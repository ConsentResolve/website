// Speed-to-Lead → CRM v2 bridge. System of record = the CRM (contacts/conversations/
// deals/crm_events at /crm/app). The STL engine feeds it: every lead + every touchpoint
// mirrors into the CRM so the team sees one unified record and reporting rolls up.
// Identity is deduped by email (then phone) via the existing contact_identifiers, so
// /api/claim-50 and /api/lead converge on ONE contact.
import { ensureCrmV2Schema, findOrCreateContactByEmail, findOrCreateContactByIdentifier, upsertConversationByThread, insertMessageOnce, normPhone, linkIdentifier } from "../crm-v2.js";
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
    if (tp.channel === "call_ai") text = "📞 Mack (AI) call — " + (res.outcome || "") + mode;
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
    // One conversation per phone number ("phone:"+np) so calls AND texts from the same
    // number thread together. The individual messages keep their own channel (voice/sms).
    const convId = await upsertConversationByThread(env, {
      channel: "phone", externalThreadId: "phone:" + np, contactId, companyId,
      subject: "📞 " + (fromRaw || np), incoming: true, lastAt: now,
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

// Inbound SMS answered by Retell's chat/SMS agent → CRM. When "Add an inbound webhook" is
// enabled on the Inbound SMS agent, Retell posts a chat_* event to the same webhook. The
// payload carries a `chat` object (not `call`), and Retell can label the customer's number
// a few different ways for SMS, so parse defensively. One CRM message per chat session
// (deduped on chat_id), updated as the thread continues. Returns the matched phone/text so
// the webhook layer can honor STOP.
export async function mirrorInboundSmsRetell(env, ev) {
  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);
    const chat = ev.chat || ev.data || ev || {};
    const chatId = chat.chat_id || chat.id || ev.chat_id || null;
    const fromRaw = chat.customer_number || chat.from_number || chat.phone_number || chat.from
      || (chat.metadata && (chat.metadata.from_number || chat.metadata.phone)) || ev.from_number || "";
    const np = normPhone(fromRaw);
    const isSms = np.length >= 10;

    // Full transcript (Them / Mack lines) + the latest inbound line.
    const msgs = chat.message_with_tool_calls || chat.messages || chat.transcript_object || [];
    let transcript = typeof chat.transcript === "string" ? chat.transcript : "";
    let lastUser = "";
    if (Array.isArray(msgs) && msgs.length) {
      const norm = msgs.map((m) => ({ role: String(m.role || m.author || "").toLowerCase(), content: m.content || m.message || m.text || "" })).filter((m) => m.content);
      if (!transcript) transcript = norm.map((m) => `${/agent|assistant|bot/.test(m.role) ? "Mack" : (isSms ? "Them" : "Website Visitor")}: ${m.content}`).join("\n");
      const users = norm.filter((m) => /user|customer|human/.test(m.role));
      if (users.length) lastUser = users[users.length - 1].content;
    }
    const analysis = chat.chat_analysis || {};
    const summary = analysis.chat_summary || "";
    const cad = analysis.custom_analysis_data || {};
    const email = String(cad.email || chat.email || (chat.metadata && chat.metadata.email) || "").trim().toLowerCase();
    const xTrade = String(cad.trade || "").trim(), xIntent = String(cad.intent || "").trim(), xWebsite = String(cad.website || "").trim(), xName = String(cad.name || "").trim();
    const xWantsCb = cad.wants_callback === true || cad.wants_callback === "true";
    if (!transcript && !lastUser && !summary) return { ok: true, skipped: "no_content", from: fromRaw || np };

    // Thread by the Retell chat SESSION (both SMS + website) so chat_started, live polls,
    // capture_email, and chat_ended all land on ONE conversation — SMS now behaves exactly
    // like website chat (watchable, sweepable, unified). Identity: SMS→phone, web→email; the
    // phone/email is still linked to the contact so a number's history stays together.
    let contactId = null, channel = "chat", threadId = "chat:" + (chatId || (isSms ? np : Date.now())), subject;
    if (isSms) {
      subject = "💬 SMS — " + (fromRaw || np);
      const idr = await env.DB.prepare("SELECT contact_id FROM contact_identifiers WHERE type='phone' AND value=?").bind(np).first().catch(() => null);
      contactId = idr ? idr.contact_id : await findOrCreateContactByIdentifier(env, "phone", np, { source: "inbound_sms" });
    } else if (email && /.+@.+\..+/.test(email)) {
      contactId = await findOrCreateContactByEmail(env, email, { source: "chat" }); subject = "💬 Chat — " + email;
    } else {
      contactId = await findOrCreateContactByIdentifier(env, "chat_session", chatId || String(Date.now()), { source: "chat" }); subject = "💬 Website chat";
    }
    if (!contactId) return { ok: false, error: "no_contact" };
    const c = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
    const companyId = c ? c.company_id : null;

    const now = nowIso();
    const convId = await upsertConversationByThread(env, {
      channel, externalThreadId: threadId, contactId, companyId, sourceDetail: "mack_chat",
      subject, incoming: true, lastAt: now,
      preview: "💬 " + String(lastUser || summary || transcript || "chat").slice(0, 90),
    });
    // A chat that opened as provisional (chat_started, no email yet) → attach the now-known
    // email contact so the finished thread lands on the real person.
    if (contactId) await env.DB.prepare("UPDATE conversations SET contact_id=? WHERE id=?").bind(contactId, convId).run().catch(() => {}); // attach the identified (phone/email) contact over the provisional one

    const lines = [isSms ? "💬 Inbound SMS — Mack (AI)" : "💬 Website chat — Mack (AI)"];
    if (isSms) lines.push("From " + (fromRaw || np));
    else if (email) lines.push("Email: " + email);
    if (summary) lines.push("", "Summary: " + summary);
    // Post-chat extraction fields (Retell pulled these out of the conversation).
    const intel = [xName && ("name: " + xName), xTrade && ("trade: " + xTrade), xIntent && ("intent: " + xIntent), xWebsite && ("website: " + xWebsite), xWantsCb && "⚑ wants a callback"].filter(Boolean);
    if (intel.length) lines.push("Extracted — " + intel.join(" · "));
    if (transcript) lines.push("", transcript);
    else if (lastUser) lines.push("", "Them: " + lastUser);
    const bodyText = lines.join("\n");
    // Fill the contact's name/trade from extraction when we have them.
    if (xName || xTrade) await env.DB.prepare("UPDATE contacts SET full_name=COALESCE(NULLIF(full_name,''), ?), lifecycle_stage=lifecycle_stage WHERE id=?").bind(xName || null, contactId).run().catch(() => {});

    const extId = "retell-chat:" + (chatId || (isSms ? np : email || Date.now()) + ":session");
    const ins = await insertMessageOnce(env, { conversationId: convId, direction: "in", channel: isSms ? "sms" : "chat", externalMessageId: extId, bodyText, sentAt: now });
    if (ins.existed) await env.DB.prepare("UPDATE messages SET body_text=? WHERE external_message_id=?").bind(bodyText, extId).run().catch(() => {});
    await logEvent(env, { type: "replied", contactId, companyId, conversationId: convId, channel: isSms ? "sms" : "chat", source: isSms ? "inbound_sms" : "chat", meta: { chat_id: chatId, from: fromRaw || np || null, email: email || null, via: "retell_chat" } });
    return { ok: true, contactId, conversationId: convId, from: fromRaw || np, email: email || null, text: lastUser };
  } catch (e) { return { ok: false, error: String(e).slice(0, 140) }; }
}

