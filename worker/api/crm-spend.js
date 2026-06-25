// GET  /api/crm/spend -> { spend:[...] }
// POST /api/crm/spend { industry, channel, amount_usd, period?, note? } -> { ok }
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, listSpend, addSpend } from "../_lib/crm.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  return json({ spend: await listSpend(env) }, {}, cors);
}
export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (!b.amount_usd) return json({ error: "amount_required" }, { status: 400 }, cors);
  await addSpend(env, b);
  return json({ ok: true }, {}, cors);
}
