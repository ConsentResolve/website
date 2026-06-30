// CRM — Meta (Facebook) ad-spend read + sync.
//   GET  /api/crm/meta/spend -> { configured, month, last30 }  (live from the Graph API)
//   POST /api/crm/meta/spend -> runs syncMetaSpend, writing this month into crm_spend
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { metaConfigured, fetchMetaSpend, syncMetaSpend, fetchMetaStatus } from "../_lib/meta.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!metaConfigured(env)) return json({ configured: false }, {}, cors);
  const month = await fetchMetaSpend(env, { datePreset: "this_month" });
  const last30 = await fetchMetaSpend(env, { datePreset: "last_30d" });
  const status = await fetchMetaStatus(env);
  return json({ configured: true, month, last30, status }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!metaConfigured(env)) return json({ configured: false, error: "not_configured" }, { status: 400 }, cors);
  const r = await syncMetaSpend(env);
  return json(r, {}, cors);
}
