// CRM — Meta campaign launcher (Instant Forms + web Conversions), all-service-pros.
//   POST /api/crm/meta/launch { budget?:50 }                       -> lead-form campaign (static + video), PAUSED
//   POST /api/crm/meta/launch { action:"conversion", budget?:50 }  -> OUTCOME_SALES web campaign (static + video), PAUSED
//   POST /api/crm/meta/launch { action:"activate", campaignId }    -> flip a campaign ACTIVE (spends money)
// Uses the Cloudflare Meta secret so the campaign can be built without exposing the token.
// Auth: CRM session OR ?key=<FEEDBACK_KEY>.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { metaConfigured, launchLeadFormCampaign, launchConversionCampaign, activateMetaCampaign, STATIC_ADS, TYLER_VIDEOS, CONV_LINK } from "../_lib/meta.js";

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

  if (b.action === "conversion") {
    const r = await launchConversionCampaign(env, {
      budgetCents: Math.round((b.budget || 50) * 100),
      name: b.name || "Home Services US 2026",
      link: CONV_LINK,
    });
    return json(r, { status: r.ok ? 200 : 502 }, cors);
  }

  // default / "leadform" — Instant Forms lead-gen with static (STATIC_ADS) + video (TYLER_VIDEOS) creatives.
  const r = await launchLeadFormCampaign(env, {
    budgetCents: Math.round((b.budget || 50) * 100),
    name: b.name || "Home Services US 2026",
    formId: b.formId || null,
    videoUrls: TYLER_VIDEOS,
  });
  return json(r, { status: r.ok ? 200 : 502 }, cors);
}
