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

// Trade fingerprints: does the site's copy actually match the trade they claimed on the form?
// Phrase-level patterns (not bare words) to dodge false hits like `window.` in inline JS.
// Keys MUST be the TRADE_OPTIONS slugs from _lib/meta.js — checkTrade() is fed tradeSlug()
// output, so a key that isn't a real form slug can never match a real lead.
const TRADE_KEYWORDS = {
  "hvac": /hvac|air conditioning|heating (and|&) (cooling|air)|furnace|heat pump|\bac repair/gi,
  "plumber": /plumb(ing|er)|water heater|drain clean|sewer line/gi,
  "electrician": /electric(ian|al service|al contractor)|rewir|breaker panel|panel upgrade/gi,
  "roofing": /roof(ing|er| repair| replacement)|shingle|storm damage/gi,
  "general-contractor": /remodel|renovat|general contractor|kitchen (and|&) bath|home addition|design.build/gi,
  "handyman": /handyman|odd jobs|honey.do|home repair service/gi,
  "painter": /paint(ing|er)s? (service|company|contractor|interior|exterior)|house paint|interior paint|exterior paint/gi,
  "house-cleaning": /house clean|cleaning service|maid|housekeeping|deep clean|move.out clean/gi,
  "power-washing": /(power|pressure) wash|soft wash/gi,
  "pest-control": /pest control|exterminat|termite|rodent|bed bug/gi,
  "lawn-care": /lawn (care|service|maintenance)|landscap(e|ing)|irrigation|mowing/gi,
  "tree-removal": /tree (service|removal|trimming|care)|arborist|stump grind/gi,
  "locksmith": /locksmith|lockout|rekey|lock (install|repair|change)/gi,
  "garage-door": /garage door|door opener/gi,
  "deck-fence": /deck (build|install|repair|construction)|fenc(e|ing) (install|company|contractor|repair)|privacy fence|pergola/gi,
  "appliance-repair": /appliance repair|washer repair|dryer repair|refrigerator repair|dishwasher repair/gi,
  "mobile-car-service": /mobile (mechanic|detail)|auto repair|oil change|car detail|brake (repair|service)/gi,
};

// Compare the claimed trade against what the site's copy actually says.
//   verified  — the claimed trade's language is on the page (ICP match)
//   mismatch  — nothing for their trade, but the site clearly reads as a different one
//   unclear   — no trade signals either way (thin site, or not a service business)
function checkTrade(html, claimed) {
  const counts = {};
  for (const [slug, re] of Object.entries(TRADE_KEYWORDS)) counts[slug] = (html.match(re) || []).length;
  const claimedHits = claimed ? (counts[claimed] || 0) : 0;
  const best = Object.entries(counts).filter(([s]) => s !== claimed).sort((a, b) => b[1] - a[1])[0];
  if (claimedHits >= 1) return { status: "verified", hits: claimedHits };
  if (best && best[1] >= 2) return { status: "mismatch", looksLike: best[0], hits: best[1] };
  return { status: "unclear" };
}

// SSRF guard — reject non-public fetch targets (loopback / private / link-local /
// cloud-metadata) and non-http(s) schemes before touching a lead-supplied URL.
function isPublicHttpUrl(u) {
  let x;
  try { x = new URL(u); } catch { return false; }
  if (x.protocol !== "http:" && x.protocol !== "https:") return false;
  const h = x.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "[::1]" || h === "::1") return false;
  if (h.includes(":")) { // IPv6
    if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return false;
    return true;
  }
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;            // this-host / private / loopback / multicast+
    if (a === 169 && b === 254) return false;                                   // link-local incl. 169.254.169.254 metadata
    if (a === 172 && b >= 16 && b <= 31) return false;                          // private
    if (a === 192 && b === 168) return false;                                   // private
  }
  return true;
}

// Read a response body with a hard byte cap so a lead can't stream a huge/slow
// payload into the Worker's memory. Bounded by the caller's fetch timeout too.
async function readCapped(resp, max) {
  if (!resp.body) return "";
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let out = "", received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      out += dec.decode(value, { stream: true });
      if (received >= max) { try { await reader.cancel(); } catch (_) {} break; }
    }
  } catch (_) {}
  return out.slice(0, max);
}

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

function tradeCheckLine(tc, claimed) {
  if (!tc || !claimed) return null;
  if (tc.status === "verified") return "Trade check: claimed " + claimed + " — ✓ verified on site (" + tc.hits + " mention" + (tc.hits === 1 ? "" : "s") + ")";
  if (tc.status === "mismatch") return "Trade check: claimed " + claimed + " — ✗ MISMATCH, site reads like " + tc.looksLike;
  return "Trade check: claimed " + claimed + " — ? no " + claimed + " language found on the site";
}

