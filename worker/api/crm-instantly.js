// CRM v2 — Instantly Unibox adapter (BUILD-PLAN P1-4). Pulls campaign REPLIES from
// Instantly's v2 API into D1 as channel='instantly', carrying the eaccount + campaign
// as source_detail so replies route back out the SAME warmed mailbox (P1-5, send-to-
// origin — never hello@). Reuses INSTANTLY_API_KEY + the browser-UA trick (Instantly's
// API sits behind Cloudflare and 403/1010s non-browser UAs).
//   GET /api/crm/instantly?raw=1[&path=/emails?limit=5] -> raw shape (firstKeys + sample)
//   GET /api/crm/instantly?poll=1                       -> ingest replies, return summary
// NOTE: v2 /emails field names are validated via ?raw=1 before the cron is enabled — the
// mapping below is defensive across likely keys until confirmed on live data.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE = "https://api.instantly.ai/api/v2";

async function instantlyGet(env, path) {
  const r = await fetch(BASE + path, { headers: { Authorization: "Bearer " + env.INSTANTLY_API_KEY, Accept: "application/json", "User-Agent": UA } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}
const listOf = (b) => (Array.isArray(b) ? b : (b && (b.items || b.data || b.emails || b.results)) || []);
const pick = (o, ...keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== "") return o[k]; return null; };

export async function pollInstantly(env, { limit = 50 } = {}) {
  if (!env.INSTANTLY_API_KEY) return { error: "no_key" };
  await ensureCrmV2Schema(env);
  const res = await instantlyGet(env, "/emails?limit=" + limit);
  if (!res.ok) return { error: "list_failed", status: res.status, detail: String(res.body).slice(0, 160) };
  const list = listOf(res.body);
  let ingested = 0, skipped = 0, outbound = 0;
  const sample = [];
  for (const e of list) {
    const fromEmail = String(pick(e, "from_address_email", "from_address", "from", "lead_email") || "").toLowerCase();
    const eaccount = String(pick(e, "eaccount", "account", "from_account") || "").toLowerCase();
    const ueType = pick(e, "ue_type", "email_type", "type");
    // Inbound = a reply FROM the lead. Instantly types vary; fall back to from!=eaccount.
    const isInbound = ueType === 2 || ueType === "2" || ueType === "received" ||
                      (!!eaccount && !!fromEmail && fromEmail !== eaccount);
    if (!isInbound) { outbound++; continue; }
    const leadEmail = fromEmail || String(pick(e, "lead_email") || "").toLowerCase();
    if (!leadEmail) { skipped++; continue; }
    const subject = pick(e, "subject", "email_subject") || "";
    const bodyText = pick(e, "body_text", "text", "content_preview", "snippet") || (e.body && e.body.text) || "";
    const bodyHtml = pick(e, "body_html", "html") || (e.body && e.body.html) || "";
    const sentAt = pick(e, "timestamp_created", "timestamp", "created_at", "date", "sent_at");
    const thread = pick(e, "thread_id", "message_id", "id");
    const campaign = pick(e, "campaign_id", "campaign");
    const extMsgId = String(pick(e, "message_id", "id") || (String(thread) + "|" + leadEmail));
    const contactId = await findOrCreateContactByEmail(env, leadEmail, { source: "instantly" });
    const convId = await upsertConversationByThread(env, {
      channel: "instantly", externalThreadId: String(thread || extMsgId), contactId, subject,
      sourceDetail: campaign ? String(campaign) : (eaccount || null), channelAccountId: eaccount || null,
      incoming: true, lastAt: sentAt, preview: String(bodyText || subject).slice(0, 160),
    });
    const r = await insertMessageOnce(env, {
      conversationId: convId, direction: "in", channel: "instantly",
      externalMessageId: extMsgId, bodyText, bodyHtml, sentAt,
    });
    if (!r.existed) { ingested++; if (sample.length < 3) sample.push({ from: leadEmail, subject, eaccount, campaign }); }
  }
  return { total: list.length, ingested, skipped, outbound, sample };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!env.INSTANTLY_API_KEY) return json({ error: "no_key", message: "INSTANTLY_API_KEY not set in Cloudflare" }, { status: 400 }, cors);
  const url = new URL(request.url);

  if (url.searchParams.get("raw") === "1") {
    const p = url.searchParams.get("path") || "/emails?limit=5";
    const res = await instantlyGet(env, p.startsWith("/") ? p : "/" + p);
    const list = listOf(res.body);
    return json({ status: res.status, firstKeys: list[0] ? Object.keys(list[0]) : null, count: list.length, sample: list.slice(0, 2) }, {}, cors);
  }
  if (url.searchParams.get("poll") === "1") {
    return json({ ok: true, result: await pollInstantly(env, { limit: Number(url.searchParams.get("limit")) || 50 }) }, {}, cors);
  }
  return json({ ok: true, hint: "?raw=1 to inspect the /emails shape, ?poll=1 to ingest replies" }, {}, cors);
}
