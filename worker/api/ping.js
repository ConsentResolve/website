// Consent Resolve — first-party presence heartbeat (no PII).
//
// The site pings this every ~20s while a tab is visible. We upsert one row per
// visitor id with the current path + last_seen, so Site Spy's "on the site now"
// reflects who is actually present — not just whoever last loaded a page.
// First-party, path + anonymous vid only (same privacy posture as /api/hit).
import { json } from "../_lib/http.js";

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
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS presence (vid TEXT PRIMARY KEY, path TEXT, last_seen TEXT)").run();
    await env.DB.prepare(
      "INSERT INTO presence (vid, path, last_seen) VALUES (?,?,?) ON CONFLICT(vid) DO UPDATE SET path=excluded.path, last_seen=excluded.last_seen"
    ).bind(vid, path, new Date().toISOString()).run();
    return json({ ok: true });
  } catch (_) {
    return json({ ok: true });
  }
}
