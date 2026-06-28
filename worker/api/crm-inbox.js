// CRM v2 unified inbox — Gmail (hello@) ingest + read (BUILD-PLAN P1-2/P1-6/P1-7 v0).
//   GET /api/crm/inbox            -> { conversations: [...] }  (open, newest first)
//   GET /api/crm/inbox?id=<id>    -> { conversation, messages: [...] }
//   GET /api/crm/inbox?poll=1     -> manual ingest of the configured mailbox(es), returns summary
// Inbound is pulled directly into D1 (no Queue for the MVP — added at scale). The
// mailbox(es) to ingest: CRM_INBOX_EMAILS (comma-sep), default hello@consentresolve.com.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { gAccessToken, sendMessage } from "../_lib/gmail.js";
import { sendInstantlyReply } from "./crm-instantly.js";
import { sendCrispMessage, getCrispTranscript } from "./crm-crisp.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce, ulid, currentUser, adminUserId, addActivityV2, isAdmin } from "../_lib/crm-v2.js";

function inboxAccounts(env) {
  return (env.CRM_INBOX_EMAILS || "hello@consentresolve.com").split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}
const hdr = (headers, name) => { const h = (headers || []).find((x) => x.name.toLowerCase() === name); return h ? h.value : ""; };
function emailOf(s) { const m = String(s || "").match(/<([^>]+)>/); return (m ? m[1] : String(s || "")).trim().toLowerCase(); }
function nameOf(s) { const m = String(s || "").match(/^\s*"?([^"<]*?)"?\s*</); return m ? m[1].trim() : ""; }
function decodeB64Url(d) {
  try { const bin = atob(String(d || "").replace(/-/g, "+").replace(/_/g, "/")); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder().decode(b); }
  catch (_) { return ""; }
}
function extractBody(payload) {
  let text = "", html = "";
  (function walk(p) {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body && p.body.data) text += decodeB64Url(p.body.data);
    else if (p.mimeType === "text/html" && p.body && p.body.data) html += decodeB64Url(p.body.data);
    (p.parts || []).forEach(walk);
  })(payload);
  return { text: text.trim(), html: html.trim() };
}

// Ingest recent inbox mail for one connected account into conversations/messages.
export async function pollEmailInbox(env, account) {
  const tok = await gAccessToken(env, account);
  if (!tok) return { account, error: "no_token" };
  const q = encodeURIComponent("in:inbox newer_than:14d");
  const lr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=40&q=" + q, { headers: { Authorization: "Bearer " + tok } });
  const lj = await lr.json();
  if (lj.error) return { account, error: (lj.error && lj.error.message) || "list_failed" };
  let ingested = 0, seen = 0;
  for (const ref of (lj.messages || [])) {
    seen++;
    const mr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + ref.id + "?format=full", { headers: { Authorization: "Bearer " + tok } });
    const m = await mr.json();
    if (m.error) continue;
    const headers = (m.payload && m.payload.headers) || [];
    const fromEmail = emailOf(hdr(headers, "from"));
    const toEmail = emailOf(hdr(headers, "to"));
    const subject = hdr(headers, "subject");
    const dateHdr = hdr(headers, "date");
    const msgId = hdr(headers, "message-id") || m.id;
    const inReplyTo = hdr(headers, "in-reply-to") || hdr(headers, "references") || null;
    const outbound = fromEmail === account;
    const other = outbound ? toEmail : fromEmail;
    if (!other) continue;
    const sentAt = m.internalDate ? new Date(Number(m.internalDate)).toISOString() : (dateHdr || null);
    const { text, html } = extractBody(m.payload);
    const contactId = await findOrCreateContactByEmail(env, other, { name: outbound ? "" : nameOf(hdr(headers, "from")), source: "email" });
    const convId = await upsertConversationByThread(env, {
      channel: "email", externalThreadId: m.threadId, contactId, subject,
      incoming: !outbound, lastAt: sentAt, preview: (m.snippet || text || "").slice(0, 160),
    });
    const r = await insertMessageOnce(env, {
      conversationId: convId, direction: outbound ? "out" : "in", channel: "email",
      externalMessageId: msgId, inReplyTo, bodyText: text || m.snippet || "", bodyHtml: html, sentAt,
    });
    if (!r.existed) ingested++;
  }
  return { account, seen, ingested };
}