// chat_started → open the CRM conversation immediately (keyed by the chat-session id) with a
// "live" placeholder, so the team sees it the moment a chat begins and can poll it. The
// chat_ended handler above updates this same conversation (same thread + message id) with
// the full transcript. Returns the chat_id so the poller knows what to fetch.
export async function openLiveChat(env, ev) {
  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);
    const chat = ev.chat || ev.data || ev || {};
    const chatId = chat.chat_id || chat.id || null;
    if (!chatId) return { ok: false, skipped: "no_chat_id" };
    const contactId = await findOrCreateContactByIdentifier(env, "chat_session", chatId, { source: "chat" });
    if (!contactId) return { ok: false, error: "no_contact" };
    const c = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
    const now = nowIso();
    const convId = await upsertConversationByThread(env, {
      channel: "chat", externalThreadId: "chat:" + chatId, contactId, companyId: c ? c.company_id : null,
      subject: "💬 Website chat", incoming: true, lastAt: now, sourceDetail: "mack_chat",
      preview: "🟢 Live — chat in progress…",
    });
    await insertMessageOnce(env, { conversationId: convId, direction: "in", channel: "chat", externalMessageId: "retell-chat:" + chatId, bodyText: "🟢 Website chat — Mack (AI) — in progress…\n(live; the transcript fills in as they talk)", sentAt: now });
    await logEvent(env, { type: "replied", contactId, companyId: c ? c.company_id : null, conversationId: convId, channel: "chat", source: "chat", meta: { chat_id: chatId, live: true } });
    return { ok: true, conversationId: convId, contactId, chat_id: chatId };
  } catch (e) { return { ok: false, error: String(e).slice(0, 140) }; }
}

