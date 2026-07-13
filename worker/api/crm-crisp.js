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

// Outbound reply to a Crisp conversation (spec §5). Needs the plugin creds
// CRISP_WEBSITE_ID / CRISP_IDENTIFIER / CRISP_KEY; no-ops clearly if unset.
export async function sendCrispMessage(env, sessionId, text) {
  const wid = env.CRISP_WEBSITE_ID, id = env.CRISP_IDENTIFIER, key = env.CRISP_KEY;
  if (!wid || !id || !key) return { error: "crisp_unconfigured", message: "Set CRISP_WEBSITE_ID / CRISP_IDENTIFIER / CRISP_KEY to reply to Crisp chats." };
  if (!sessionId) return { error: "no_session" };
  const r = await fetch("https://api.crisp.chat/v1/website/" + wid + "/conversation/" + sessionId + "/message", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa(id + ":" + key), "X-Crisp-Tier": "plugin" },
    body: JSON.stringify({ type: "text", from: "operator", origin: "chat", content: text }),
  });
  let j = {}; try { j = await r.json(); } catch (_) {}
  if (!r.ok) return { error: "crisp_send_failed", message: String((j && j.reason) || r.status).slice(0, 120) };
  return { ok: true, id: (j.data && j.data.fingerprint) || null };
}

// Fetch the full message history of a Crisp conversation (both sides) for the CRM thread.
// Needs the same plugin creds as sending. Returns null if unconfigured/unavailable.
export async function getCrispTranscript(env, sessionId) {
  const wid = env.CRISP_WEBSITE_ID, id = env.CRISP_IDENTIFIER, key = env.CRISP_KEY;
  if (!wid || !id || !key || !sessionId) return null;
  const r = await fetch("https://api.crisp.chat/v1/website/" + wid + "/conversation/" + sessionId + "/messages", {
    headers: { Authorization: "Basic " + btoa(id + ":" + key), "X-Crisp-Tier": "plugin" },
  });
  let j = {}; try { j = await r.json(); } catch (_) {}
  if (!r.ok || !j || j.error) return null;
  return Array.isArray(j.data) ? j.data : [];
}

// List recent Crisp conversations via REST (plugin creds). Belt-and-suspenders vs webhook drift:
// a rotated CRM key silently 401s the webhook and Crisp disables it, so we also poll + backfill.
async function listCrispConversations(env, pages) {
  const wid = env.CRISP_WEBSITE_ID, id = env.CRISP_IDENTIFIER, key = env.CRISP_KEY;
  if (!wid || !id || !key) return null;
  const out = [];
  for (let p = 1; p <= (pages || 3); p++) {
    const r = await fetch("https://api.crisp.chat/v1/website/" + wid + "/conversations/" + p, {
      headers: { Authorization: "Basic " + btoa(id + ":" + key), "X-Crisp-Tier": "plugin" },
    });
    let j = {}; try { j = await r.json(); } catch (_) {}
    if (!r.ok || !j || !Array.isArray(j.data)) break;
    out.push(...j.data);
    if (j.data.length < 20) break; // short page = last page
  }
  return out;
}

// Ingest one Crisp conversation's visitor messages into the v2 inbox. Dedup-safe (session +
// per-message fingerprint), so re-running the poll never doubles a chat.
async function ingestCrispConversation(env, sess) {
  const session = sess.session_id;
  if (!session) return 0;
  const meta = sess.meta || {};
  const email = String(meta.email || "").toLowerCase();
  const name = meta.nickname || "";
  const hasEmail = EMAIL_RE.test(email);
  let contactId = null;
  if (hasEmail) {
    contactId = await findOrCreateContactByEmail(env, email, { name, source: "crisp" });
    await linkIdentifier(env, contactId, "crisp_session", session);
  } else {
    contactId = await findOrCreateContactByIdentifier(env, "crisp_session", session, { name, source: "crisp" });
  }
  if (!contactId) return 0;
  const msgs = (await getCrispTranscript(env, session)) || [];
  const visitor = msgs.filter((m) => (m.from === "user" || m.from === "visitor") && m.type === "text");
  if (!visitor.length) return 0;
  const last = visitor[visitor.length - 1];
  const lastContent = typeof last.content === "string" ? last.content : (last.content && last.content.text) || "Crisp chat";
  const convId = await upsertConversationByThread(env, {
    channel: "crisp", externalThreadId: session, contactId,
    subject: name ? "Chat with " + name : "Crisp chat", incoming: true,
    lastAt: new Date(last.timestamp || Date.now()).toISOString(),
    preview: String(lastContent).slice(0, 160),
  });
  let n = 0;
  for (const m of visitor) {
    const body = typeof m.content === "string" ? m.content : (m.content && m.content.text) || "";
    await insertMessageOnce(env, {
      conversationId: convId, direction: "in", channel: "crisp",
      externalMessageId: m.fingerprint ? String(m.fingerprint) : null,
      bodyText: body, sentAt: new Date(m.timestamp || Date.now()).toISOString(),
    });
    n++;
  }
  return n;
}

