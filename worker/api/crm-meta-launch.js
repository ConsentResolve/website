// CRM — Meta cold lead-gen campaign launcher (Instant Forms).
//   POST /api/crm/meta/launch { budget?:100 }              -> create the full campaign PAUSED
//   POST /api/crm/meta/launch { action:"activate", campaignId } -> flip it ACTIVE (spends money)
// Uses the Cloudflare Meta secret so the campaign can be built without exposing the token.
// Auth: CRM session OR ?key=<FEEDBACK_KEY>.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { metaConfigured, launchLeadFormCampaign, activateMetaCampaign } from "../_lib/meta.js";

async function readAuthed(request, env) {
  if (await crmAuthed(request, env)) return true;
  const k = new URL(request.url).searchParams.get("key");
  return !!(env.FEEDBACK_KEY && k === env.FEEDBACK_KEY);
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await readAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!metaConfigured(env)) return json({ configured: false, error: "not_configured" }, { status: 400 }, cors);
  let b = {}; try { b = await request.json(); } catch (_) {}

  if (b.action === "activate") {
    if (!b.campaignId) return json({ error: "campaignId_required" }, { status: 400 }, cors);
    return json(await activateMetaCampaign(env, b.campaignId), {}, cors);
  }
  const budget = Number(b.budget || 100);
  const r = await launchLeadFormCampaign(env, { budgetCents: Math.round(budget * 100), name: b.name || "HVAC US 2026", formId: b.formId || null });
  return json(r, { status: r.ok ? 200 : 502 }, cors);
}
