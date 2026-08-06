// worker/api/crm-single-task.js
// Single-Task Mode — per-user enablement + first-view logging/claim.
// The RANKING of "the one lead to work next" happens client-side over the already-loaded
// conversations (so it always resolves to a record the UI can open); this endpoint only:
//   GET                       -> { enabled, user:{id,name,email} }   (is it on for me?)
//   POST {enabled:true|false} -> flip Single-Task Mode for the signed-in user
//   POST {viewed:{id}}        -> claim the conversation (assign to me if unassigned = the
//                                concurrency lock) + stamp a first-view activity (Phase 2 data)
// Auth: any signed-in CRM user; each user only ever reads/sets their own flag.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, currentUser, addActivityV2 } from "../_lib/crm-v2.js";

async function ensureFlag(env) {
  // Idempotent: the column may already exist.
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN single_task_enabled INTEGER NOT NULL DEFAULT 0").run(); } catch (_) {}
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  await ensureFlag(env);
  const me = await currentUser(request, env);
  if (!me) return json({ enabled: false, user: null }, {}, cors);
  const row = await env.DB.prepare("SELECT single_task_enabled FROM users WHERE id=?").bind(me.id).first();
  return json({ enabled: !!(row && row.single_task_enabled), user: { id: me.id, name: me.name, email: me.email } }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  await ensureFlag(env);
  const me = await currentUser(request, env);
  if (!me) return json({ error: "no_user" }, { status: 403 }, cors);
  const body = await request.json().catch(() => ({}));

  if (typeof body.enabled === "boolean") {
    await env.DB.prepare("UPDATE users SET single_task_enabled=? WHERE id=?").bind(body.enabled ? 1 : 0, me.id).run();
    return json({ ok: true, enabled: body.enabled }, {}, cors);
  }

  if (body.viewed && body.viewed.id) {
    const id = String(body.viewed.id);
    // Claim the conversation if it's unassigned — this is both "it's mine now" and the lock
    // that stops a second rep in Single-Task Mode from being handed the same lead.
    let claimed = false;
    try {
      const r = await env.DB.prepare("UPDATE conversations SET assignee_id=? WHERE id=? AND (assignee_id IS NULL OR assignee_id='')").bind(me.id, id).run();
      claimed = !!(r && r.meta && r.meta.changes);
    } catch (_) {}
    // Stamp first-view (Phase 2 timing data). Cheap + best-effort; never blocks the response.
    await addActivityV2(env, { actorId: me.id, entityType: "conversation", entityId: id, action: "single_task_viewed" }).catch(() => {});
    return json({ ok: true, claimed }, {}, cors);
  }

  return json({ error: "noop" }, { status: 400 }, cors);
}
