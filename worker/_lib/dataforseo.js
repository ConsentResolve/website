// worker/_lib/dataforseo.js
//   Shared DataForSEO calls used by BOTH the single-lead Intel lookup
//   (worker/api/crm-lookup.js) and the bulk Prospecting pipeline
//   (worker/api/prospecting.js). Keeping them here means the two surfaces can
//   never drift — the same signal means the same thing everywhere.
//
//   Auth is HTTP Basic base64(login:password). Every DataForSEO response carries
//   an exact dollar `cost` field, which each fn surfaces so spend is *measured*.

export function normDomain(s) {
  let d = String(s || "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "").trim();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : "";
}

export function dfsAuth(env) { return "Basic " + btoa(env.DATAFORSEO_LOGIN + ":" + env.DATAFORSEO_PASSWORD); }
export function dfsConfigured(env) { return !!(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD); }

// ── Stage 2: monthly traffic + running ads (DataForSEO Labs Domain Rank Overview)
export async function dataforseoLookup(env, domain) {
  if (!dfsConfigured(env)) return { used: false, cost: 0 };
  try {
    const r = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live", {
      method: "POST",
      headers: { Authorization: dfsAuth(env), "Content-Type": "application/json" },
      body: JSON.stringify([{ target: domain, location_code: 2840, language_code: "en" }]),
    });
    const j = await r.json();
    const cost = Number(j.cost || 0);
    const item = j.tasks && j.tasks[0] && j.tasks[0].result && j.tasks[0].result[0] && j.tasks[0].result[0].items && j.tasks[0].result[0].items[0];
    const m = (item && item.metrics) || {};
    const org = m.organic || {}, paid = m.paid || {};
    const orgT = org.etv != null ? Math.round(org.etv) : null;
    const paidT = paid.etv != null ? Math.round(paid.etv) : null;
    return { used: true, cost, data: {
      traffic_month: (orgT != null || paidT != null) ? (orgT || 0) + (paidT || 0) : null,  // total estimated monthly visits
      organic_traffic: orgT,                                                    // organic split
      paid_traffic: paidT,                                                      // paid split
      ad_spend: paid.estimated_paid_traffic_cost != null ? Math.round(paid.estimated_paid_traffic_cost) : null,
      organic_keywords: org.count != null ? org.count : null,
      paid_keywords: paid.count != null ? paid.count : null,
    } };
  } catch (e) { return { used: false, cost: 0, error: String(e).slice(0, 120) }; }
}

// Lead marketplaces — a live backlink to one usually means they're buying shared leads ($60–300).
export const MARKETPLACES = ["angi.com", "homeadvisor.com", "thumbtack.com", "porch.com", "networx.com", "modernize.com", "houzz.com", "buildzoom.com", "bark.com", "yelp.com", "nextdoor.com"];

// ── Stage 3: which lead marketplaces they link to (#1 "raises hand for $7/lead" signal) PLUS
//   Domain Authority (rank, referring domains, spam score) from the backlinks summary — two
//   calls in one step so the dossier gets both without another round-trip.
export async function dfsBacklinks(env, domain) {
  if (!dfsConfigured(env)) return { used: false, cost: 0 };
  let cost = 0, marketplaces = [], authority = null;
  try {
    const r = await fetch("https://api.dataforseo.com/v3/backlinks/referring_domains/live", {
      method: "POST", headers: { Authorization: dfsAuth(env), "Content-Type": "application/json" },
      body: JSON.stringify([{ target: domain, limit: 1000, order_by: ["backlinks,desc"] }]),
    });
    const j = await r.json();
    cost += Number(j.cost || 0);
    const items = (j.tasks && j.tasks[0] && j.tasks[0].result && j.tasks[0].result[0] && j.tasks[0].result[0].items) || [];
    const refs = items.map((i) => String(i.domain || "").toLowerCase().replace(/^www\./, ""));
    marketplaces = MARKETPLACES.filter((m) => refs.some((d) => d === m || d.endsWith("." + m)));
  } catch (e) { return { used: false, cost, error: String(e).slice(0, 120) }; }
  // Domain Authority summary — rank / referring domains / backlinks / spam score.
  try {
    const r2 = await fetch("https://api.dataforseo.com/v3/backlinks/summary/live", {
      method: "POST", headers: { Authorization: dfsAuth(env), "Content-Type": "application/json" },
      body: JSON.stringify([{ target: domain, internal_list_limit: 1, backlinks_status_type: "live" }]),
    });
    const j2 = await r2.json();
    cost += Number(j2.cost || 0);
    const s = j2.tasks && j2.tasks[0] && j2.tasks[0].result && j2.tasks[0].result[0];
    if (s) authority = {
      rank: s.rank != null ? s.rank : null,
      referring_domains: s.referring_domains != null ? s.referring_domains : null,
      backlinks: s.backlinks != null ? s.backlinks : null,
      spam_score: s.backlinks_spam_score != null ? s.backlinks_spam_score : null,
    };
  } catch (_) { /* authority is best-effort; marketplaces already captured */ }
  return { used: true, cost, marketplaces, authority };
}

