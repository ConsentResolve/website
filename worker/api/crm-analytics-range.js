// Consent Resolve CRM — Analytics for a chosen date range.
//   GET /api/crm/analytics/range?days=30   (CRM-gated)
// Returns the same ANALYTICS shape as /api/crm/app, recomputed for `days`.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { buildAnalytics } from "../_lib/analytics.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const days = parseInt(new URL(request.url).searchParams.get("days") || "30", 10);
  try {
    const analytics = await buildAnalytics(env, days);
    return json({ ok: true, analytics }, {}, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160) }, { status: 500 }, cors);
  }
}
