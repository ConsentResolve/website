// CRM leads API — gated by the admin session cookie OR ?key=<CRM_KEY>.
//   GET  /api/crm/leads               -> { leads: [...] }   (filters: ?industry= &source=)
//   GET  /api/crm/leads?id=<id>       -> { lead, activity, events }
//   POST /api/crm/leads { id, ...fields } -> { ok } (update stage/status/value/owner/notes; logs activity)
//   POST /api/crm/leads { create:true, ... } -> { ok, id } (manual add)

import { json, corsHeaders } from "../_lib/http.js";
import { isAuthed } from "../_lib/auth.js";
import { listLeads, getLead, updateLead, addActivity, upsertLead, deleteLead } from "../_lib/crm.js";

export function crmKey(env) {
  return env.CRM_KEY || env.DASHBOARD_KEY || "cr-dash-2026";
}

async function authed(request, env) {
  if (await isAuthed(request, env)) return true;
  const key = new URL(request.url).searchParams.get("key") || "";
  return key && key === crmKey(env);
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await authed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    const data = await getLead(env, id);
    if (!data) return json({ error: "not_found" }, { status: 404 }, cors);
    return json(data, {}, cors);
  }
  const leads = await listLeads(env, {
    industry: url.searchParams.get("industry") || "all",
    source: url.searchParams.get("source") || "all",
  });
  return json({ leads }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await authed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  let body = {};
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }

  if (body.create) {
    if (!body.email) return json({ error: "email_required" }, { status: 400 }, cors);
    const id = await upsertLead(env, body);
    await addActivity(env, id, "note", "Lead added manually", body.actor || "manual");
    return json({ ok: true, id }, {}, cors);
  }

  if (body.action === "delete") {
    if (!body.id) return json({ error: "id_required" }, { status: 400 }, cors);
    await deleteLead(env, body.id);
    return json({ ok: true, deleted: true }, {}, cors);
  }

  if (!body.id) return json({ error: "id_required" }, { status: 400 }, cors);
  const before = await getLead(env, body.id);
  if (!before) return json({ error: "not_found" }, { status: 404 }, cors);

  // Guardrail: identified (non-consented) visitors can't be moved into outreach stages.
  if (before.lead.consent_status === "identified" && ["contacted", "qualified", "demo", "proposal"].includes(body.stage)) {
    return json({ error: "consent_blocked", message: "Identified visitors have not consented — retargeting/intel only, not outreach." }, { status: 403 }, cors);
  }

  await updateLead(env, body.id, body);
  if (body.stage && body.stage !== before.lead.stage) await addActivity(env, body.id, "status_change", `Stage → ${body.stage}`, body.actor || "user");
  if (body.status && body.status !== before.lead.status) await addActivity(env, body.id, "status_change", `Status → ${body.status}`, body.actor || "user");
  if (body.note) await addActivity(env, body.id, "note", body.note, body.actor || "user");
  return json({ ok: true }, {}, cors);
}
