// POST /api/claim-50 — lead capture for the demo booking form (ClaimForm.astro).
// Creates a v2 contact + conversation (so it lands in the CRM inbox with the qualifier data),
// and records email + SMS (PEWC) consent in the ledger. Mirrors register.js minus Turnstile,
// and carries the extra offer/estimate/attribution fields into the inbox note.
import { corsHeaders, json, clientIp } from "../_lib/http.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";
import { ensureRebuildSchema, recordConsent, logEvent } from "../_lib/crm-rebuild.js";
import { SMS_CONSENT_DISCLOSURE } from "../_lib/sms-consent.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env, waitUntil }) {
  const cors = corsHeaders(request, env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }

  const email = (b.email || "").toString().trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, { status: 400 }, cors);
  const name = (b.name || "").toString().trim();
  const phone = (b.phone || "").toString().trim();
  const website = (b.website || "").toString().trim();
  const trade = (b.trade || "").toString().trim();
  const smsConsent = b.sms_consent === "1" || b.sms_consent === 1 || b.sms_consent === true;
  const emailConsent = b.consent_contact === "1" || b.consent_contact === 1 || b.consent_contact === true || b.type === "exit_report";
  const ip = clientIp(request);
  const ua = request.headers.get("User-Agent") || null;

  const work = (async () => {
    if (!env.DB) return;
    await ensureCrmV2Schema(env);
    await ensureRebuildSchema(env);
    const contactId = await findOrCreateContactByEmail(env, email, { name, phone, source: "claim50" });
    if (!contactId) return;

    // Consent records (email required for the normal flow; SMS is the PEWC opt-in).
    if (emailConsent) {
      await recordConsent(env, { contactId, email, channel: "email", action: "granted", basis: b.type === "exit_report" ? "report request" : "web form", captureMethod: "claim50_form", sourceUrl: "https://consentresolve.com/demo/", ip, userAgent: ua, source: "claim50" }).catch(() => {});
    }
    if (smsConsent && phone) {
      await recordConsent(env, { contactId, phone, channel: "sms", action: "granted", basis: "PEWC", disclosureText: SMS_CONSENT_DISCLOSURE, captureMethod: "claim50_form", sourceUrl: "https://consentresolve.com/demo/", ip, userAgent: ua, source: "claim50" }).catch(() => {});
    }

    // Inbox conversation + message with all the qualifier/estimate/attribution context.
    const lines = [
      b.type === "exit_report" ? "Ghost Report request (exit-intent)" : "Claim-50 lead — FIRST50 offer",
      "Name: " + (name || "—"), "Email: " + email, phone ? "Phone: " + phone : "",
      website ? "Website: " + website : "", trade ? "Trade: " + trade : "",
      b.monthly_visitors ? "Monthly visitors: " + b.monthly_visitors : "",
      b.est_leads ? "Est. leads/mo: " + b.est_leads : "", b.est_revenue ? "Est. revenue: $" + b.est_revenue : "",
      b.segment ? "Segment: " + b.segment : "",
      (b.utm_source || b.gclid) ? "Attribution: " + [b.utm_source && "src=" + b.utm_source, b.utm_campaign && "cmp=" + b.utm_campaign, b.gclid && "gclid=" + b.gclid].filter(Boolean).join(" · ") : "",
    ].filter(Boolean).join("\n");
    const convId = await upsertConversationByThread(env, {
      channel: "claim50", externalThreadId: "claim50:" + email, contactId,
      subject: "Demo request" + (name ? " — " + name : ""), sourceDetail: [trade && "trade:" + trade, website && "site:" + website, b.segment].filter(Boolean).join("|") || null,
      incoming: true, lastAt: new Date().toISOString(),
      preview: [b.type === "exit_report" ? "📄 report" : "🔥 claim-50", name, email, website].filter(Boolean).join(" · ").slice(0, 160),
    });
    await insertMessageOnce(env, {
      conversationId: convId, direction: "in", channel: "claim50",
      externalMessageId: "claim50:" + email + ":" + Date.now(), bodyText: lines, sentAt: new Date().toISOString(),
    });
    await logEvent(env, { type: "lead_created", contactId, conversationId: convId, source: "claim50", meta: { offer: "FIRST50", segment: b.segment || null } }).catch(() => {});
  })().catch(() => {});
  if (typeof waitUntil === "function") waitUntil(work); else await work;

  return json({ ok: true }, {}, cors);
}