// Cron sweep: mirror inbound + outbound SMS straight from Twilio into the CRM. Retell
// handles the AI reply but does NOT reliably fire chat webhooks for SMS, so we read the
// messages from Twilio (the source of truth) and thread them by phone — a number's texts
// and calls land on one contact. Deduped on the Twilio MessageSid.
export async function sweepTwilioSms(env) {
  const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN, num = env.TWILIO_FROM_NUMBER;
  if (!sid || !tok || !num) return { ok: false, skipped: "no_twilio" };
  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);
    const auth = "Basic " + btoa(sid + ":" + tok);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?PageSize=100`, { headers: { Authorization: auth } });
    if (!res.ok) return { ok: false, status: res.status };
    const j = await res.json().catch(() => ({}));
    const rows = (j.messages || []).filter((m) => m.from === num || m.to === num);
    let mirrored = 0;
    for (const m of rows) {
      const sent = m.date_sent ? Date.parse(m.date_sent) : Date.now();
      // 6-hour window (was 30 min): the sweep is the ONLY reliable path for Retell-handled
      // SMS (Retell doesn't webhook SMS to us), so a transient cron miss must not silently
      // drop a message forever. Idempotent — deduped on the Twilio MessageSid below.
      if (Date.now() - sent > 6 * 60 * 60000) continue;
      const inbound = m.to === num;                  // to our number → from the visitor
      const other = inbound ? m.from : m.to;
      const np = normPhone(other);
      if (np.length < 10) continue;
      const extId = "twilio-sms:" + m.sid;
      const seen = await env.DB.prepare("SELECT 1 x FROM messages WHERE external_message_id=?").bind(extId).first().catch(() => null);
      if (seen) continue;
      const idr = await env.DB.prepare("SELECT contact_id FROM contact_identifiers WHERE type='phone' AND value=?").bind(np).first().catch(() => null);
      const contactId = idr ? idr.contact_id : await findOrCreateContactByIdentifier(env, "phone", np, { source: "sms" });
      if (!contactId) continue;
      const cc = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
      const iso = new Date(sent).toISOString();
      const convId = await upsertConversationByThread(env, {
        channel: "chat", externalThreadId: "phone:" + np, contactId, companyId: cc ? cc.company_id : null, sourceDetail: "sms",
        subject: "💬 SMS — " + other, incoming: inbound, lastAt: iso,
        preview: (inbound ? "💬 " : "↩ ") + String(m.body || "").slice(0, 90),
      });
      await insertMessageOnce(env, { conversationId: convId, direction: inbound ? "in" : "out", channel: "sms", externalMessageId: extId, bodyText: m.body || "", sentAt: iso });
      if (inbound) await reconcileChatFromTranscript(env, convId, m.body || "").catch(() => {}); // catch an email/phone they text in
      mirrored++;
    }
    return { ok: true, mirrored };
  } catch (e) { return { ok: false, error: String(e).slice(0, 140) }; }
}

// Scan a chat/SMS transcript for intel (email, phone) and reconcile the conversation's
// identity — so an "Unknown" chat becomes the real person the moment they drop an email or
// number in the message box, WITHOUT relying on Mack to call the capture tool. Returns the
// resolved email so callers can surface it live. Idempotent + safe to call every poll.
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i;
export async function reconcileChatFromTranscript(env, convId, transcript) {
  try {
    const text = String(transcript || "");
    const em = text.match(EMAIL_RE);
    const email = em ? em[0].toLowerCase().replace(/[.,;:)]+$/, "") : "";
    const phoneM = text.replace(new RegExp(EMAIL_RE.source, "gi"), "").match(/\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/);
    const phone = phoneM ? phoneM[0] : "";
    if (!email && !phone) return { ok: true, none: true };
    const conv = await env.DB.prepare("SELECT contact_id FROM conversations WHERE id=?").bind(convId).first().catch(() => null);
    if (!conv) return { ok: false };
    let contactId = conv.contact_id;
    if (email) {
      const ec = await findOrCreateContactByEmail(env, email, { source: "chat" });
      if (ec) {
        contactId = ec;
        await env.DB.prepare("UPDATE conversations SET contact_id=?, subject=? , updated_at=datetime('now') WHERE id=?").bind(ec, "💬 Chat — " + email, convId).run().catch(() => {});
      }
    }
    if (phone && contactId) { const np = normPhone(phone); if (np.length >= 10) await linkIdentifier(env, contactId, "phone", np); }
    return { ok: true, email: email || null, phone: phone || null, contactId };
  } catch (e) { return { ok: false, error: String(e).slice(0, 120) }; }
}

// Cron sweep (every minute): for each recently-opened website chat, pull the current
// transcript from Retell and refresh the stored copy. This is what actually makes
// website-chat transcripts appear near-real-time — Retell fires chat_ended late or only on
// timeout, so we can't rely on that event alone to populate the thread.
export async function sweepLiveChats(env) {
  if (!env.RETELL_API_KEY) return { ok: false, skipped: "no_retell_key" };
  try {
    await ensureCrmV2Schema(env);
    const cutoff = new Date(Date.now() - 30 * 60000).toISOString(); // active in last 30 min
    const rows = (await env.DB.prepare(
      "SELECT id, external_thread_id FROM conversations WHERE channel='chat' AND external_thread_id LIKE 'chat:%' AND status='open' AND COALESCE(last_message_at, updated_at) > ? ORDER BY COALESCE(last_message_at, updated_at) DESC LIMIT 15"
    ).bind(cutoff).all()).results || [];
    let updated = 0;
    for (const row of rows) {
      const chatId = String(row.external_thread_id || "").slice("chat:".length);
      if (!chatId) continue;
      const r = await fetch(`https://api.retellai.com/get-chat/${encodeURIComponent(chatId)}`, { headers: { Authorization: `Bearer ${env.RETELL_API_KEY}` } });
      if (!r.ok) continue;
      const j = await r.json().catch(() => ({}));
      const msgs = j.message_with_tool_calls || j.messages || j.transcript_object || [];
      let transcript = typeof j.transcript === "string" ? j.transcript : "";
      if (!transcript && Array.isArray(msgs)) {
        transcript = msgs.map((m) => `${/agent|assistant|bot/.test(String(m.role || "").toLowerCase()) ? "Mack" : "Website Visitor"}: ${m.content || m.message || m.text || ""}`).filter((l) => l.trim().length > 5).join("\n");
      }
      if (!transcript) continue;
      const ended = /end/i.test(String(j.chat_status || j.status || ""));
      const body = "🟢 Website chat — Mack (AI)" + (ended ? " (ended)" : " — live") + "\n\n" + transcript;
      // Only mark the conversation unread / bump last_message_at when the transcript actually
      // GREW. Otherwise a chat you've already read gets re-flagged unread every minute (the
      // sweep re-fetches the same transcript) and can never be cleared.
      const prev = await env.DB.prepare("SELECT body_text FROM messages WHERE external_message_id=?").bind("retell-chat:" + chatId).first().catch(() => null);
      const changed = !prev || prev.body_text !== body;
      await env.DB.prepare("UPDATE messages SET body_text=? WHERE external_message_id=?").bind(body, "retell-chat:" + chatId).run().catch(() => {});
      const last = transcript.split("\n").filter(Boolean).slice(-1)[0] || "chat";
      if (changed) {
        await env.DB.prepare("UPDATE conversations SET last_message_preview=?, last_message_at=datetime('now'), unread=1, updated_at=datetime('now') WHERE id=?").bind((ended ? "💬 " : "🟢 ") + last.slice(0, 90), row.id).run().catch(() => {});
      } else {
        await env.DB.prepare("UPDATE conversations SET last_message_preview=?, updated_at=datetime('now') WHERE id=?").bind((ended ? "💬 " : "🟢 ") + last.slice(0, 90), row.id).run().catch(() => {});
      }
      await reconcileChatFromTranscript(env, row.id, transcript).catch(() => {}); // identify from any email/phone in the chat
      updated++;
    }
    return { ok: true, swept: rows.length, updated };
  } catch (e) { return { ok: false, error: String(e).slice(0, 140) }; }
}
