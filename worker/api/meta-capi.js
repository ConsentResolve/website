// Meta Conversions API (server-side events) — CONSENT-RESPECTING for browser conversions.
// The /api/meta-capi endpoint is called by DemoForm / BookMeeting ONLY after the consent-gated
// Meta Pixel has fired its browser Lead event (same event_id → Meta dedupes). It therefore
// mirrors a *consented* event for better match quality; it NEVER sends a conversion for a
// visitor who didn't consent to the Facebook Pixel service.
//
// sendCapi() is also reused server-side (e.g. the Cal.com booking webhook fires a `Schedule`).
// Those webhook events are first-party conversions the user initiated (they booked a meeting
// with their own email); there's no browser to read consent from at webhook time.
//
// Inert until META_CAPI_TOKEN (or META_ACCESS_TOKEN) is set. Set META_CAPI_TEST_CODE (or pass
// testCode) to route events to Events Manager → Test Events for live verification.
import { json, corsHeaders } from "../_lib/http.js";

const GRAPH = "https://graph.facebook.com/v21.0";

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Send one server-side event to the Conversions API. Reusable by the HTTP endpoint and by
// other server code (webhooks). Returns { ok, received, error, test }.
export async function sendCapi(env, opts) {
  const {
    eventName, eventId, email, phone, eventSourceUrl,
    fbp, fbc, ua, ip, actionSource = "website", testCode,
    value, currency, // Purchase value (number) + ISO currency (e.g. "USD")
  } = opts || {};
  // Default to the ad-account pixel so server events land where the ads optimize. Overridable
  // via META_PIXEL_ID (set in wrangler.jsonc vars).
  const pixel = env.META_PIXEL_ID || "1045574481147406";
  const token = env.META_CAPI_TOKEN || env.META_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "no_token" };
  if (!eventName || !eventId) return { ok: false, error: "missing_event" };

  const userData = {};
  if (email) userData.em = [await sha256(String(email).trim().toLowerCase())];
  if (phone) { const d = String(phone).replace(/[^\d]/g, ""); if (d) userData.ph = [await sha256(d)]; }
  if (ua) userData.client_user_agent = ua;
  if (ip) userData.client_ip_address = ip;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: String(eventId),   // dedupes against a matching browser Pixel event
    action_source: actionSource,
    user_data: userData,
  };
  if (eventSourceUrl) event.event_source_url = eventSourceUrl;
  // custom_data carries conversion value (e.g. Purchase) so Meta can optimize toward revenue.
  if (value != null && Number.isFinite(Number(value))) {
    event.custom_data = { value: Number(value), currency: (currency || "USD") };
  }

  const payload = { data: [event] };
  // Test-events routing: env var (persistent while testing) or a per-call override. When set,
  // the event shows up in Events Manager → Test Events so you can confirm delivery live.
  const test = testCode || env.META_CAPI_TEST_CODE || null;
  if (test) payload.test_event_code = test;

  try {
    const res = await fetch(GRAPH + "/" + pixel + "/events?access_token=" + encodeURIComponent(token), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    let j = {}; try { j = await res.json(); } catch (_) {}
    return { ok: res.ok, received: j.events_received || 0, error: j.error ? (j.error.message || "") : null, test: !!test };
  } catch (err) {
    return { ok: false, error: String(err).slice(0, 120) };
  }
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const token = env.META_CAPI_TOKEN || env.META_ACCESS_TOKEN;
  if (!token) return json({ ok: false, error: "no_token" }, {}, cors);
  let b = {};
  try { b = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }
  const email = String(b.email || "").trim().toLowerCase();
  if (!email || !b.event_id) return json({ ok: false, error: "missing" }, { status: 400 }, cors);

  const r = await sendCapi(env, {
    eventName: b.event_name || "Lead",
    eventId: b.event_id,
    email,
    eventSourceUrl: b.event_source_url,
    fbp: b.fbp, fbc: b.fbc,
    ua: request.headers.get("user-agent"),
    ip: request.headers.get("cf-connecting-ip"),
    actionSource: "website",
    testCode: b.test_event_code,   // allow a manual test send to be routed to Test Events
  });
  return json(r, {}, cors);
}
