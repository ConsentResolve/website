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
import { ensureCrmV2Schema, currentUser, adminUserId, addActivityV2 } from "../_lib/crm-v2.js";
import { enrichContactById } from "../_lib/apollo.js";

const APOLLO_COST = (env) => Number(env.APOLLO_COST_PER_LOOKUP || 0.03);
// Claude Haiku pricing (USD per token) — cheap extraction model.
const CLAUDE_IN = 1 / 1e6, CLAUDE_OUT = 5 / 1e6, CLAUDE_MODEL = "claude-haiku-4-5-20251001";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

async function ensure(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lookup_log (
    id TEXT PRIMARY KEY, contact_id TEXT, company_id TEXT, domain TEXT,
    cost_usd REAL, sources TEXT, actor TEXT, created_at TEXT)`).run().catch(() => {});
}

function normDomain(s) {
  let d = String(s || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "").trim();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : "";
}
const rid = () => "lk_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---- free, server-side site parsing ----------------------------------------
async function fetchSite(domain) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch("https://" + domain, { redirect: "follow", signal: ctl.signal, cf: { cacheTtl: 0 }, headers: { "user-agent": "Mozilla/5.0 (ConsentResolveIntel)" } });
    const html = (await r.text()).slice(0, 500000);
    return { ok: r.ok, status: r.status, url: r.url, html };
  } catch (e) { return { ok: false, status: 0, url: "", html: "", error: String(e).slice(0, 120) }; }
  finally { clearTimeout(t); }
}
const grab = (re, html) => { const m = html.match(re); return m ? m[1] : null; };
function parseSite(domain, html) {
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

// ---- optional Claude summary ------------------------------------------------
async function claudeSummary(env, domain, text) {
  if (!env.ANTHROPIC_API_KEY) return { used: false, cost: 0 };
  const prompt = `You are enriching a home-service contractor lead. From this website text for ${domain}, return STRICT JSON:
{"trade": "<primary trade or null>", "services": ["..."], "runs_ads": <true|false|null>, "brief": "<one crisp sentence a salesperson would find useful>"}
Only the JSON. Text:\n${text.slice(0, 6000)}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    const usage = j.usage || {};
    const cost = (usage.input_tokens || 0) * CLAUDE_IN + (usage.output_tokens || 0) * CLAUDE_OUT;
    let data = {};
    try { data = JSON.parse((j.content && j.content[0] && j.content[0].text || "{}").replace(/^```json\s*|\s*```$/g, "")); } catch (_) {}
    return { used: true, cost, data };
  } catch (e) { return { used: false, cost: 0, error: String(e).slice(0, 120) }; }
}

