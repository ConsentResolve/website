// Partner (agency/reseller) application → CRM. Public POST from /agency-partners.
// Creates/updates a contact by email and opens a 'partner' conversation in the Inbox so
// the team follows up by hand. No Speed-to-Lead engine enrollment — partners get a human
// call, not an automated cascade. Mirrors the other form-ingest paths (crm-bridge style).
import { json, corsHeaders } from "../_lib/http.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";
import { ensureRebuildSchema, logEvent } from "../_lib/crm-rebuild.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  let b = {};
  try { b = await request.json(); } catch (_) { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }

  const email = String(b.email || "").trim().toLowerCase();
  const name = String(b.name || "").trim();
  if (!email || !/.+@.+\..+/.test(email)) return json({ ok: false, error: "need_email", message: "Please enter a valid work email." }, { status: 200 }, cors);

  const agency = String(b.agency || b.company || "").trim();
  const trade = String(b.trade || "").trim();
  const clients = String(b.clients || "").trim();
  const note = String(b.message || b.note || "").trim();

  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);
    const contactId = await findOrCreateContactByEmail(env, email, { name: name || null, company: agency || null, source: "partner" });
    if (!contactId) return json({ ok: false, error: "no_contact", message: "Something went wrong — email hello@consentresolve.com." }, { status: 200 }, cors);
    const c = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
    const companyId = c ? c.company_id : null;

    const now = new Date().toISOString();
    // Channel 'email' so the team can reply from the Inbox (reply routing supports email);
    // the partner origin is carried by source='partner' + the "partner:"+email thread key.
    const convId = await upsertConversationByThread(env, {
      channel: "email", externalThreadId: "partner:" + email, contactId, companyId,
      subject: "🤝 Partner application — " + (name || agency || email),
      sourceDetail: "agency-partners", incoming: true, lastAt: now,
      preview: "🤝 " + ([agency, trade, clients ? clients + " clients" : ""].filter(Boolean).join(" · ") || "Founding-partner application").slice(0, 100),
    });
    const body = [
      "🤝 Founding-partner application (agency-partners page)",
      "Name: " + (name || "—"),
      "Agency: " + (agency || "—"),
      "Email: " + email,
      "Primary trade: " + (trade || "—"),
      "Client count: " + (clients || "—"),
      note ? "\nNote: " + note : "",
    ].filter(Boolean).join("\n");
    await insertMessageOnce(env, { conversationId: convId, direction: "in", channel: "email", externalMessageId: "partner-apply:" + email + ":" + now, bodyText: body, sentAt: now });
    await logEvent(env, { type: "lead_created", contactId, companyId, conversationId: convId, channel: "partner", source: "partner", meta: { agency, trade, clients } });

    return json({ ok: true, message: "Got it — we'll reach out within one business day to book your 15-minute fit call." }, {}, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160), message: "Something went wrong — email hello@consentresolve.com and we'll sort it." }, { status: 500 }, cors);
  }
}
