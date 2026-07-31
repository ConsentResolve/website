// Speed-to-Lead → CRM v2 bridge. System of record = the CRM (contacts/conversations/
// deals/crm_events at /crm/app). The STL engine feeds it: every lead + every touchpoint
// mirrors into the CRM so the team sees one unified record and reporting rolls up.
// Identity is deduped by email (then phone) via the existing contact_identifiers, so
// /api/claim-50 and /api/lead converge on ONE contact.
import { ensureCrmV2Schema, findOrCreateContactByEmail, findOrCreateContactByIdentifier, upsertConversationByThread, insertMessageOnce, normPhone } from "../crm-v2.js";
import { ensureRebuildSchema, logEvent } from "../crm-rebuild.js";

const STL_CHANNEL = "speed_to_lead";
const nowIso = () => new Date().toISOString();

function leadSummary(l) {
  return [
    `New Speed-to-Lead lead — ${l.population === "B" ? "Population B (fully consented: email/SMS/call/AI)" : "Population A (identified, email + manual dial)"}`,
    "Name: " + ([l.first_name, l.last_name].filter(Boolean).join(" ") || "—"),
    "Company: " + (l.company || "—"), "Email: " + (l.email || "—"), "Phone: " + (l.phone || "—"),
    "Trade: " + (l.trade || "—"),
    "Source: " + (l.ad_source || "site") + (l.campaign_id ? " / " + l.campaign_id : ""),
    "Landing: " + (l.landing_page || "—"),
  ].join("\n");
}

// Link an STL lead → CRM contact/company, store the link, and open a Speed-to-Lead
// conversation in the Inbox with a lead_created event (feeds Analytics funnel by source).
export async function linkLeadToCrm(env, lead) {
  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null;
    let contactId = null;
    if (lead.email) contactId = await findOrCreateContactByEmail(env, lead.email, { name, company: lead.company, phone: lead.phone, source: lead.ad_source || STL_CHANNEL });
    else if (lead.phone) contactId = await findOrCreateContactByIdentifier(env, "phone", normPhone(lead.phone), { name, company: lead.company, source: lead.ad_source || STL_CHANNEL });
    if (!contactId) return { ok: false };

    try { await env.DB.prepare("UPDATE stl_leads SET crm_contact_id=? WHERE id=?").bind(contactId, lead.id).run(); } catch (_) {}
    const c = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
    const companyId = c ? c.company_id : null;
    const now = nowIso();
    const convId = await upsertConversationByThread(env, {
      channel: STL_CHANNEL, externalThreadId: "stl:" + lead.id, contactId, companyId,
      subject: "⚡ Speed-to-Lead — " + (name || lead.email || lead.phone || "new lead"),
      sourceDetail: lead.ad_source || null, incoming: true, lastAt: now,
      preview: `New ${lead.population === "B" ? "consented" : "identified"} lead${lead.trade ? " · " + lead.trade : ""}${lead.ad_source ? " · " + lead.ad_source : ""}`,
    });
    await insertMessageOnce(env, { conversationId: convId, direction: "in", channel: STL_CHANNEL, externalMessageId: "stl-lead:" + lead.id, bodyText: leadSummary(lead), sentAt: now });
    await logEvent(env, { type: "lead_created", contactId, companyId, conversationId: convId, channel: STL_CHANNEL, source: lead.ad_source || "site", meta: { stl_lead_id: lead.id, population: lead.population, trade: lead.trade, campaign: lead.campaign_id, is_demo: lead.is_demo } });
    return { ok: true, contactId, companyId, conversationId: convId };
  } catch (e) { return { ok: false, error: String(e).slice(0, 140) }; }
}

async function convFor(env, lead) {
  if (!lead || !lead.crm_contact_id) return null;
  return await env.DB.prepare("SELECT id, company_id FROM conversations WHERE channel=? AND external_thread_id=?").bind(STL_CHANNEL, "stl:" + lead.id).first().catch(() => null);
}

// Mirror a dispatched engine touchpoint → CRM conversation message + crm_event.
export async function mirrorTouchpoint(env, lead, tp, res) {
  try {
    const conv = await convFor(env, lead);
    if (!conv) return;
    const mode = res.act === "simulate" ? " (simulated)" : "";
    let text = null, ev = "contacted", dir = "out", ch = tp.channel;
    if (tp.channel === "call_ai") text = "📞 Ruby (AI) call — " + (res.outcome || "") + mode;
    else if (tp.channel === "call_human") text = "📞 Human dial — " + (res.outcome || "") + mode;
    else if (tp.channel === "sms") text = "💬 SMS sent" + mode + (res.detail && res.act !== "live" ? " — " + res.detail : "");
    else if (tp.channel === "email") text = "✉️ Email sent" + mode;
    else return;
    await insertMessageOnce(env, { conversationId: conv.id, direction: dir, channel: ch, externalMessageId: "stl-tp:" + tp.id + ":" + (res.act || "x"), bodyText: text, sentAt: nowIso() });
    await logEvent(env, { type: ev, contactId: lead.crm_contact_id, companyId: conv.company_id, conversationId: conv.id, channel: ch, source: lead.ad_source || "site", meta: { step: tp.sequence_step, outcome: res.outcome, mode: res.act } });
  } catch (_) {}
}

