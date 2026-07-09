// Meta (Facebook) Ads — read ad spend via the Marketing API (Graph v21.0) and sync it
// into crm_spend so the paid-lead cost/lead + ROAS tab use real numbers. Reuses the same
// System-User token (ads_management scope → includes read) + ad account as
// scripts/meta_campaign.py. Inert until META_ACCESS_TOKEN + META_AD_ACCOUNT_ID are set.
const GRAPH = "https://graph.facebook.com/v21.0";

export function metaConfigured(env) {
  return !!(env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID);
}

function acct(env) {
  const a = String(env.META_AD_ACCOUNT_ID || "").trim();
  return a.startsWith("act_") ? a : "act_" + a;
}

async function metaGet(env, path, params) {
  const q = new URLSearchParams(Object.assign({ access_token: env.META_ACCESS_TOKEN }, params || {}));
  const res = await fetch(GRAPH + "/" + path + "?" + q.toString());
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, body: j, error: j && j.error ? j.error : null };
}

// Per-campaign spend for a window. datePreset: today|yesterday|last_7d|last_30d|this_month|maximum.
export async function fetchMetaSpend(env, { datePreset = "this_month" } = {}) {
  if (!metaConfigured(env)) return { ok: false, configured: false };
  const r = await metaGet(env, acct(env) + "/insights", {
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,impressions,clicks",
    date_preset: datePreset,
    limit: "200",
  });
  if (!r.ok) return { ok: false, configured: true, status: r.status, error: r.error ? (r.error.message || ("graph " + r.status)) : ("graph " + r.status) };
  const rows = (((r.body && r.body.data) || [])).map((d) => ({
    campaignId: d.campaign_id || null,
    campaign: d.campaign_name || "(campaign)",
    spend: Number(d.spend || 0),
    impressions: Number(d.impressions || 0),
    clicks: Number(d.clicks || 0),
  }));
  const total = rows.reduce((s, x) => s + x.spend, 0);
  return { ok: true, configured: true, datePreset, total: Math.round(total * 100) / 100, rows };
}

// Campaign statuses + custom-audience sizes — so the CRM can show whether a retarget
// campaign is paused/active and whether its audience is big enough to deliver (Meta needs
// ~1,000 matched for a Custom Audience). Read-only.
export async function fetchMetaStatus(env) {
  if (!metaConfigured(env)) return { configured: false };
  const c = await metaGet(env, acct(env) + "/campaigns", { fields: "id,name,effective_status,daily_budget,lifetime_budget", limit: "50" });
  const a = await metaGet(env, acct(env) + "/customaudiences", { fields: "name,approximate_count,delivery_status", limit: "50" });
  // Ad-set budgets — for campaigns without campaign-level (CBO) budget, the daily budget
  // lives on the ad sets. Sum each campaign's ACTIVE ad-set daily budgets. Amounts are in
  // account-currency minor units (cents) → /100.
  const s = await metaGet(env, acct(env) + "/adsets", { fields: "campaign_id,daily_budget,effective_status", limit: "500" });
  const adsetDaily = {};
  for (const x of (((s.body && s.body.data) || []))) {
    const cid = x.campaign_id; const cents = Number(x.daily_budget || 0);
    if (!cid || !(cents > 0)) continue;
    if (x.effective_status && x.effective_status !== "ACTIVE") continue; // count only live ad sets
    adsetDaily[cid] = (adsetDaily[cid] || 0) + cents;
  }
  const campaigns = (((c.body && c.body.data) || [])).map((x) => {
    const cboDaily = Number(x.daily_budget || 0);
    const fromAdsets = adsetDaily[x.id] || 0;
    const dailyCents = cboDaily > 0 ? cboDaily : fromAdsets;
    return {
      name: x.name,
      status: x.effective_status,
      dailyBudget: dailyCents > 0 ? Math.round(dailyCents) / 100 : null,
      lifetimeBudget: Number(x.lifetime_budget || 0) > 0 ? Math.round(Number(x.lifetime_budget)) / 100 : null,
      budgetLevel: cboDaily > 0 ? "campaign" : (fromAdsets > 0 ? "adset" : null),
    };
  });
  const audiences = (((a.body && a.body.data) || [])).map((x) => ({
    name: x.name,
    count: x.approximate_count != null ? Number(x.approximate_count) : null,
    ready: !!(x.delivery_status && x.delivery_status.code === 200),
  }));
  return { configured: true, campaigns, audiences, error: c.error ? (c.error.message || "") : (a.error ? (a.error.message || "") : null) };
}

