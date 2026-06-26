// CRM v2 — lightweight presence (BUILD-PLAN P4-1, right-sized for ~6 users).
// D1 heartbeat instead of a Durable Object: avoids a DO migration on the live site
// worker (the only deploy-risky change) and needs no WebSocket. Soft-signal only —
// "who's viewing what" — cleaned by a 35s freshness window.
//   POST /api/crm/presence { viewing }  -> upsert my heartbeat, return others active now
//   GET  /api/crm/presence              -> all active (last 35s)
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser } from "../_lib/crm-v2.js";

async function ensure(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS presence (email TEXT PRIMARY KEY, name TEXT, viewing TEXT, updated_at TEXT)").run();
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensure(env);
  const active = (await env.DB.prepare("SELECT email, name, viewing FROM presence WHERE updated_at > datetime('now','-35 seconds')").all()).results || [];
  return json({ active }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensure(env);
  const me = await currentUser(request, env);
  const email = me ? me.email : "unknown";
  const name = me ? me.name : "Someone";
  let b = {};
  try { b = await request.json(); } catch (_) {}
  await env.DB.prepare(
    "INSERT INTO presence (email, name, viewing, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(email) DO UPDATE SET name=excluded.name, viewing=excluded.viewing, updated_at=excluded.updated_at"
  ).bind(email, name, b.viewing || null).run();
  await env.DB.prepare("DELETE FROM presence WHERE updated_at < datetime('now','-600 seconds')").run();
  const others = (await env.DB.prepare("SELECT email, name, viewing FROM presence WHERE updated_at > datetime('now','-35 seconds') AND email != ?").bind(email).all()).results || [];
  return json({ ok: true, others }, {}, cors);
}
