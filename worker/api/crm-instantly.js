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
import { crmAuthed, crmWebhookToken } from "../_lib/crm.js";
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
const lc = (s) => String(s || "").toLowerCase();
const tsOf = (m) => m.timestamp_email || m.timestamp_created || "";
// Outbound = sent from one of our warmed mailboxes (from === eaccount). A reply is the
// opposite. ue_type:1 (sent) is the fallback when from/eaccount are missing.
const isOutbound = (m) => { const f = lc(m.from_address_email), ea = lc(m.eaccount); return f && ea ? f === ea : Number(m.ue_type) === 1; };
const bodyOf = (m) => (m.body && (m.body.text || m.body.html)) || "";
const stripRe = (s) => String(s || "").replace(/^(re|fwd?):\s*/i, "").trim();
function htmlToText(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(div|p|tr|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// Pull recent Instantly emails, group by thread, and ingest ONLY threads that received a
// reply (a non-no-reply path keeps cold sends out of the inbox). The full thread is stored
// for context; direction per message comes from from===eaccount.
export async function pollInstantly(env, { limit = 100 } = {}) {
  if (!env.INSTANTLY_API_KEY) return { error: "no_key" };
  await ensureCrmV2Schema(env);
  const res = await instantlyGet(env, "/emails?limit=" + limit);
  if (!res.ok) return { error: "list_failed", status: res.status, detail: String(res.body).slice(0, 160) };
  const list = listOf(res.body);

  const threads = {};
  for (const e of list) { const t = e.thread_id || e.id; (threads[t] = threads[t] || []).push(e); }

  let convCount = 0, msgCount = 0, threadsSkipped = 0;
  const sample = [];
  for (const tid of Object.keys(threads)) {
    const msgs = threads[tid].sort((a, b) => String(tsOf(a)).localeCompare(String(tsOf(b))));
    if (!msgs.some((m) => !isOutbound(m))) { threadsSkipped++; continue; } // no reply yet → skip
    const ref = msgs.find((m) => m.lead) || msgs[msgs.length - 1];
    const leadEmail = lc(ref.lead || ref.from_address_email);
    if (!leadEmail) { threadsSkipped++; continue; }
    const eaccount = lc((msgs.find((m) => m.eaccount) || {}).eaccount);
    const campaign = (msgs.find((m) => m.campaign_id) || {}).campaign_id || null;
    const last = msgs[msgs.length - 1];
    const contactId = await findOrCreateContactByEmail(env, leadEmail, { source: "instantly" });
    const convId = await upsertConversationByThread(env, {
      channel: "instantly", externalThreadId: tid, contactId, subject: stripRe(msgs[0].subject),
      sourceDetail: campaign || eaccount || null, channelAccountId: eaccount || null,
      incoming: !isOutbound(last), lastAt: tsOf(last), preview: htmlToText(bodyOf(last)).slice(0, 160),
    });
    for (const m of msgs) {
      const out = isOutbound(m);
      const r = await insertMessageOnce(env, {
        conversationId: convId, direction: out ? "out" : "in", channel: "instantly",
        externalMessageId: m.id || m.message_id, bodyText: htmlToText(bodyOf(m)), // store Instantly id (= reply_to_uuid)
        bodyHtml: (m.body && m.body.html) || "", sentAt: tsOf(m),
      });
      if (!r.existed) msgCount++;
    }
    convCount++;
    if (sample.length < 3) sample.push({ lead: leadEmail, eaccount, campaign, subject: stripRe(msgs[0].subject), msgs: msgs.length });
  }
  return { emails: list.length, threads: Object.keys(threads).length, replied_threads: convCount, threadsSkipped, messages_ingested: msgCount, sample };
}

// Send a reply out the SAME warmed mailbox via Instantly (P1-5, send-to-origin).
// reply_to_uuid is the Instantly email `id` we stored as external_message_id.
export async function sendInstantlyReply(env, { eaccount, replyToUuid, subject, body }) {
  if (!env.INSTANTLY_API_KEY) return { error: "no_key" };
  const res = await fetch(BASE + "/emails/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA, Authorization: "Bearer " + env.INSTANTLY_API_KEY },
    body: JSON.stringify({ eaccount, reply_to_uuid: replyToUuid, subject, body: { text: body, html: String(body || "").replace(/\n/g, "<br>") } }),
  });
  let j = {}; try { j = await res.json(); } catch (_) {}
  if (!res.ok) return { error: String((j && (j.error || j.message)) || ("http_" + res.status)).slice(0, 160), status: res.status };
  return { ok: true, id: j.id || (j.email && j.email.id) || null };
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

// Instantly reply webhook (real-time). Gate by ?key=<CRM_WEBHOOK_TOKEN>. On a reply event
// we re-poll (reusing the proven ingest path, so we don't depend on the webhook's exact
// payload shape). The */5 cron stays as a fallback if a webhook is ever missed.
export async function onRequestPost({ request, env }) {
  if ((new URL(request.url).searchParams.get("key") || "") !== crmWebhookToken(env)) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  let b = {};
  try { b = await request.json(); } catch (_) {}
  const evt = String(b.event_type || b.event || b.type || "").toLowerCase();
  if (evt && !/repl/.test(evt)) return json({ ok: true, skipped: evt }); // only act on reply events
  try {
    const r = await pollInstantly(env, { limit: 50 });
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ ok: true, error: String(e).slice(0, 120) });
  }
}