// ── Custom Audiences (list-based retargeting) ─────────────────────────────────
// Upload cold-email recipients as a Meta Custom Audience so the retargeting campaign
// shows ads to the same people we're emailing (email + ad = warmer touch). Emails are
// SHA-256 hashed in-worker before they ever leave — Meta never sees the plaintext.
async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function metaPost(env, path, params) {
  const body = new URLSearchParams(Object.assign({ access_token: env.META_ACCESS_TOKEN }, params || {}));
  const res = await fetch(GRAPH + "/" + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, body: j, error: j && j.error ? j.error : null };
}
export async function listCustomAudiences(env) {
  if (!metaConfigured(env)) return { ok: false, configured: false };
  const r = await metaGet(env, acct(env) + "/customaudiences", { fields: "id,name,approximate_count_lower_bound,approximate_count_upper_bound,subtype,delivery_status", limit: "100" });
  if (!r.ok) return { ok: false, error: r.error ? (r.error.message || ("graph " + r.status)) : ("graph " + r.status) };
  return { ok: true, audiences: (((r.body && r.body.data) || [])).map((x) => ({ id: x.id, name: x.name, count: x.approximate_count_upper_bound != null ? Number(x.approximate_count_upper_bound) : null, subtype: x.subtype })) };
}
export async function ensureCustomAudience(env, name) {
  const list = await listCustomAudiences(env);
  if (list.ok) { const hit = list.audiences.find((a) => a.name === name); if (hit) return { ok: true, id: hit.id, created: false, count: hit.count }; }
  const r = await metaPost(env, acct(env) + "/customaudiences", { name, subtype: "CUSTOM", customer_file_source: "USER_PROVIDED_ONLY", description: "Cold-email recipients — consent-first retargeting" });
  if (!r.ok || !(r.body && r.body.id)) return { ok: false, error: r.error ? (r.error.message || ("graph " + r.status)) : ("graph " + r.status) };
  return { ok: true, id: r.body.id, created: true };
}
export async function addEmailsToAudience(env, audienceId, emails) {
  const norm = Array.from(new Set((emails || []).map((e) => String(e || "").trim().toLowerCase()).filter((e) => e.indexOf("@") > 0)));
  let added = 0; const errors = [];
  for (let i = 0; i < norm.length; i += 1000) {
    const chunk = norm.slice(i, i + 1000);
    const data = [];
    for (const e of chunk) data.push([await sha256hex(e)]);
    const r = await metaPost(env, audienceId + "/users", { payload: JSON.stringify({ schema: ["EMAIL"], data }) });
    if (r.ok && r.body && r.body.num_received != null) added += Number(r.body.num_received);
    else if (r.ok) added += chunk.length;
    else errors.push((r.error && r.error.message) || ("graph " + r.status));
  }
  return { ok: errors.length === 0, added, total: norm.length, errors };
}

