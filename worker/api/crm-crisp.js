// Crisp chat webhook -> CRM lead. Register the URL (with ?key=<CRM_WEBHOOK_TOKEN>)
// in Crisp → Settings → Webhooks. Any event that carries a visitor email becomes
// a consented lead (they volunteered contact in chat); the message is logged.
// Always returns 200 so Crisp doesn't disable the hook on a parse miss.
import { json } from "../_lib/http.js";
import { crmWebhookToken, upsertLead, addActivity } from "../_lib/crm.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, findOrCreateContactByIdentifier, linkIdentifier, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function deepFind(obj, keys, depth) {
  if (!obj || typeof obj !== "object" || (depth || 0) > 4) return null;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (keys.includes(k.toLowerCase()) && v && typeof v !== "object") return v;
  }
  for (const k of Object.keys(obj)) {
    const v = deepFind(obj[k], keys, (depth || 0) + 1);
    if (v) return v;
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  if ((new URL(request.url).searchParams.get("key") || "") !== crmWebhookToken(env)) return json({ error: "unauthorized" }, { status: 401 });
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: true, skipped: "bad_json" }); }
  try {
    const email = String(deepFind(body, ["email", "user_email"], 0) || "").toLowerCase();
    const name = String(deepFind(body, ["nickname", "name", "first_name"], 0) || "");
    const session = String(deepFind(body, ["session_id", "session"], 0) || "");
    const content = deepFind(body, ["content", "message", "excerpt"], 0);
    const hasEmail = EMAIL_RE.test(email);

    // v2 unified inbox: capture the conversation (anonymous visitors too, keyed on session).
    await ensureCrmV2Schema(env);
    let contactId = null;
    if (hasEmail) {
      contactId = await findOrCreateContactByEmail(env, email, { name, source: "crisp" });
      if (session) await linkIdentifier(env, contactId, "crisp_session", session);
    } else if (session) {
      contactId = await findOrCreateContactByIdentifier(env, "crisp_session", session, { name, source: "crisp" });
    }
    if (contactId && (session || email)) {
      const convId = await upsertConversationByThread(env, {
        channel: "crisp", externalThreadId: session || email, contactId,
        subject: name ? "Chat with " + name : "Crisp chat", incoming: true,
        lastAt: new Date().toISOString(), preview: content ? String(content).slice(0, 160) : "Crisp chat",
      });
      await insertMessageOnce(env, {
        conversationId: convId, direction: "in", channel: "crisp",
        externalMessageId: deepFind(body, ["fingerprint", "message_id", "id"], 0) || null,
        bodyText: content ? String(content) : "", sentAt: new Date().toISOString(),
      });
    }

    // Legacy lead (kept during transition) — only when an email is present.
    if (hasEmail) {
      const id = await upsertLead(env, { source: "crisp", email, name, consent_status: "consented" });
      await addActivity(env, id, "chat", "Crisp chat" + (content ? ": " + String(content).slice(0, 200) : ""), "crisp");
    }
    return json({ ok: true, channel: "crisp", contact: contactId, had_email: hasEmail });
  } catch (e) { return json({ ok: true, error: String(e).slice(0, 120) }); }
}
