// Booking tool for the Mack chat agent (Retell custom functions call these).
//   POST /api/chat-book/times                        -> { times:[{label,iso}] }  (next open demo slots)
//   POST /api/chat-book/create {start_iso,email,phone,name,website,ad_spend,trade}
//        -> { ok, when } or { ok:false, reason }
// Wraps the existing native booking (/api/booking/*) so Mack books the SAME calendar, and stamps
// the website/ad-spend the visitor gave. Public (no auth) — same as the booking widget path.
import { json, corsHeaders } from "../_lib/http.js";
import * as booking from "./booking.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

async function readBody(request) { try { return await request.json(); } catch { return {}; } }

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const url = new URL(request.url);
  const origin = url.origin;
  const path = url.pathname;

  // ---- next open demo times ----
  if (path === "/api/chat-book/times") {
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 16 * 86400000).toISOString().slice(0, 10);
    let days = [];
    try {
      // Call the booking slots handler IN-PROCESS (a self-fetch to our own hostname returns empty).
      const slotReq = new Request(`${origin}/api/booking/slots?start=${start}&end=${end}`, { headers: { Accept: "application/json" } });
      const res = await booking.onRequestGet({ request: slotReq, env });
      const j = await res.json();
      days = Array.isArray(j.days) ? j.days : [];
    } catch (_) {}
    // Flatten to the next 6 slots across days so Mack can offer a few concrete options.
    const times = [];
    for (const d of days) { for (const s of (d.slots || [])) { times.push({ label: `${d.label} at ${s.time}`, iso: s.iso }); if (times.length >= 6) break; } if (times.length >= 6) break; }
    if (!times.length) return json({ times: [], note: "No open times in the next two weeks — offer the phone number (727) 999-9846." }, {}, cors);
    return json({ times, timezone: "America/Chicago" }, {}, cors);
  }

  // ---- book a demo ----
  if (path === "/api/chat-book/create") {
    const b = await readBody(request);
    const startIso = String(b.start_iso || b.startIso || "").trim();
    const email = String(b.email || "").trim();
    const phone = String(b.phone || b.mobile || "").trim();
    if (!startIso) return json({ ok: false, reason: "need_time", say: "Which of those times works? I need the exact slot to book it." }, {}, cors);
    if (!email) return json({ ok: false, reason: "need_email", say: "What email should I send the calendar invite to?" }, {}, cors);
    if (!phone) return json({ ok: false, reason: "need_phone", say: "And the best mobile number for a text reminder?" }, {}, cors);

    const payload = {
      startIso, email, phone,
      name: String(b.name || "").trim() || undefined,
      website: String(b.website || "").trim() || undefined,
      trade: String(b.trade || "").trim() || undefined,
      traffic: String(b.ad_spend || b.adSpend || "").trim() || undefined,   // stash their ad-spend answer on the booking
      leadSources: ["Site chat (Mack)"],
      utm: { utm_source: "chat", utm_medium: "mack" },
    };
    try {
      const createReq = new Request(`${origin}/api/booking/create`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const res = await booking.onRequestPost({ request: createReq, env });
      const j = await res.json();
      if (j && j.ok) return json({ ok: true, when: startIso, say: "You're booked — I've sent a calendar invite and a text reminder. Anything else I can help with?" }, {}, cors);
      if (j && j.reason === "slot_taken") return json({ ok: false, reason: "slot_taken", say: "That time was just taken — want me to grab the next opening?" }, {}, cors);
      return json({ ok: false, reason: (j && j.reason) || "error", say: "I couldn't lock that in just now — you can also call or text (727) 999-9846 and we'll set it up." }, {}, cors);
    } catch (_) {
      return json({ ok: false, reason: "network", say: "Something hiccupped booking that — try again in a moment, or call (727) 999-9846." }, {}, cors);
    }
  }

  return json({ error: "not_found" }, { status: 404 }, cors);
}