// ── Cold lead-gen campaign launcher (Instant Forms) ───────────────────────────
// Creates a full OUTCOME_LEADS campaign (lead form + campaign + ad set + creatives + ads),
// all PAUSED, from the Cloudflare Meta secret — so it can be launched without exposing the
// token locally. On-submit leads ingest via api/crm-meta.js. Activate separately (spends money).
const emsg = (r) => {
  const e = (r && r.error) || {};
  const parts = [e.message, e.error_user_title, e.error_user_msg].filter(Boolean);
  const base = parts.length ? parts.join(" · ") : ("graph " + (r && r.status));
  return base + (e.error_subcode ? " [subcode " + e.error_subcode + "]" : "") + (e.code ? " (code " + e.code + ")" : "");
};
// The 17 trades (slug + form label). No "Other" — a lead who doesn't fit an industry can't submit.
export const TRADE_OPTIONS = [
  ["hvac", "HVAC / Heating & Air"], ["plumber", "Plumbing"], ["electrician", "Electrical"],
  ["roofing", "Roofing"], ["general-contractor", "General Contractor / Remodeling"], ["handyman", "Handyman"],
  ["painter", "Painting"], ["house-cleaning", "House Cleaning"], ["power-washing", "Power Washing"],
  ["pest-control", "Pest Control"], ["lawn-care", "Lawn Care & Landscaping"], ["tree-removal", "Tree Service"],
  ["locksmith", "Locksmith"], ["garage-door", "Garage Doors"], ["deck-fence", "Deck & Fence"],
  ["appliance-repair", "Appliance Repair"], ["mobile-car-service", "Mobile Auto / Car Service"],
];
// Map a lead's trade answer (Meta may return the option key OR its display value) back to a slug.
export function tradeSlug(answer) {
  if (!answer) return null;
  const a = String(answer).trim().toLowerCase();
  for (const [slug, name] of TRADE_OPTIONS) if (a === slug || a === name.toLowerCase()) return slug;
  for (const [slug, name] of TRADE_OPTIONS) if (name.toLowerCase().startsWith(a) || a.startsWith(slug)) return slug;
  return null;
}

// Optional interest/behavior layer for the lead ad set, merged into the base targeting.
// Left empty until we resolve current (non-deprecated) interest IDs — an empty object keeps
// the launch valid. To turn on a strict contractor/small-business filter, set e.g.:
//   flexible_spec: [{ interests: [{ id: "<id>", name: "General contractor" }, ...] }]
// (with Advantage+ Audience OFF above, this is a hard filter, not an expansion hint.)
const LEAD_TARGETING_EXTRA = {
  // Two AND'd groups (Advantage+ OFF above makes this a hard filter, not an expansion hint):
  //   (1) they RUN a business  AND  (2) they're in the home-services / construction world.
  // This is the direct fix for "furniture-store employee picks HVAC" — a casual consumer who
  // isn't a business owner in a trade won't match. Names are labels only; Meta keys on id.
  flexible_spec: [
    { behaviors: [
      { id: "6002714898572", name: "Small business owners" },
      { id: "6020530281783", name: "Business page admins" },
      { id: "6273196847983", name: "New Active Business (< 12 months)" },
    ] },
    { interests: [
      { id: "6003234413249", name: "Home improvement" },
      { id: "6003574304918", name: "Home construction" },
      { id: "6003009740281", name: "Roofing Contractor" },
      { id: "6003395414271", name: "Construction" },
    ] },
  ],
};

const LEAD_FORM = {
  name: "Consent Resolve — Exclusive Home-Service Leads",
  intro_headline: "Exclusive leads for home-service pros — $7 each, yours alone",
  intro_paragraph:
    "Recover the ~98% of homeowners who land on your site and leave without a trace. " +
    "Real name, email, and what they need — consent-first, never resold. " +
    "Tell us where to send your 2-minute demo.",
  // Trade first (qualifying — no "Other", so only our 17 industries can submit), then contact
  // fields, then a free-text website/FB-page URL (second qualifier: real businesses have one;
  // the webhook validates it resolves and flags mismatches — see crm-meta.js).
  questions: [
    { type: "CUSTOM", key: "trade", label: "What's your trade?", options: TRADE_OPTIONS.map(([k, v]) => ({ key: k, value: v })) },
    { type: "FULL_NAME" },
    { type: "EMAIL" },
    { type: "PHONE" },
    { type: "COMPANY_NAME" },
    { type: "CUSTOM", key: "website", label: "Business website or Facebook Page URL" },
  ],
  privacy_url: "https://consentresolve.com/privacy-policy/",
  ty_title: "You're in — check your email",
  ty_body: "We'll send your 2-minute demo shortly. Want it now?",
  ty_button: "See the demo",
  ty_url: "https://consentresolve.com/industries/?utm_source=meta_lead&utm_medium=paid_social&utm_campaign=allpros_2026",
};
const AD_PRIMARY =
  "You're already paying for the clicks. About 98% of the homeowners who land on your site leave without a trace. " +
  "We hand the ones who opt in back to you as exclusive, consent-first leads — a real name and email, $7 each, never resold.";
