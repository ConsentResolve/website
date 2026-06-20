// X tweet metrics — /api/x-metrics?key=<FEEDBACK_KEY>  (GET, key-gated)
// Fetches public_metrics (impressions, likes) for our PUBLISHED tweets, so the
// dashboard can show X views alongside fb/ig/yt/tk. X view data has no separate
// API for us — it lives on each tweet — so we read it from the tweets we posted.
// fetch_metrics.py calls this on the 6h cadence and merges the rows into metrics.json.
import { json } from "../_lib/http.js";
import { nowIso } from "../_lib/db.js";

async function getRow(env) {
  try { return await env.DB.prepare(
    "SELECT access_token, refresh_token, expires_at FROM social_tokens WHERE provider='x'").first(); }
  catch { return null; }
}
async function save(env, { access_token, refresh_token, expires_at }) {
  await env.DB.prepare(
    `INSERT INTO social_tokens (provider, access_token, refresh_token, expires_at, updated_at)
     VALUES ('x', ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET access_token=excluded.access_token,
       refresh_token=COALESCE(excluded.refresh_token, social_tokens.refresh_token),
       expires_at=excluded.expires_at, updated_at=excluded.updated_at`)
    .bind(access_token || null, refresh_token || null, expires_at || null, nowIso()).run();
}
// Reuse the stored access token while valid; only refresh (rotate+persist) when expired.
async function accessToken(env) {
  const row = await getRow(env);
  if (row?.access_token && row.expires_at && new Date(row.expires_at) > new Date(Date.now() + 60000))
    return row.access_token;
  const refresh = row?.refresh_token || env.X_REFRESH_TOKEN;
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET || !refresh) return null;
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`) },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, client_id: env.X_CLIENT_ID }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) return null;
  await save(env, { access_token: data.access_token, refresh_token: data.refresh_token || refresh,
    expires_at: new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString() });
  return data.access_token;
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });

  let pub = [];
  try {
    const r = await env.DB.prepare(
      "SELECT resource_slug, post_id, post_url FROM social_queue WHERE platform='x' AND status='published' AND post_id IS NOT NULL ORDER BY published_at DESC LIMIT 100").all();
    pub = r.results || [];
  } catch { /* table missing */ }
  if (!pub.length) return json({ rows: [], note: "no published x tweets yet" });

  const tok = await accessToken(env);
  if (!tok) return json({ rows: [], error: "x_token_unavailable" });

  const byId = {}; pub.forEach((p) => { byId[p.post_id] = p; });
  const ids = pub.map((p) => p.post_id).filter(Boolean).slice(0, 100);
  const rows = [];
  try {
    const res = await fetch(`https://api.twitter.com/2/tweets?ids=${ids.join(",")}&tweet.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${tok}` } });
    const data = await res.json().catch(() => ({}));
    if (data.errors && !data.data) return json({ rows: [], error: data.errors[0]?.detail || "x_api_error" });
    for (const t of (data.data || [])) {
      const m = t.public_metrics || {}; const p = byId[t.id] || {};
      rows.push({ name: p.resource_slug || t.id, platform: "x",
        views: m.impression_count ?? null, likes: m.like_count ?? null,
        url: p.post_url || `https://x.com/i/web/status/${t.id}` });
    }
  } catch (e) { return json({ rows: [], error: String(e) }); }
  return json({ rows });
}