// ---- DataForSEO: the stuff we can't parse (monthly traffic + ad spend) ------
// Uses DataForSEO Labs "Domain Rank Overview". Auth = Basic base64(login:password); the API
// returns the exact dollar `cost` of the request, which we surface as the lookup cost.
async function dataforseoLookup(env, domain) {
  const login = env.DATAFORSEO_LOGIN, pass = env.DATAFORSEO_PASSWORD;
  if (!login || !pass) return { used: false, cost: 0 };
  try {
    const r = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live", {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(login + ":" + pass), "Content-Type": "application/json" },
      body: JSON.stringify([{ target: domain, location_code: 2840, language_code: "en" }]),
    });
    const j = await r.json();
    const cost = Number(j.cost || 0);
    const item = j.tasks && j.tasks[0] && j.tasks[0].result && j.tasks[0].result[0] && j.tasks[0].result[0].items && j.tasks[0].result[0].items[0];
    const m = (item && item.metrics) || {};
    const org = m.organic || {}, paid = m.paid || {};
    return { used: true, cost, data: {
      traffic_month: org.etv != null ? Math.round(org.etv) : null,           // estimated monthly organic visits
      ad_spend: paid.estimated_paid_traffic_cost != null ? Math.round(paid.estimated_paid_traffic_cost) : null,
      organic_keywords: org.count != null ? org.count : null,
      paid_keywords: paid.count != null ? paid.count : null,
    } };
  } catch (e) { return { used: false, cost: 0, error: String(e).slice(0, 120) }; }
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  await ensureCrmV2Schema(env);
  await ensure(env);
  const b = await request.json().catch(() => ({}));
  if (!b.contact_id) return json({ ok: false, error: "contact_id_required" }, { status: 400 }, cors);

  const ct = await env.DB.prepare("SELECT id, primary_email, company_id FROM contacts WHERE id=?").bind(b.contact_id).first().catch(() => null);
  const co = ct && ct.company_id ? await env.DB.prepare("SELECT id, domain, enrichment FROM companies WHERE id=?").bind(ct.company_id).first().catch(() => null) : null;
  // Resolve the website: explicit param > saved company domain > business-email domain.
  let domain = normDomain(b.website) || normDomain(co && co.domain);
  if (!domain && ct && ct.primary_email && !/gmail|yahoo|hotmail|outlook|aol|icloud/.test(ct.primary_email)) domain = normDomain(ct.primary_email.split("@")[1]);
  if (!domain) return json({ ok: false, error: "need_website", message: "No website on file — pass one to look up." }, {}, cors);

  // Persist the domain so we always "have somewhere to look".
  if (co && !normDomain(co.domain)) await env.DB.prepare("UPDATE companies SET domain=?, updated_at=datetime('now') WHERE id=?").bind(domain, co.id).run().catch(() => {});

  const mode = b.mode || "all"; // 'claude' (free: site parse + Claude) | 'dataforseo' (paid) | 'all'

  // Start from cached enrichment so each button AUGMENTS the other's data instead of wiping it.
  let prev = {}; try { prev = co && co.enrichment ? JSON.parse(co.enrichment) : {}; } catch (_) {}
  const { _directory: pDir, _intel: pInt, _looked_up_at: _plu, _last_cost: _plc, ...pEnr } = prev;
  const parsed = { enrich: { ...pEnr, website: { ...(pEnr.website || {}), domain } }, directory: { ...(pDir || {}) }, intel: { ...(pInt || {}) } };
  const breakdown = [];

  // ── Claude / free: fetch the live site, parse it, and (if keyed) summarize with Claude ──
  if (mode === "claude" || mode === "all") {
    const site = await fetchSite(domain);
    if (site.ok && site.html) {
      const p = parseSite(domain, site.html);
      Object.assign(parsed.enrich, p.enrich);
      Object.assign(parsed.directory, p.directory);
      Object.assign(parsed.intel, p.intel);
    }
    breakdown.push({ source: "Website parse", cost: 0, ok: site.ok, note: site.ok ? null : "site fetch failed (" + (site.status || site.error || "?") + ")" });
    const text = (site.html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const cl = await claudeSummary(env, domain, text);
    if (cl.used && cl.data) {
      breakdown.push({ source: "Claude summary", cost: cl.cost, ok: !cl.error });
      if (cl.data.trade) parsed.intel.trade = cl.data.trade;
      if (cl.data.brief) parsed.intel.brief = cl.data.brief;
      if (Array.isArray(cl.data.services)) parsed.intel.services = cl.data.services.slice(0, 8);
      if (typeof cl.data.runs_ads === "boolean") parsed.intel.runs_ads = cl.data.runs_ads;
    } else {
      breakdown.push({ source: "Claude summary", cost: 0, ok: false, note: env.ANTHROPIC_API_KEY ? (cl.error || "no result") : "ANTHROPIC_API_KEY not set — using page parse only" });
    }
    if (env.APOLLO_API_KEY && ct && ct.primary_email) {
      const me0 = await currentUser(request, env).catch(() => null);
      const ar = await enrichContactById(env, b.contact_id, { actorId: me0 ? me0.id : await adminUserId(env) }).catch(() => ({}));
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
        if (dd.ad_spend != null && dd.ad_spend > 0) { parsed.enrich.spend_low = Math.round(dd.ad_spend * 0.8); parsed.enrich.spend_high = Math.round(dd.ad_spend * 1.2); parsed.enrich.spend_channels = ["Google Ads"]; }
        if (dd.paid_keywords != null) parsed.enrich.ads = { ...(parsed.enrich.ads || {}), google: dd.paid_keywords > 0 };
        if (dd.organic_keywords != null) parsed.enrich.organic_keywords = dd.organic_keywords;
      } else {
        breakdown.push({ source: "DataForSEO", cost: dfs.cost || 0, ok: false, note: dfs.error || "no data returned for this domain" });
      }
    } else {
      breakdown.push({ source: "DataForSEO", cost: 0, ok: false, note: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set" });
    }
  }

  const cost_usd = Math.round(breakdown.reduce((a, x) => a + (x.cost || 0), 0) * 10000) / 10000;

  // The most-important intel, distilled for the dashboard header.
  const en = parsed.enrich, di = parsed.directory, it = parsed.intel;
  const signals = {
    trade: it.trade || null,
    has_form: en.website && typeof en.website.capture === "boolean" ? en.website.capture : null,
    chat: it.chat != null ? !!it.chat : null,
    phone: di.phone || null,
    tech: it.tech || [],
    pixels: en.pixels || [],
    traffic_month: en.traffic_month != null ? en.traffic_month : null,
    ad_spend_low: en.spend_low != null ? en.spend_low : null,
    ad_spend_high: en.spend_high != null ? en.spend_high : null,
    rating: en.gmb ? en.gmb.rating : null,
    reviews: en.gmb ? en.gmb.reviews : null,
    brief: it.brief || null,
  };

  // Cache the merged enrichment on the company (parsed already includes prev).
  if (co) {
    const merged = { ...parsed.enrich, _directory: parsed.directory, _intel: parsed.intel, _looked_up_at: new Date().toISOString(), _last_cost: cost_usd, _signals: signals };
    await env.DB.prepare("UPDATE companies SET enrichment=?, updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(merged), co.id).run().catch(() => {});
  }

  const me = await currentUser(request, env).catch(() => null);
  await env.DB.prepare("INSERT INTO lookup_log (id, contact_id, company_id, domain, cost_usd, sources, actor, created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))")
    .bind(rid(), b.contact_id, co ? co.id : null, domain, cost_usd, JSON.stringify(breakdown.map((x) => x.source)), me ? me.id : null).run().catch(() => {});
  await addActivityV2(env, { actorId: me ? me.id : null, entityType: "contact", entityId: b.contact_id, action: "intel_lookup", meta: { domain, cost_usd, mode } }).catch(() => {});

  return json({ ok: true, domain, mode, cost_usd, breakdown, enrich: parsed.enrich, directory: parsed.directory, intel: parsed.intel, signals, claude_on: !!env.ANTHROPIC_API_KEY, dataforseo_on: !!(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD) }, {}, cors);
}
