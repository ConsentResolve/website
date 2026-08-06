// CRM v2 unified inbox — Gmail (hello@) ingest + read (BUILD-PLAN P1-2/P1-6/P1-7 v0).
//   GET /api/crm/inbox            -> { conversations: [...] }  (open, newest first)
//   GET /api/crm/inbox?id=<id>    -> { conversation, messages: [...] }
//   GET /api/crm/inbox?poll=1     -> manual ingest of the configured mailbox(es), returns summary
// Inbound is pulled directly into D1 (no Queue for the MVP — added at scale). The
// mailbox(es) to ingest: CRM_INBOX_EMAILS (comma-sep), default hello@consentresolve.com.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { gAccessToken, sendMessage, trashThread } from "../_lib/gmail.js";
import { sendInstantlyReply } from "./crm-instantly.js";
import { sendTestSms as sendSms } from "../_lib/stl/twilio.js";
import { sendCrispMessage, getCrispTranscript } from "./crm-crisp.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, findOrCreateContactByIdentifier, findOrCreateCompany, normPhone, upsertConversationByThread, insertMessageOnce, ulid, currentUser, adminUserId, addActivityV2, isAdmin, createTask } from "../_lib/crm-v2.js";
import { handleGoalEvent, enrollNurture } from "../_lib/workflow-engine.js";
import { getByEmail } from "../_lib/db.js";
import { progressFor } from "../_lib/demo-notify.js";
import { addSuppression, isSuppressed, logEvent } from "../_lib/crm-rebuild.js";

// Recognize a delivery-failure (DSN / bounce) email so we can suppress the dead address
// instead of ingesting the mailer-daemon notice as a normal inbound conversation.
function isBounce(fromEmail, subject, payload) {
  const f = String(fromEmail || "").toLowerCase();
  if (/mailer-daemon@|postmaster@/.test(f)) return true;
  if (/(delivery status notification|undeliverable|mail delivery (failed|subsystem)|returned mail|failure notice)/i.test(subject || "")) return true;
  // multipart/report; report-type=delivery-status is the RFC-3464 tell.
  const ct = String((payload && payload.mimeType) || "");
  if (/multipart\/report/i.test(ct)) return true;
  const hasDsnPart = (function walk(p) {
    if (!p) return false;
    if (/message\/delivery-status/i.test(p.mimeType || "")) return true;
    return (p.parts || []).some(walk);
  })(payload);
  return hasDsnPart;
}

// Pull the address that actually failed out of the DSN body. Prefers the RFC-3464
// "Final-Recipient:" field; falls back to an SMTP 5xx line, then any address near "failed".
function failedRecipient(text, html, ourAccount) {
  const body = (text || "") + "\n" + String(html || "").replace(/<[^>]+>/g, " ");
  let m = /Final-Recipient:\s*(?:rfc822;)?\s*([^\s<>]+@[^\s<>]+)/i.exec(body)
       || /Original-Recipient:\s*(?:rfc822;)?\s*([^\s<>]+@[^\s<>]+)/i.exec(body)
       || /(?:5\.\d\.\d|55\d)[\s\S]{0,80}?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.exec(body)
       || /<([^>]+@[^>]+)>[\s\S]{0,60}?(?:failed|not found|does not exist|undeliverable|rejected)/i.exec(body);
  const addr = m ? String(m[1]).trim().toLowerCase() : "";
  // Never suppress our own mailbox (bounces are From our address in some layouts).
  if (!addr || addr === String(ourAccount || "").toLowerCase()) return "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr) ? addr : "";
}

// Whether a DSN is a HARD (permanent) failure vs a transient one, so we only suppress the
// permanently-dead addresses and don't kill a mailbox that was merely full for an hour.
function isHardBounce(text, html) {
  const body = (text || "") + "\n" + String(html || "");
  if (/(4\.\d\.\d|\b4[25]\d\b|temporar|greylist|try again|rate limit|deferred|mailbox full|quota exceeded|over quota)/i.test(body)) return false;
  return /(5\.\d\.\d|\b55\d\b|does not exist|no such user|user unknown|address (not found|rejected)|recipient (not found|rejected)|permanent|mailbox unavailable)/i.test(body);
}

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

// Suppress a hard-bounced address on email + record it on the contact. Idempotent: returns
// true only the first time an address is newly suppressed (so the cron log is meaningful).
async function markBounced(env, email) {
  try {
    const already = await env.DB.prepare("SELECT 1 FROM suppressions WHERE email=? AND channel IN ('email','all') LIMIT 1").bind(email).first();
    if (already) return false;
    await addSuppression(env, { email, channel: "email", reason: "hard_bounce", source: "gmail_dsn" });
    // Mirror into the legacy table the inbox intel panel reads, so the bounce shows up there too.
    try { await env.DB.prepare("INSERT INTO crm_suppressions (email, reason, source, created_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(email) DO UPDATE SET reason=excluded.reason, source=excluded.source").bind(email, "bounced", "gmail_dsn").run(); } catch (_) {}
    // Attribute to the contact if we know them (activity feed + funnel event).
    let contactId = null;
    try { const row = await env.DB.prepare("SELECT contact_id FROM contact_identifiers WHERE type='email' AND value=? LIMIT 1").bind(email).first(); contactId = row && row.contact_id; } catch (_) {}
    await logEvent(env, { type: "email_bounced", contactId: contactId || undefined, channel: "email", meta: { email, kind: "hard" } }).catch(() => {});
    if (contactId) await addActivityV2(env, { entityType: "contact", entityId: contactId, action: "email_bounced", meta: { email } }).catch(() => {});
    return true;
  } catch (_) { return false; }
}