// ── Stage 1: domain technologies → marketing-maturity signals (call tracking, pixels, field CRM,
//   review tools, and competitor identity pixels we'd be displacing).
export const TECH_BUCKETS = {
  call_tracking: /callrail|calltrackingmetrics|whatconverts|marchex/i,
  ad_pixels: /facebook pixel|meta pixel|google ads|gtag|doubleclick|google conversion/i,
  field_crm: /servicetitan|jobber|housecall|service fusion|servicefusion|workiz/i,
  review_tools: /podium|birdeye|nicejob|grade\.us|reviewsio/i,
  competitor_id: /retention\.com|customers\.ai|rb2b|warmly|opensend|leadpost|vector/i,
};
export async function dfsTech(env, domain) {
  if (!dfsConfigured(env)) return { used: false, cost: 0 };
  try {
    const r = await fetch("https://api.dataforseo.com/v3/domain_analytics/technologies/domain_technologies/live", {
      method: "POST", headers: { Authorization: dfsAuth(env), "Content-Type": "application/json" },
      body: JSON.stringify([{ target: domain }]),
    });
    const j = await r.json();
    const cost = Number(j.cost || 0);
    const res = j.tasks && j.tasks[0] && j.tasks[0].result && j.tasks[0].result[0];
    const names = [];
    const groups = res && (res.technologies || res.items);
    if (groups && !Array.isArray(groups)) for (const cat in groups) { const v = groups[cat]; if (Array.isArray(v)) names.push(...v); else if (v && typeof v === "object") for (const sub in v) if (Array.isArray(v[sub])) names.push(...v[sub]); }
    else if (Array.isArray(groups)) for (const it of groups) { if (it.technology) names.push(it.technology); if (Array.isArray(it.technologies)) names.push(...it.technologies); }
    const blob = names.join(" ");
    const hits = {}; for (const k in TECH_BUCKETS) { const m = blob.match(TECH_BUCKETS[k]); if (m) hits[k] = m[0]; }
    return { used: true, cost, all: names.slice(0, 40), hits };
  } catch (e) { return { used: false, cost: 0, error: String(e).slice(0, 120) }; }
}

