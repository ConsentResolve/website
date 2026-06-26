// CRM v2 unified inbox — Gmail (hello@) ingest + read (BUILD-PLAN P1-2/P1-6/P1-7 v0).
//   GET /api/crm/inbox            -> { conversations: [...] }  (open, newest first)
//   GET /api/crm/inbox?id=<id>    -> { conversation, messages: [...] }
//   GET /api/crm/inbox?poll=1     -> manual ingest of the configured mailbox(es), returns summary
// Inbound is pulled directly into D1 (no Queue for the MVP — added at scale). The
// mailbox(es) to ingest: CRM_INBOX_EMAILS (comma-sep), default hello@consentresolve.com.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { gAccessToken } from "../_lib/gmail.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";

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

  const id = url.searchParams.get("id");
  if (id) {
    const conv = await env.DB.prepare(
      `SELECT cv.*, c.full_name, c.primary_email, co.name AS company_name
         FROM conversations cv LEFT JOIN contacts c ON c.id=cv.contact_id
         LEFT JOIN companies co ON co.id=cv.company_id WHERE cv.id=?`
    ).bind(id).first();
    if (!conv) return json({ error: "not_found" }, { status: 404 }, cors);
    const msgs = (await env.DB.prepare(
      "SELECT id, direction, channel, body_text, body_html, sent_at, created_at FROM messages WHERE conversation_id=? ORDER BY COALESCE(sent_at, created_at) ASC"
    ).bind(id).all()).results || [];
    await env.DB.prepare("UPDATE conversations SET unread=0 WHERE id=?").bind(id).run();
    return json({ conversation: conv, messages: msgs }, {}, cors);
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