// Ingest recent inbox mail for one connected account into conversations/messages.
// --- Auto-intel: find a new lead's website so the enrichment drip can enrich them ----------
const FREEMAIL_HOST = /^(gmail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|me|mac|proton|protonmail|comcast|att|sbcglobal|verizon|bellsouth|cox|charter|earthlink|gmx)\./i;
// Business domain from an email address, or null for free-mail / our own / none.
function bizDomainFromEmail(email) {
  const at = String(email || "").split("@")[1];
  if (!at) return null;
  const d = at.trim().toLowerCase().replace(/[>,;].*$/, "");
  return (!d || FREEMAIL_HOST.test(d) || d.includes("consentresolve")) ? null : d;
}
// First real business website in the email body/signature — explicit http(s):// or www. URLs
// only, so we never match stray words. Skips our own + social/utility domains.
const SKIP_DOMAIN = /(consentresolve|gmail|yahoo|hotmail|outlook|aol|icloud|proton|google|facebook|fb\.|instagram|linkedin|twitter|x\.com|youtube|tiktok|bit\.ly|schema\.org|w3\.org|example\.|sentry|mailchimp|constantcontact|calendly|godaddy|wixsite|squarespace)/i;
function websiteFromBody(text, html) {
  const hay = String(text || "") + " " + String(html || "");
  const rx = /https?:\/\/(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)|(?:^|[\s(<])(www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;
  let m;
  while ((m = rx.exec(hay))) {
    const d = (m[1] || m[2] || "").toLowerCase().replace(/^www\./, "").replace(/[/?#].*$/, "");
    if (d && /\.[a-z]{2,}$/.test(d) && !SKIP_DOMAIN.test(d)) return d;
  }
  return null;
}
// Persist a new inbound lead's website onto their company (cheap, no API) so the auto-enrich
// drip runs both lookups on them next tick. Only fills a blank domain; safe to call repeatedly.
async function attachLeadDomain(env, contactId, senderEmail, text, html) {
  if (!contactId) return null;
  const domain = bizDomainFromEmail(senderEmail) || websiteFromBody(text, html);
  if (!domain) return null;
  const ct = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first().catch(() => null);
  if (ct && ct.company_id) {
    await env.DB.prepare("UPDATE companies SET domain=COALESCE(NULLIF(domain,''), ?), updated_at=datetime('now') WHERE id=?").bind(domain, ct.company_id).run().catch(() => {});
  } else {
    const companyId = await findOrCreateCompany(env, { name: domain, domain }).catch(() => null);
    if (companyId) await env.DB.prepare("UPDATE contacts SET company_id=?, updated_at=datetime('now') WHERE id=?").bind(companyId, contactId).run().catch(() => {});
  }
  return domain;
}

// ── Phase 1b: inbound reply intelligence ─────────────────────────────────────
const REPLY_MODEL = "claude-haiku-4-5-20251001";
async function classifyReply(env, text) {
  if (!env.ANTHROPIC_API_KEY || !text) return { sentiment: "neutral", followup_date: null };
  const prompt = `Classify this inbound email reply from a sales prospect. Return STRICT JSON only, no prose:
{"sentiment":"positive|not_interested|bad_timing|neutral","followup_date":"<a timeframe if they named one, e.g. 'next spring','Q1','after March', else null>"}
positive = interested, wants a demo/call/info, or asks a buying question. not_interested = a clear no, unsubscribe, "stop", "remove me", "not interested". bad_timing = interested-ish but not now ("circle back later","busy season","next quarter"). neutral = auto-reply, a question needing a human, or unclear.
REPLY:
${String(text).slice(0, 4000)}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: REPLY_MODEL, max_tokens: 200, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    let d = {}; try { d = JSON.parse(((j.content && j.content[0] && j.content[0].text) || "{}").replace(/^```json\s*|\s*```$/g, "")); } catch (_) {}
    const s = ["positive", "not_interested", "bad_timing", "neutral"].includes(d.sentiment) ? d.sentiment : "neutral";
    return { sentiment: s, followup_date: d.followup_date || null };
  } catch (_) { return { sentiment: "neutral", followup_date: null }; }
}
async function sysNote(env, convId, text) {
  if (!convId) return;
  await env.DB.prepare("INSERT INTO messages (id, conversation_id, direction, channel, body_text, sent_at) VALUES (?,?, 'system', 'system', ?, ?)")
    .bind(ulid(), convId, text, new Date().toISOString()).run().catch(() => {});
}
async function notifyReply(env, { sentiment }) {
  const url = env.SALES_WEBHOOK_URL || env.TEAM_NOTIFY_URL;
  if (!url) return;
  try { await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `CRM: a ${sentiment.replace("_", " ")} reply just came in → ${(env.STL_PUBLIC_ORIGIN || "https://consentresolve.com")}/crm/app` }) }); } catch (_) {}
}
// A reply to our outreach: ANY reply pauses the sequence; then classify + route + flag the SDR.
// Gated to contacts who are (or were) in a sequence, so general inbound to hello@ is untouched.
async function handleInboundReply(env, { contactId, convId, text, subject }) {
  if (!contactId || !convId) return;
  const inSeq = await env.DB.prepare("SELECT 1 FROM workflow_runs WHERE contact_id=? LIMIT 1").bind(contactId).first().catch(() => null);
  const inNurt = inSeq ? null : await env.DB.prepare("SELECT 1 FROM nurture_contacts WHERE contact_id=? AND status='active' LIMIT 1").bind(contactId).first().catch(() => null);
  if (!inSeq && !inNurt) return;
  try { await handleGoalEvent(env, { contactId, goal: "replied" }); } catch (_) {}   // ANY reply pauses sequences
  // Any reply pauses quarterly nurture too (bad_timing re-activates it below).
  await env.DB.prepare("UPDATE nurture_contacts SET status='paused', updated_at=datetime('now') WHERE contact_id=? AND status='active'").bind(contactId).run().catch(() => {});
  const cls = await classifyReply(env, (subject ? subject + "\n" : "") + (text || ""));
  const s = cls.sentiment;
  await addActivityV2(env, { entityType: "contact", entityId: contactId, action: "reply_classified", meta: { sentiment: s, followup: cls.followup_date || null } }).catch(() => {});
  if (s === "positive") {
    await env.DB.prepare("UPDATE contacts SET lifecycle_stage='demo_requested', updated_at=datetime('now') WHERE id=?").bind(contactId).run().catch(() => {});
    await createTask(env, { contactId, conversationId: convId, type: "followup", title: "Respond within 15 min — positive reply", body: "Lead replied positively. Reply personally with your booking link (do not automate), then confirm the demo.", dueAt: new Date().toISOString(), source: "automation" });
    await sysNote(env, convId, "⚡ Positive reply — moved to Demo Requested. Respond within 15 minutes.");
    await logEvent(env, { type: "demo_requested", contactId, conversationId: convId, meta: { via: "reply" } }).catch(() => {});
  } else if (s === "not_interested") {
    try { await handleGoalEvent(env, { contactId, goal: "opted_out" }); } catch (_) {}
    await sysNote(env, convId, "🛑 Not interested — marked Do Not Contact and exited all sequences.");
  } else if (s === "bad_timing") {
    await enrollNurture(env, contactId, "bad_timing").catch(() => {});
    await createTask(env, { contactId, conversationId: convId, type: "followup", title: "Follow up later — bad timing" + (cls.followup_date ? ` (${cls.followup_date})` : ""), body: "Timing is off. Sequence paused, added to Long-Term Nurture. Follow up" + (cls.followup_date ? ` around ${cls.followup_date}` : " next quarter") + ".", source: "automation" });
    await sysNote(env, convId, "🕒 Bad timing — paused + added to Long-Term Nurture. Follow-up task created" + (cls.followup_date ? ` (${cls.followup_date})` : "") + ".");
  } else {
    await sysNote(env, convId, "✉️ Reply received — sequence paused. Needs a human.");
  }
  await env.DB.prepare("UPDATE conversations SET unread=1, status='open', updated_at=datetime('now') WHERE id=?").bind(convId).run().catch(() => {});
  await notifyReply(env, { sentiment: s });
}

export async function pollEmailInbox(env, account) {
  const tok = await gAccessToken(env, account);
  if (!tok) return { account, error: "no_token" };
  const q = encodeURIComponent("in:inbox newer_than:14d");
  const lr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=40&q=" + q, { headers: { Authorization: "Bearer " + tok } });
  const lj = await lr.json();
  if (lj.error) return { account, error: (lj.error && lj.error.message) || "list_failed" };
  let ingested = 0, seen = 0, bounced = 0;
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
    // Skip system mail the mailbox sends to itself (SEO weekly digest, internal test sends,
    // etc.): hello@ -> hello@. These are notifications, not conversations, and re-materialize
    // every poll if filed — which is why a deleted "SEO weekly" kept coming back.
    if (other === account) continue;
    const sentAt = m.internalDate ? new Date(Number(m.internalDate)).toISOString() : (dateHdr || null);
    const { text, html } = extractBody(m.payload);

    // Delivery-failure notice → suppress the dead address on email (hard bounces only) and
    // record it on the contact, instead of ingesting the mailer-daemon notice as a "reply".
    if (isBounce(fromEmail, subject, m.payload)) {
      const dead = failedRecipient(text, html, account);
      if (dead && isHardBounce(text, html) && (await markBounced(env, dead))) bounced++;
      continue; // never file a DSN as an inbound conversation
    }
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
    // Auto-intel: on a genuinely-new inbound message, capture the lead's website (business
    // sender domain, else a URL in the body) so the enrichment drip runs both lookups on them
    // automatically as they come in. Cheap — no API calls here, just persists the domain.
    if (!outbound && !r.existed) {
      try { await attachLeadDomain(env, contactId, other, text, html); } catch (_) {}
      try { await handleInboundReply(env, { contactId, convId, text: text || m.snippet, subject }); } catch (_) {}
    }
  }
  return { account, seen, ingested, bounced };
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
    let notes = (await env.DB.prepare(
      "SELECT n.id, n.body, n.created_at, u.name AS author FROM notes n LEFT JOIN users u ON u.id=n.author_id WHERE n.conversation_id=? ORDER BY n.created_at DESC"
    ).bind(id).all()).results || [];
    // Website intel (from the Meta-lead webhook's system note): parse into structured data
    // for the intel pane's card, and drop the raw note from the list so it isn't shown twice.
    let webIntel = null;
    {
      const wi = notes.find((n) => (n.body || "").startsWith("🔍 Website intel"));
      if (wi) {
        notes = notes.filter((n) => n !== wi);
        const lines = wi.body.split("\n");
        const grab = (label) => {
          const l = lines.find((x) => x.startsWith(label + ": "));
          return l ? l.slice(label.length + 2).trim() : "";
        };
        const list = (label) => {
          const v = grab(label);
          return (!v || /^none/i.test(v) || v.startsWith("NONE")) ? [] : v.replace(/\s*[⚠✓].*$/u, "").split(/,|·/).map((s) => s.trim()).filter(Boolean);
        };
        const sd = String(conv.source_detail || "");
        const tag = (k) => { const m = sd.split("|").find((p) => p.startsWith(k + ":")); return m ? m.slice(k.length + 1) : ""; };
        webIntel = {
          url: (lines[0].split("—")[1] || "").trim(),
          title: grab("Title"),
          platform: grab("Platform") === "unknown" ? "" : grab("Platform"),
          capture: list("Visitor capture"),
          tracking: list("Tracking"),
          competitors: list("Competitor spend"),
          tools: list("Tools").map((s) => s.replace(/\s*\(.*\)?$/, "")),
          phone: grab("Phone on site"),
          siteCheck: grab("Site check"),
          tradeCheck: grab("Trade check"),
          angle: (lines.find((x) => x.startsWith("Angle: ")) || "").slice(7),
          adLibrary: grab("Ad Library"),
          fit: tag("fit") || "warm",
          site: tag("site") || "ok",
        };
      }
    }
    // Live demo progress: if this contact has a demo-form participant record, surface how
    // far they got (registered -> visited -> consented -> emailed/enrolled), read fresh.
    let demo = null;
    try {
      const pemail = (contact && contact.primary_email) || conv.primary_email;
      if (pemail) {
        const part = await getByEmail(env, String(pemail).toLowerCase());
        if (part) {
          const pf = progressFor(part.status);
          demo = { status: part.status, short: pf.short, detail: pf.detail,
                   registeredAt: part.created_at || null, visitedAt: part.visited_at || null,
                   consentedAt: part.consented_at || null, samplePage: part.sample_page || null };
        }
      }
    } catch (_) {}
    // On-site intel: session-stitched pageviews (path / source / referrer / time) + a
    // session-based time-on-site estimate, so the intel pane can show where they came
    // from, what they read, and how engaged they are.
    let intel = null;
    try {
      if (conv.contact_id) {
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS visitor_links (vid TEXT, contact_id TEXT, email TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(vid, contact_id))").run();
        const vids = ((await env.DB.prepare("SELECT vid FROM visitor_links WHERE contact_id=?").bind(conv.contact_id).all()).results || []).map((v) => v.vid).filter(Boolean);
        let pvs = [];
        if (vids.length) {
          const ph = vids.map(() => "?").join(",");
          pvs = (await env.DB.prepare("SELECT path, utm_source, utm_campaign, ref, created_at FROM traffic WHERE vid IN (" + ph + ") ORDER BY created_at ASC LIMIT 300").bind(...vids).all()).results || [];
        }
        let secs = 0;
        for (let i = 1; i < pvs.length; i++) { const g = (new Date(pvs[i].created_at) - new Date(pvs[i - 1].created_at)) / 1000; if (g > 0 && g < 1800) secs += g; }
        if (pvs.length === 1) secs = 30;
        const srcRow = pvs.find((p) => p.utm_source) || pvs.find((p) => p.ref);
        const campRow = pvs.find((p) => p.utm_campaign);
        intel = {
          pageCount: pvs.length,
          pages: pvs.slice(-40).reverse().map((p) => ({ path: p.path, source: p.utm_source || null, ref: p.ref || null, at: p.created_at })),
          firstSeen: pvs.length ? pvs[0].created_at : null,
          lastSeen: pvs.length ? pvs[pvs.length - 1].created_at : null,
          timeOnSiteSec: Math.round(secs),
          source: srcRow ? (srcRow.utm_source || srcRow.ref) : null,
          campaign: campRow ? campRow.utm_campaign : null,
        };
      }
    } catch (_) {}
    // Paid-ad attribution: flag valuable paid-sourced leads + an avg cost-per-lead
    // (logged channel spend / leads from that channel). Detected from the stitched
    // utm_source or a Meta Lead-Ad conversation.
    let paid = null;
    try {
      const PAID = { facebook: "facebook", fb: "facebook", instagram: "facebook", ig: "facebook", meta: "facebook", google: "google", googleads: "google", adwords: "google", gads: "google", youtube: "google", bing: "bing", tiktok: "tiktok", linkedin: "linkedin" };
      const src = intel && intel.source ? String(intel.source).toLowerCase() : "";
      let platform = PAID[src] || null;
      if (!platform && conv.channel === "meta_lead") platform = "facebook";
      if (platform) {
        const sp = await env.DB.prepare("SELECT COALESCE(SUM(amount_usd),0) AS amt FROM crm_spend WHERE lower(channel) LIKE ?").bind("%" + platform + "%").first();
        const spend = sp ? Number(sp.amt) : 0;
        let leads = 0;
        try {
          const lr = await env.DB.prepare("SELECT COUNT(DISTINCT vl.contact_id) AS n FROM visitor_links vl JOIN traffic t ON t.vid=vl.vid WHERE lower(t.utm_source) LIKE ?").bind("%" + platform + "%").first();
          leads += lr ? Number(lr.n) : 0;
          if (platform === "facebook") { const ml = await env.DB.prepare("SELECT COUNT(DISTINCT contact_id) AS n FROM conversations WHERE channel='meta_lead'").first(); leads += ml ? Number(ml.n) : 0; }
        } catch (_) {}
        paid = {
          isPaid: true, platform,
          source: (intel && intel.source) || (conv.channel === "meta_lead" ? "meta lead ad" : platform),
          campaign: (intel && intel.campaign) || null,
          spendUsd: spend, leads,
          costPerLeadUsd: (spend > 0 && leads > 0) ? Math.round(spend / leads) : null,
        };
      }
    } catch (_) {}
    // Cold-email engagement (#3) + cross-channel suppression (#6) by the contact's email.
    let coldEmail = null, suppressed = null;
    try {
      if (contact && contact.primary_email) {
        const em = String(contact.primary_email).toLowerCase();
        const cl = await env.DB.prepare("SELECT * FROM instantly_leads WHERE email=?").bind(em).first();
        if (cl) coldEmail = { status: cl.status, opens: cl.opens, replies: cl.replies, clicks: cl.clicks, campaign: cl.campaign };
        const sp = await env.DB.prepare("SELECT reason, source FROM crm_suppressions WHERE email=?").bind(em).first();
        if (sp) suppressed = { reason: sp.reason, source: sp.source };
      }
    } catch (_) {}
    await env.DB.prepare("UPDATE conversations SET unread=0 WHERE id=?").bind(id).run();
    return json({ conversation: conv, messages: msgs, contact, company, users, notes, demo, intel, webIntel, paid, coldEmail, suppressed }, {}, cors);
  }

  const status = url.searchParams.get("status") || "open";
  const rows = (await env.DB.prepare(
    `SELECT cv.id, cv.channel, cv.subject, cv.status, cv.unread, cv.last_message_at, cv.last_message_preview,
            cv.assignee_id, cv.source_detail, c.full_name, c.primary_email, co.name AS company_name
       FROM conversations cv LEFT JOIN contacts c ON c.id=cv.contact_id
       LEFT JOIN companies co ON co.id=cv.company_id
      WHERE cv.status=? ORDER BY COALESCE(cv.last_message_at, cv.updated_at) DESC LIMIT 200`
  ).bind(status).all()).results || [];
  return json({ conversations: rows }, {}, cors);
}

// Status machine A/B/C (BUILD-PLAN P1-9): open | snoozed(+snooze_days) | archived.
// (D=Convert-to-Lead lands with the pipeline slice.)
// Stop every automation for a contact when a human takes the conversation over — the single
// path used by BOTH the explicit ⏸ Pause control and an inbound-handled manual reply. It:
//   • marks the conversation 'paused' (the durable "a human owns this" marker — the Inbox
//     buckets it as Open, and the Speed-to-Lead runner honors it so Mack won't dial/text),
//   • exits any active drip/workflow run, and
//   • cancels pending Speed-to-Lead touchpoints (scheduled SMS / AI calls).
// Reversible via Resume/Auto. Never opts the contact out (that's a separate STOP path).
async function pauseContactAutomation(env, { contactId, convId, phone }) {
  let stopped = false;
  try {
    if (convId) {
      await env.DB.prepare("UPDATE conversations SET status='paused', updated_at=datetime('now') WHERE id=? AND status NOT IN ('snoozed','archived','nurture')").bind(convId).run();
    }
    if (contactId) {
      const r = await env.DB.prepare("UPDATE workflow_runs SET status='exited', exit_reason='human_takeover', next_run_at=NULL, updated_at=datetime('now') WHERE contact_id=? AND status='active'").bind(contactId).run();
      if (r && r.meta && r.meta.changes) stopped = true;
      const r2 = await env.DB.prepare("UPDATE stl_touchpoints SET status='canceled', notes='human took over (CRM paused)' WHERE status='pending' AND lead_id IN (SELECT id FROM stl_leads WHERE crm_contact_id=?)").bind(contactId).run();
      if (r2 && r2.meta && r2.meta.changes) stopped = true;
    }
    if (phone) {
      await env.DB.prepare("UPDATE stl_touchpoints SET status='canceled', notes='human took over (CRM paused)' WHERE status='pending' AND lead_id IN (SELECT id FROM stl_leads WHERE phone=?)").bind(phone).run();
    }
  } catch (_) {}
  return stopped;
}

// Internal team CC'd on every outbound EMAIL reply so replies are watched in their own inboxes.
const CC_TEAM = ["tyler@consentresolve.com", "jbeyke@consentresolve.com", "aaron@consentresolve.com"];
// Drop a small system status line into the conversation so send success/failure is visible in
// the thread (failures are persisted so they survive a refresh — a lightweight failure log).
async function noteSend(env, convId, text) {
  try {
    await env.DB.prepare("INSERT INTO messages (id, conversation_id, direction, channel, body_text, sent_at) VALUES (?,?, 'system', 'system', ?, ?)")
      .bind(ulid(), convId, String(text || "").slice(0, 300), new Date().toISOString()).run();
  } catch (_) {}
}
// Record a send failure in the thread + return the 400 (single call site per failing branch).
async function failSend(env, convId, kind, reason, message, cors) {
  const label = kind === "sms" ? "SMS" : "Email";
  await noteSend(env, convId, `⚠ ${label} failed to send — ${message || reason || "unknown error"}. Not delivered.`);
  return json({ error: reason || "send_failed", message: message || reason || "send failed" }, { status: 400 }, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (!b.id && !b.del && !b.purge_test && !b.seed_open_test) return json({ error: "id_required" }, { status: 400 }, cors);

  // Reply, send-to-origin (BUILD-PLAN P1-8). Routes by channel: email→Gmail (hello@),
  // instantly→Instantly reply (warmed mailbox), crisp→Crisp REST, meta_lead/demo_form→
  // email to the captured address (spec §5: form sources reply by email, never Messenger).
  // Logs the reply to activities with the sending rep (per-rep attribution).
  if (b.reply !== undefined) {
    const body = String(b.reply || "").trim();
    if (!body) return json({ error: "empty_reply" }, { status: 400 }, cors);
    // Rich HTML body from the composer (sanitized client-side). Sent as the text/html part so
    // replies render with native Gmail formatting; `body` stays the text/plain fallback.
    const emailHtml = (typeof b.html === "string" && b.html.trim()) ? b.html : null;
    const escH = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const conv = await env.DB.prepare(
      "SELECT cv.*, c.primary_email FROM conversations cv LEFT JOIN contacts c ON c.id=cv.contact_id WHERE cv.id=?"
    ).bind(b.id).first();
    if (!conv) return json({ error: "not_found" }, { status: 404 }, cors);
    const me = await currentUser(request, env);
    const authorId = me ? me.id : null;
    // FROM identity for outbound email. Leads should see the responding rep (e.g. "Tyler
    // Spurlock") over the shared hello@ mailbox — never the mailbox's default send-as, which
    // was rendering as "Aaron <aaron@consentresolve.com>". We set From explicitly (the same
    // trick the IV sequence uses) so display name = who's replying and the address is hello@.
    let repName = (me && me.name) || "";
    if (!repName) { const _a = await env.DB.prepare("SELECT name FROM users WHERE role='admin' AND active=1 ORDER BY created_at LIMIT 1").first(); repName = (_a && _a.name) || "Consent Resolve"; }
    const fromEmail = `${repName.replace(/["<>\r\n,]/g, " ").trim()} <hello@consentresolve.com>`;
    // Subject line for an outbound EMAIL. Never leak an internal thread label — SMS/voice/chat
    // threads carry labels like "💬 SMS — +16124333224" or a bare phone number, which read as
    // spam and look unprofessional. Reuse the real subject only for a genuine email thread; for
    // everything else (form leads, SMS→email switch, identified visitors) use a clean, human one.
    const looksInternalSubj = (s) => {
      if (!s || !String(s).trim()) return true;
      const t = String(s).trim();
      if (/^(re:\s*)?(💬|📞|📱|✉|☎|📧)/u.test(t)) return true;                          // starts with a channel emoji
      if (/^(re:\s*)?(sms|mms|text|voice|call|calls|chat|identified|visitor|meta lead|lead)\b/i.test(t)) return true; // channel/label word
      if (/[—\-–]\s*\+?\d[\d\s().\-]{5,}/.test(t) || /^\+?\d[\d\s().\-]{6,}$/.test(t)) return true; // "— +1612…" or a bare phone number
      return false;
    };
    const realEmailThread = conv.channel === "email" && !looksInternalSubj(conv.subject);
    const subj = realEmailThread
      ? "Re: " + conv.subject.replace(/^re:\s*/i, "")
      : "Re: your inquiry with Consent Resolve";
    let externalId = null, sentVia = conv.channel;

    // Resolve the contact's reachable addresses once — used by both the explicit-channel
    // override and native routing. Phone comes from the thread ("phone:<E164>") or, for a
    // non-SMS thread (email / identified visitor / form lead), the contact's phone on file.
    const email = conv.primary_email || null;
    let phone = null;
    {
      const raw = String(conv.external_thread_id || "");
      if (raw.startsWith("phone:")) phone = raw.slice(6);
      if (!phone && conv.contact_id) { const pc = await env.DB.prepare("SELECT phone FROM contacts WHERE id=?").bind(conv.contact_id).first(); phone = pc && pc.phone; }
      if (phone) { const dd = String(phone).replace(/[^\d]/g, ""); phone = dd.length === 10 ? "+1" + dd : dd.length >= 11 ? "+" + dd : null; } // E.164: 10-digit NANP → +1XXXXXXXXXX (a bare "+"+10 digits was invalid)
    }

    // MANUAL CHANNEL OVERRIDE — a rep (e.g. Tyler) can choose to reply by Email or SMS on any
    // Open conversation, regardless of how the lead first reached us (identified visitors, form
    // leads, etc.). The composer's channel switch sends `channel`; we honor it here, gated by a
    // reachable address + a not-suppressed check. This is the "reply via SMS and Email" ability.
    const want = (b.channel === "email" || b.channel === "sms") ? b.channel : null;
    if (want === "email") {
      if (!email) return json({ error: "no_recipient", message: "No email address on file for this contact." }, { status: 400 }, cors);
      if (await isSuppressed(env, { contactId: conv.contact_id, email, channel: "email" })) return json({ error: "suppressed", message: "This contact opted out of email." }, { status: 400 }, cors);
      const res = await sendMessage(env, conv.channel_account_id || inboxAccounts(env)[0], email, subj, body, conv.channel === "email" ? conv.external_thread_id : null, { cc: CC_TEAM, from: fromEmail, ...(emailHtml ? { html: emailHtml } : {}) });
      if (res.error) return await failSend(env, conv.id, "email", res.error, res.error, cors);
      externalId = res.id; sentVia = "email";
    } else if (want === "sms") {
      if (!phone) return json({ error: "no_phone", message: "No mobile number on file to text this contact." }, { status: 400 }, cors);
      if (await isSuppressed(env, { contactId: conv.contact_id, phone, channel: "sms" })) return json({ error: "suppressed", message: "This contact opted out of texts (STOP)." }, { status: 400 }, cors);
      const res = await sendSms(env, phone, body);
      if (!res.ok) return await failSend(env, conv.id, "sms", res.error || "sms_failed", res.error, cors);
      externalId = res.sid; sentVia = "sms";
    } else if (conv.channel === "email" || conv.channel === "identified") {
      // Native default: identified visitors + email threads reply by email to the address on file.
      if (!email) return json({ error: "no_recipient" }, { status: 400 }, cors);
      const res = await sendMessage(env, conv.channel_account_id || inboxAccounts(env)[0], email, subj, body, conv.channel === "email" ? conv.external_thread_id : null, { cc: CC_TEAM, from: fromEmail, ...(emailHtml ? { html: emailHtml } : {}) });
      if (res.error) return await failSend(env, conv.id, "email", res.error, res.error, cors);
      externalId = res.id; sentVia = "email";
    } else if (conv.channel === "meta_lead" || conv.channel === "demo_form") {
      const to = conv.primary_email;
      if (!to) return json({ error: "no_email", message: "No email on file for this lead — call only." }, { status: 400 }, cors);
      // CAN-SPAM footer (name + physical address + opt-out) + List-Unsubscribe header — both are
      // legit-sender trust signals that help these first-touch emails clear spam filters. The rep
      // name (resolved above) also signs the footer so it matches the visible From.
      const signed = body + "\r\n\r\n-- \r\n" + repName + "\r\n" +
        "Consent Resolve\r\n1907 Gulf Way #1, St Pete Beach, FL 33706\r\n" +
        "You're getting this because you asked to hear from us at consentresolve.com. Reply UNSUBSCRIBE and we'll stop.";
      // Matching HTML footer so the rich reply still carries the CAN-SPAM block.
      const signedHtml = emailHtml ? emailHtml +
        `<br><br><div style="color:#5f6368;font-size:12px;font-family:Arial,Helvetica,sans-serif;line-height:1.5">-- <br>${escH(repName)}<br>Consent Resolve<br>1907 Gulf Way #1, St Pete Beach, FL 33706<br>You're getting this because you asked to hear from us at consentresolve.com. Reply UNSUBSCRIBE and we'll stop.</div>` : null;
      const res = await sendMessage(env, inboxAccounts(env)[0], to, subj, signed, null, {
        cc: CC_TEAM, from: fromEmail,
        headers: { "List-Unsubscribe": "<mailto:hello@consentresolve.com?subject=unsubscribe>" },
        ...(signedHtml ? { html: signedHtml } : {}),
      }); // new email thread, not Messenger
      if (res.error) return await failSend(env, conv.id, "email", res.error, res.error, cors);
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
    } else if (conv.channel === "sms" || conv.channel === "phone" || conv.channel === "voice" || conv.channel === "speed_to_lead"
               || (conv.channel === "chat" && String(conv.external_thread_id || "").startsWith("phone:"))) {
      // Reply by SMS to the number on the thread. Covers inbound texts, calls, speed-to-lead,
      // and legacy phone-keyed threads still typed 'chat'. `phone` is already resolved + E.164.
      if (!phone) return json({ error: "no_phone", message: "No phone number on this conversation to text." }, { status: 400 }, cors);
      const res = await sendSms(env, phone, body);
      if (!res.ok) return await failSend(env, conv.id, "sms", res.error || "sms_failed", res.error, cors);
      externalId = res.sid; sentVia = "sms";
    } else {
      return json({
        error: "unsupported_channel", channel: conv.channel,
        message: conv.channel === "chat"
          ? "This was a live website chat — replies aren't supported once the session ends. If you have their email or number, reach out that way."
          : "Replies aren't supported for this channel yet.",
      }, { status: 400 }, cors);
    }

    const now = new Date().toISOString();
    await insertMessageOnce(env, { conversationId: conv.id, direction: "out", channel: sentVia, authorId, externalMessageId: externalId, bodyText: body, sentAt: now });
    await env.DB.prepare("UPDATE conversations SET last_message_at=?, last_message_preview=?, unread=0, updated_at=datetime('now') WHERE id=?").bind(now, body.slice(0, 160), conv.id).run();
    await addActivityV2(env, { actorId: authorId, entityType: "conversation", entityId: conv.id, action: "replied", meta: { channel: conv.channel, via: sentVia } });

    // HUMAN TAKEOVER — a manual reply hands the conversation to a human. Route it through the
    // SAME Pause path as the ⏸ button so nothing (a drip step or Mack) sends on top of it.
    // "Anything a human touches in Open is paused." Reversible via Resume/Auto.
    const pausedAutomation = await pauseContactAutomation(env, { contactId: conv.contact_id, convId: conv.id, phone });

    // Success status line for the conversation window (client shows it immediately; the outbound
    // bubble is the durable record, so we don't persist a separate ✓ line).
    const statusNote = sentVia === "sms"
      ? `✓ Sent by SMS${phone ? " to " + phone : ""}`
      : sentVia === "email"
        ? `✓ Sent by email${email ? " to " + email : ""} · cc ${CC_TEAM.map((a) => a.split("@")[0]).join(", ")}`
        : "✓ Sent";
    return json({ ok: true, sent: sentVia, status_note: statusNote, automation_paused: pausedAutomation }, {}, cors);
  }

  // Mark a conversation read — the inbox's select() fires this so the unread dot/badge
  // clears in the DB (not just client-side) and doesn't re-appear on the next data refresh.
  if (b.mark_read) {
    await env.DB.prepare("UPDATE conversations SET unread=0 WHERE id=?").bind(b.id).run().catch(() => {});
    return json({ ok: true, read: b.id }, {}, cors);
  }

  // Pause automation for this contact — the ⏸ control. Same path a manual reply takes:
  // a human owns it now, so no drip step and no AI (Mack) fires on top of the conversation.
  if (b.pause) {
    const conv = await env.DB.prepare("SELECT id, contact_id, external_thread_id FROM conversations WHERE id=?").bind(b.id).first();
    if (!conv) return json({ error: "not_found" }, { status: 404 }, cors);
    let phone = null;
    { const raw = String(conv.external_thread_id || ""); if (raw.startsWith("phone:")) phone = raw.slice(6); if (!phone && conv.contact_id) { const pc = await env.DB.prepare("SELECT phone FROM contacts WHERE id=?").bind(conv.contact_id).first(); phone = pc && pc.phone; } }
    const stopped = await pauseContactAutomation(env, { contactId: conv.contact_id, convId: conv.id, phone });
    const me = await currentUser(request, env);
    await addActivityV2(env, { actorId: me ? me.id : null, entityType: "conversation", entityId: conv.id, action: "automation_paused" }).catch(() => {});
    return json({ ok: true, paused: true, stopped }, {}, cors);
  }
  // Resume — clear the human-owned/paused marker so a sequence can run again. The caller
  // re-arms the actual automation separately (▶ Auto → /api/crm/workflow enroll).
  if (b.resume) {
    await env.DB.prepare("UPDATE conversations SET status='open', updated_at=datetime('now') WHERE id=? AND status='paused'").bind(b.id).run().catch(() => {});
    return json({ ok: true, resumed: true }, {}, cors);
  }

  // UNDO an opt-out — for a mistaken/test "Contact opted out of SMS/voice". Reverses the three
  // things an opt-out writes: (1) the workflow run's exit_reason='opted_out' (which drives the
  // banner), (2) the all-channel suppression that blocks sends, and (3) the manual test revoke
  // rows on the consent ledger. Deliberate + logged (who undid it). Use only to correct errors.
  if (b.restore) {
    const conv = await env.DB.prepare("SELECT id, contact_id FROM conversations WHERE id=?").bind(b.id || b.restore).first().catch(() => null);
    const contactId = (conv && conv.contact_id) || b.contact_id;
    if (!contactId) return json({ ok: false, error: "no_contact" }, { status: 400 }, cors);
    await env.DB.prepare("UPDATE workflow_runs SET exit_reason=NULL, status='exited', next_run_at=NULL, updated_at=datetime('now') WHERE contact_id=? AND exit_reason='opted_out'").bind(contactId).run().catch(() => {});
    await env.DB.prepare("DELETE FROM suppressions WHERE contact_id=? AND (reason='opted_out' OR channel='all')").bind(contactId).run().catch(() => {});
    await env.DB.prepare("DELETE FROM consent_records WHERE contact_id=? AND action='revoked' AND capture_method='manual_crm'").bind(contactId).run().catch(() => {});
    const me = await currentUser(request, env);
    await addActivityV2(env, { actorId: me ? me.id : null, entityType: "contact", entityId: contactId, action: "optout_undone", meta: { by: me ? me.name : "CRM" } }).catch(() => {});
    return json({ ok: true, restored: true, contact_id: contactId }, {}, cors);
  }

  // Seed two real, replyable TEST conversations into Open for manual QA — an inbound SMS from a
  // chosen cell (a reply texts it back via Twilio) and an inbound email (a reply emails back via
  // Gmail). No active sequence, so they sit in Open. crmAuthed; idempotent by thread.
  if (b.seed_open_test) {
    const now = new Date().toISOString();
    const out = {};
    try {
      const em = (b.email_addr || "aaron@kickass.net").toLowerCase();
      const digits = normPhone(b.sms_phone || "+17133848985");          // 10-digit NANP identity
      const e164 = digits.length === 10 ? "+1" + digits : "+" + digits; // dial string for the reply
      // Idempotent + self-healing: wipe prior test conversations and any orphaned test
      // identifiers (earlier cleanups deleted the contact rows but left the email/phone
      // identifiers, so findOrCreateContactByEmail was returning a dead contact_id).
      await env.DB.prepare("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE source_detail='test')").run().catch(() => {});
      await env.DB.prepare("DELETE FROM conversations WHERE source_detail='test'").run().catch(() => {});
      await env.DB.prepare("DELETE FROM contact_identifiers WHERE (type='email' AND value=?) OR (type='phone' AND value=?)").bind(em, digits).run().catch(() => {});
      // ONE fresh test contact that owns BOTH an email and a phone — so both chips populate on
      // both test conversations ("we know both").
      const cid = await findOrCreateContactByEmail(env, em, { name: "Aaron (test)", phone: e164, source: "test" });
      await env.DB.prepare("UPDATE contacts SET primary_email=?, phone=?, full_name=COALESCE(full_name,'Aaron (test)') WHERE id=?").bind(em, e164, cid).run();
      // Inbound SMS from the cell — external_thread_id carries the full E.164 so the reply texts it.
      const smsId = ulid(); const smsPrev = "Hey, testing the CRM — can you text me back?";
      await env.DB.prepare(
        "INSERT INTO conversations (id, contact_id, channel, source_detail, external_thread_id, subject, status, unread, last_message_at, last_message_preview, created_at) VALUES (?,?,?,?,?,?, 'open', 1, ?, ?, datetime('now'))"
      ).bind(smsId, cid, "sms", "test", "phone:" + e164, "Test SMS", now, smsPrev).run();
      await insertMessageOnce(env, { conversationId: smsId, direction: "in", channel: "sms", externalMessageId: "test-sms:" + smsId, bodyText: smsPrev, sentAt: now });
      // Inbound email — external_thread_id null so a reply starts a fresh Gmail thread to the address.
      const emId = ulid(); const emPrev = "Hi — this is a test. Reply and let's confirm it comes through.";
      await env.DB.prepare(
        "INSERT INTO conversations (id, contact_id, channel, source_detail, external_thread_id, subject, status, unread, last_message_at, last_message_preview, created_at) VALUES (?,?,?,?,?,?, 'open', 1, ?, ?, datetime('now'))"
      ).bind(emId, cid, "email", "test", null, "Testing the CRM", now, emPrev).run();
      await insertMessageOnce(env, { conversationId: emId, direction: "in", channel: "email", externalMessageId: "test-email:" + emId, bodyText: emPrev, sentAt: now });
      // Extra SMS-only test conversations (phone-only contacts) — reply texts each number back.
      const extra = Array.isArray(b.sms_phones) ? b.sms_phones : ["+16148275641", "+16148326497", "+16143142424"];
      out.extra_sms = [];
      for (const num of extra.slice(0, 20)) {
        const d2 = normPhone(num); if (d2.length < 10) continue;
        const p2 = d2.length === 10 ? "+1" + d2 : "+" + d2;
        await env.DB.prepare("DELETE FROM contact_identifiers WHERE type='phone' AND value=?").bind(d2).run().catch(() => {});
        const c2 = await findOrCreateContactByIdentifier(env, "phone", d2, { name: "SMS test " + p2, source: "test" });
        await env.DB.prepare("UPDATE contacts SET phone=?, full_name=COALESCE(full_name,?) WHERE id=?").bind(p2, "SMS test " + p2, c2).run().catch(() => {});
        const sid = ulid(); const prev = "Test text from " + p2 + " — reply to check the SMS pipe.";
        await env.DB.prepare(
          "INSERT INTO conversations (id, contact_id, channel, source_detail, external_thread_id, subject, status, unread, last_message_at, last_message_preview, created_at) VALUES (?,?,?,?,?,?, 'open', 1, ?, ?, datetime('now'))"
        ).bind(sid, c2, "sms", "test", "phone:" + p2, "Test SMS", now, prev).run();
        await insertMessageOnce(env, { conversationId: sid, direction: "in", channel: "sms", externalMessageId: "test-sms:" + sid, bodyText: prev, sentAt: now });
        out.extra_sms.push({ conversationId: sid, phone: p2 });
      }
      const rb = await env.DB.prepare("SELECT primary_email, phone FROM contacts WHERE id=?").bind(cid).first().catch(() => null);
      out.contact = { id: cid, email: em, phone: e164, readback: rb };
      out.sms = { conversationId: smsId };
      out.email = { conversationId: emId };
    } catch (e) { out.error = String(e).slice(0, 200); }
    return json({ ok: true, seeded: out }, {}, cors);
  }

  // Add an internal note to a conversation (Activity tab composer). Notes are private —
  // never sent to the contact; they show in the Activity feed, newest first.
  if (b.note !== undefined) {
    const body = String(b.note || "").trim();
    if (!body) return json({ error: "empty_note" }, { status: 400 }, cors);
    const conv = await env.DB.prepare("SELECT id, contact_id FROM conversations WHERE id=?").bind(b.id).first();
    if (!conv) return json({ error: "not_found" }, { status: 404 }, cors);
    const me = await currentUser(request, env);
    const id = ulid();
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO notes (id, author_id, conversation_id, contact_id, body, created_at) VALUES (?,?,?,?,?,?)"
    ).bind(id, me ? me.id : null, conv.id, conv.contact_id, body, now).run();
    await addActivityV2(env, { actorId: me ? me.id : null, entityType: "conversation", entityId: conv.id, action: "note_added" }).catch(() => {});
    return json({ ok: true, note: { id, body, author: me ? me.name : null } }, {}, cors);
  }

  // Delete a conversation for good (persistent) — the inbox's deleteConv calls this.
  // Removes the conversation + its messages/notes; if the contact was provisional and is
  // now orphaned (no other conversations), removes it and its identifiers too.
  if (b.del || b.delete_conversation) {
    // A displayed conversation is often a MERGED THREAD of several underlying rows (the inbox
    // collapses a person's conversations into one). Deleting only the primary left the siblings,
    // which re-threaded on the next load — THE "messages come back" bug. So we delete EVERY id
    // passed. `del` accepts one id or an array (the UI sends the thread's member ids).
    const raw = b.del != null ? b.del : b.id;
    const ids = [...new Set((Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(String))];
    if (!ids.length) return json({ ok: true, already_gone: true }, {}, cors);
    const me = await currentUser(request, env);
    const scrubs = [];
    const tkeys = [];
    let deleted = 0;
    for (const id of ids) {
      const conv = await env.DB.prepare("SELECT id, contact_id, channel, channel_account_id, external_thread_id FROM conversations WHERE id=?").bind(id).first();
      if (!conv) continue;
      // PERMANENT tombstone so automated re-ingest (Gmail/Instantly/Site-Spy) can never resurrect
      // it. Uses ONLY base columns (thread_key + deleted_at) + a far-future date, so it ALWAYS
      // writes even if the `hard` column was never added — the previous `(thread_key, hard)` insert
      // threw on a missing column and wrote NOTHING, which is why deletes kept coming back. The
      // year-9999 date can't be postdated by any real message, so upsert never re-opens it. A new
      // email from the same person is a NEW Gmail thread (different key), so it's unaffected.
      const tkey = conv.channel + "|" + (conv.external_thread_id || "");
      await env.DB.prepare("INSERT OR REPLACE INTO conversation_tombstones (thread_key, deleted_at) VALUES (?, '9999-12-31T23:59:59Z')").bind(tkey).run().catch(() => {});
      await env.DB.prepare("UPDATE conversation_tombstones SET hard=1 WHERE thread_key=?").bind(tkey).run().catch(() => {}); // belt-and-suspenders if the column exists
      tkeys.push(tkey);
      // SCRUB AT SOURCE — move a Gmail-backed thread to Trash so the `in:inbox` poll can't re-read
      // it (reversible; needs the gmail.modify scope — one Gmail reconnect enables it).
      if (conv.channel === "email" && conv.external_thread_id && !String(conv.external_thread_id).startsWith("phone:")) {
        try { const r = await trashThread(env, conv.channel_account_id || inboxAccounts(env)[0], conv.external_thread_id); scrubs.push(r && r.ok ? "gmail_trashed" : ((r && (r.error || r.skipped)) || "no_op")); } catch (e) { scrubs.push(String(e).slice(0, 60)); }
      }
      await env.DB.prepare("DELETE FROM messages WHERE conversation_id=?").bind(id).run().catch(() => {});
      await env.DB.prepare("DELETE FROM notes WHERE conversation_id=?").bind(id).run().catch(() => {});
      await env.DB.prepare("DELETE FROM conversations WHERE id=?").bind(id).run();
      if (conv.contact_id) {
        const other = await env.DB.prepare("SELECT 1 x FROM conversations WHERE contact_id=? LIMIT 1").bind(conv.contact_id).first().catch(() => null);
        if (!other) {
          const ct = await env.DB.prepare("SELECT is_provisional FROM contacts WHERE id=?").bind(conv.contact_id).first().catch(() => null);
          if (ct && ct.is_provisional) {
            await env.DB.prepare("DELETE FROM contact_identifiers WHERE contact_id=?").bind(conv.contact_id).run().catch(() => {});
            await env.DB.prepare("DELETE FROM contacts WHERE id=?").bind(conv.contact_id).run().catch(() => {});
          }
        }
      }
      await addActivityV2(env, { actorId: me ? me.id : null, entityType: "conversation", entityId: id, action: "deleted" }).catch(() => {});
      deleted++;
    }
    // Verify the tombstones actually landed — the linchpin of the whole fix. Reading them back
    // proves the write worked (vs. the old silent failure) and gives the UI a real confirmation.
    let tombstoned = 0;
    if (tkeys.length) {
      const ph = tkeys.map(() => "?").join(",");
      const v = await env.DB.prepare(`SELECT COUNT(*) n FROM conversation_tombstones WHERE thread_key IN (${ph})`).bind(...tkeys).first().catch(() => null);
      tombstoned = v ? Number(v.n || 0) : 0;
    }
    return json({ ok: true, deleted: ids, count: deleted, tombstoned, source_scrub: scrubs }, {}, cors);
  }

  // Bulk purge obvious test/demo conversations. DRY-RUN BY DEFAULT — returns the match
  // list; pass {purge_test:true, confirm:true} to actually delete. Conservative matchers
  // (unmistakable junk domains + the diagnostic probe numbers + "safe to delete" markers)
  // so real prospects are never swept.
  if (b.purge_test) {
    const rows = (await env.DB.prepare(
      "SELECT cv.id, cv.subject, cv.last_message_preview, cv.contact_id, ct.full_name, ct.primary_email FROM conversations cv LEFT JOIN contacts ct ON ct.id=cv.contact_id"
    ).all()).results || [];
    const TEST_EMAIL = /(@ham\.com|@help\.com|@mad\.com|@brokenfoot\.net|@dfads\.com|@hey\.com|@kickass\.net|@fadsdsf\.com|@ouch\.com|@angry\.net)$|((test|e2e|selftest|webhook|pipeline|crisp)[^@]*@consentresolve\.com)/i;
    // ONLY unmistakable junk names. Bare common first names (Bob/Hank/Mike/…) were removed —
    // a real prospect named "Bob" must never be swept. Those ambiguous rows are still caught
    // when a junk EMAIL or junk TEXT (+1555…, DIAGNOSTIC PROBE, "safe to delete") co-occurs.
    const TEST_NAME = /^(CRM E2E Test|CRM Test Two|Webhook (SecretCheck|Self-Test)|Brenda Stubbed Her Toe|Dennis Madly|`?dsafjlka|CR Pipeline Test|Crisp Test|request_contact)$/i;
    const TEST_TEXT = /(\+1555000000|\+1555000000?2|DIAGNOSTIC PROBE|PROBE 2|safe to delete|📞 Calls — \+1555)/i;
    const hits = rows.filter((r) => {
      const em = r.primary_email || "", nm = r.full_name || "", tx = (r.subject || "") + " " + (r.last_message_preview || "");
      return (em && TEST_EMAIL.test(em)) || TEST_NAME.test(nm) || TEST_TEXT.test(tx);
    });
    if (!b.confirm) {
      return json({ ok: true, dry_run: true, count: hits.length, note: "pass confirm:true to delete", matches: hits.map((h) => ({ id: h.id, name: h.full_name, email: h.primary_email, subject: h.subject })) }, {}, cors);
    }
    let n = 0;
    for (const h of hits) {
      await env.DB.prepare("DELETE FROM messages WHERE conversation_id=?").bind(h.id).run().catch(() => {});
      await env.DB.prepare("DELETE FROM notes WHERE conversation_id=?").bind(h.id).run().catch(() => {});
      await env.DB.prepare("DELETE FROM conversations WHERE id=?").bind(h.id).run().catch(() => {});
      n++;
    }
    return json({ ok: true, purged: n }, {}, cors);
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

  // 'nurture' moves a lead onto the long-game newsletter track (out of Open, into the Nurture bucket).
  const status = ["open", "snoozed", "archived", "nurture"].includes(b.status) ? b.status : "open";
  let snooze = null;
  if (status === "snoozed") {
    // Precise reminder time (ISO) preferred — e.g. "call back tomorrow 10am"; else fall back to N days.
    if (b.snooze_until && !isNaN(Date.parse(b.snooze_until))) snooze = new Date(b.snooze_until).toISOString();
    else snooze = new Date(Date.now() + (Number(b.snooze_days) || 3) * 86400000).toISOString();
  }
  const note = status === "snoozed" ? ((b.snooze_note || "").toString().trim().slice(0, 300) || null) : null;
  try { await env.DB.prepare("ALTER TABLE conversations ADD COLUMN snooze_note TEXT").run(); } catch (_) {} // idempotent
  await env.DB.prepare(
    "UPDATE conversations SET status=?, snooze_until=?, snooze_note=?, updated_at=datetime('now') WHERE id=?"
  ).bind(status, snooze, note, b.id).run();
  return json({ ok: true, status, snooze_until: snooze, snooze_note: note }, {}, cors);
}

// Snooze sweep (BUILD-PLAN P1-10): resurface due conversations. Called from the cron.
export async function sweepSnoozed(env) {
  await ensureCrmV2Schema(env);
  const r = await env.DB.prepare(
    "UPDATE conversations SET status='open', unread=1, updated_at=datetime('now') WHERE status='snoozed' AND snooze_until IS NOT NULL AND snooze_until<=datetime('now')"
  ).run();
  return (r.meta && r.meta.changes) || 0;
}
