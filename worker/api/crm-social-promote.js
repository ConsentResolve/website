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

// CRM session (UI) OR ?key=<FEEDBACK_KEY> (so the actuator scripts — meta_campaign.py,
// run_scheduler.py — can read the queue + mark items launched from GitHub Actions/CLI).
async function authed(request, env) {
  if (await crmAuthed(request, env)) return true;
  const k = new URL(request.url).searchParams.get("key");
  return !!(env.FEEDBACK_KEY && k === env.FEEDBACK_KEY);
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await authed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureTable(env);
  const u = new URL(request.url);
  const mode = u.searchParams.get("mode");        // paid | organic
  const status = u.searchParams.get("status");    // queued | launched | ...
  let sql = "SELECT * FROM social_promote_queue", binds = [], where = [];
  if (mode) { where.push("mode=?"); binds.push(mode); }
  if (status) { where.push("status=?"); binds.push(status); }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY created_at DESC LIMIT 100";
  const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
  return json({ queue: rows }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await authed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureTable(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (b.mark && b.id) {  // actuator marks an item launched/boosted so it isn't re-processed
    await env.DB.prepare("UPDATE social_promote_queue SET status=? WHERE id=?").bind(String(b.status || "launched"), b.id).run();
    return json({ ok: true, id: b.id, status: b.status || "launched" }, {}, cors);
  }
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
