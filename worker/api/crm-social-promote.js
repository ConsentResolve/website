// Score → Promote loop. Flag a high-scoring creative for promotion so winners get
// amplified instead of just observed. Two modes:
//   paid    — queue it to be pushed into a Meta ad (meta_campaign.py reads this queue)
//   organic — queue it to be re-posted more often (the scheduler reads this queue)
//   GET  /api/crm/social/promote            -> { queue:[...] }
//   POST /api/crm/social/promote {name,platform,mode}        -> flag (idempotent per name+mode)
//   POST /api/crm/social/promote {remove:true, id}           -> unflag
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";

async function ensureTable(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS social_promote_queue (id TEXT PRIMARY KEY, name TEXT, platform TEXT, mode TEXT, status TEXT DEFAULT 'queued', created_at TEXT)").run();
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureTable(env);
  const rows = (await env.DB.prepare("SELECT * FROM social_promote_queue ORDER BY created_at DESC LIMIT 100").all()).results || [];
  return json({ queue: rows }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureTable(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (b.remove && b.id) {
    await env.DB.prepare("DELETE FROM social_promote_queue WHERE id=?").bind(b.id).run();
    return json({ ok: true, removed: b.id }, {}, cors);
  }
  const name = String(b.name || "").trim();
  if (!name) return json({ error: "name_required" }, { status: 400 }, cors);
  const mode = b.mode === "organic" ? "organic" : "paid";
  const ex = await env.DB.prepare("SELECT id FROM social_promote_queue WHERE name=? AND mode=?").bind(name, mode).first();
  if (ex) return json({ ok: true, already: true, id: ex.id }, {}, cors);
  const id = "pq_" + name.replace(/[^a-z0-9]/gi, "").slice(0, 20) + "_" + mode + "_" + (name.length);
  await env.DB.prepare("INSERT INTO social_promote_queue (id, name, platform, mode, status, created_at) VALUES (?,?,?,?, 'queued', datetime('now'))")
    .bind(id, name, b.platform || null, mode).run();
  return json({ ok: true, id }, {}, cors);
}
