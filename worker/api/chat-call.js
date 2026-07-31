// Chat-to-phone bridge — POST /api/chat-call
// A visitor in the web chat (Mack) asks for a phone call. We create a consented
// Speed-to-Lead lead, lay down an IMMEDIATE AI voice touchpoint, and fire the tick so
// Retell rings them within seconds — then Mack (voice) warm-transfers to an available
// rep, exactly like the rest of the engine (same gate, same cascade, same CRM logging).
//
// Two callers, one endpoint:
//   1. Our in-widget "Get a call" form  → JSON { phone, name?, email?, trade?, consent:true }
//   2. Mack's `request_callback` tool    → Retell function-call body { args:{ phone, name? }, call:{} }
import { json, corsHeaders, clientIp } from "../_lib/http.js";
import { createLead } from "../_lib/stl/classifier.js";
import { scheduleLead, parkRepMatchingPhone, tick } from "../_lib/stl/runner.js";
import { linkLeadToCrm } from "../_lib/stl/crm-bridge.js";
import { toE164 } from "../_lib/phone.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const cors = corsHeaders(request, env);
  let body = {};
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }

  // Retell custom-function calls wrap the params in `args`; our form posts them flat.
  const fromTool = !!(body && (body.args || body.arguments || body.call));
  const src = body.args || body.arguments || body;
  const rawPhone = src.phone || src.phone_number || body.phone || "";
  const phone = toE164(rawPhone);
  if (!phone) {
    // Return a shape each caller understands (Mack relays `message`).
    return json({ ok: false, error: "need_phone", message: "I need a good 10-digit number to call you." }, { status: 200 }, cors);
  }

  // Consent: the in-widget form must tick the box; a tool call IS the visitor asking to be
  // called (they typed the request + number into the chat). Record it either way.
  const consented = fromTool ? true : !!(body.consent === true || body.consent === "true");
  if (!consented) {
    return json({ ok: false, error: "need_consent", message: "I can reach out once you okay it above." }, { status: 200 }, cors);
  }

  // call (default) rings them + warm-transfers; text sends an immediate SMS thread.
  const mode = String(src.mode || body.mode || "call").toLowerCase() === "text" ? "text" : "call";
  const verb = mode === "text" ? "text" : "call";
  const exact = fromTool
    ? `Visitor asked Mack (web chat) to ${verb} this number and provided it in the conversation.`
    : `Visitor requested a ${verb} from the website chat and ticked the contact-consent box.`;

  const payload = {
    kind: "form_submit",
    first_name: src.name || src.first_name || body.name || "there",
    company: src.company || body.company || null,
    email: src.email || body.email || null,
    phone,
    trade: src.trade || body.trade || "other",
    landing_page: body.landing_page || "/chat",
    ad_source: "chat", campaign_id: mode === "text" ? "chat-to-sms" : "chat-to-phone",
    // Regulated-channel consent → Population B. SMS always; voice/human only for a call.
    consent: { email: !!(src.email || body.email), sms: true, phone_human: mode === "call", phone_ai: mode === "call", grade: "written", exact_language: exact },
    // Server-captured provenance wins.
    ip: clientIp(request) || null,
    user_agent: request.headers.get("user-agent") || null,
  };
  if (request.cf && request.cf.timezone) payload.timezone = request.cf.timezone;
  if (request.cf && request.cf.regionCode) payload.state = request.cf.regionCode;

  try {
    const { leadId, revokeToken } = await createLead(env, payload);
    const lead = await env.DB.prepare("SELECT * FROM stl_leads WHERE id=?").bind(leadId).first();

    // text: one immediate SMS (replies flow into the CRM Inbox).
    // call: immediate AI voice call + a human-dial fallback ~3 min later if unanswered.
    // Neither step is window-gated, so a chat-requested touch fires right away, any hour.
    const steps = mode === "text"
      ? [{ step: "CHAT_sms", offset: 0, channel: "sms", actor: "system", template: "CHAT_sms" }]
      : [
          { step: "B1_retell", offset: 0,      channel: "call_ai",    actor: "ai",    template: "B1_retell" },
          { step: "B4_dial",   offset: 3 * 60,  channel: "call_human", actor: "human", template: "B4_dial", windowed: true, skipIfTransferred: true },
        ];
    await scheduleLead(env, lead, steps);
    if (mode === "call" && lead && lead.phone) await parkRepMatchingPhone(env, lead.phone).catch(() => {});

    // Mirror to the CRM (system of record) + fire the tick so the touch goes out in seconds.
    const jobs = Promise.allSettled([linkLeadToCrm(env, lead), tick(env)]);
    if (waitUntil) waitUntil(jobs); else await jobs;

    const origin = env.STL_PUBLIC_ORIGIN || new URL(request.url).origin;
    return json({
      ok: true, lead_id: leadId, mode, status: mode === "text" ? "texting" : "calling",
      message: mode === "text"
        ? "Sent — check your phone for a text from Mack. Reply anytime, a human reads them."
        : "You're all set — Mack is calling you now. Keep your phone handy.",
      revoke_url: revokeToken ? `${origin}/consent/revoke?t=${revokeToken}` : undefined,
    }, {}, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200), message: "Something went wrong kicking off the call — try again in a sec." }, { status: 500 }, cors);
  }
}