const AD_HEADLINE = "Get back the 98% who leave";
// Mix: 4 real-service-pro photos (Jobber-style headline + CTA baked in) + 1 line-art ROI diagram.
export const STATIC_ADS = [
  "https://consentresolve.com/ads/cr_plumber.png",      // competitor: "One lead. One pro. Never resold."
  "https://consentresolve.com/ads/cr_electrician.png",  // value: "$7 a lead. Yours alone."
  "https://consentresolve.com/ads/cr_roofer.png",       // wasted-spend: "Get back the 98% who leave."
  "https://consentresolve.com/ads/cr_team.png",         // consent: "Leads that opted in. Not scraped."
  "https://consentresolve.com/ads/cr_roimath_4x5.png",  // ROI-math (line-art diagram, for variety)
];
// 1:1 square versions (blurred-fill) — fit the feed placement without the zoomed-Reel crop.
export const TYLER_VIDEOS = [
  "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/sprint/leak-stat-sq.mp4",
  "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/sprint/math-new-sq.mp4",
  "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/sprint/creepy-new-sq.mp4",
];
export const CONV_LINK =
  "https://consentresolve.com/industries/?utm_source=meta&utm_medium=paid&utm_campaign=CR_conv_allpros";

// Upload a video by URL — Meta fetches it asynchronously (may take minutes), so we do NOT
// poll here (Cloudflare Workers can't wait that long). Returns the video id immediately;
// the creative step handles the "still processing" case.
export async function uploadAdVideo(env, url) {
  const r = await metaPost(env, acct(env) + "/advideos", { file_url: url });
  if (!r.ok || !(r.body && r.body.id)) return { ok: false, error: emsg(r) };
  return { ok: true, id: r.body.id };
}

// Build a video ad creative. If Meta says the video is still processing (it downloads
// async), we surface notReady:true so a later call can retry once it's ready.
export async function createVideoCreative(env, { videoId, message, title, link, leadFormId, thumbnailUrl }) {
  const page = env.FACEBOOK_PAGE_ID;
  const videoData = {
    video_id: videoId,
    message,
    title,
    call_to_action: leadFormId
      ? { type: "SIGN_UP", value: { lead_gen_form_id: leadFormId } }
      : { type: "LEARN_MORE", value: { link } },
  };
  // Meta requires a video thumbnail (image_url or image_hash). Default to Tyler's headshot;
  // reviewable/swappable in Ads Manager before activation.
  videoData.image_url = thumbnailUrl || "https://consentresolve.com/team/tyler-spurlock.jpg";
  const spec = { page_id: page, video_data: videoData };
  const cr = await metaPost(env, acct(env) + "/adcreatives", { name: "video-" + videoId, object_story_spec: JSON.stringify(spec) });
  if (cr.ok && cr.body && cr.body.id) return { ok: true, id: cr.body.id };
  const msg = emsg(cr);
  if (/still (being )?process|not ready|media.*process/i.test(msg)) return { ok: false, notReady: true, error: msg };
  return { ok: false, error: msg };
}

