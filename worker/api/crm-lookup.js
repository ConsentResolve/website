// worker/api/crm-lookup.js
//   POST /api/crm/lookup { contact_id, website? } -> gather company intel from the website
//   itself (free HTML parsing), optionally Apollo firmographics + a Claude summary, and return
//   the merged enrichment + the DOLLAR COST of this lookup. Result is cached on companies.enrichment.
//
// Cost model (shown to the user each run):
//   • Website fetch + parse ......... $0.00 (we do it ourselves — no BuiltWith)
//   • Apollo firmographic match ..... env.APOLLO_COST_PER_LOOKUP (default $0.03) — only if it matched
//   • Claude summary ................ real token cost, only if ANTHROPIC_API_KEY is set
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, currentUser, adminUserId, addActivityV2, findOrCreateCompany } from "../_lib/crm-v2.js";
import { enrichContactById } from "../_lib/apollo.js";
// DataForSEO calls live in a shared lib so the single-lead lookup and the bulk
// Prospecting sweep use one implementation and can never drift (see worker/api/prospecting.js).
import { normDomain, dataforseoLookup, dfsBacklinks, dfsTech, dfsGmb, MARKETPLACES, TECH_BUCKETS } from "../_lib/dataforseo.js";
import { scoreProspect } from "../_lib/prospect-score.js";
import { reportAiOutcome } from "../_lib/ai-credits.js";

const APOLLO_COST = (env) => Number(env.APOLLO_COST_PER_LOOKUP || 0.03);
// Sonnet 5 + live web_search — same model/tool combo apollo-prospect.js's claudeFindOwner
// already proves works for this data (owner name/email off-site). Haiku with zero web access
// was the old approach here; it could only see 1-3 pre-fetched pages of the domain's own site,
// so anything not on those pages (owner name, socials, directories, agency credit) was a guess.
const CLAUDE_IN = 3 / 1e6, CLAUDE_OUT = 15 / 1e6, CLAUDE_MODEL = "claude-sonnet-5";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