// ── Stage 0: Business Listings — one request per city+trade returns many local businesses.
//   The cheapest-per-prospect way to build a TAM: name, domain, phone, rating, reviews, category.
//   `categories` filters to the trade; `location_coordinate` or a title/address filter scopes the
//   city. We use the flexible `filters` form on business_listings/search.
export async function dfsBusinessListings(env, { trade, city, region, categories, limit = 100 }) {
  if (!dfsConfigured(env)) return { used: false, cost: 0, businesses: [] };
  // Category keywords per trade — Google-Business categories DataForSEO indexes.
  const CAT = categories || TRADE_CATEGORIES[trade] || [trade];
  // Location string like "Tampa, Florida, United States" — DataForSEO matches on address text.
  const locBits = [city, region, "United States"].filter(Boolean);
  const filters = [["categories", "in", CAT]];
  if (city) filters.push("and", ["address_info.city", "like", `%${city}%`]);
  try {
    const r = await fetch("https://api.dataforseo.com/v3/business_data/business_listings/search/live", {
      method: "POST", headers: { Authorization: dfsAuth(env), "Content-Type": "application/json" },
      body: JSON.stringify([{ categories: CAT, description: trade, title: trade, filters, limit: Math.min(limit, 1000), order_by: ["rating.value,desc"] }]),
    });
    const j = await r.json();
    const cost = Number(j.cost || 0);
    const items = (j.tasks && j.tasks[0] && j.tasks[0].result && j.tasks[0].result[0] && j.tasks[0].result[0].items) || [];
    const businesses = items.map((it) => {
      const ai = it.address_info || {};
      return {
        name: it.title || null,
        domain: normDomain(it.domain || it.url || ""),
        phone: it.phone || null,
        city: ai.city || city || null,
        region: ai.region || region || null,
        rating: it.rating && it.rating.value != null ? Number(it.rating.value) : null,
        reviews: it.rating && it.rating.votes_count != null ? Number(it.rating.votes_count) : (it.total_photos != null ? null : null),
        category: it.category || (Array.isArray(it.additional_categories) ? it.additional_categories[0] : null) || trade,
      };
    }).filter((b) => b.name);
    return { used: true, cost, businesses, location: locBits.join(", ") };
  } catch (e) { return { used: false, cost: 0, businesses: [], error: String(e).slice(0, 120) }; }
}

// Google-Business category keywords per canonical trade slug.
export const TRADE_CATEGORIES = {
  hvac: ["HVAC contractor", "Air conditioning contractor", "Heating contractor", "Furnace repair service"],
  plumbing: ["Plumber", "Plumbing supply store", "Drainage service"],
  roofing: ["Roofing contractor"],
  electrical: ["Electrician"],
  "windows & doors": ["Window installation service", "Door supplier"],
  landscaping: ["Landscaper", "Lawn care service"],
  "garage door": ["Garage door supplier"],
  fencing: ["Fence contractor"],
  concrete: ["Concrete contractor", "Masonry contractor"],
  flooring: ["Flooring contractor", "Flooring store"],
  remodeling: ["Remodeler", "Bathroom remodeler", "Kitchen remodeler"],
  solar: ["Solar energy contractor"],
  gutters: ["Gutter cleaning service"],
  siding: ["Siding contractor"],
  "pool service": ["Swimming pool repair service", "Pool cleaning service"],
  "pest control": ["Pest control service"],
  painting: ["Painter", "Painting"],
  "tree service": ["Tree service", "Arborist service"],
  "general contractor": ["General contractor", "Home improvement store"],
  handyman: ["Handyman", "Handyman/Handywoman/Handyperson"],
  "appliance repair": ["Appliance repair service"],
  foundation: ["Foundation"],
};

// ── Optional Stage 4: instant on-page fetch → does the homepage have a lead-capture form?
export async function dfsOnPageForm(env, domain) {
  if (!dfsConfigured(env)) return { used: false, cost: 0 };
  try {
    const r = await fetch("https://api.dataforseo.com/v3/on_page/instant_pages", {
      method: "POST", headers: { Authorization: dfsAuth(env), "Content-Type": "application/json" },
      body: JSON.stringify([{ url: "https://" + domain, enable_javascript: false }]),
    });
    const j = await r.json();
    const cost = Number(j.cost || 0);
    const item = j.tasks && j.tasks[0] && j.tasks[0].result && j.tasks[0].result[0] && j.tasks[0].result[0].items && j.tasks[0].result[0].items[0];
    // On-Page reports a `no_form` check (true = no form found). Invert it for our "has a form" signal.
    const checks = (item && item.checks) || {};
    const has_form = checks.no_form === false ? true : (checks.no_form === true ? false : null);
    return { used: true, cost, has_form };
  } catch (e) { return { used: false, cost: 0, error: String(e).slice(0, 120) }; }
}
