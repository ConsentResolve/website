// Chat/SMS detail capture — POST /api/chat-capture
// Mack's `capture_email` tool fires this the moment a visitor shares their email / phone /
// details in the website chat or by SMS. Instead of creating a NEW record, it UPDATES the
// current live chat conversation: identifies the (previously provisional) contact by email,
// attaches the phone, and logs the captured intel as a note on that same thread.
// Correlates to the live chat by the Retell chat id (passed in the tool-call body), falling
// back to the most-recent open live chat. Retell wraps tool params in `args`.
import { json, corsHeaders } from "../_lib/http.js";
import {
  ensureCrmV2Schema, findOrCreateContactByEmail, findOrCreateContactByIdentifier,
  upsertConversationByThread, insertMessageOnce, linkIdentifier, normPhone,
} from "../_lib/crm-v2.js";
import { ensureRebuildSchema, logEvent } from "../_lib/crm-rebuild.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  let body = {};
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }
  const src = body.args || body.arguments || body;

  // Fields come from the tool args (src). Do NOT fall back to body.* — Retell puts the
  // FUNCTION name at body.name ("capture_email"), which was polluting the contact name.
  const email = String(src.email || "").trim().toLowerCase();
  let name = String(src.name || src.first_name || "").trim();
  if (/^capture_email$|^request_contact$/i.test(name)) name = ""; // guard against the function name leaking in
  const phoneRaw = String(src.phone || "").trim();
  const np = normPhone(phoneRaw);
  const trade = String(src.trade || "").trim();
  const company = String(src.company || "").trim();
  const website = String(src.website || "").trim();
  const note = String(src.note || "").trim();
  // The live chat session id — Retell passes the chat context alongside the tool args.
  const chatId = String((body.chat && (body.chat.chat_id || body.chat.id)) || (body.call && body.call.chat_id) || body.chat_id || src.chat_id || "").trim();

  const hasEmail = email && /.+@.+\..+/.test(email);
  const hasPhone = np.length >= 10;
  // Accept ANY intel — name/website/trade too — and attach it to the live chat record.
  if (!hasEmail && !hasPhone && !name && !website && !company && !trade) {
    return json({ ok: true, note: "no_intel" }, { status: 200 }, cors);
  }

  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);

    // Find the live chat first, so soft intel (name/website only) can attach to it.
    let live = chatId
      ? await env.DB.prepare("SELECT id, contact_id FROM conversations WHERE channel='chat' AND external_thread_id=?").bind("chat:" + chatId).first().catch(() => null)
      : null;
    if (!live) {
      const cutoff = new Date(Date.now() - 15 * 60000).toISOString();
      live = await env.DB.prepare(
        "SELECT id, contact_id FROM conversations WHERE channel='chat' AND external_thread_id LIKE 'chat:%' AND status='open' AND COALESCE(last_message_at, updated_at) > ? ORDER BY COALESCE(last_message_at, updated_at) DESC LIMIT 1"
      ).bind(cutoff).first().catch(() => null);
    }

    // Strongest contact: email, else phone, else the live chat's existing (provisional) one.
    let contactId = hasEmail
      ? await findOrCreateContactByEmail(env, email, { name: name || null, company: company || null, source: "chat" })
      : hasPhone
      ? await findOrCreateContactByIdentifier(env, "phone", np, { name: name || null, company: company || null, source: "chat" })
      : (live ? live.contact_id : null);
    if (!contactId) return json({ ok: true, note: "no_target" }, { status: 200 }, cors);
    if (hasEmail && hasPhone) await linkIdentifier(env, contactId, "phone", np);
    // Fill the name if we learned it and the contact has none yet.
    if (name) await env.DB.prepare("UPDATE contacts SET full_name=? WHERE id=? AND (full_name IS NULL OR full_name='')").bind(name, contactId).run().catch(() => {});
    const c = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
    const companyId = c ? c.company_id : null;
    const now = new Date().toISOString();

    let convId;
    if (live) {
      convId = live.id;
      await env.DB.prepare(
        "UPDATE conversations SET contact_id=?, company_id=COALESCE(company_id, ?), subject=?, last_message_preview=?, updated_at=datetime('now') WHERE id=?"
      ).bind(contactId, companyId, "💬 Chat — " + (name || email || phoneRaw || "visitor"), "📇 " + (email || phoneRaw || name || website), convId).run().catch(() => {});
    } else {
      // No live chat (plain form / SMS with no session) → open a chat record keyed by identity.
      const tk = hasEmail ? "chat-email:" + email : "chat-phone:" + np;
      convId = await upsertConversationByThread(env, {
        channel: "email", externalThreadId: tk, contactId, companyId, sourceDetail: "mack_chat",
        subject: "💬 Chat — " + (name || email || phoneRaw), incoming: true, lastAt: now,
        preview: "📇 Details captured in chat",
      });
    }

    // Log the captured intel as a note on that same conversation.
    const parts = ["📇 Captured during chat:"];
    if (email) parts.push("Email: " + email);
    if (hasPhone) parts.push("Phone: " + phoneRaw);
    if (name) parts.push("Name: " + name);
    if (company) parts.push("Company: " + company);
    if (website) parts.push("Website: " + website);
    if (trade) parts.push("Trade: " + trade);
    if (note) parts.push("Note: " + note);
    await insertMessageOnce(env, { conversationId: convId, direction: "in", channel: "chat", externalMessageId: "chat-capture:" + (chatId || email || np) + ":" + now, bodyText: parts.join("\n"), sentAt: now });
    await logEvent(env, { type: "lead_created", contactId, companyId, conversationId: convId, channel: "chat", source: "chat", meta: { via: "capture_email", chat_id: chatId || null, email: email || null, phone: hasPhone ? np : null, trade: trade || null } });

    return json({ ok: true, message: "Perfect — got your details. I'll make sure the right info reaches you." }, {}, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160), message: "Got it — a teammate will follow up." }, { status: 500 }, cors);
  }
}