export async function launchLeadFormCampaign(env, { budgetCents = 10000, name = "Home Services US 2026", formId = null, videoUrls = [] } = {}) {
  if (!metaConfigured(env)) return { ok: false, error: "not_configured" };
  const page = env.FACEBOOK_PAGE_ID;
  if (!page) return { ok: false, error: "no_page_id — set FACEBOOK_PAGE_ID in Cloudflare" };
  const A = acct(env);
  if (!formId) {
    // Reuse an existing form of the same name (Meta rejects duplicate names) — makes retries idempotent.
    const existing = await metaGet(env, page + "/leadgen_forms", { fields: "id,name,status", limit: "100" });
    const hit = (((existing.body && existing.body.data) || [])).find((f) => f.name === LEAD_FORM.name);
    if (hit) formId = hit.id;
  }
  if (!formId) {
    // Unique name — Meta rejects duplicate form names on a Page, and listing existing forms
    // needs a Page token we don't hold. The returned form id is reused for retries.
    const form = await metaPost(env, page + "/leadgen_forms", {
      name: LEAD_FORM.name + " · " + new Date().toISOString().slice(0, 16).replace("T", " "), locale: "EN_US",
      questions: JSON.stringify(LEAD_FORM.questions),
      privacy_policy: JSON.stringify({ url: LEAD_FORM.privacy_url, link_text: "Privacy Policy" }),
      context_card: JSON.stringify({ title: LEAD_FORM.intro_headline, style: "PARAGRAPH_STYLE", content: [LEAD_FORM.intro_paragraph], button_text: "Get my demo" }),
      thank_you_page: JSON.stringify({ title: LEAD_FORM.ty_title, body: LEAD_FORM.ty_body, button_type: "VIEW_WEBSITE", button_text: LEAD_FORM.ty_button, website_url: LEAD_FORM.ty_url }),
      follow_up_action_url: LEAD_FORM.ty_url,
      // "Higher Intent" — adds a review-and-confirm step before submit. Filters the reflexive
      // one-tap form-fillers that a "More Volume" form attracts (the junk-lead default). Fewer
      // leads, but they've re-read their own name/company/trade and chosen to submit.
      is_optimized_for_quality: "true",
    });
    if (!form.ok || !(form.body && form.body.id)) return { ok: false, step: "leadgen_form", error: emsg(form) };
    formId = form.body.id;
  }
  // is_adset_budget_sharing_enabled is required when the budget lives on the ad set (not the
  // campaign). false = each ad set keeps its full daily budget.
  const camp = await metaPost(env, A + "/campaigns", { name: "Lead Ads · " + name, objective: "OUTCOME_LEADS", status: "PAUSED", special_ad_categories: JSON.stringify([]), is_adset_budget_sharing_enabled: "false" });
  if (!camp.ok || !(camp.body && camp.body.id)) return { ok: false, step: "campaign", error: emsg(camp), formId };
  const campaignId = camp.body.id;
  // Quality-tightened targeting for the lead form. The first live ad set was bare US / 18+ / all
  // placements / "more volume" form — which pulled reflexive form-fillers (furniture store → "HVAC").
  // Fixes: real business-owner age band, English only, Advantage+ OFF so any interest layer is a hard
  // filter (not an expansion hint), and Facebook+Instagram feeds only — Audience Network is the single
  // biggest source of accidental/junk taps. LEAD_TARGETING lets us bolt on a flexible_spec interest
  // layer (contractor / small-business) once we've resolved current interest IDs.
  const targeting = Object.assign({
    geo_locations: { countries: ["US"] },
    age_min: 30, age_max: 65,
    locales: [6],                                   // English (US)
    targeting_automation: { advantage_audience: 0 },
    publisher_platforms: ["facebook", "instagram"], // excludes Audience Network + Messenger
  }, LEAD_TARGETING_EXTRA);
  const aset = await metaPost(env, A + "/adsets", {
    name: name + " · leads", campaign_id: campaignId, daily_budget: String(budgetCents),
    billing_event: "IMPRESSIONS", optimization_goal: "LEAD_GENERATION", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "ON_AD", promoted_object: JSON.stringify({ page_id: page }), targeting: JSON.stringify(targeting), status: "PAUSED",
  });
  if (!aset.ok || !(aset.body && aset.body.id)) return { ok: false, step: "adset", error: emsg(aset), campaignId, formId };
  const adsetId = aset.body.id;
  const ads = [];
  const pendingVideos = [];
  for (const img of STATIC_ADS) {
    const spec = { page_id: page, link_data: { picture: img, link: LEAD_FORM.ty_url, message: AD_PRIMARY, name: AD_HEADLINE, call_to_action: { type: "SIGN_UP", value: { lead_gen_form_id: formId } } } };
    const cr = await metaPost(env, A + "/adcreatives", { name: "lead-" + img.split("/").pop(), object_story_spec: JSON.stringify(spec) });
    if (!cr.ok || !(cr.body && cr.body.id)) { ads.push({ img, error: emsg(cr) }); continue; }
    const ad = await metaPost(env, A + "/ads", { name: "lead-" + img.split("/").pop(), adset_id: adsetId, creative: JSON.stringify({ creative_id: cr.body.id }), status: "PAUSED" });
    ads.push(ad.ok && ad.body && ad.body.id ? { img, adId: ad.body.id } : { img, error: emsg(ad) });
  }
  for (const vurl of (videoUrls || [])) {
    const up = await uploadAdVideo(env, vurl);
    if (!up.ok) { ads.push({ video: vurl, error: up.error }); continue; }
    const cr = await createVideoCreative(env, { videoId: up.id, message: AD_PRIMARY, title: AD_HEADLINE, leadFormId: formId });
    if (cr.notReady) { pendingVideos.push({ video: vurl, videoId: up.id }); ads.push({ video: vurl, videoId: up.id, pending: true }); continue; }
    if (!cr.ok) { ads.push({ video: vurl, videoId: up.id, error: cr.error }); continue; }
    const ad = await metaPost(env, A + "/ads", { name: "lead-video-" + up.id, adset_id: adsetId, creative: JSON.stringify({ creative_id: cr.id }), status: "PAUSED" });
    ads.push(ad.ok && ad.body && ad.body.id ? { video: vurl, videoId: up.id, adId: ad.body.id } : { video: vurl, videoId: up.id, error: emsg(ad) });
  }
  return { ok: true, formId, campaignId, adsetId, ads, pendingVideos, budgetPerDay: budgetCents / 100 };
}

