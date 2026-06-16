// Reel delete-queue API — /api/queue
//   POST { name, action?: "delete"|"restore", author? }
//        action "delete" (default) -> queue the reel for deletion
//        action "restore"           -> remove it from the queue (undo)
//   GET  -> { count, queued:[names], rows:[...] }  (public; names aren't sensitive)
// Nothing is actually deleted from R2 here — this only records intent. The hard
// delete is run out-of-band once the queue is reviewed. Self-inits its table on
// the existing D1 binding (env.DB), same pattern as /api/feedback.
import { json, corsHeaders } from "../_lib/http.js";

async function ensure(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS delete_queue (
       name TEXT PRIMARY KEY,
       author TEXT,
       created_at TEXT DEFAULT (datetime('now'))
     )`
  ).run();
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(request, env), "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }); }
  const name = (b.name || "").toString().slice(0, 120);
  const action = (b.action || "delete").toString();
  const author = (b.author || "").toString().slice(0, 80);
  if (!name) return json({ error: "missing_name" }, { status: 400 });
  await ensure(env);
  if (action === "restore") {
    await env.DB.prepare("DELETE FROM delete_queue WHERE name = ?").bind(name).run();
    return json({ ok: true, queued: false });
  }
  await env.DB.prepare("INSERT OR REPLACE INTO delete_queue (name, author) VALUES (?, ?)").bind(name, author).run();
  return json({ ok: true, queued: true });
}

export async function onRequestGet({ env }) {
  await ensure(env);
  const { results } = await env.DB.prepare(
    "SELECT name, author, created_at FROM delete_queue ORDER BY created_at DESC"
  ).all();
  return json({ count: results.length, queued: results.map((r) => r.name), rows: results });
}
