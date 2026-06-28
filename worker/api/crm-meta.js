// CRM v2 — Meta Lead Ads webhook (BUILD-PLAN P2-2, spec §5).
//   GET  /api/crm/meta  -> webhook verification (hub.challenge) — set META_VERIFY_TOKEN
//   POST /api/crm/meta  -> leadgen event -> fetch lead via Graph -> v2 conversation
// This is a FORM source (canSend=false): replies route via EMAIL using the captured
// address (handled in the inbox), never via Messenger — sidesteps the 24h DM window.
// Setup (Aaron): in the existing CR Meta app, subscribe the page to the `leadgen` field,
// point the webhook at this URL with META_VERIFY_TOKEN. Graph fetch uses FB_PAGE_TOKEN.
import { json } from "../_lib/http.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, findOrCreateContactByIdentifier, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url).searchParams;
  if (u.get("hub.mode") === "subscribe" && u.get("hub.verify_token") && u.get("hub.verify_token") === (env.META_VERIFY_TOKEN || "")) {
    return new Response(u.get("hub.challenge") || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

// Verify Meta's X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the app secret).
async function verifySig(raw, header, secret) {
  if (!secret) return true; // not configured yet → allow (open like other webhooks)
  const sig = String(header || "").replace(/^sha256=/, "");
  if (!sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === sig;
}

export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  if (!(await verifySig(raw, request.headers.get("X-Hub-Signature-256"), env.META_APP_SECRET))) {
    return json({ error: "bad_signature" }, { status: 403 });
  }
  let body = {};
  try { body = JSON.parse(raw); } catch { return json({ ok: true, skipped: "bad_json" }); }
  try {
    await ensureCrmV2Schema(env);
    const token = env.FB_PAGE_TOKEN || env.META_PAGE_TOKEN || "";
    let ingested = 0;
    for (const entry of (body.entry || [])) {
      for (const ch of (entry.changes || [])) {
        if (ch.field !== "leadgen" || !ch.value) continue;
        const leadgenId = ch.value.leadgen_id;
        const formId = ch.value.form_id || "";
        if (!leadgenId || !token) continue;
        // Fetch the lead's field_data from the Graph API.
        let lead = {};
        try {
          const r = await fetch("https://graph.facebook.com/v19.0/" + leadgenId + "?access_token=" + encodeURIComponent(token));
          lead = await r.json();
        } catch (_) {}
        const fields = {};
        for (const f of (lead.field_data || [])) fields[(f.name || "").toLowerCase()] = (f.values && f.values[0]) || "";
        const email = (fields.email || fields.work_email || "").toLowerCase();
        const name = fields.full_name || [fields.first_name, fields.last_name].filter(Boolean).join(" ") || "";
        const phone = fields.phone_number || fields.phone || "";
        const contactId = email
          ? await findOrCreateContactByEmail(env, email, { name, phone, source: "meta_lead" })
          : await findOrCreateContactByIdentifier(env, "meta_lead", String(leadgenId), { name, source: "meta_lead" });
        if (!contactId) continue;
        const convId = await upsertConversationByThread(env, {
          channel: "meta_lead", externalThreadId: String(leadgenId), contactId,
          subject: "Meta Lead" + (name ? " — " + name : ""), sourceDetail: formId ? "form:" + formId : null,
          incoming: true, lastAt: new Date().toISOString(),
          preview: [name, email, phone].filter(Boolean).join(" · ").slice(0, 160) || "Meta lead form",
        });
        await insertMessageOnce(env, {
          conversationId: convId, direction: "in", channel: "meta_lead", externalMessageId: "meta:" + leadgenId,
          bodyText: (lead.field_data || []).map((f) => (f.name || "") + ": " + ((f.values && f.values[0]) || "")).join("\n") || "Lead form submitted.",
          sentAt: new Date().toISOString(),
        });
        ingested++;
      }
    }
    return json({ ok: true, ingested });
  } catch (e) { return json({ ok: true, error: String(e).slice(0, 120) }); }
}
