// worker/api/crm-task.js
//   The task ENTITY (call / linkedin / manual / nudge) — distinct from /api/crm/tasks,
//   which is the per-conversation found/done checklist.
//   GET  /api/crm/task?status=open[&contact_id=&conversation_id=]  → list
//   POST /api/crm/task {action:"create", ...}                       → create a task
//   POST /api/crm/task {action:"complete", id, status, outcome}     → close a task
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser, listTasks, createTask, completeTask } from "../_lib/crm-v2.js";
import { enrollContact } from "../_lib/workflow-engine.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  const q = new URL(request.url).searchParams;
  const tasks = await listTasks(env, {
    status: q.get("status") || "open",
    contactId: q.get("contact_id") || undefined,
    conversationId: q.get("conversation_id") || undefined,
    limit: Math.min(500, parseInt(q.get("limit") || "200", 10)),
  });
  return json({ ok: true, tasks }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  const b = await request.json().catch(() => ({}));
  const me = await currentUser(request, env).catch(() => null);
  const actorId = me ? me.id : null;

  if (b.action === "complete") {
    if (!b.id) return json({ ok: false, error: "no_id" }, { status: 400 }, cors);
    const status = ["done", "skipped", "open"].includes(b.status) ? b.status : "done";
    await completeTask(env, { id: b.id, status, outcome: b.outcome || null, actorId });
    return json({ ok: true, id: b.id, status }, {}, cors);
  }

  if (b.action === "reengage") {
    // Manual trigger (e.g. spotted a new website launch or a review surge) → 3-touch sprint.
    if (!b.contact_id) return json({ ok: false, error: "no_contact" }, { status: 400 }, cors);
    const r = await enrollContact(env, { contactId: b.contact_id, source: "manual_reengage", workflowId: "reengage" }).catch((e) => ({ error: String(e) }));
    return json({ ok: !r.error, ...r }, {}, cors);
  }

  if (b.action === "create") {
    if (!b.title) return json({ ok: false, error: "no_title" }, { status: 400 }, cors);
    const id = await createTask(env, {
      contactId: b.contact_id || null, conversationId: b.conversation_id || null, companyId: b.company_id || null,
      type: b.type || "manual", title: b.title, body: b.body || null, dueAt: b.due_at || null,
      assigneeId: b.assignee_id || actorId, source: "manual", createdBy: actorId,
    });
    return json({ ok: true, id }, {}, cors);
  }

  return json({ ok: false, error: "bad_action" }, { status: 400 }, cors);
}