// GET ?sync=<CRM_WEBHOOK_TOKEN>  -> poll Crisp + backfill any missed chats (webhook-independent).
// GET ?sync=<key>&cleanup_diag=1 -> also remove the synthetic diagnostic sessions.
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url).searchParams;
  if (!u.get("sync")) return json({ ok: true, hint: "POST = Crisp webhook. GET ?sync=<key> backfills missed chats." });
  if (u.get("sync") !== crmWebhookToken(env)) return json({ error: "unauthorized" }, { status: 401 });
  // Debug: surface Crisp's raw response so we can tell 403-scope vs 200-empty vs wrong-website.
  if (u.get("debug")) {
    const wid = env.CRISP_WEBSITE_ID, id = env.CRISP_IDENTIFIER, key = env.CRISP_KEY;
    const cfg = { has_website_id: !!wid, website_id_len: (wid || "").length, has_identifier: !!id, has_key: !!key };
    if (!wid || !id || !key) return json({ ok: false, cfg, note: "one or more secrets still missing/empty" });
    const r = await fetch("https://api.crisp.chat/v1/website/" + wid + "/conversations/1", {
      headers: { Authorization: "Basic " + btoa(id + ":" + key), "X-Crisp-Tier": "plugin" },
    });
    let bodyText = ""; try { bodyText = await r.text(); } catch (_) {}
    let parsed = null; try { parsed = JSON.parse(bodyText); } catch (_) {}
    const sample = parsed && Array.isArray(parsed.data)
      ? parsed.data.slice(0, 3).map((c) => ({ session: c.session_id, state: c.state, email: (c.meta || {}).email || null, nick: (c.meta || {}).nickname || null }))
      : null;
    return json({ ok: r.ok, cfg, crisp_status: r.status, crisp_reason: parsed && parsed.reason, count: parsed && Array.isArray(parsed.data) ? parsed.data.length : null, sample, raw: parsed ? undefined : bodyText.slice(0, 300) });
  }
  try {
    await ensureCrmV2Schema(env);
    if (u.get("cleanup_diag")) {
      for (const s of ["session_test_diag_001", "session_test_diag_002"]) {
        const c = await env.DB.prepare("SELECT id FROM conversations WHERE channel='crisp' AND external_thread_id=?").bind(s).first();
        if (c) {
          await env.DB.prepare("DELETE FROM messages WHERE conversation_id=?").bind(c.id).run();
          await env.DB.prepare("DELETE FROM conversations WHERE id=?").bind(c.id).run();
        }
      }
    }
    const convs = await listCrispConversations(env, Number(u.get("pages")) || 3);
    if (convs === null) return json({ ok: false, error: "crisp_unconfigured", message: "Set CRISP_WEBSITE_ID / CRISP_IDENTIFIER / CRISP_KEY (Cloudflare secrets) to enable Crisp polling + replies." });
    let ingested = 0, messages = 0;
    for (const s of convs) { const n = await ingestCrispConversation(env, s); if (n) { ingested++; messages += n; } }
    return json({ ok: true, conversations: convs.length, ingested, messages });
  } catch (e) { return json({ ok: false, error: String(e).slice(0, 160) }); }
}

export async function onRequestPost({ request, env }) {
  if ((new URL(request.url).searchParams.get("key") || "") !== crmWebhookToken(env)) return json({ error: "unauthorized" }, { status: 401 });
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: true, skipped: "bad_json" }); }
  try {
    // Only ingest a real inbound visitor message. Skip other event types (compose/typing,
    // profile updates) and operator/system messages — otherwise one chat doubles up.
    const event = String(body.event || "");
    if (event && event !== "message:received") return json({ ok: true, skipped: "event:" + event });
    const from = String(deepFind(body, ["from"], 0) || "").toLowerCase();
    if (from && from !== "user" && from !== "visitor") return json({ ok: true, skipped: "from:" + from });

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
