// worker/api/booking.js — native demo-booking backend (Cal.com v2 proxy + D1 analytics).
// Routes (registered in worker/index.js at these exact paths):
//   GET  /api/booking/slots?start=YYYY-MM-DD&end=YYYY-MM-DD  -> { days:[{date,label,slotCount,slots:[{time,iso}]}] }
//   POST /api/booking/create  { startIso,name,company,website,phone,email,trade,traffic,leadSources[],utm }
//   POST /api/booking/event   { event, step, sessionId, meta }   (per-step funnel analytics → D1)
//   GET  /api/booking/ics?uid=...                               (.ics for "Add to my calendar")
//
// The Cal.com API key NEVER reaches the browser — every Cal call goes through here. The whole
// thing is inert-graceful until CALCOM_API_KEY + CALCOM_EVENT_TYPE_ID are set (slots returns an
// empty, `_configured:false` payload so the widget shows its phone-number fallback).
import { json, corsHeaders, clientIp } from "../_lib/http.js";

const CAL = "https://api.cal.com/v2";
const CAL_VER = "2024-08-13"; // REQUIRED — omitting it silently falls back to an older API version
const TZ = "America/Chicago";

// ---- Cal.com client -------------------------------------------------------
async function calFetch(env, path, opts = {}) {
  const key = env.CALCOM_API_KEY;
  if (!key) return { _noKey: true };
  let r, j = {};
  try {
    r = await fetch(CAL + path, {
      ...opts,
      headers: { Authorization: "Bearer " + key, "cal-api-version": CAL_VER, "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    try { j = await r.json(); } catch (_) {}
    return { ok: r.ok, status: r.status, body: j };
  } catch (e) {
    return { ok: false, status: 0, body: { error: String(e).slice(0, 120) } };
  }
}

// ---- D1 schema ------------------------------------------------------------
async function ensureBookingSchema(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS booking_events (
       id TEXT PRIMARY KEY, session_id TEXT, event TEXT, step TEXT, meta_json TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now')))`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bev_session ON booking_events(session_id, created_at)`).run().catch(() => {});
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS bookings (
       id TEXT PRIMARY KEY, uid TEXT, session_id TEXT, name TEXT, company TEXT, website TEXT,
       phone TEXT, email TEXT, trade TEXT, traffic TEXT, lead_sources TEXT, start_iso TEXT,
       utm_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`
  ).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_uid ON bookings(uid)`).run().catch(() => {});
}

// ---- normalization (also unit-tested in worker/api/__tests__/booking.test.js) ----
export function normWebsite(w) {
  const t = String(w == null ? "" : w).trim();
  if (!t) return null;                                   // only reject empty/whitespace
  let d = t.replace(/^\s*https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/g, "").replace(/\s+/g, "").toLowerCase();
  if (!d) return null;
  return "https://" + d;                                 // don't strict-validate; silently fix
}
export function normPhoneE164(p) {
  const d = String(p == null ? "" : p).replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d[0] === "1") return "+" + d;
  if (d.length >= 11) return "+" + d;
  return "+1" + d;                                        // best-effort default country
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2));
const clean = (s) => String(s == null ? "" : s).trim();

// ---- time formatting (America/Chicago) ------------------------------------
function fmtTime(iso) {
  try { return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso)); }
  catch (_) { return ""; }
}
function fmtDayLabel(dateStr) {
  try {
    const d = new Date(dateStr + "T12:00:00Z");
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ }).format(d);
  } catch (_) { return dateStr; }
}
// The Chicago calendar date for a UTC instant (so a 7pm-CT slot lands on the right day strip).
function chicagoDate(iso) {
  try {
    const p = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ }).formatToParts(new Date(iso));
    const g = (t) => (p.find((x) => x.type === t) || {}).value;
    return `${g("year")}-${g("month")}-${g("day")}`;
  } catch (_) { return (iso || "").slice(0, 10); }
}

