// Chat/SMS email capture — POST /api/chat-capture
// Mack's `capture_email` tool fires this the moment a visitor shares their email in the
// website chat OR by SMS. Upserts a CRM contact by email and opens a conversation so the
// lead is captured in real time (not just at chat end). Channel 'email' so the team can
// reply from the Inbox; source 'chat' tags where it came from. Also callable as a plain
// form ({email,name,...}); Retell wraps tool params in `args`.
import { json, corsHeaders } from "../_lib/http.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";
import { ensureRebuildSchema, logEvent } from "../_lib/crm-rebuild.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  let body = {};
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }
  const src = body.args || body.arguments || body;
  const email = String(src.email || body.email || "").trim().toLowerCase();
  const name = String(src.name || src.first_name || body.name || "").trim();
  if (!email || !/.+@.+\..+/.test(email)) {
    return json({ ok: false, error: "need_email", message: "That email didn't look right — mind spelling it out?" }, { status: 200 }, cors);
  }
  const trade = String(src.trade || body.trade || "").trim();
  const company = String(src.company || body.company || "").trim();
  const note = String(src.note || body.note || "").trim();

  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);
    const contactId = await findOrCreateContactByEmail(env, email, { name: name || null, company: company || null, source: "chat" });
    if (!contactId) return json({ ok: false, error: "no_contact", message: "Got it — I'll have a teammate follow up." }, { status: 200 }, cors);
    const c = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
    const companyId = c ? c.company_id : null;

    const now = new Date().toISOString();
    const convId = await upsertConversationByThread(env, {
      channel: "email", externalThreadId: "chat-email:" + email, contactId, companyId,
      subject: "💬 Chat — " + (name || email), sourceDetail: "mack_chat", incoming: true, lastAt: now,
      preview: "💬 Email captured in chat" + (trade ? " · " + trade : ""),
    });
    const lines = ["💬 Email captured by Mack (chat/SMS)", "Email: " + email, "Name: " + (name || "—")];
    if (company) lines.push("Company: " + company);
    if (trade) lines.push("Trade: " + trade);
    if (note) lines.push("Note: " + note);
    await insertMessageOnce(env, { conversationId: convId, direction: "in", channel: "chat", externalMessageId: "chat-capture:" + email + ":" + now, bodyText: lines.join("\n"), sentAt: now });
    await logEvent(env, { type: "lead_created", contactId, companyId, conversationId: convId, channel: "chat", source: "chat", meta: { via: "capture_email", trade: trade || null, company: company || null } });

    return json({ ok: true, message: "Perfect — got your email. I'll make sure the right details reach you." }, {}, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160), message: "Got it — a teammate will follow up by email." }, { status: 500 }, cors);
  }
}