async function ensure(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lookup_log (
    id TEXT PRIMARY KEY, contact_id TEXT, company_id TEXT, domain TEXT,
    cost_usd REAL, sources TEXT, actor TEXT, created_at TEXT)`).run().catch(() => {});
}

const rid = () => "lk_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---- free, server-side site parsing ----------------------------------------
export async function fetchSite(domain) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch("https://" + domain, { redirect: "follow", signal: ctl.signal, cf: { cacheTtl: 0 }, headers: { "user-agent": "Mozilla/5.0 (ConsentResolveIntel)" } });
    let html = await r.text();
    // Strip heavy inline CSS / SVG / comments BEFORE truncating. Modern sites (e.g. a 1MB
    // Tailwind dump) bury the footer — socials, schema, contact info — past the old 500KB cap,
    // so those never got detected. Scripts are KEPT (pixel/tag detection reads them).
    html = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").slice(0, 900000);
    return { ok: r.ok, status: r.status, url: r.url, html };
  } catch (e) { return { ok: false, status: 0, url: "", html: "", error: String(e).slice(0, 120) }; }
  finally { clearTimeout(t); }
}
const grab = (re, html) => { const m = html.match(re); return m ? m[1] : null; };
export function parseSite(domain, html) {
  const low = html.toLowerCase();
  const has = (re) => re.test(html);
  const capture = /<form[\s>][\s\S]{0,8000}?<(input|textarea)[\s>]/i.test(html);   // a form with any input = lead capture
  const chatVendor = (low.match(/crisp\.chat|intercom|drift\.com|tawk\.to|retellai|chatwoot|tidio|livechatinc|podium|gorgias/) || [null])[0];
  const pixels = [];
  if (/fbq\(|connect\.facebook\.net\/[^"']*fbevents/.test(html)) pixels.push("Meta Pixel");
  if (/gtag\(|googletagmanager\.com|google-analytics\.com/.test(html)) pixels.push("Google Analytics");
  if (/clarity\.ms/.test(low)) pixels.push("Microsoft Clarity");
  if (/hotjar/.test(low)) pixels.push("Hotjar");
  const techs = [];
  const gen = grab(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i, html);
  if (gen) techs.push(gen.split(" ")[0]);
  for (const [re, name] of [[/wp-content|wordpress/i, "WordPress"], [/wix\.com|_wixCssImports/i, "Wix"], [/squarespace/i, "Squarespace"], [/cdn\.shopify|myshopify/i, "Shopify"], [/webflow/i, "Webflow"], [/godaddy|websitebuilder/i, "GoDaddy"], [/hubspot/i, "HubSpot"], [/duda(one)?/i, "Duda"]])
    if (re.test(html) && !techs.includes(name)) techs.push(name);
  const soc = (host, re) => { const m = html.match(re); return m ? m[1].replace(/\/$/, "") : null; };
  const facebook = soc("f", /facebook\.com\/([A-Za-z0-9._-]{2,})/i);
  const instagram = soc("i", /instagram\.com\/([A-Za-z0-9._]{2,})/i);
  const linkedin = soc("l", /linkedin\.com\/(company\/[A-Za-z0-9-]+|in\/[A-Za-z0-9-]+)/i);
  const tiktok = soc("t", /tiktok\.com\/@([A-Za-z0-9._]{2,})/i);
  const phone = grab(/href=["']tel:([+0-9()\-.\s]{7,})["']/i, html) || grab(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/, html);
  const email = grab(/href=["']mailto:([^"'?>\s]+@[^"'?>\s]+)["']/i, html);
  // schema.org LocalBusiness rating
  const ratingValue = grab(/"ratingValue"\s*:\s*"?([0-9.]+)"?/i, html);
  const reviewCount = grab(/"reviewCount"\s*:\s*"?(\d+)"?/i, html) || grab(/"userRatingCount"\s*:\s*"?(\d+)"?/i, html);
  const gmb = ratingValue ? { rating: Number(ratingValue), reviews: reviewCount ? Number(reviewCount) : 0, verified: false } : null;
  const title = grab(/<title[^>]*>([^<]{2,140})<\/title>/i, html);
  const metaDesc = grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,300})["']/i, html);
  // free trade guess from visible text
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").toLowerCase();
  const TRADES = [["hvac", /hvac|air condition|furnace|heating & cooling|a\/c repair/], ["plumbing", /plumb|drain|water heater|repipe/], ["roofing", /roof/], ["windows & doors", /window|patio door|entry door|sliding door/], ["electrical", /electric/], ["landscaping/lawn", /lawn|landscap/], ["garage door", /garage door/], ["fencing", /\bfenc/], ["concrete/masonry", /concrete|masonry|paver|hardscap/], ["flooring", /flooring|hardwood floor|tile install/], ["remodeling", /remodel|renovation|kitchen & bath/], ["solar", /solar panel|solar install/], ["gutters", /gutter/], ["siding", /siding/], ["deck & patio", /\bdeck\b|patio cover|pergola/], ["pool service", /pool (service|cleaning|repair|resurfac)/], ["pest control", /pest control|exterminat/], ["cleaning", /house cleaning|maid|janitor/], ["painting", /painting|painter/], ["locksmith", /locksmith/], ["tree service", /tree service|tree removal|arborist/], ["general contractor", /general contractor|home improvement/], ["handyman", /handyman/], ["appliance repair", /appliance repair/], ["foundation", /foundation repair/]];
  let trade = null; for (const [name, re] of TRADES) if (re.test(text)) { trade = name; break; }
  return {
    enrich: { website: { domain, capture }, gmb, pixels, facebook: facebook ? { handle: facebook, ads_live: 0, followers: 0 } : null },
    directory: { linkedin: linkedin || null, instagram: instagram || null, tiktok: tiktok || null, phone, email, title, metaDesc },
    intel: { trade, tech: techs, chat: !!chatVendor, chat_vendor: chatVendor || null, brief: metaDesc || title || "" },
  };
}

// ---- fetch a few high-signal pages (home + contact/about) -------------------
// The old lookup read ONE page; a "tell me everything" answer needs the pages
// where humans actually put names, phones, hours, and service areas.
// Grouped by CATEGORY, not a flat list: "/contact" is a substring of "/contact-us", so a flat
// list + slice(0,2) let two variants of the SAME category (e.g. both contact paths matching a
// "/contact-us/" href) burn the whole page budget, starving the about-us fetch entirely — which
// is exactly where an owner's name/bio usually lives. One pick per category guarantees contact
// AND about both get a shot whenever the homepage links to both, regardless of which suffix style
// (bare vs "-us") the site happens to use.
const EXTRA_CATEGORIES = [["/contact-us", "/contact"], ["/about-us", "/about"], ["/our-team", "/team"]];
function pickExtraPaths(low) {
  const picked = [];
  for (const group of EXTRA_CATEGORIES) {
    const hit = group.find((p) => low.includes(p.replace(/^\//, "")));
    if (hit) picked.push(hit);
  }
  return picked;
}
async function fetchPages(domain) {
  const home = await fetchSite(domain);
  const pages = [{ path: "/", html: home.html }];
  if (home.ok && home.html) {
    // Only chase links the homepage actually references, so we don't burn time on 404s.
    const low = home.html.toLowerCase();
    const wanted = pickExtraPaths(low);
    for (const p of wanted) {
      const r = await fetchSite(domain + p).catch(() => null);
      if (r && r.ok && r.html) pages.push({ path: p, html: r.html });
    }
  }
  const toText = (html) => (html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const text = pages.map((p) => `[page ${p.path}]\n` + toText(p.html).slice(0, 7000)).join("\n\n");
  return { home, text };
}

// ---- gather recent INBOUND messages for this contact ------------------------
// #1: their email/chat/SMS often already contains a phone, company, or trade the
// record is missing. We feed those bodies to Claude so a lookup fills the blanks.
async function gatherInbound(env, contactId) {
  if (!contactId) return "";
  try {
    const rows = await env.DB.prepare(
      `SELECT m.direction, m.channel, m.body_text, m.sent_at
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE c.contact_id = ? AND m.direction = 'in' AND m.body_text IS NOT NULL
        ORDER BY COALESCE(m.sent_at, m.created_at) DESC LIMIT 12`
    ).bind(contactId).all().catch(() => ({ results: [] }));
    const txt = (rows.results || []).map((r) => `[${r.channel} in] ${String(r.body_text || "").replace(/\s+/g, " ").slice(0, 1200)}`).join("\n");
    return txt.slice(0, 8000);
  } catch (_) { return ""; }
}

// ---- rich Claude extraction -------------------------------------------------
// Reads the site pages + the lead's own inbound messages and returns a full,
// salesperson-ready profile: reachable people, phones, emails, trade, area,
// hours, license, and whether the site is run by a marketing agency (#3).
async function claudeEnrich(env, domain, siteText, inboundText) {
  if (!env.ANTHROPIC_API_KEY) return { used: false, cost: 0 };
  const prompt = `You are a B2B sales researcher enriching a home-service contractor lead for "${domain}". Start from the WEBSITE PAGES and the lead's own INBOUND MESSAGES below — they're already fetched and free. Use the web_search tool for anything NOT covered there: the owner/decision-maker's name, socials, directory listings (Yelp/BBB/Nextdoor), reviews/rating count, or who built/runs the site. Search the way a human researcher would — the business's own About/Contact/Team page, Google, LinkedIn, Facebook, BBB, and public registries. Extract everything a salesperson could act on. Prefer facts stated in the messages over guesses, and never invent or guess a name/email/phone you didn't actually find on a real page — cite nothing you can't verify. If a field is unknown after searching, use null (or [] for lists). Do NOT invent data.

Do any web searching FIRST, silently. Once you're done researching, your final reply must be STRICT JSON only — no prose, no markdown fences, nothing before or after it:
{
  "company_name": "<official business name or null>",
  "trade": "<primary trade, e.g. HVAC, roofing, plumbing, or null>",
  "services": ["specific services offered"],
  "service_area": "<cities/counties/region served or null>",
  "owner_name": "<owner/principal full name or null>",
  "contacts": [{"name":"<person>","role":"<title/role>","email":"<email or null>","phone":"<phone or null>"}],
  "phones": ["all distinct phone numbers found"],
  "emails": ["all distinct email addresses found"],
  "hours": "<business hours or null>",
  "license_number": "<contractor license # or null>",
  "years_in_business": <integer or null>,
  "socials": {"facebook":null,"instagram":null,"linkedin":null,"tiktok":null,"youtube":null},
  "runs_ads": <true|false|null>,
  "agency_managed": <true|false|null>,
  "agency_name": "<marketing/web agency that built or runs the site, if any credit/footer/tech reveals one, else null>",
  "brief": "<2-3 sentence sales-useful summary: what they do, size/vibe, and the best angle to reach them>",
  "website_grade": {"overall":"<letter A+..F for lead-capture effectiveness>","usability":"<letter>","cta":"<letter>","seo":"<letter>","content":"<letter>","notes":"<1-2 sentences on the biggest lead-capture weaknesses you can see: form placement/field count, missing sticky call button, stale/undated content, thin service pages>"},
  "why_hot": ["<3-6 short, qualitative reasons this contractor is a strong Consent Resolve fit, drawn from the SITE — e.g. 'CTA buried below the fold', 'community-first brand', 'busy crews (recent reviews)'. No fabricated numbers.>"],
  "talking_points": ["<4-7 specific, sales-ready points a rep can open with, each referencing a REAL fact from the site or messages>"],
  "email_angles": [{"label":"<short angle name>","body":"<1-2 sentence cold-email opener, personalized to THIS business, in a plain, human voice>"}],
  "objections": [{"objection":"<a likely objection in the owner's words>","response":"<concise, honest rebuttal in Consent Resolve's voice>"}],
  "owner_story": "<2-4 sentence rapport paragraph about the owner/company from the site — origin story, values, community ties, brand voice — for building genuine rapport. null if nothing found. Mark anything uncertain; do not invent.>",
  "owner_hooks": ["<short conversational hooks: sponsorships, origin story, shop mascot, sports team, faith/family, years in business — for rapport>"],
  "google_screened": <true|false|null>,
  "directories": {"yelp":"<Yelp profile URL if linked, else null>","nextdoor":"<Nextdoor URL if linked, else null>","bbb":"<BBB URL if linked, else null>","youtube":"<YouTube channel URL if linked, else null>"},
  "site_health": {"ssl": <true|false|null>, "mobile_ready": <true|false|null>, "blog_last_updated": "<the most recent visible blog/news post date, or null>"}
}

Only report google_screened=true if you actually see a "Google Screened" or "Google Guaranteed" badge. For directories, only include a URL you can see linked on the site. For site_health, ssl=true if the pages loaded over https, mobile_ready from a responsive/viewport meta, blog_last_updated only if a real date is visible.

CONSENT RESOLVE CONTEXT (keep talking_points/email_angles/objections accurate to this — do not overstate): We identify a contractor's OWN anonymous website visitors WITH their consent and hand back the name + email as an EXCLUSIVE lead at a flat $7 each, never resold. Consent-first (visitors opt in), it sits on top of their existing ads/funnel and installs in ~10 minutes. Honest math: ~75% of visitors consent, ~22-25% of those resolve, so ~16-19% of total visitors become identifiable leads. NEVER promise a close rate, ROI, or a specific dollar outcome. The core wedge: recover the ~97% of paid traffic that leaves the site unidentified.

WEBSITE PAGES:
${(siteText || "").slice(0, 14000)}

INBOUND MESSAGES FROM THIS LEAD:
${(inboundText || "(none)").slice(0, 8000)}`;
  const timeout = AbortSignal.timeout(45000); // web_search rounds take longer than a plain completion
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
        messages: [{ role: "user", content: prompt }],
      }),
      signal: timeout,
    });
    const j = await r.json();
    const usage = j.usage || {};
    const cost = (usage.input_tokens || 0) * CLAUDE_IN + (usage.output_tokens || 0) * CLAUDE_OUT;
    // With web_search enabled the response interleaves server_tool_use / web_search_tool_result
    // blocks before the final text block, so the answer is no longer reliably content[0]. Collect
    // every text block, then extract the JSON object out of it rather than assuming the whole
    // string is clean JSON — the model sometimes narrates its search before the object.
    const text = ((j.content || []).filter((b) => b && b.type === "text").map((b) => b.text || "").join("\n")).trim();
    let data = {};
    try { data = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); } catch (_) {
      // Fallback: scan for the largest brace-balanced {...} blob in the text (same technique
      // apollo-prospect.js's claudeFindOwner uses) rather than silently returning {}.
      let best = null;
      for (let i = 0; i < text.length; i++) {
        if (text[i] !== "{") continue;
        let depth = 0;
        for (let k = i; k < text.length; k++) {
          if (text[k] === "{") depth++;
          else if (text[k] === "}") { depth--; if (depth === 0) { const cand = text.slice(i, k + 1); if (!best || cand.length > best.length) best = cand; break; } }
        }
      }
      if (best) { try { data = JSON.parse(best); } catch (_) {} }
    }
    const errMsg = r.ok ? null : ((j.error && j.error.message) || `HTTP ${r.status}`);
    await reportAiOutcome(env, { ok: r.ok, error: errMsg, source: "crm-lookup.claudeEnrich" });
    return { used: true, cost, data, error: errMsg };
  } catch (e) { return { used: false, cost: 0, error: String(e).slice(0, 120) }; }
}

// ---- conservative writeback: fill BLANKS on the record, never overwrite ------
// Returns a list of the fields we actually changed (for the activity log + UI toast).
function firstPhone(list) { for (const p of (list || [])) { const d = String(p || "").replace(/[^\d]/g, ""); if (d.length >= 10) return String(p).trim(); } return null; }
async function writeBackRecord(env, { contact, company, data }) {
  const changed = [];
  if (!data) return changed;
  // Phone → contact_identifiers (only if the contact has none on file).
  const phone = firstPhone(data.phones) || (data.contacts || []).map((c) => c && c.phone).filter(Boolean).map(firstPhone).find(Boolean);
  if (phone && contact) {
    const has = await env.DB.prepare("SELECT id FROM contact_identifiers WHERE contact_id=? AND type='phone' LIMIT 1").bind(contact.id).first().catch(() => null);
    if (!has) {
      await env.DB.prepare("INSERT OR IGNORE INTO contact_identifiers (id, contact_id, type, value, verified) VALUES (?,?,?,?,0)")
        .bind(rid(), contact.id, "phone", phone).run().catch(() => {});
      await env.DB.prepare("UPDATE contacts SET phone=COALESCE(NULLIF(phone,''),?), updated_at=datetime('now') WHERE id=?").bind(phone, contact.id).run().catch(() => {});
      changed.push("phone");
    }
  }
  // Email → set primary_email if missing (never overwrite an existing one).
  const email = (data.emails || []).find((e) => /@/.test(String(e || "")));
  if (email && contact && !contact.primary_email) {
    await env.DB.prepare("UPDATE contacts SET primary_email=?, updated_at=datetime('now') WHERE id=?").bind(String(email).toLowerCase(), contact.id).run().catch(() => {});
    changed.push("email");
  }
  // Contact name → set full_name if missing (prefer an explicit owner).
  const name = data.owner_name || ((data.contacts || [])[0] || {}).name;
  if (name && contact && (!contact.full_name || contact.full_name === contact.primary_email)) {
    await env.DB.prepare("UPDATE contacts SET full_name=?, updated_at=datetime('now') WHERE id=?").bind(String(name).slice(0, 120), contact.id).run().catch(() => {});
    changed.push("name");
  }
  // Company name → replace a domain-placeholder name with the real business name.
  if (data.company_name && company) {
    const looksPlaceholder = !company.name || company.name === company.domain || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(company.name);
    if (looksPlaceholder) { await env.DB.prepare("UPDATE companies SET name=?, updated_at=datetime('now') WHERE id=?").bind(String(data.company_name).slice(0, 160), company.id).run().catch(() => {}); changed.push("company"); }
  }
  return changed;
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  const b = await request.json().catch(() => ({}));
  const me = await currentUser(request, env).catch(() => null);
  const res = await enrichLead(env, { contactId: b.contact_id, website: b.website, mode: b.mode, actorId: me ? me.id : null, force: !!b.force });
  return json(res, res.ok ? {} : { status: res.status || 400 }, cors);
}

// Core enrichment — shared by the HTTP endpoint, the auto-enrich cron drip, and inbound
// ingest. Fetches the live site + Claude synthesis (free) and/or DataForSEO (paid), writes
// back to the record, caches on the company, and returns the dossier payload. Deliberately
// free of request/cors coupling so cron and ingest can call it directly.
export async function enrichLead(env, { contactId, website, mode, actorId, force } = {}) {
  await ensureCrmV2Schema(env);
  await ensure(env);
  const b = { contact_id: contactId, website, mode };
  if (!b.contact_id && !normDomain(b.website)) return { ok: false, status: 400, error: "need_website", message: "No contact or website to look up." };

  const ct = b.contact_id ? await env.DB.prepare("SELECT id, full_name, primary_email, company_id FROM contacts WHERE id=?").bind(b.contact_id).first().catch(() => null) : null;
  let co = ct && ct.company_id ? await env.DB.prepare("SELECT id, domain, enrichment FROM companies WHERE id=?").bind(ct.company_id).first().catch(() => null) : null;
  // Resolve the website: explicit param > saved company domain > business-email domain.
  let domain = normDomain(b.website) || normDomain(co && co.domain);
  if (!domain && ct && ct.primary_email && !/gmail|yahoo|hotmail|outlook|aol|icloud/.test(ct.primary_email)) domain = normDomain(ct.primary_email.split("@")[1]);
  if (!domain) return { ok: false, status: 400, error: "need_website", message: "No website on file — pass one to look up." };

  // A lookup must PERSIST. If the contact has no company yet, create one from the domain and link
  // it — otherwise there's nowhere to cache the enrichment and it vanishes on refresh.
  if (ct && !co) {
    const companyId = await findOrCreateCompany(env, { name: ct.full_name || domain, domain }).catch(() => null);
    if (companyId) {
      await env.DB.prepare("UPDATE contacts SET company_id=?, updated_at=datetime('now') WHERE id=?").bind(companyId, ct.id).run().catch(() => {});
      co = await env.DB.prepare("SELECT id, domain, enrichment FROM companies WHERE id=?").bind(companyId).first().catch(() => null);
    }
  }
  // Persist the domain so we always "have somewhere to look".
  if (co && !normDomain(co.domain)) await env.DB.prepare("UPDATE companies SET domain=?, updated_at=datetime('now') WHERE id=?").bind(domain, co.id).run().catch(() => {});

  mode = mode || "all"; // 'claude' (free: site parse + Claude) | 'dataforseo' (paid) | 'all'

  // Start from cached enrichment so each button AUGMENTS the other's data instead of wiping it.
  let prev = {}; try { prev = co && co.enrichment ? JSON.parse(co.enrichment) : {}; } catch (_) {}
  const { _directory: pDir, _intel: pInt, _looked_up_at: _plu, _last_cost: _plc, ...pEnr } = prev;
  const parsed = { enrich: { ...pEnr, website: { ...(pEnr.website || {}), domain } }, directory: { ...(pDir || {}) }, intel: { ...(pInt || {}) } };
  const breakdown = [];

  // Fresh-cache shortcut — if this company was fully enriched (synthesis + ICP) within 30 days,
  // return the cache instead of re-paying DataForSEO/Claude. Skipped when force is set. Keeps the
  // auto-run on Intel-open, the batch dossier modal, and the drip from re-billing fresh leads.
  {
    const luTs = Date.parse(prev._looked_up_at || "") || 0;
    const fresh = luTs && (Date.now() - luTs) < 30 * 86400000;
    if (!force && fresh && prev._signals && prev._signals.icp && pInt && pInt.synthesis) {
      return { ok: true, cached: true, domain, mode, cost_usd: 0,
        breakdown: [{ source: "cache", cost: 0, ok: true, note: "fresh (<30d) — reused, no re-spend" }],
        enrich: parsed.enrich, directory: parsed.directory, intel: parsed.intel, signals: prev._signals,
        writeback: [], claude_on: !!env.ANTHROPIC_API_KEY, dataforseo_on: !!(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD) };
    }
  }

  // ── Claude / free: fetch site pages + read inbound messages, extract a full profile, write back ──
  let writeback = [];
  if (mode === "claude" || mode === "all") {
    const { home, text } = await fetchPages(domain);
    if (home.ok && home.html) {
      const p = parseSite(domain, home.html);
      Object.assign(parsed.enrich, p.enrich);
      Object.assign(parsed.directory, p.directory);
      Object.assign(parsed.intel, p.intel);
    }
    breakdown.push({ source: "Website parse", cost: 0, ok: home.ok, note: home.ok ? null : "site fetch failed (" + (home.status || home.error || "?") + ")" });
    const inbound = await gatherInbound(env, b.contact_id);
    const cl = await claudeEnrich(env, domain, text, inbound);
    if (cl.used && cl.data) {
      const d = cl.data;
      breakdown.push({ source: "Claude research", cost: cl.cost, ok: !cl.error, note: inbound ? "read site + inbound messages" : "read site" });
      if (d.trade) parsed.intel.trade = d.trade;
      if (d.brief) parsed.intel.brief = d.brief;
      if (Array.isArray(d.services)) parsed.intel.services = d.services.slice(0, 12);
      if (typeof d.runs_ads === "boolean") parsed.intel.runs_ads = d.runs_ads;
      if (d.service_area) parsed.intel.service_area = d.service_area;
      if (d.hours) parsed.intel.hours = d.hours;
      if (d.license_number) parsed.intel.license = d.license_number;
      if (d.owner_name) parsed.directory.owner = d.owner_name;
      if (Array.isArray(d.contacts) && d.contacts.length) parsed.directory.contacts = d.contacts.filter((c) => c && (c.name || c.email || c.phone)).slice(0, 8);
      if (Array.isArray(d.emails) && d.emails.length) parsed.directory.emails = [...new Set(d.emails.filter((e) => /@/.test(String(e))))].slice(0, 8);
      if (Array.isArray(d.phones) && d.phones.length) parsed.directory.phones = [...new Set(d.phones.map((p) => String(p).trim()).filter(Boolean))].slice(0, 8);
      if (!parsed.directory.phone && parsed.directory.phones && parsed.directory.phones.length) parsed.directory.phone = parsed.directory.phones[0];
      if (d.company_name) parsed.enrich.company_name = d.company_name;
      if (d.years_in_business != null && !parsed.enrich.years) parsed.enrich.years = d.years_in_business;
      if (d.socials && typeof d.socials === "object") for (const k of ["facebook", "instagram", "linkedin", "tiktok", "youtube"]) if (d.socials[k] && !parsed.directory[k]) parsed.directory[k] = d.socials[k];
      // #3 agency detection — cached so the Agency tab can read/flag it.
      if (d.agency_managed != null || d.agency_name) parsed.intel.agency = { managed: !!d.agency_managed, name: d.agency_name || null, detected_at: new Date().toISOString() };
      // Additional site-observable data points.
      if (typeof d.google_screened === "boolean") parsed.intel.google_screened = d.google_screened;
      if (d.directories && typeof d.directories === "object") parsed.intel.directories = Object.assign({}, parsed.intel.directories || {}, d.directories);
      if (d.site_health && typeof d.site_health === "object") parsed.intel.site_health = Object.assign({}, parsed.intel.site_health || {}, d.site_health);
      (parsed.intel.freshness = parsed.intel.freshness || {}).claude = new Date().toISOString();
      // Dossier synthesis — the salesperson-facing narrative fields (website grade, talking
      // points, email angles, objections, owner rapport). Kept under intel.synthesis so the
      // Intel tab renders them and re-running the paid lookup never wipes them.
      const syn = {};
      if (d.website_grade && typeof d.website_grade === "object") syn.website_grade = d.website_grade;
      if (Array.isArray(d.why_hot) && d.why_hot.length) syn.why_hot = d.why_hot.slice(0, 8);
      if (Array.isArray(d.talking_points) && d.talking_points.length) syn.talking_points = d.talking_points.slice(0, 8);
      if (Array.isArray(d.email_angles) && d.email_angles.length) syn.email_angles = d.email_angles.filter((a) => a && (a.body || a.label)).slice(0, 6);
      if (Array.isArray(d.objections) && d.objections.length) syn.objections = d.objections.filter((o) => o && (o.objection || o.response)).slice(0, 6);
      if (d.owner_story) syn.owner_story = String(d.owner_story).slice(0, 900);
      if (Array.isArray(d.owner_hooks) && d.owner_hooks.length) syn.owner_hooks = d.owner_hooks.slice(0, 8);
      if (Object.keys(syn).length) { syn.synthesized_at = new Date().toISOString(); parsed.intel.synthesis = { ...(parsed.intel.synthesis || {}), ...syn }; }
      // #1 writeback — fill blanks on the actual record (phone, email, name, company).
      writeback = await writeBackRecord(env, { contact: ct, company: co, data: d }).catch(() => []);
    } else {
      breakdown.push({ source: "Claude research", cost: 0, ok: false, note: env.ANTHROPIC_API_KEY ? (cl.error || "no result") : "ANTHROPIC_API_KEY not set — using page parse only" });
    }
    if (env.APOLLO_API_KEY && ct && ct.primary_email) {
      const ar = await enrichContactById(env, b.contact_id, { actorId: actorId || await adminUserId(env) }).catch(() => ({}));
      const org = ar && (ar.org || (ar.person && ar.person.organization));
      if (org) {
        parsed.enrich.employees = org.estimated_num_employees || parsed.enrich.employees;
        if (org.founded_year) parsed.enrich.years = Math.max(0, new Date().getFullYear() - org.founded_year);
        breakdown.push({ source: "Apollo firmographics", cost: APOLLO_COST(env), ok: true });
      }
    }
  }

  // ── DataForSEO / paid: monthly traffic + estimated ad spend ──
  if (mode === "dataforseo" || mode === "all") {
    if (env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD) {
      const dfs = await dataforseoLookup(env, domain);
      if (dfs.used && !dfs.error) {
        breakdown.push({ source: "DataForSEO (traffic + ad spend)", cost: dfs.cost, ok: true });
        const dd = dfs.data || {};
        if (dd.traffic_month != null) parsed.enrich.traffic_month = dd.traffic_month;
        if (dd.organic_traffic != null) parsed.enrich.organic_traffic = dd.organic_traffic;
        if (dd.paid_traffic != null) parsed.enrich.paid_traffic = dd.paid_traffic;
        if (dd.ad_spend != null && dd.ad_spend > 0) { parsed.enrich.spend_low = Math.round(dd.ad_spend * 0.8); parsed.enrich.spend_high = Math.round(dd.ad_spend * 1.2); parsed.enrich.spend_channels = ["Google Ads"]; }
        if (dd.paid_keywords != null) { parsed.enrich.ads = { ...(parsed.enrich.ads || {}), google: dd.paid_keywords > 0 }; parsed.enrich.running_ads = dd.paid_keywords > 0; }
        if (dd.organic_keywords != null) parsed.enrich.organic_keywords = dd.organic_keywords;
        (parsed.intel.freshness = parsed.intel.freshness || {}).traffic = new Date().toISOString();
      } else {
        breakdown.push({ source: "DataForSEO", cost: dfs.cost || 0, ok: false, note: dfs.error || "no data returned for this domain" });
      }
      // #1 highest-intent signal: lead-marketplace backlinks = already buying shared leads. Also
      // returns Domain Authority (rank / referring domains / spam score) in the same step.
      const bl = await dfsBacklinks(env, domain);
      if (bl.used) {
        breakdown.push({ source: "DataForSEO backlinks + authority", cost: bl.cost, ok: true });
        parsed.enrich.marketplaces = bl.marketplaces; parsed.enrich.pays_per_lead = bl.marketplaces.length > 0;
        if (bl.authority) parsed.enrich.authority = bl.authority;
        (parsed.intel.freshness = parsed.intel.freshness || {}).backlinks = new Date().toISOString();
      } else breakdown.push({ source: "DataForSEO backlinks", cost: bl.cost || 0, ok: false, note: bl.error });
      // Marketing-maturity tech stack (call tracking, pixels, field CRM, competitor identity pixels).
      const tk = await dfsTech(env, domain);
      if (tk.used) { breakdown.push({ source: "DataForSEO technologies", cost: tk.cost, ok: true }); parsed.intel.tech_hits = tk.hits; if (tk.all && tk.all.length) parsed.intel.tech = [...new Set([...(parsed.intel.tech || []), ...tk.all])].slice(0, 30); (parsed.intel.freshness = parsed.intel.freshness || {}).tech = new Date().toISOString(); }
      else breakdown.push({ source: "DataForSEO technologies", cost: tk.cost || 0, ok: false, note: tk.error });
      // REAL Google Business Profile — authoritative rating / reviews / photos / claimed, keyed by
      // business name (GMB isn't keyed by domain). Overrides the weak schema-scrape gmb. Skipped
      // with no name; may return null for ambiguous franchise/corporate domains (many locations).
      const bizName = parsed.enrich.company_name || (ct && ct.full_name) || (co && co.name) || null;
      if (bizName && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(bizName)) {
        const addr = String(parsed.directory.address || parsed.intel.service_area || "");
        const cm = addr.match(/,\s*([A-Za-z .'-]{2,}),\s*[A-Z]{2}\b/);
        const gb = await dfsGmb(env, { name: bizName, city: cm ? cm[1].trim() : null });
        if (gb.used) { breakdown.push({ source: "DataForSEO Google Business", cost: gb.cost, ok: !!gb.gmb, note: gb.gmb ? null : "no GMB match for name" }); if (gb.gmb) { parsed.enrich.gmb = { ...(parsed.enrich.gmb || {}), ...gb.gmb }; (parsed.intel.freshness = parsed.intel.freshness || {}).gmb = new Date().toISOString(); } }
        else breakdown.push({ source: "DataForSEO Google Business", cost: gb.cost || 0, ok: false, note: gb.error });
      }
    } else {
      breakdown.push({ source: "DataForSEO", cost: 0, ok: false, note: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set" });
    }
  }

  const cost_usd = Math.round(breakdown.reduce((a, x) => a + (x.cost || 0), 0) * 10000) / 10000;

  // The most-important intel, distilled for the dashboard header.
  const en = parsed.enrich, di = parsed.directory, it = parsed.intel;
  const th = it.tech_hits || {};
  const signals = {
    // #1 — already paying per lead (the money signal)
    pays_per_lead: en.pays_per_lead != null ? en.pays_per_lead : null,
    marketplaces: en.marketplaces || [],
    running_ads: en.running_ads != null ? en.running_ads : (en.ads && en.ads.google != null ? en.ads.google : null),
    call_tracking: th.call_tracking || null,
    field_crm: th.field_crm || null,
    competitor_id: th.competitor_id || null,
    // fit / leak signals
    trade: it.trade || null,
    has_form: en.website && typeof en.website.capture === "boolean" ? en.website.capture : null,
    chat: it.chat != null ? !!it.chat : null,
    phone: di.phone || null,
    tech: it.tech || [],
    pixels: en.pixels || [],
    traffic_month: en.traffic_month != null ? en.traffic_month : null,
    organic_traffic: en.organic_traffic != null ? en.organic_traffic : null,
    paid_traffic: en.paid_traffic != null ? en.paid_traffic : null,
    ad_spend_low: en.spend_low != null ? en.spend_low : null,
    ad_spend_high: en.spend_high != null ? en.spend_high : null,
    authority: en.authority || null,
    rating: en.gmb ? en.gmb.rating : null,
    reviews: en.gmb ? en.gmb.reviews : null,
    google_screened: it.google_screened != null ? it.google_screened : null,
    directories: it.directories || null,
    site_health: it.site_health || null,
    freshness: it.freshness || null,
    brief: it.brief || null,
    // reachable people + the richer profile from the Claude research pass
    contacts: di.contacts || [],
    emails: di.emails || [],
    phones: di.phones || [],
    owner: di.owner || null,
    company_name: en.company_name || null,
    service_area: it.service_area || null,
    hours: it.hours || null,
    license: it.license || null,
    agency: it.agency || null,
  };

  // ICP fit — reuse the SAME scorer the Prospecting sweep uses, so the dossier's score and the
  // Batch Triage list can never disagree. Maps our signal names onto scoreProspect's shape.
  const _icp = scoreProspect({
    marketplaces: signals.marketplaces,
    competitor_id: signals.competitor_id,
    running_ads: signals.running_ads,
    ad_spend: (signals.ad_spend_low != null && signals.ad_spend_high != null) ? Math.round((signals.ad_spend_low + signals.ad_spend_high) / 2) : null,
    call_tracking: signals.call_tracking,
    field_crm: signals.field_crm,
    ad_pixels: (signals.pixels && signals.pixels.length) ? "pixel" : null,
    has_form: signals.has_form,
    traffic_month: signals.traffic_month,
    rating: signals.rating,
    reviews: signals.reviews,
    has_site: true,
  });
  signals.icp = { score: _icp.score, tier: _icp.tier, reasons: _icp.reasons };

  // Cache the merged enrichment on the company (parsed already includes prev).
  if (co) {
    const merged = { ...parsed.enrich, _directory: parsed.directory, _intel: parsed.intel, _looked_up_at: new Date().toISOString(), _last_cost: cost_usd, _signals: signals };
    await env.DB.prepare("UPDATE companies SET enrichment=?, updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(merged), co.id).run().catch(() => {});
  }

  const actor = actorId || (await adminUserId(env).catch(() => null));
  await env.DB.prepare("INSERT INTO lookup_log (id, contact_id, company_id, domain, cost_usd, sources, actor, created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))")
    .bind(rid(), b.contact_id, co ? co.id : null, domain, cost_usd, JSON.stringify(breakdown.map((x) => x.source)), actor || null).run().catch(() => {});
  if (b.contact_id) await addActivityV2(env, { actorId: actor || null, entityType: "contact", entityId: b.contact_id, action: "intel_lookup", meta: { domain, cost_usd, mode, updated: writeback } }).catch(() => {});

  return { ok: true, domain, mode, cost_usd, breakdown, enrich: parsed.enrich, directory: parsed.directory, intel: parsed.intel, signals, writeback, claude_on: !!env.ANTHROPIC_API_KEY, dataforseo_on: !!(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD) };
}

// Auto-enrich drip — brings every lead "up to date" without a manual button. Picks companies
// that have a domain but whose enrichment is MISSING, in the OLD pre-synthesis format, or stale
// (>30d), and runs BOTH lookups (mode:'all') for up to `limit` per call. Bounded so it respects
// the Worker subrequest/time budget on the cron; successive ticks work through the whole book.
export async function enrichDueLeads(env, { limit = 8 } = {}) {
  const claudeOn = !!env.ANTHROPIC_API_KEY, dfsOn = !!(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD);
  if (!claudeOn && !dfsOn) return { skipped: "no_enrich_keys" };
  await ensureCrmV2Schema(env);
  const staleBefore = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = await env.DB.prepare(
    `SELECT c.id AS contact_id, co.domain AS domain
       FROM companies co
       JOIN contacts c ON c.company_id = co.id
      WHERE co.domain IS NOT NULL AND co.domain != ''
        AND ( co.enrichment IS NULL
              OR co.enrichment NOT LIKE '%"synthesis"%'
              OR COALESCE(json_extract(co.enrichment, '$._looked_up_at'), '') < ? )
      GROUP BY co.id
      ORDER BY COALESCE(json_extract(co.enrichment, '$._looked_up_at'), '') ASC
      LIMIT ?`
  ).bind(staleBefore, limit).all().catch(() => ({ results: [] }));
  let enriched = 0, cost = 0;
  for (const r of (rows.results || [])) {
    try {
      const res = await enrichLead(env, { contactId: r.contact_id, website: r.domain, mode: "all" });
      if (res && res.ok) { enriched++; cost += res.cost_usd || 0; }
    } catch (_) { /* one bad domain never stalls the drip */ }
  }
  return { enriched, cost_usd: Math.round(cost * 10000) / 10000, scanned: (rows.results || []).length };
}
