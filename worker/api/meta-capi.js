// Meta Conversions API (server-side Lead event) — CONSENT-RESPECTING.
// This endpoint is called by DemoForm ONLY after the consent-gated Meta Pixel has fired its
// browser Lead event (same event_id → Meta dedupes). It therefore mirrors a *consented* event
// for better match quality + reliability; it NEVER sends a conversion for a visitor who didn't
// consent to the Facebook Pixel service. Inert until META_CAPI_TOKEN (or META_ACCESS_TOKEN) set.
import { json, corsHeaders } from "../_lib/http.js";

const GRAPH = "https://graph.facebook.com/v21.0";

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const pixel = env.META_PIXEL_ID || "1611275646787663";
  const token = env.META_CAPI_TOKEN || env.META_ACCESS_TOKEN;
  if (!token) return json({ ok: false, error: "no_token" }, {}, cors);
  let b = {};
  try { b = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }
  const email = String(b.email || "").trim().toLowerCase();
  if (!email || !b.event_id) return json({ ok: false, error: "missing" }, { status: 400 }, cors);

  const userData = { em: [await sha256(email)] };
  const ua = request.headers.get("user-agent");
  const ip = request.headers.get("cf-connecting-ip");
  if (ua) userData.client_user_agent = ua;
  if (ip) userData.client_ip_address = ip;
  if (b.fbp) userData.fbp = b.fbp;
  if (b.fbc) userData.fbc = b.fbc;

  const payload = {
    data: [{
      event_name: "Lead",
      event_time: Math.floor(Date.now() / 1000),
      event_id: String(b.event_id), // dedupes against the browser pixel's eventID
      action_source: "website",
      event_source_url: b.event_source_url || undefined,
      user_data: userData,
    }],
  };
  try {
    const res = await fetch(GRAPH + "/" + pixel + "/events?access_token=" + encodeURIComponent(token), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    let j = {}; try { j = await res.json(); } catch (_) {}
    return json({ ok: res.ok, received: j.events_received || 0, error: j.error ? (j.error.message || "") : null }, {}, cors);
  } catch (err) {
    return json({ ok: false, error: String(err).slice(0, 120) }, {}, cors);
  }
}