// ── Conversion (web) campaign launcher ────────────────────────────────────────
// OUTCOME_SALES optimizing for the LEAD Pixel event on the website. Static + video
// creatives, all PAUSED. Videos that are still processing are returned in pendingVideos.
export async function launchConversionCampaign(env, { budgetCents = 5000, name = "Home Services US 2026", link } = {}) {
  if (!metaConfigured(env)) return { ok: false, error: "not_configured" };
  const page = env.FACEBOOK_PAGE_ID;
  if (!page) return { ok: false, error: "no_page_id — set FACEBOOK_PAGE_ID in Cloudflare" };
  const A = acct(env);
  const dest = link || CONV_LINK;
  // Cold start: the Pixel has no LEAD-event volume yet, so Meta blocks conversion optimization.
  // Run as TRAFFIC optimizing for landing-page views to /industries/; flip the ad set to
  // OUTCOME_SALES/OFFSITE_CONVERSIONS once the demo form has logged enough Lead events.
  const camp = await metaPost(env, A + "/campaigns", { name: "Traffic · " + name, objective: "OUTCOME_TRAFFIC", status: "PAUSED", special_ad_categories: JSON.stringify([]), is_adset_budget_sharing_enabled: "false" });
  if (!camp.ok || !(camp.body && camp.body.id)) return { ok: false, step: "campaign", error: emsg(camp) };
  const campaignId = camp.body.id;
  const targeting = { geo_locations: { countries: ["US"] }, targeting_automation: { advantage_audience: 0 } };
  const aset = await metaPost(env, A + "/adsets", {
    name: name + " · web", campaign_id: campaignId, daily_budget: String(budgetCents),
    billing_event: "IMPRESSIONS", optimization_goal: "LANDING_PAGE_VIEWS", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "WEBSITE", targeting: JSON.stringify(targeting), status: "PAUSED",
  });
  if (!aset.ok || !(aset.body && aset.body.id)) return { ok: false, step: "adset", error: emsg(aset), campaignId };
  const adsetId = aset.body.id;
  const ads = [];
  const pendingVideos = [];
  for (const img of STATIC_ADS) {
    const spec = { page_id: page, link_data: { picture: img, link: dest, message: AD_PRIMARY, name: AD_HEADLINE, call_to_action: { type: "LEARN_MORE", value: { link: dest } } } };
    const cr = await metaPost(env, A + "/adcreatives", { name: "conv-" + img.split("/").pop(), object_story_spec: JSON.stringify(spec) });
    if (!cr.ok || !(cr.body && cr.body.id)) { ads.push({ img, error: emsg(cr) }); continue; }
    const ad = await metaPost(env, A + "/ads", { name: "conv-" + img.split("/").pop(), adset_id: adsetId, creative: JSON.stringify({ creative_id: cr.body.id }), status: "PAUSED" });
    ads.push(ad.ok && ad.body && ad.body.id ? { img, adId: ad.body.id } : { img, error: emsg(ad) });
  }
  for (const vurl of TYLER_VIDEOS) {
    const up = await uploadAdVideo(env, vurl);
    if (!up.ok) { ads.push({ video: vurl, error: up.error }); continue; }
    const cr = await createVideoCreative(env, { videoId: up.id, message: AD_PRIMARY, title: AD_HEADLINE, link: dest });
    if (cr.notReady) { pendingVideos.push({ video: vurl, videoId: up.id }); ads.push({ video: vurl, videoId: up.id, pending: true }); continue; }
    if (!cr.ok) { ads.push({ video: vurl, videoId: up.id, error: cr.error }); continue; }
    const ad = await metaPost(env, A + "/ads", { name: "conv-video-" + up.id, adset_id: adsetId, creative: JSON.stringify({ creative_id: cr.id }), status: "PAUSED" });
    ads.push(ad.ok && ad.body && ad.body.id ? { video: vurl, videoId: up.id, adId: ad.body.id } : { video: vurl, videoId: up.id, error: emsg(ad) });
  }
  return { ok: true, campaignId, adsetId, ads, pendingVideos, budgetPerDay: budgetCents / 100 };
}

