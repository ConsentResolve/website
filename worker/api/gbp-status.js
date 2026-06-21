// Google Business Profile connection status — /api/gbp-status?key=<FEEDBACK_KEY>  (GET, key-gated)
// Reports which GBP secrets are configured, whether the Google token refresh works
// (Google refresh tokens do NOT rotate, so this is safe to run repeatedly), and the
// GBP queue. postGBP needs GOOGLE_CLIENT_ID/SECRET, GOOGLE_REFRESH_TOKEN, GBP_ACCOUNT_ID,
// GBP_LOCATION_ID — any missing one yields "missing_credentials".
import { json } from "../_lib/http.js";

async function probeGoogle(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) return "missing_credentials";
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.access_token) return "live — token refresh ok";
    return `FAILED (${res.status}): ${d.error || d.error_description || "no access_token"}`;
  } catch (e) { return "error: " + e; }
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });

  let last = null, q = null;
  try { last = await env.DB.prepare(
    "SELECT MAX(published_at) AS last FROM social_queue WHERE platform='google_business_profile' AND status='published'").first(); }
  catch { /* table missing */ }
  try {
    const r = await env.DB.prepare(
      "SELECT status, COUNT(*) c FROM social_queue WHERE platform='google_business_profile' GROUP BY status").all();
    q = {}; for (const row of (r.results || [])) q[row.status] = row.c;
  } catch { /* table missing */ }

  return json({
    in_launch_platforms: true,
    autopost_enabled: env.SOCIAL_AUTOPOST_ENABLED === "true",
    google_client_id: env.GOOGLE_CLIENT_ID ? "configured" : "missing",
    google_client_secret: env.GOOGLE_CLIENT_SECRET ? "configured" : "missing",
    google_refresh_token: env.GOOGLE_REFRESH_TOKEN ? "configured" : "missing",
    gbp_account_id: env.GBP_ACCOUNT_ID ? "configured" : "missing",
    gbp_location_id: env.GBP_LOCATION_ID ? "configured" : "missing",
    token_check: await probeGoogle(env),
    gbp_queue: q,
    last_published_at: last?.last || null,
  });
}