function intelNote(website, siteFlag, s, company, trade, siteAnswer) {
  if (siteFlag === "nosite") {
    return "🔍 Website intel — no website yet\nSite check: they answered \"" + siteAnswer + "\" on the form — honest no-site answer, not a fake business.\nAngle: Consent Resolve installs on their website, so they can't use us until they have one. Nurture: check back when the site is live (or point them to a site builder first).";
  }
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
    tradeCheckLine(s.tradeCheck, trade),
    "Visitor capture: " + (capture.length ? capture.join(" · ") : "NONE ❌"),
    "Tracking: " + (s.pixel.length ? s.pixel.join(", ") : "none (they can't even measure the leak)"),
    s.competitors.length ? "Competitor spend: " + s.competitors.join(", ") + " ⚠ (already pays for leads)" : "Competitor badges: none found",
    s.fsm.length ? "Tools: " + s.fsm.join(", ") + " (integration talking point)" : null,
    s.phone ? "Phone on site: " + s.phone : null,
    "",
    (s.tradeCheck && s.tradeCheck.status === "mismatch")
      ? "Angle: site does NOT match the claimed trade — likely a junk fill. Verify before spending any time."
      : leak
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
  // Key-gated cleanup. By default deletes ONLY injected sample leads (external_thread_id
  // 'sample-…') — safe alongside real leads. ?purge_test=<KEY>&all=1 restores the old
  // wipe-everything behavior (dangerous once real leads exist; it once ate 4 real leads).
  if (u.get("purge_test") && env.FEEDBACK_KEY && u.get("purge_test") === env.FEEDBACK_KEY) {
    try {
      await ensureCrmV2Schema(env);
      const where = u.get("all") === "1"
        ? "channel='meta_lead'"
        : "channel='meta_lead' AND external_thread_id LIKE 'sample-%'";
      const convs = ((await env.DB.prepare("SELECT id FROM conversations WHERE " + where).all()).results) || [];
      for (const cv of convs) {
        await env.DB.prepare("DELETE FROM messages WHERE conversation_id=?").bind(cv.id).run();
        try { await env.DB.prepare("DELETE FROM notes WHERE conversation_id=?").bind(cv.id).run(); } catch (_) {}
        await env.DB.prepare("DELETE FROM conversations WHERE id=?").bind(cv.id).run();
      }
      const emails = ["aaron@kickass.net", "test@meta.com", "aaron+handydan@kickass.net", "sample+demo@consentresolve.com", "sample@consentresolve.com"];
      let contacts = 0;
      for (const e of emails) { const r = await env.DB.prepare("DELETE FROM contacts WHERE lower(primary_email)=? AND NOT EXISTS (SELECT 1 FROM conversations WHERE contact_id=contacts.id)").bind(e.toLowerCase()).run(); contacts += (r.meta && r.meta.changes) || 0; }
      return json({ ok: true, purged: { conversations: convs.length, contacts } });
    } catch (e) { return json({ ok: false, error: String(e).slice(0, 160) }); }
  }
  // Key-gated sample-lead injector (demos/tests) — runs the REAL ingest pipeline including
  // the website fetch + intel note: ?inject_sample=<FEEDBACK_KEY>&website=…&name=…&company=…&trade=…
  if (u.get("inject_sample") && env.FEEDBACK_KEY && u.get("inject_sample") === env.FEEDBACK_KEY) {
    try {
      await ensureCrmV2Schema(env);
      const fields = {
        trade: u.get("trade") || "remodeling",
        full_name: u.get("name") || "Sample Lead (demo)",
        email: (u.get("email") || "sample@consentresolve.com").toLowerCase(),
        phone_number: u.get("phone") || "+1 (555) 010-0000",
        company_name: u.get("company") || "",
        website: u.get("website") || "",
      };
      const fieldData = Object.entries(fields).map(([name, v]) => ({ name, values: [v] }));
      const r = await ingestLead(env, { fields, leadgenId: "sample-" + Date.now(), formId: "sample", fieldData });
      return json({ ok: !!r, ...(r || {}) });
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
        if (await ingestLead(env, { fields, leadgenId, formId, fieldData: lead.field_data })) ingested++;
      }
    }
    return json({ ok: true, ingested });
  } catch (e) { return json({ ok: true, error: String(e).slice(0, 120) }); }
}

