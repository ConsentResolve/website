// POST /api/chat-lead — browser-safe capture from the in-widget "Mack" card.
// Records a name + (email OR phone) + the visitor's preferred channel, attaches it to their
// live chat conversation, and logs the preference as a note. CAPTURE-ONLY — it never fires a
// call or text (that's /api/chat-call). Deliberately public (a lead form like /demo), so the
// widget can POST it from the browser; guarded by requiring a valid email or 10-digit phone.
import { json, corsHeaders } from "../_lib/http.js";
import {
  ensureCrmV2Schema, findOrCreateContactByEmail, findOrCreateContactByIdentifier,
  linkIdentifier, normPhone, ulid,
} from "../_lib/crm-v2.js";
import { ensureRebuildSchema, logEvent } from "../_lib/crm-rebuild.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  let b = {};
  try { b = await request.json(); } catch (_) { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }

  const email = String(b.email || "").trim().toLowerCase();
  let name = String(b.name || "").trim().slice(0, 80);
  const np = normPhone(String(b.phone || "").trim());
  const pref = ["email", "text", "call"].includes(String(b.pref || "").toLowerCase()) ? String(b.pref).toLowerCase() : "email";
  const hasEmail = email && /.+@.+\..+/.test(email) && email.length < 160;
  const hasPhone = np.length >= 10;
  if (!hasEmail && !hasPhone) return json({ ok: false, error: "need_contact" }, { status: 200 }, cors);

  try {
    await ensureCrmV2Schema(env); await ensureRebuildSchema(env);

    // Attach to the visitor's most-recent open live chat (last 20 min) so the capture lands on
    // the SAME conversation they're chatting in, not an orphan record.
    const cutoff = new Date(Date.now() - 20 * 60000).toISOString();
    const live = await env.DB.prepare(
      "SELECT id, contact_id FROM conversations WHERE channel='chat' AND external_thread_id LIKE 'chat:%' AND status='open' AND COALESCE(last_message_at, updated_at) > ? ORDER BY COALESCE(last_message_at, updated_at) DESC LIMIT 1"
    ).bind(cutoff).first().catch(() => null);

    let contactId = hasEmail
      ? await findOrCreateContactByEmail(env, email, { name: name || null, source: "chat" })
      : await findOrCreateContactByIdentifier(env, "phone", np, { name: name || null, source: "chat" });
    if (!contactId && live) contactId = live.contact_id;
    if (!contactId) return json({ ok: true, note: "no_target" }, { status: 200 }, cors);

    if (hasEmail && hasPhone) await linkIdentifier(env, contactId, "phone", np).catch(() => {});
    if (name) await env.DB.prepare("UPDATE contacts SET full_name=? WHERE id=? AND (full_name IS NULL OR full_name='')").bind(name, contactId).run().catch(() => {});
    // Point the live chat at the now-identified contact so the thread + this capture unify.
    if (live && live.id) await env.DB.prepare("UPDATE conversations SET contact_id=COALESCE(contact_id, ?) WHERE id=?").bind(contactId, live.id).run().catch(() => {});

    const co = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
    const companyId = co ? co.company_id : null;

    const prefLabel = pref === "text" ? "text (SMS)" : pref === "call" ? "a call" : "email";
    const noteBody = "💬 Chat capture — wants us to reach out by " + prefLabel + "."
      + (hasEmail ? "  ✉ " + email : "") + (hasPhone ? "  📞 +1" + np : "") + (name ? "  ·  " + name : "");
    if (live && live.id) {
      try { await env.DB.prepare("INSERT INTO notes (id, author_id, conversation_id, contact_id, body) VALUES (?, NULL, ?, ?, ?)").bind(ulid(), live.id, contactId, noteBody).run(); } catch (_) {}
    }
    await logEvent(env, { type: "replied", contactId, companyId, conversationId: live ? live.id : null, channel: "chat", source: "chat", meta: { capture: "widget_card", pref, email: email || null, phone: hasPhone ? np : null } }).catch(() => {});

    return json({ ok: true, pref }, {}, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, { status: 200 }, cors);
  }
}
