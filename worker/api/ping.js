// Consent Resolve — first-party presence heartbeat.
//
// The site pings this every ~20s while a tab is visible. We upsert one row per
// visitor id with the current path + last_seen, plus the IP + coarse geo that
// Cloudflare attaches to the request (server-side; no client change). Powers
// Site Spy's real-time "on the site now". Shown only inside the CRM-gated
// dashboard. NOTE: IP is personal data — set CRW/CR presence to location-only by
// blanking the ip capture below if you want to drop it.
import { json } from "../_lib/http.js";

let _presenceReady = false;
async function ensurePresence(env) {
  if (_presenceReady) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS presence (vid TEXT PRIMARY KEY, path TEXT, last_seen TEXT, ip TEXT, country TEXT, region TEXT, city TEXT)").run();
  for (const col of ["ip TEXT", "country TEXT", "region TEXT", "city TEXT"]) {
    try { await env.DB.prepare(`ALTER TABLE presence ADD COLUMN ${col}`).run(); } catch (_) {}
  }
  _presenceReady = true;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ ok: true });
    const b = await request.json().catch(() => ({}));
    const vid = String(b.vid || "").slice(0, 40);
    if (!vid) return json({ ok: true });
    const path = String(b.path || "").slice(0, 200);
    const ip = (request.headers.get("CF-Connecting-IP") || "").slice(0, 45);
    const cf = request.cf || {};
    const country = String(cf.country || "").slice(0, 4);
    const region = String(cf.region || cf.regionCode || "").slice(0, 60);
    const city = String(cf.city || "").slice(0, 80);
    await ensurePresence(env);
    await env.DB.prepare(
      "INSERT INTO presence (vid, path, last_seen, ip, country, region, city) VALUES (?,?,?,?,?,?,?) " +
      "ON CONFLICT(vid) DO UPDATE SET path=excluded.path, last_seen=excluded.last_seen, ip=excluded.ip, country=excluded.country, region=excluded.region, city=excluded.city"
    ).bind(vid, path, new Date().toISOString(), ip, country, region, city).run();
    return json({ ok: true });
  } catch (_) {
    return json({ ok: true });
  }
}
