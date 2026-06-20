// X / Twitter connection status — /api/x-status?key=<FEEDBACK_KEY>  (GET, key-gated)
// Reports whether the OAuth2 app creds + refresh token are configured, whether a
// live token refresh actually succeeds (the real test), and the last published X
// post from the queue. X posting runs in the Cron Worker (LAUNCH_PLATFORMS), gated
// by SOCIAL_AUTOPOST_ENABLED === "true".
import { json } from "../_lib/http.js";

async function storedRefresh(env) {
  try {
    const r = await env.DB.prepare("SELECT refresh_token, updated_at FROM social_tokens WHERE provider = 'x'").first();
    return r || null;
  } catch { return null; }
}

// Try the refresh-token grant exactly like publish.js does — proves the creds work.
async function probeRefresh(env, refresh) {
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET || !refresh) return "missing_credentials";
  try {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`),
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: env.X_CLIENT_ID }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.access_token) return "live — refresh succeeded (token rotated)";
    return `FAILED (${res.status}): ${data.error || data.error_description || "no access_token"}`;
  } catch (e) { return "error: " + e; }
}

export async function onRequestGet({ request, env }) {
  if (!env.FEEDBACK_KEY || new URL(request.url).searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });

  const stored = await storedRefresh(env);
  const refresh = (stored && stored.refresh_token) || env.X_REFRESH_TOKEN;

  let last = null, published = null;
  try {
    last = await env.DB.prepare(
      "SELECT MAX(published_at) AS last FROM social_queue WHERE platform = 'x' AND status = 'published'").first();
    published = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM social_queue WHERE platform = 'x' AND status = 'published'").first();
  } catch { /* table may not exist yet */ }

  return json({
    in_launch_platforms: true,            // x is in LAUNCH_PLATFORMS (publish.js)
    autopost_enabled: env.SOCIAL_AUTOPOST_ENABLED === "true",
    client_id: env.X_CLIENT_ID ? "configured" : "missing",
    client_secret: env.X_CLIENT_SECRET ? "configured" : "missing",
    refresh_token: refresh ? (stored?.refresh_token ? "stored in D1 (rotated)" : "from env seed") : "missing",
    refresh_token_updated_at: stored?.updated_at || null,
    token_check: await probeRefresh(env, refresh),
    published_count: published?.c ?? 0,
    last_published_at: last?.last || null,
  });
}
