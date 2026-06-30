// Instantly (cold email) → CRM. Pull reply emails from the Unibox and ingest them as
// inbound conversations/messages stitched to the contact by email — so cold-email replies
// land in the same inbox as chat / demo / Gmail. Inert until INSTANTLY_API_KEY is set.
//
// Direction is decided by from-address: if the sender is one of OUR sending inboxes it's our
// own outbound (skip); otherwise it's a real reply from the lead (ingest as direction "in").
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce } from "./crm-v2.js";

const BASE = "https://api.instantly.ai/api/v2";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function instantlyConfigured(env) { return !!env.INSTANTLY_API_KEY; }

async function instGet(env, path) {
  const res = await fetch(BASE + path, {
    headers: { Authorization: "Bearer " + env.INSTANTLY_API_KEY, Accept: "application/json", "User-Agent": UA },
  });
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, body: j };
}

function stripHtml(h) {
  return String(h || "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(div|p)>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n").trim();
}

async function senderAccounts(env) {
  const r = await instGet(env, "/accounts?limit=100");
  const set = new Set();
  for (const a of ((r.body && r.body.items) || [])) if (a.email) set.add(String(a.email).toLowerCase());
  return set;
}

function emailBodies(e) {
  const b = e.body;
  if (b && typeof b === "object") return { html: b.html || null, text: b.text || (b.html ? stripHtml(b.html) : null) };
  if (typeof b === "string") return { html: b, text: stripHtml(b) };
  return { html: null, text: null };
}

// Pull recent emails and ingest INBOUND replies. Idempotent: insertMessageOnce dedups on
// external_message_id, so re-polling the same window is harmless. Returns { scanned, ingested }.
export async function ingestInstantlyReplies(env, { limit = 100 } = {}) {
  if (!instantlyConfigured(env) || !env.DB) return { scanned: 0, ingested: 0, configured: instantlyConfigured(env) };
  await ensureCrmV2Schema(env);
  const senders = await senderAccounts(env);
  const r = await instGet(env, "/emails?limit=" + limit);
  if (!r.ok) return { scanned: 0, ingested: 0, configured: true, error: "emails " + r.status };
  const items = (r.body && r.body.items) || [];
  let scanned = 0, ingested = 0;
  for (const e of items) {
    scanned++;
    const from = String(e.from_address_email || "").toLowerCase();
    if (!from || senders.has(from)) continue; // our own outbound — only ingest replies
    const lead = e.lead && typeof e.lead === "object" ? e.lead : {};
    const name = [lead.first_name || lead.firstName, lead.last_name || lead.lastName].filter(Boolean).join(" ").trim() || null;
    const contactId = await findOrCreateContactByEmail(env, from, { source: "instantly", name });
    const { html, text } = emailBodies(e);
    const sentAt = e.timestamp_email || e.timestamp_created || null;
    const convId = await upsertConversationByThread(env, {
      channel: "instantly", externalThreadId: e.thread_id || e.id, contactId,
      subject: e.subject || "Cold-email reply",
      sourceDetail: e.campaign_id ? "campaign:" + e.campaign_id : null,
      incoming: true, lastAt: sentAt, preview: (text || "").slice(0, 140),
    });
    const ins = await insertMessageOnce(env, {
      conversationId: convId, direction: "in", channel: "instantly",
      externalMessageId: "inst:" + (e.message_id || e.id), bodyText: text, bodyHtml: html, sentAt,
    });
    if (!ins.existed) ingested++;
  }
  return { scanned, ingested, configured: true };
}
