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
const LEAD_FORM = {
  name: "Consent Resolve — Exclusive HVAC Leads",
  intro_headline: "Exclusive HVAC leads — $7 each, yours alone",
  intro_paragraph:
    "Recover the ~98% of homeowners who land on your site and leave without calling. " +
    "Real name, email, and what they need — consent-first, never resold. " +
    "Tell us where to send your 2-minute demo.",
  questions: ["FULL_NAME", "EMAIL", "PHONE", "COMPANY_NAME"],
  privacy_url: "https://consentresolve.com/privacy-policy/",
  ty_title: "You're in — check your email",
  ty_body: "We'll send your 2-minute demo shortly. Want it now?",
  ty_button: "See the demo",
  ty_url: "https://consentresolve.com/hvac-leads/?utm_source=meta_lead&utm_medium=paid_social&utm_campaign=hvac_2026",
};
const AD_PRIMARY =
  "The homeowners who leave your site without calling? We hand them back — real name, email, and what they need. " +
  "$7 each, exclusively yours, never resold.";
const AD_HEADLINE = "Exclusive HVAC leads — $7 each";
const AD_IMAGES = [
  "https://consentresolve.com/ads/hvac_hook_4x5.png",
  "https://consentresolve.com/ads/hvac_math_4x5.png",
];

export async function launchLeadFormCampaign(env, { budgetCents = 10000, name = "HVAC US 2026", formId = null } = {}) {
  if (!metaConfigured(env)) return { ok: false, error: "not_configured" };
  const page = env.FACEBOOK_PAGE_ID;
  if (!page) return { ok: false, error: "no_page_id — set FACEBOOK_PAGE_ID in Cloudflare" };
  const A = acct(env);
  if (!formId) {
    const form = await metaPost(env, page + "/leadgen_forms", {
      name: LEAD_FORM.name, locale: "EN_US",
      questions: JSON.stringify(LEAD_FORM.questions.map((q) => ({ type: q }))),
      privacy_policy: JSON.stringify({ url: LEAD_FORM.privacy_url, link_text: "Privacy Policy" }),
      context_card: JSON.stringify({ title: LEAD_FORM.intro_headline, style: "PARAGRAPH_STYLE", content: [LEAD_FORM.intro_paragraph], button_text: "Get my demo" }),
      thank_you_page: JSON.stringify({ title: LEAD_FORM.ty_title, body: LEAD_FORM.ty_body, button_type: "VIEW_WEBSITE", button_text: LEAD_FORM.ty_button, website_url: LEAD_FORM.ty_url }),
      follow_up_action_url: LEAD_FORM.ty_url,
    });
    if (!form.ok || !(form.body && form.body.id)) return { ok: false, step: "leadgen_form", error: emsg(form) };
    formId = form.body.id;
  }
  const camp = await metaPost(env, A + "/campaigns", { name: "Lead Ads · " + name, objective: "OUTCOME_LEADS", status: "PAUSED", special_ad_categories: JSON.stringify([]) });
  if (!camp.ok || !(camp.body && camp.body.id)) return { ok: false, step: "campaign", error: emsg(camp), formId };
  const campaignId = camp.body.id;
  const targeting = { geo_locations: { countries: ["US"] }, targeting_automation: { advantage_audience: 0 } };
  const aset = await metaPost(env, A + "/adsets", {
    name: name + " · leads", campaign_id: campaignId, daily_budget: String(budgetCents),
    billing_event: "IMPRESSIONS", optimization_goal: "LEAD_GENERATION", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "ON_AD", promoted_object: JSON.stringify({ page_id: page }), targeting: JSON.stringify(targeting), status: "PAUSED",
  });
  if (!aset.ok || !(aset.body && aset.body.id)) return { ok: false, step: "adset", error: emsg(aset), campaignId, formId };
  const adsetId = aset.body.id;
  const ads = [];
  for (const img of AD_IMAGES) {
    const spec = { page_id: page, link_data: { picture: img, link: LEAD_FORM.ty_url, message: AD_PRIMARY, name: AD_HEADLINE, call_to_action: { type: "SIGN_UP", value: { lead_gen_form_id: formId } } } };
    const cr = await metaPost(env, A + "/adcreatives", { name: "lead-" + img.split("/").pop(), object_story_spec: JSON.stringify(spec) });
    if (!cr.ok || !(cr.body && cr.body.id)) { ads.push({ img, error: emsg(cr) }); continue; }
    const ad = await metaPost(env, A + "/ads", { name: "lead-" + img.split("/").pop(), adset_id: adsetId, creative: JSON.stringify({ creative_id: cr.body.id }), status: "PAUSED" });
    ads.push(ad.ok && ad.body && ad.body.id ? { img, adId: ad.body.id } : { img, error: emsg(ad) });
  }
  return { ok: true, formId, campaignId, adsetId, ads, budgetPerDay: budgetCents / 100 };
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
