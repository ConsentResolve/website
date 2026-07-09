// CRM v2 — Meta Lead Ads webhook (BUILD-PLAN P2-2, spec §5).
//   GET  /api/crm/meta  -> webhook verification (hub.challenge) — set META_VERIFY_TOKEN
//   POST /api/crm/meta  -> leadgen event -> fetch lead via Graph -> v2 conversation
// This is a FORM source (canSend=false): replies route via EMAIL using the captured
// address (handled in the inbox), never via Messenger — sidesteps the 24h DM window.
// Setup (Aaron): in the existing CR Meta app, subscribe the page to the `leadgen` field,
// point the webhook at this URL with META_VERIFY_TOKEN. Graph fetch uses FB_PAGE_TOKEN.
import { json } from "../_lib/http.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, findOrCreateContactByIdentifier, upsertConversationByThread, insertMessageOnce, ulid } from "../_lib/crm-v2.js";
import { tradeSlug } from "../_lib/meta.js";

// ---- Website intel: mine the lead's homepage for signals that shape the pitch. ----
// One regex pass over HTML we already fetched for the alive-check; no external APIs.
const SIGNALS = {
  platform: [["WordPress", /wp-content|wp-includes|wp-json/i], ["Wix", /wix\.com|wixstatic\.com/i], ["Squarespace", /squarespace/i], ["Duda", /dudaone|dudamobile|cdn\.website\.com/i], ["GoDaddy", /godaddysites|apis\.godaddy/i], ["Webflow", /webflow/i], ["Shopify", /cdn\.shopify/i]],
  pixel: [["Meta pixel", /fbq\s*\(|connect\.facebook\.net/i], ["Google Analytics", /googletagmanager|google-analytics|gtag\s*\(/i], ["CallRail", /callrail|calltrk/i]],
  chat: [["Podium", /podium/i], ["Intercom", /intercom/i], ["Crisp", /crisp\.chat/i], ["Tawk", /tawk\.to/i], ["Drift", /drift\.com|driftt/i], ["Birdeye", /birdeye/i], ["LiveChat", /livechat/i]],
  competitors: [["Thumbtack", /thumbtack/i], ["Angi", /angi\.com|angieslist/i], ["HomeAdvisor", /homeadvisor/i], ["Google LSA", /google guaranteed|localservices/i]],
  fsm: [["ServiceTitan", /servicetitan/i], ["Housecall Pro", /housecallpro/i], ["Jobber", /getjobber|jobber/i], ["Calendly", /calendly/i]],
};

function scanWebsite(html) {
  const hits = {};
  for (const [group, list] of Object.entries(SIGNALS)) {
    hits[group] = list.filter(([, re]) => re.test(html)).map(([name]) => name);
  }
  hits.hasForm = /<form[\s>]/i.test(html);
  const tel = html.match(/href=["']tel:([+\d\-().\s]{7,20})/i);
  hits.phone = tel ? tel[1].trim() : "";
  const title = html.match(/<title[^>]*>([^<]{2,120})</i);
  hits.title = title ? title[1].trim() : "";
  return hits;
}

function intelNote(website, siteFlag, s, company) {
  if (siteFlag !== "ok") {
    return "🔍 Website intel — " + (website || "no site given") + "\nSite check: " + (siteFlag === "dead" ? "UNREACHABLE ⚠ (typo, or not a real business?)" : "no website provided") + "\nAngle: verify the business exists (Google the company + phone) before investing time.";
  }
  const capture = [];
  if (s.hasForm) capture.push("contact form");
  if (s.chat.length) capture.push("chat (" + s.chat.join(", ") + ")");
  // Pixels measure, they don't capture — list separately so the rep reads it right.
  const leak = !s.hasForm && !s.chat.length;
  const lines = [
    "🔍 Website intel — " + website,
    s.title ? "Title: " + s.title : null,
    "Platform: " + (s.platform.join(", ") || "unknown"),
    "Visitor capture: " + (capture.length ? capture.join(" · ") : "NONE ❌"),
    "Tracking: " + (s.pixel.length ? s.pixel.join(", ") : "none (they can't even measure the leak)"),
    s.competitors.length ? "Competitor spend: " + s.competitors.join(", ") + " ⚠ (already pays for leads)" : "Competitor badges: none found",
    s.fsm.length ? "Tools: " + s.fsm.join(", ") + " (integration talking point)" : null,
    s.phone ? "Phone on site: " + s.phone : null,
    "",
    leak
      ? "Angle: real site with weak/no visitor capture → prime for the 98%-leak pitch" + (s.competitors.length ? " + they already buy shared leads, sell exclusivity." : ".")
      : "Angle: they already invest in capture — lead with exclusivity + $7 flat vs what they pay now.",
    "Ad Library: https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q=" + encodeURIComponent(company || website),
  ];
  return lines.filter((l) => l !== null).join("\n");
}

// Verify token for the Meta webhook handshake. Not a real secret (the actual security is the
// X-Hub-Signature check below) — defaulted so no Cloudflare secret is required to connect the
// webhook. Override with env.META_VERIFY_TOKEN if you ever want a custom value.
export const LEADGEN_VERIFY_TOKEN = "cr-leadgen-verify-2026";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url).searchParams;
  // One-off, key-gated cleanup: remove all meta_lead test conversations + the known test contacts.
  if (u.get("purge_test") && env.FEEDBACK_KEY && u.get("purge_test") === env.FEEDBACK_KEY) {
    try {
      await ensureCrmV2Schema(env);
      const convs = ((await env.DB.prepare("SELECT id FROM conversations WHERE channel='meta_lead'").all()).results) || [];
      for (const cv of convs) {
        await env.DB.prepare("DELETE FROM messages WHERE conversation_id=?").bind(cv.id).run();
        try { await env.DB.prepare("DELETE FROM notes WHERE conversation_id=?").bind(cv.id).run(); } catch (_) {}
      }
      await env.DB.prepare("DELETE FROM conversations WHERE channel='meta_lead'").run();
      const emails = ["aaron@kickass.net", "test@meta.com", "aaron+handydan@kickass.net"];
      let contacts = 0;
      for (const e of emails) { const r = await env.DB.prepare("DELETE FROM contacts WHERE lower(primary_email)=?").bind(e.toLowerCase()).run(); contacts += (r.meta && r.meta.changes) || 0; }
      return json({ ok: true, purged: { conversations: convs.length, contacts } });
    } catch (e) { return json({ ok: false, error: String(e).slice(0, 160) }); }
  }
  const expected = env.META_VERIFY_TOKEN || LEADGEN_VERIFY_TOKEN;
  if (u.get("hub.mode") === "subscribe" && u.get("hub.verify_token") === expected) {
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
    // Fetch the lead with whatever token is available. The launcher's system-user token
    // (META_ACCESS_TOKEN) already carries `leads_retrieval`, so no separate page token is needed.
    const token = env.FB_PAGE_TOKEN || env.META_PAGE_TOKEN || env.META_ACCESS_TOKEN || "";
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
        const trade = tradeSlug(fields.trade);   // form's qualifying question → industry slug
        // Second qualifier: business website / FB page URL. Verify it resolves so the inbox
        // can tell a real contractor from a junk form-fill at a glance (site:ok|dead|none).
        let website = (fields.website || "").trim();
        if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
        let siteFlag = "none";
        let intel = null;
        if (website) {
          siteFlag = "dead";
          try {
            const ping = await fetch(website, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(5000) });
            if (ping.status < 500) {
              siteFlag = "ok";
              const html = (await ping.text()).slice(0, 400000); // cap: one homepage is plenty
              intel = scanWebsite(html);
            }
          } catch (_) {}
        }
        // fit: hot = real site with NO capture path (no form, no chat) — exactly who we sell to.
        const fit = siteFlag !== "ok" ? "cold" : (intel && !intel.hasForm && !intel.chat.length) ? "hot" : "warm";
        const contactId = email
          ? await findOrCreateContactByEmail(env, email, { name, phone, source: "meta_lead" })
          : await findOrCreateContactByIdentifier(env, "meta_lead", String(leadgenId), { name, source: "meta_lead" });
        if (!contactId) continue;
        const convId = await upsertConversationByThread(env, {
          channel: "meta_lead", externalThreadId: String(leadgenId), contactId,
          subject: "Meta Lead" + (name ? " — " + name : ""),
          sourceDetail: [formId ? "form:" + formId : null, trade ? "trade:" + trade : null, "site:" + siteFlag, "fit:" + fit].filter(Boolean).join("|") || null,
          incoming: true, lastAt: new Date().toISOString(),
          preview: [fit === "hot" ? "🔥" : null, trade, name, email, phone, website ? website + (siteFlag === "dead" ? " (unreachable)" : "") : "no website"].filter(Boolean).join(" · ").slice(0, 160) || "Meta lead form",
        });
        await insertMessageOnce(env, {
          conversationId: convId, direction: "in", channel: "meta_lead", externalMessageId: "meta:" + leadgenId,
          bodyText: (lead.field_data || []).map((f) => (f.name || "") + ": " + ((f.values && f.values[0]) || "")).join("\n") || "Lead form submitted.",
          sentAt: new Date().toISOString(),
        });
        // Attach the website-intel dossier as a system note (author null) — once per lead.
        if (website || siteFlag !== "none") {
          try {
            const dup = await env.DB.prepare("SELECT id FROM notes WHERE conversation_id=? AND body LIKE '🔍 Website intel%'").bind(convId).first();
            if (!dup) {
              await env.DB.prepare("INSERT INTO notes (id, author_id, conversation_id, contact_id, body) VALUES (?, NULL, ?, ?, ?)")
                .bind(ulid(), convId, contactId, intelNote(website, siteFlag, intel || {}, fields.company_name || name)).run();
            }
          } catch (_) {}
        }
        ingested++;
      }
    }
    return json({ ok: true, ingested });
  } catch (e) { return json({ ok: true, error: String(e).slice(0, 120) }); }
}