// Inbound SMS from the lead → CRM conversation (direction in) + a 'replied' event.
export async function mirrorInboundSms(env, lead, body, sid) {
  try {
    const conv = await convFor(env, lead);
    if (!conv) return;
    await insertMessageOnce(env, { conversationId: conv.id, direction: "in", channel: "sms", externalMessageId: "sms-in:" + (sid || Date.now()), bodyText: body || "", sentAt: nowIso() });
    await logEvent(env, { type: "replied", contactId: lead.crm_contact_id, companyId: conv.company_id, conversationId: conv.id, channel: "sms", source: lead.ad_source || "site", meta: { via: "sms" } });
  } catch (_) {}
}

function fmtDur(s) {
  if (!s || s < 1) return "0s";
  const m = Math.floor(s / 60), r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

// Inbound phone call to our number (answered by Mack in Retell) → CRM. Called from the
// Retell webhook for events with NO touchpoint_id (i.e. not an engine-dispatched outbound
// call). Matches the caller to an existing contact by phone so a known lead's call lands
// on their record; otherwise opens a provisional contact. Deduped on the Retell call_id
// so call_ended + call_analyzed don't double-log — the analyzed event enriches the same
// message with the summary + transcript.
export async function mirrorInboundCall(env, call, eventName) {
  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);
    const fromRaw = call.from_number || call.from || "";
    const np = normPhone(fromRaw);
    if (np.length < 10) return { ok: false, skipped: "no_from" };
    const to = call.to_number || call.to || "";

    const analysis = call.call_analysis || {};
    const summary = analysis.call_summary || "";
    const sentiment = analysis.user_sentiment || null;
    const voicemail = analysis.in_voicemail === true;
    const durS = call.duration_ms ? Math.round(call.duration_ms / 1000)
      : (call.end_timestamp && call.start_timestamp ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : (call.call_length_seconds || null));
    const noAnswer = call.disconnection_reason === "dial_no_answer";
    const transcript = (call.transcript || (Array.isArray(call.transcript_object)
      ? call.transcript_object.map((t) => `${t.role}: ${t.content}`).join("\n") : "") || "").slice(0, 6000);
    const recording = call.recording_url || "";

    // Identity: a known lead's number resolves to their contact; a stranger gets a
    // provisional one keyed on the phone identifier.
    let contactId = null;
    const idr = await env.DB.prepare("SELECT contact_id FROM contact_identifiers WHERE type='phone' AND value=?").bind(np).first().catch(() => null);
    if (idr) contactId = idr.contact_id;
    else contactId = await findOrCreateContactByIdentifier(env, "phone", np, { source: "inbound_call" });
    if (!contactId) return { ok: false, error: "no_contact" };
    const c = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
    const companyId = c ? c.company_id : null;

    const label = voicemail ? "📞 Inbound voicemail" : noAnswer ? "📞 Missed call" : "📞 Inbound call";
    const now = nowIso();
    const convId = await upsertConversationByThread(env, {
      channel: "voice", externalThreadId: "voice:" + np, contactId, companyId,
      subject: "📞 Calls — " + (fromRaw || np), incoming: true, lastAt: now,
      preview: label + (durS ? " · " + fmtDur(durS) : "") + (summary ? " · " + summary.slice(0, 80) : ""),
    });

    const lines = [
      `${label}${durS ? " — " + fmtDur(durS) : ""}`,
      `From ${fromRaw || np}${to ? " → " + to : ""} · answered by Mack (AI)`,
    ];
    if (summary) lines.push("", summary);
    if (sentiment) lines.push("Caller sentiment: " + sentiment);
    if (recording) lines.push("Recording: " + recording);
    if (transcript) lines.push("", "Transcript:", transcript);
    const bodyText = lines.join("\n");

    const extId = "retell-call:" + (call.call_id || np + ":" + now);
    const ins = await insertMessageOnce(env, { conversationId: convId, direction: "in", channel: "voice", externalMessageId: extId, bodyText, sentAt: now });
    // call_analyzed usually lands after call_ended — enrich the row we already inserted.
    if (ins.existed && eventName && /analy/i.test(eventName)) {
      await env.DB.prepare("UPDATE messages SET body_text=? WHERE external_message_id=?").bind(bodyText, extId).run().catch(() => {});
    }
    await logEvent(env, { type: "inbound_call", contactId, companyId, conversationId: convId, channel: "voice", source: "inbound_call", meta: { call_id: call.call_id || null, duration_s: durS, voicemail, missed: noAnswer, sentiment, from: fromRaw || np } });
    return { ok: true, contactId, conversationId: convId, logged_new: !ins.existed };
  } catch (e) { return { ok: false, error: String(e).slice(0, 140) }; }
}
