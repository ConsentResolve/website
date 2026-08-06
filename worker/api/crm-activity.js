// worker/api/crm-activity.js
// Read-only "what did a rep do lately" report from the activities log.
//   GET /api/crm/activity?actor=tyler&hours=24
//     actor : user name or email (e.g. "tyler" or "tyler@consentresolve.com").
//             Omit (or actor=all) -> a per-user summary for the window.
//     hours : lookback window, default 24, max 720 (30d).
// Returns replies (detailed) + the full action timeline + summary counts.
// Auth: any signed-in CRM user.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema } from "../_lib/crm-v2.js";

// Human-friendly labels for the actions a rep produces in the CRM. Falls back to the
// raw action string for anything not mapped, so new actions still show up.
const ACTION_LABELS = {
  replied: "Replied", note_added: "Added note", note: "Added note", assigned: "Assigned lead",
  automation_paused: "Paused automation", deleted: "Deleted conversation", optout_undone: "Undid opt-out",
  converted: "Converted to deal", task_created: "Created task", task_completed: "Completed task",
  task_cancelled: "Cancelled task", enriched: "Enriched contact", stage_changed: "Moved pipeline stage",
};
const label = (a) => ACTION_LABELS[a] || a.replace(/_/g, " ");

function inClause(ids) { return ids.map(() => "?").join(","); }

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);

  const url = new URL(request.url);
  const actorQ = (url.searchParams.get("actor") || "").trim();
  let hours = parseInt(url.searchParams.get("hours") || "24", 10);
  if (!Number.isFinite(hours) || hours <= 0) hours = 24;
  hours = Math.min(hours, 720);
  const sinceMod = `-${hours} hours`;

  // ---- No actor (or "all"): per-user summary leaderboard for the window ----
  if (!actorQ || actorQ.toLowerCase() === "all") {
    const rows = (await env.DB.prepare(
      `SELECT u.name AS name, u.email AS email,
              SUM(CASE WHEN a.action='replied' THEN 1 ELSE 0 END) AS replies,
              COUNT(*) AS actions
         FROM activities a JOIN users u ON u.id = a.actor_id
        WHERE a.created_at >= datetime('now', ?)
        GROUP BY a.actor_id
        ORDER BY replies DESC, actions DESC`
    ).bind(sinceMod).all()).results || [];
    return json({ scope: "all", since_hours: hours, users: rows }, {}, cors);
  }

  // ---- Resolve the actor: match on name, email, email-local-part, or name prefix ----
  const user = await env.DB.prepare(
    `SELECT * FROM users
      WHERE lower(name)=lower(?1) OR lower(email)=lower(?1)
         OR lower(email) LIKE lower(?1)||'@%' OR lower(name) LIKE lower(?1)||'%'
      ORDER BY (lower(name)=lower(?1)) DESC, created_at ASC LIMIT 1`
  ).bind(actorQ).first();
  if (!user) return json({ error: "no_such_user", actor: actorQ }, { status: 404 }, cors);

  const rows = (await env.DB.prepare(
    `SELECT id, action, entity_type, entity_id, meta, created_at
       FROM activities
      WHERE actor_id = ? AND created_at >= datetime('now', ?)
      ORDER BY created_at DESC LIMIT 500`
  ).bind(user.id, sinceMod).all()).results || [];

  // Resolve entity ids -> readable names (conversation subject / contact name+email).
  const convIds = [...new Set(rows.filter((r) => r.entity_type === "conversation").map((r) => r.entity_id))];
  const contactIds = new Set(rows.filter((r) => r.entity_type === "contact").map((r) => r.entity_id));
  const convMap = {};
  if (convIds.length) {
    const cr = (await env.DB.prepare(
      `SELECT id, contact_id, subject, channel FROM conversations WHERE id IN (${inClause(convIds)})`
    ).bind(...convIds).all()).results || [];
    for (const c of cr) { convMap[c.id] = c; if (c.contact_id) contactIds.add(c.contact_id); }
  }
  const contactMap = {};
  const cIds = [...contactIds];
  if (cIds.length) {
    const ct = (await env.DB.prepare(
      `SELECT id, full_name, primary_email FROM contacts WHERE id IN (${inClause(cIds)})`
    ).bind(...cIds).all()).results || [];
    for (const c of ct) contactMap[c.id] = c;
  }
  const nameOf = (contactId) => {
    const c = contactMap[contactId];
    return c ? (c.full_name || c.primary_email || "unknown contact") : null;
  };
  const targetOf = (r) => {
    if (r.entity_type === "conversation") {
      const c = convMap[r.entity_id];
      return (c && (nameOf(c.contact_id) || c.subject)) || "a conversation";
    }
    if (r.entity_type === "contact") return nameOf(r.entity_id) || "a contact";
    if (r.entity_type === "deal") return "a deal";
    return r.entity_type;
  };
  const metaOf = (r) => { try { return r.meta ? JSON.parse(r.meta) : {}; } catch (_) { return {}; } };

  const replies = [];
  const timeline = [];
  const byAction = {};
  for (const r of rows) {
    byAction[r.action] = (byAction[r.action] || 0) + 1;
    const target = targetOf(r);
    const m = metaOf(r);
    timeline.push({ at: r.created_at, action: r.action, label: label(r.action), target, channel: m.channel || null });
    if (r.action === "replied") {
      replies.push({ at: r.created_at, to: target, channel: m.channel || null, via: m.via || null, conversation_id: r.entity_type === "conversation" ? r.entity_id : null });
    }
  }

  return json({
    scope: "actor",
    actor: { name: user.name, email: user.email, role: user.role },
    since_hours: hours,
    summary: { replies: replies.length, actions_total: rows.length, by_action: byAction },
    replies,
    actions: timeline,
  }, {}, cors);
}
