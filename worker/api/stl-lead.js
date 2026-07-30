// Speed-to-Lead — POST /api/lead  (build step 2). Public funnel ingest.
// Classifies consent → population A|B, creates the lead + consent event, and lays
// down the sequence. Nothing is dispatched here; the cron tick executes the cadence.
import { json, corsHeaders, clientIp } from "../_lib/http.js";
import { createLead } from "../_lib/stl/classifier.js";
import { scheduleLead } from "../_lib/stl/runner.js";
import { backfillPhoneType } from "../_lib/stl/twilio.js";
import { linkLeadToCrm } from "../_lib/stl/crm-bridge.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const cors = corsHeaders(request, env);
  let body = {};
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }

  // Server-captured provenance always wins over anything the client claims.
  body.ip = clientIp(request) || body.ip || null;
  body.user_agent = request.headers.get("user-agent") || body.user_agent || null;
  if (request.cf && request.cf.timezone && !body.timezone) body.timezone = request.cf.timezone;
  if (request.cf && request.cf.regionCode && !body.state) body.state = request.cf.regionCode;
  // UTM / source attribution → ad_source + campaign_id (feeds by-source ROAS).
  if (!body.ad_source && body.utm_source) body.ad_source = String(body.utm_source).slice(0, 40);
  if (!body.campaign_id && body.utm_campaign) body.campaign_id = String(body.utm_campaign).slice(0, 80);

  try {
    const { leadId, population, revokeToken } = await createLead(env, body);
    const lead = await env.DB.prepare("SELECT * FROM stl_leads WHERE id=?").bind(leadId).first();
    await scheduleLead(env, lead);
    // Mirror into the CRM (system of record): contact/company + Inbox conversation.
    const crmJob = linkLeadToCrm(env, lead).catch(() => {});
    if (waitUntil) waitUntil(crmJob); else await crmJob;
    // Enrich phone_type (mobile/landline/voip) in the background via Twilio Lookup —
    // the gate uses it to allow a manual dial to a published business line.
    if (lead && lead.phone && !lead.phone_type) {
      const job = backfillPhoneType(env, leadId, lead.phone).catch(() => {});
      if (waitUntil) waitUntil(job);
    }
    const origin = env.STL_PUBLIC_ORIGIN || new URL(request.url).origin;
    return json({
      ok: true, lead_id: leadId, population,
      revoke_url: `${origin}/consent/revoke?t=${revokeToken}`,
    }, {}, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 }, cors);
  }
}
