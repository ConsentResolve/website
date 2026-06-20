// Lightweight first-party pageview beacon — /api/hit
//   POST { path, utm_source?, utm_campaign?, ref? }  (no PII; path + attribution only)
// Powers the "Clicks" KPI (landings on /demo) + per-source click attribution.
// Self-initializes the `traffic` table on the existing D1 binding (env.DB).
import { json, corsHeaders } from "../_lib/http.js";

async function ensure(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS traffic (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       path TEXT, utm_source TEXT, utm_campaign TEXT, ref TEXT,
       created_at TEXT DEFAULT (datetime('now'))
     )`
  ).run();
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: {
    ...corsHeaders(request, env), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false }); }
  await ensure(env);
  const s = (v, n) => (v || "").toString().slice(0, n);
  await env.DB.prepare("INSERT INTO traffic (path, utm_source, utm_campaign, ref, created_at) VALUES (?,?,?,?,?)")
    .bind(s(b.path, 200), s(b.utm_source, 60), s(b.utm_campaign, 80), s(b.ref, 200), new Date().toISOString()).run();
  return json({ ok: true });
}