export async function pollAllInboxes(env) {
  await ensureCrmV2Schema(env);
  const out = [];
  for (const acct of inboxAccounts(env)) out.push(await pollEmailInbox(env, acct));
  return out;
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  const url = new URL(request.url);

  if (url.searchParams.get("poll") === "1") {
    return json({ ok: true, polled: await pollAllInboxes(env), accounts: inboxAccounts(env) }, {}, cors);
  }

  // Debug: list recent mail across ALL labels (not just inbox) with labelIds, so we can
  // see where a message landed (Spam/archived) vs. what the in:inbox poll matches. Admin-only.
  if (url.searchParams.get("debug") === "1") {
    if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);
    const out = [];
    for (const acct of inboxAccounts(env)) {
      const tok = await gAccessToken(env, acct);
      if (!tok) { out.push({ account: acct, error: "no_token" }); continue; }
      const lr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=" + encodeURIComponent("newer_than:2d"), { headers: { Authorization: "Bearer " + tok } });
      const lj = await lr.json();
      const msgs = [];
      for (const ref of (lj.messages || []).slice(0, 15)) {
        const mr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + ref.id + "?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date", { headers: { Authorization: "Bearer " + tok } });
        const m = await mr.json();
        const h = {}; ((m.payload && m.payload.headers) || []).forEach((x) => { h[x.name.toLowerCase()] = x.value; });
        msgs.push({ from: h.from || "", subject: h.subject || "", date: h.date || "", labels: m.labelIds || [] });
      }
      out.push({ account: acct, q: "newer_than:2d (all labels)", count: (lj.messages || []).length, messages: msgs });
    }
    return json({ debug: out }, {}, cors);
  }

  const id = url.searchParams.get("id");
  if (id) {
    const conv = await env.DB.prepare(
      `SELECT cv.*, c.full_name, c.primary_email, co.name AS company_name
         FROM conversations cv LEFT JOIN contacts c ON c.id=cv.contact_id
         LEFT JOIN companies co ON co.id=cv.company_id WHERE cv.id=?`
    ).bind(id).first();
    if (!conv) return json({ error: "not_found" }, { status: 404 }, cors);
    // For Crisp, pull the full transcript (both sides) live and sync it in, so the CRM
    // shows the whole chat — not just the visitor's incoming messages. No-op without creds.
    if (conv.channel === "crisp") {
      try {
        const tx = await getCrispTranscript(env, conv.external_thread_id);
        for (const m of (tx || [])) {
          const text = typeof m.content === "string" ? m.content : (m.content && (m.content.text || m.content.value)) || "";
          if (!text) continue;
          await insertMessageOnce(env, {
            conversationId: id, direction: m.from === "operator" ? "out" : "in", channel: "crisp",
            externalMessageId: m.fingerprint != null ? String(m.fingerprint) : null,
            bodyText: text, sentAt: m.timestamp ? new Date(m.timestamp).toISOString() : null,
          });
        }
      } catch (_) {}
    }
    const msgs = (await env.DB.prepare(
      "SELECT id, direction, channel, body_text, body_html, sent_at, created_at FROM messages WHERE conversation_id=? ORDER BY COALESCE(sent_at, created_at) ASC"
    ).bind(id).all()).results || [];
    let contact = null, company = null;
    if (conv.contact_id) {
      contact = await env.DB.prepare("SELECT * FROM contacts WHERE id=?").bind(conv.contact_id).first();
      if (contact && contact.company_id) company = await env.DB.prepare("SELECT * FROM companies WHERE id=?").bind(contact.company_id).first();
    }
    const users = (await env.DB.prepare("SELECT id, name FROM users WHERE active=1 ORDER BY name").all()).results || [];
    const notes = (await env.DB.prepare(
      "SELECT n.id, n.body, n.created_at, u.name AS author FROM notes n LEFT JOIN users u ON u.id=n.author_id WHERE n.conversation_id=? ORDER BY n.created_at DESC"
    ).bind(id).all()).results || [];
    await env.DB.prepare("UPDATE conversations SET unread=0 WHERE id=?").bind(id).run();
    return json({ conversation: conv, messages: msgs, contact, company, users, notes }, {}, cors);
  }

  const status = url.searchParams.get("status") || "open";
  const rows = (await env.DB.prepare(
    `SELECT cv.id, cv.channel, cv.subject, cv.status, cv.unread, cv.last_message_at, cv.last_message_preview,
            cv.assignee_id, c.full_name, c.primary_email, co.name AS company_name
       FROM conversations cv LEFT JOIN contacts c ON c.id=cv.contact_id
       LEFT JOIN companies co ON co.id=cv.company_id
      WHERE cv.status=? ORDER BY COALESCE(cv.last_message_at, cv.updated_at) DESC LIMIT 200`
  ).bind(status).all()).results || [];
  return json({ conversations: rows }, {}, cors);
}