// Flip a campaign + its ad sets + ads to ACTIVE (starts spending). Deliberate second step.
export async function activateMetaCampaign(env, campaignId) {
  if (!metaConfigured(env)) return { ok: false, error: "not_configured" };
  if (!campaignId) return { ok: false, error: "no_campaign_id" };
  const c = await metaPost(env, campaignId, { status: "ACTIVE" });
  if (!c.ok) return { ok: false, step: "campaign", error: emsg(c) };
  const out = { ok: true, campaignId, adsets: [], ads: [] };
  const asets = await metaGet(env, campaignId + "/adsets", { fields: "id", limit: "50" });
  for (const a of (((asets.body && asets.body.data) || []))) {
    const r = await metaPost(env, a.id, { status: "ACTIVE" });
    out.adsets.push({ id: a.id, ok: r.ok, error: r.ok ? undefined : emsg(r) });
  }
  const adsList = await metaGet(env, campaignId + "/ads", { fields: "id", limit: "100" });
  for (const a of (((adsList.body && adsList.body.data) || []))) {
    const r = await metaPost(env, a.id, { status: "ACTIVE" });
    out.ads.push({ id: a.id, ok: r.ok, error: r.ok ? undefined : emsg(r) });
  }
  return out;
}

// Delete a campaign (and its child ad sets/ads) — for cleaning up empty/orphan campaigns
// left by failed launch attempts. Meta soft-deletes via status=DELETED.
export async function deleteMetaCampaign(env, campaignId) {
  if (!metaConfigured(env)) return { ok: false, error: "not_configured" };
  if (!campaignId) return { ok: false, error: "no_campaign_id" };
  const r = await metaPost(env, campaignId, { status: "DELETED" });
  return r.ok ? { ok: true, deleted: campaignId } : { ok: false, error: emsg(r) };
}

// Idempotent: replace this calendar month's Meta-sourced rows in crm_spend with the live
// figures (channel="facebook", note="meta:<campaign_id>:<name>"). Safe to run on a cron.
export async function syncMetaSpend(env) {
  if (!metaConfigured(env) || !env.DB) return { ok: false, configured: metaConfigured(env), synced: 0 };
  const sp = await fetchMetaSpend(env, { datePreset: "this_month" });
  if (!sp.ok) return { ok: false, configured: true, error: sp.error || "fetch_failed", synced: 0 };
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS crm_spend (id TEXT PRIMARY KEY, industry TEXT, channel TEXT, amount_usd REAL, period TEXT, note TEXT, created_at TEXT)").run();
  await env.DB.prepare("DELETE FROM crm_spend WHERE channel='facebook' AND period=? AND note LIKE 'meta:%'").bind(period).run();
  let synced = 0, i = 0;
  for (const row of sp.rows) {
    i++;
    if (!(row.spend > 0)) continue;
    const id = "ms_" + period + "_" + (row.campaignId || String(i));
    await env.DB.prepare("INSERT INTO crm_spend (id, industry, channel, amount_usd, period, note, created_at) VALUES (?,?,?,?,?,?,datetime('now'))")
      .bind(id, null, "facebook", row.spend, period, "meta:" + (row.campaignId || "") + ":" + row.campaign).run();
    synced++;
  }
  return { ok: true, configured: true, period, total: sp.total, synced };
}
