// X / Twitter connection status — /api/x-status?key=<FEEDBACK_KEY>  (GET, key-gated)
// Reports whether the OAuth2 app creds + refresh token are configured, the X queue
// breakdown (why it may not be posting), and the last published X post. X posting
// runs in the Cron Worker (LAUNCH_PLATFORMS), gated by SOCIAL_AUTOPOST_ENABLED.
//
// Add &refresh=1 to actually exercise the refresh-token grant. IMPORTANT: X rotates
// the refresh token on every use (single-use), so this persists the rotated token to
// D1 (social_tokens) — exactly like the cron does — to avoid invalidating it. Without
// &refresh=1 the probe is read-only and never touches the token.
import { json } from "../_lib/http.js";
import { nowIso } from "../_lib/db.js";

async function getRow(env) {
  try { return await env.DB.prepare(
    "SELECT refresh_token, expires_at, updated_at FROM social_tokens WHERE provider = 'x'").first(); }
  catch { return null; }
}
async function save(env, { access_token, refresh_token, expires_at }) {
  await env.DB.prepare(
    `INSERT INTO social_tokens (provider, access_token, refresh_token, expires_at, updated_at)
     VALUES ('x', ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, social_tokens.refresh_token),
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`)
    .bind(access_token || null, refresh_token || null, expires_at || null, nowIso()).run();
}

// Live refresh + PERSIST the rotated token (X refresh tokens are single-use).
async function refreshAndPersist(env, refresh) {
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
    if (res.ok && data.access_token) {
      await save(env, {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refresh,
        expires_at: new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString(),
      });
      return "live — refresh succeeded; rotated token persisted to D1";
    }
    return `FAILED (${res.status}): ${data.error || data.error_description || "no access_token"} — re-auth needed`;
  } catch (e) { return "error: " + e; }
}

async function queueCounts(env) {
  try {
    const r = await env.DB.prepare(
      "SELECT status, COUNT(*) AS c FROM social_queue WHERE platform = 'x' GROUP BY status").all();
    const out = {};
    for (const row of (r.results || [])) out[row.status] = row.c;
    return out;
  } catch { return null; }
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });

  const row = await getRow(env);
  const refresh = (row && row.refresh_token) || env.X_REFRESH_TOKEN;

  let token_check = "not run — add &refresh=1 to test (rotates the X token; persisted to D1)";
  if (u.searchParams.get("refresh") === "1") token_check = await refreshAndPersist(env, refresh);

  let last = null;
  try { last = await env.DB.prepare(
    "SELECT MAX(published_at) AS last FROM social_queue WHERE platform = 'x' AND status = 'published'").first(); }
  catch { /* table may not exist */ }

  return json({
    in_launch_platforms: true,
    autopost_enabled: env.SOCIAL_AUTOPOST_ENABLED === "true",
    client_id: env.X_CLIENT_ID ? "configured" : "missing",
    client_secret: env.X_CLIENT_SECRET ? "configured" : "missing",
    refresh_token: refresh ? (row && row.refresh_token ? "stored in D1 (rotated)" : "from env seed only") : "missing",
    refresh_token_updated_at: (row && row.updated_at) || null,
    token_check,
    x_queue: await queueCounts(env),   // why it posts or not: needs ready_to_publish rows
    last_published_at: last?.last || null,
  });
}