// Shared ingest: fields -> contact -> conversation (+site check, intel note). Used by the
// webhook above and the key-gated sample injector in onRequestGet (demo/test leads).
async function ingestLead(env, { fields, leadgenId, formId, fieldData }) {
        const email = (fields.email || fields.work_email || "").toLowerCase();
        const name = fields.full_name || [fields.first_name, fields.last_name].filter(Boolean).join(" ") || "";
        const phone = fields.phone_number || fields.phone || "";
        const trade = tradeSlug(fields.trade);   // form's qualifying question → industry slug
        // Second qualifier: business website / FB page URL. Verify it resolves so the inbox
        // can tell a real contractor from a junk form-fill at a glance (site:ok|dead|none).
        let siteAnswer = (fields.website || "").trim();
        try { siteAnswer = decodeURIComponent(siteAnswer); } catch (_) {}   // Meta sends e.g. "not%20yet"
        // A text field invites text: "not yet", "none", "n/a" are honest no-website answers,
        // not typo'd domains — don't fetch them, and don't call the lead fake over it.
        const saysNoSite = /^(no+|none|n\/?a|not?\s*yet|no\s*website|coming\s*soon|don'?t\s*have\s*(one|a?\s*website)?|-+|\.+)$/i.test(siteAnswer);
        let website = (!siteAnswer || saysNoSite || !siteAnswer.includes(".")) ? "" : siteAnswer;
        if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
        let siteFlag = siteAnswer && !website ? "nosite" : "none";
        // SSRF guard: only fetch public http(s) hosts. A lead can type anything;
        // never let the webhook fetch loopback/private/link-local/metadata targets
        // from Cloudflare egress.
        if (website && !isPublicHttpUrl(website)) { website = ""; siteFlag = "nosite"; }
        let intel = null;
        if (website) {
          siteFlag = "dead";
          try {
            const ping = await fetch(website, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(5000) });
            if (ping.ok) {  // 2xx only — a 4xx/parked page is not a live homepage
              siteFlag = "ok";
              const html = await readCapped(ping, 400000); // cap the read: one homepage is plenty, and bounds memory
              intel = scanWebsite(html);
              intel.tradeCheck = checkTrade(html, trade);
            }
          } catch (_) {}
        }
        // fit: hot = real site with NO capture path (no form, no chat) — exactly who we sell to.
        // A trade mismatch overrides to cold: real site, wrong business = the junk-lead pattern.
        let fit = siteFlag !== "ok" ? "cold" : (intel && !intel.hasForm && !intel.chat.length) ? "hot" : "warm";
        if (intel && intel.tradeCheck && intel.tradeCheck.status === "mismatch") fit = "cold";
        const contactId = email
          ? await findOrCreateContactByEmail(env, email, { name, phone, source: "meta_lead" })
          : await findOrCreateContactByIdentifier(env, "meta_lead", String(leadgenId), { name, source: "meta_lead" });
        if (!contactId) return null;
        const convId = await upsertConversationByThread(env, {
          channel: "meta_lead", externalThreadId: String(leadgenId), contactId,
          subject: "Meta Lead" + (name ? " — " + name : ""),
          sourceDetail: [formId ? "form:" + formId : null, trade ? "trade:" + trade : null, "site:" + siteFlag, "fit:" + fit].filter(Boolean).join("|") || null,
          incoming: true, lastAt: new Date().toISOString(),
          preview: [fit === "hot" ? "🔥" : null, trade, name, email, phone, website ? website + (siteFlag === "dead" ? " (unreachable)" : "") : (siteFlag === "nosite" ? "no website yet (“" + siteAnswer + "”)" : "no website")].filter(Boolean).join(" · ").slice(0, 160) || "Meta lead form",
        });
        await insertMessageOnce(env, {
          conversationId: convId, direction: "in", channel: "meta_lead", externalMessageId: "meta:" + leadgenId,
          bodyText: (fieldData || []).map((f) => (f.name || "") + ": " + ((f.values && f.values[0]) || "")).join("\n") || "Lead form submitted.",
          sentAt: new Date().toISOString(),
        });
        // Attach the website-intel dossier as a system note (author null) — once per lead.
        let note = null;
        if (website || siteFlag !== "none") {
          note = intelNote(website, siteFlag, intel || {}, fields.company_name || name, trade, siteAnswer);
          try {
            const dup = await env.DB.prepare("SELECT id FROM notes WHERE conversation_id=? AND body LIKE '🔍 Website intel%'").bind(convId).first();
            if (!dup) {
              await env.DB.prepare("INSERT INTO notes (id, author_id, conversation_id, contact_id, body) VALUES (?, NULL, ?, ?, ?)")
                .bind(ulid(), convId, contactId, note).run();
            }
          } catch (_) {}
        }
        return { convId, fit, siteFlag, note };
}