// ---- handlers -------------------------------------------------------------
export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  const url = new URL(request.url);
  const path = url.pathname;

  // ---- /api/booking/slots ----
  if (path === "/api/booking/slots") {
    const start = (url.searchParams.get("start") || "").slice(0, 10);
    const end = (url.searchParams.get("end") || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return json({ days: [], error: "bad_range" }, { status: 400 }, cors);
    }
    // 60s edge cache keyed by the range, so the day strip stays snappy.
    const cache = caches.default;
    const cacheKey = new Request(url.origin + "/api/booking/slots?start=" + start + "&end=" + end, request);
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const res = await calFetch(env, `/slots?eventTypeId=${encodeURIComponent(env.CALCOM_EVENT_TYPE_ID || "")}` +
      `&startTime=${start}T00:00:00.000Z&endTime=${end}T23:59:59.999Z&timeZone=${encodeURIComponent(TZ)}`);
    if (res._noKey) return json({ days: [], _configured: false }, {}, cors);
    if (!res.ok) {
      const dbg = url.searchParams.get("debug") === "1"
        ? { _status: res.status, _body: res.body } : {};
      return json({ days: [], error: "slots_failed", ...dbg }, {}, cors);
    }

    // v2 /slots returns data keyed by date OR a flat array — handle both.
    const data = (res.body && res.body.data) || {};
    const byDay = new Map();
    const push = (iso) => {
      if (!iso) return;
      const day = chicagoDate(iso);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push({ iso, time: fmtTime(iso) });
    };
    if (Array.isArray(data)) data.forEach((s) => push(s.start || s.time));
    else for (const k of Object.keys(data)) (data[k] || []).forEach((s) => push((s && (s.start || s.time)) || (typeof s === "string" ? s : null)));

    const days = [...byDay.keys()].sort().map((date) => {
      const slots = byDay.get(date).sort((a, b) => a.iso.localeCompare(b.iso));
      return { date, label: fmtDayLabel(date), slotCount: slots.length, slots };
    }).filter((d) => d.slotCount > 0);

    const out = json({ days }, {}, cors);
    const cached = new Response(out.body, out);
    cached.headers.set("Cache-Control", "public, max-age=60");
    await cache.put(cacheKey, cached.clone());
    return cached;
  }

  // ---- /api/booking/ics ----
  if (path === "/api/booking/ics") {
    const u = url.searchParams.get("uid");
    if (!u) return new Response("missing uid", { status: 400 });
    await ensureBookingSchema(env);
    const b = await env.DB.prepare("SELECT * FROM bookings WHERE uid=? ORDER BY created_at DESC LIMIT 1").bind(u).first().catch(() => null);
    if (!b || !b.start_iso) return new Response("not found", { status: 404 });
    const ics = buildIcs(b);
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="consent-resolve-demo.ics"',
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response("not found", { status: 404 });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const url = new URL(request.url);
  const path = url.pathname;

  // ---- /api/booking/event (analytics beacon) ----
  if (path === "/api/booking/event") {
    let b = {};
    try { b = await request.json(); } catch (_) {}
    if (!b || !b.event) return json({ ok: false }, { status: 400 }, cors);
    try {
      await ensureBookingSchema(env);
      await env.DB.prepare(
        "INSERT INTO booking_events (id, session_id, event, step, meta_json, created_at) VALUES (?,?,?,?,?,datetime('now'))"
      ).bind(uid(), clean(b.sessionId).slice(0, 60), clean(b.event).slice(0, 40), clean(b.step).slice(0, 40), b.meta ? JSON.stringify(b.meta).slice(0, 2000) : null).run();
    } catch (_) {}
    return json({ ok: true }, {}, cors);
  }

  // ---- /api/booking/create ----
  if (path === "/api/booking/create") {
    // Generous per-IP rate limit (no captcha). Best-effort; never blocks a real user.
    let b = {};
    try { b = await request.json(); } catch (_) { return json({ ok: false, reason: "bad_json" }, { status: 400 }, cors); }

    const name = clean(b.name), email = clean(b.email);
    const website = normWebsite(b.website), phone = normPhoneE164(b.phone);
    const startIso = clean(b.startIso);
    if (!name || !website || !phone || !email || !startIso) {
      return json({ ok: false, reason: "missing_fields" }, { status: 400 }, cors);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, reason: "bad_email" }, { status: 400 }, cors);

    await ensureBookingSchema(env);
    if (await tooManyRecent(env, request)) return json({ ok: false, reason: "rate_limited" }, { status: 429 }, cors);

    if (!env.CALCOM_API_KEY || !env.CALCOM_EVENT_TYPE_ID) {
      return json({ ok: false, reason: "not_configured" }, { status: 503 }, cors);
    }

    const company = clean(b.company);
    const leadSources = Array.isArray(b.leadSources) ? b.leadSources.map(clean).filter(Boolean) : [];
    const utm = b.utm || {};
    const meta = {
      trade: clean(b.trade), traffic: clean(b.traffic), leadSources: leadSources.join("|"),
      website, company,
      utm_source: clean(utm.utm_source || utm.source), utm_medium: clean(utm.utm_medium || utm.medium), utm_campaign: clean(utm.utm_campaign || utm.campaign),
    };
    const payload = {
      eventTypeId: Number(env.CALCOM_EVENT_TYPE_ID),
      start: startIso,
      attendee: { name, email, phoneNumber: phone, timeZone: TZ, language: "en" },
      metadata: meta,
    };

    let res = await calFetch(env, "/bookings", { method: "POST", body: JSON.stringify(payload) });
    // Known Cal.com quirk: some configs 400 demanding `title` despite the docs. Retry once.
    if (!res.ok && res.status === 400 && JSON.stringify(res.body || {}).toLowerCase().includes("title")) {
      payload.title = "Consent Resolve demo — " + (company || name);
      res = await calFetch(env, "/bookings", { method: "POST", body: JSON.stringify(payload) });
    }
    if (!res.ok) {
      const blob = JSON.stringify(res.body || {}).toLowerCase();
      const reason = (res.status === 409 || blob.includes("no longer available") || blob.includes("already booked") || blob.includes("slot")) ? "slot_taken" : "api_error";
      return json({ ok: false, reason }, {}, cors);
    }
    const bk = (res.body && (res.body.data || res.body)) || {};
    const bUid = bk.uid || (bk.booking && bk.booking.uid) || uid();

    try {
      await env.DB.prepare(
        `INSERT INTO bookings (id, uid, session_id, name, company, website, phone, email, trade, traffic, lead_sources, start_iso, utm_json, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
      ).bind(uid(), bUid, clean(b.sessionId).slice(0, 60), name, company || null, website, phone, email,
        meta.trade || null, meta.traffic || null, meta.leadSources || null, startIso, JSON.stringify(utm || {})).run();
    } catch (_) {}

    return json({ ok: true, booking: { uid: bUid, startIso } }, {}, cors);
  }

  return json({ ok: false }, { status: 404 }, cors);
}

// Per-IP rate limit: max 8 create attempts / 10 min. Cheap indexed scan.
async function tooManyRecent(env, request) {
  try {
    const ip = clientIp(request);
    if (!ip) return false;
    const r = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM booking_events WHERE event='rl_create' AND meta_json=? AND created_at >= datetime('now','-10 minutes')"
    ).bind(ip).first();
    await env.DB.prepare("INSERT INTO booking_events (id, session_id, event, step, meta_json, created_at) VALUES (?,?,?,?,?,datetime('now'))")
      .bind(uid(), null, "rl_create", null, ip).run().catch(() => {});
    return r && Number(r.n) >= 8;
  } catch (_) { return false; }
}

// ---- ICS builder ----------------------------------------------------------
function buildIcs(b) {
  const dt = (iso) => { try { return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); } catch (_) { return ""; } };
  const start = dt(b.start_iso);
  const end = dt(new Date(new Date(b.start_iso).getTime() + 15 * 60 * 1000).toISOString());
  const stamp = dt(new Date().toISOString());
  const esc = (s) => String(s == null ? "" : s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const desc = "Your Consent Resolve demo. We'll send your video link by text before the call. Questions? Call (727) 999-9846.";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Consent Resolve//Demo//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:" + esc(b.uid) + "@consentresolve.com",
    "DTSTAMP:" + stamp,
    "DTSTART:" + start,
    "DTEND:" + end,
    "SUMMARY:Consent Resolve demo",
    "DESCRIPTION:" + esc(desc),
    "LOCATION:Online (video link by text)",
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Consent Resolve demo in 30 minutes", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
