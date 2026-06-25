// GET /api/crm/analytics -> { industries:[...], totals:{...}, byChannel:{...} }
// Per-industry funnel (visits→leads→demos→won) + CPL/CAC/win-rate/ROAS.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, computeAnalytics } from "../_lib/crm.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  return json(await computeAnalytics(env), {}, cors);
}