// Status machine A/B/C (BUILD-PLAN P1-9): open | snoozed(+snooze_days) | archived.
// (D=Convert-to-Lead lands with the pipeline slice.)
export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (!b.id) return json({ error: "id_required" }, { status: 400 }, cors);

  // Reply, send-to-origin (BUILD-PLAN P1-8). Routes by channel: email→Gmail (hello@),
  // instantly→Instantly reply (warmed mailbox), crisp→Crisp REST, meta_lead/demo_form→
  // email to the captured address (spec §5: form sources reply by email, never Messenger).
  // Logs the reply to activities with the sending rep (per-rep attribution).
  if (b.reply !== undefined) {
    const body = String(b.reply || "").trim();
    if (!body) return json({ error: "empty_reply" }, { status: 400 }, cors);
    const conv = await env.DB.prepare(
      "SELECT cv.*, c.primary_email FROM conversations cv LEFT JOIN contacts c ON c.id=cv.contact_id WHERE cv.id=?"
    ).bind(b.id).first();
    if (!conv) return json({ error: "not_found" }, { status: 404 }, cors);
    const me = await currentUser(request, env);
    const authorId = me ? me.id : null;
    const subj = conv.subject ? "Re: " + conv.subject.replace(/^re:\s*/i, "") : "Re: your inquiry";
    let externalId = null, sentVia = conv.channel;

    if (conv.channel === "email") {
      const to = conv.primary_email;
      if (!to) return json({ error: "no_recipient" }, { status: 400 }, cors);
      const res = await sendMessage(env, conv.channel_account_id || inboxAccounts(env)[0], to, subj, body, conv.external_thread_id);
      if (res.error) return json({ error: res.error }, { status: 400 }, cors);
      externalId = res.id;
    } else if (conv.channel === "meta_lead" || conv.channel === "demo_form") {
      const to = conv.primary_email;
      if (!to) return json({ error: "no_email", message: "No email on file for this lead — call only." }, { status: 400 }, cors);
      const res = await sendMessage(env, inboxAccounts(env)[0], to, subj, body, null); // new email thread, not Messenger
      if (res.error) return json({ error: res.error }, { status: 400 }, cors);
      externalId = res.id; sentVia = "email";
    } else if (conv.channel === "instantly") {
      const eaccount = conv.channel_account_id;
      if (!eaccount) return json({ error: "no_eaccount" }, { status: 400 }, cors);
      const last = await env.DB.prepare(
        "SELECT external_message_id FROM messages WHERE conversation_id=? AND external_message_id IS NOT NULL ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1"
      ).bind(conv.id).first();
      if (!last || !last.external_message_id) return json({ error: "no_reply_target" }, { status: 400 }, cors);
      const res = await sendInstantlyReply(env, { eaccount, replyToUuid: last.external_message_id, subject: subj, body });
      if (res.error) return json({ error: res.error }, { status: 400 }, cors);
      externalId = res.id;
    } else if (conv.channel === "crisp") {
      const res = await sendCrispMessage(env, conv.external_thread_id, body);
      if (res.error) return json({ error: res.error, message: res.message }, { status: 400 }, cors);
      externalId = res.id;
    } else {
      return json({ error: "unsupported_channel", channel: conv.channel }, { status: 400 }, cors);
    }

    const now = new Date().toISOString();
    await insertMessageOnce(env, { conversationId: conv.id, direction: "out", channel: conv.channel, authorId, externalMessageId: externalId, bodyText: body, sentAt: now });
    await env.DB.prepare("UPDATE conversations SET last_message_at=?, last_message_preview=?, unread=0, updated_at=datetime('now') WHERE id=?").bind(now, body.slice(0, 160), conv.id).run();
    await addActivityV2(env, { actorId: authorId, entityType: "conversation", entityId: conv.id, action: "replied", meta: { channel: conv.channel, via: sentVia } });
    return json({ ok: true, sent: sentVia }, {}, cors);
  }

  // Assign a conversation to a rep (A — inbox assignment, spec §7).
  if (b.assignee_id !== undefined) {
    const aid = b.assignee_id || null;
    if (aid) { const u = await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(aid).first(); if (!u) return json({ error: "bad_user" }, { status: 400 }, cors); }
    await env.DB.prepare("UPDATE conversations SET assignee_id=?, updated_at=datetime('now') WHERE id=?").bind(aid, b.id).run();
    const me = await currentUser(request, env);
    await addActivityV2(env, { actorId: me ? me.id : null, entityType: "conversation", entityId: b.id, action: "assigned", meta: { assignee_id: aid } });
    return json({ ok: true, assignee_id: aid }, {}, cors);
  }

  // Add an internal note on the conversation (A — notes, spec §3).
  if (b.note !== undefined) {
    const text = String(b.note || "").trim();
    if (!text) return json({ error: "empty_note" }, { status: 400 }, cors);
    const conv = await env.DB.prepare("SELECT contact_id FROM conversations WHERE id=?").bind(b.id).first();
    if (!conv) return json({ error: "not_found" }, { status: 404 }, cors);
    const me = await currentUser(request, env);
    await env.DB.prepare("INSERT INTO notes (id, author_id, conversation_id, contact_id, body) VALUES (?, ?, ?, ?, ?)").bind(ulid(), me ? me.id : null, b.id, conv.contact_id || null, text).run();
    await addActivityV2(env, { actorId: me ? me.id : null, entityType: "conversation", entityId: b.id, action: "note" });
    return json({ ok: true }, {}, cors);
  }

  // Convert to Lead (status D, BUILD-PLAN P3-4): create a deal from the conversation,
  // mark it converted (stays linked + replyable).
  if (b.convert) {
    const conv = await env.DB.prepare("SELECT * FROM conversations WHERE id=?").bind(b.id).first();
    if (!conv) return json({ error: "not_found" }, { status: 404 }, cors);
    let companyId = conv.company_id;
    if (!companyId && conv.contact_id) {
      const ct = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(conv.contact_id).first();
      companyId = ct && ct.company_id;
    }
    if (!companyId) return json({ error: "no_company" }, { status: 400 }, cors);
    const me = await currentUser(request, env);
    const owner = me ? me.id : await adminUserId(env);
    const dealId = ulid();
    await env.DB.prepare(
      "INSERT INTO deals (id, company_id, primary_contact_id, origin_conversation_id, owner_id, title, lead_status) VALUES (?, ?, ?, ?, ?, ?, 'active')"
    ).bind(dealId, companyId, conv.contact_id || null, conv.id, owner, conv.subject || "New deal").run();
    await env.DB.prepare("UPDATE conversations SET status='converted', updated_at=datetime('now') WHERE id=?").bind(conv.id).run();
    await addActivityV2(env, { actorId: owner, entityType: "deal", entityId: dealId, action: "converted", meta: { conversation_id: conv.id } });
    return json({ ok: true, deal_id: dealId }, {}, cors);
  }

  const status = ["open", "snoozed", "archived"].includes(b.status) ? b.status : "open";
  let snooze = null;
  if (status === "snoozed") snooze = new Date(Date.now() + (Number(b.snooze_days) || 3) * 86400000).toISOString();
  await env.DB.prepare(
    "UPDATE conversations SET status=?, snooze_until=?, updated_at=datetime('now') WHERE id=?"
  ).bind(status, snooze, b.id).run();
  return json({ ok: true, status, snooze_until: snooze }, {}, cors);
}

// Snooze sweep (BUILD-PLAN P1-10): resurface due conversations. Called from the cron.
export async function sweepSnoozed(env) {
  await ensureCrmV2Schema(env);
  const r = await env.DB.prepare(
    "UPDATE conversations SET status='open', unread=1, updated_at=datetime('now') WHERE status='snoozed' AND snooze_until IS NOT NULL AND snooze_until<=datetime('now')"
  ).run();
  return (r.meta && r.meta.changes) || 0;
}
