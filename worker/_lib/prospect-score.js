// worker/_lib/prospect-score.js
//   Pure, dependency-free scoring for the bulk prospecting pipeline. Given a
//   flattened `signals` object gathered by the waterfall, return a fit score
//   (0–100), a tier, and the human-readable `reasons` the CRM card shows.
//
//   Weights reflect ONE question: "how obviously does this contractor need us?"
//   Someone already buying $60–300 shared leads is the strongest fit; a
//   competitor identity pixel (RB2B/Warmly) we can displace is next.
//
//   Kept pure so it is unit-testable with `node --test` and identical on the
//   POST path and the cron path.

// signals shape (all optional):
// {
//   marketplaces: ["angi.com", ...],   // Stage 3 backlink intersection
//   competitor_id: "rb2b" | null,       // Stage 1 tech bucket
//   running_ads: <bool>,                // Stage 2 paid.count > 0
//   ad_spend: <number|null>,            // Stage 2 estimated paid traffic cost
//   call_tracking: "callrail" | null,   // Stage 1
//   field_crm: "servicetitan" | null,   // Stage 1
//   ad_pixels: "gtag" | null,           // Stage 1
//   has_form: <bool|null>,              // Stage 4 (optional)
//   traffic_month: <number|null>,       // Stage 2 organic etv
//   rating: <number|null>,              // Stage 0
//   reviews: <number|null>,             // Stage 0
//   has_site: <bool>,                   // Stage 0 (domain present)
//   national: <bool>,                   // franchise/HQ flag (disqualify)
// }

export const WEIGHTS = {
  paying_per_lead: 30,
  competitor_id: 20,
  running_ads: 18,
  call_tracking: 10,
  field_crm: 10,
  has_form: 6,
  ad_pixels: 5,
  reputable: 5,       // rating >= 4.0 AND reviews >= 20
  traffic: 4,         // organic traffic > 100/mo
};

export const TIER_CUTS = { hot: 50, warm: 25, cold: 10 };

export function scoreProspect(signals = {}) {
  const s = signals || {};
  const reasons = [];

  // Hard disqualifiers first.
  if (s.has_site === false || (s.domain === "" )) return { score: 0, tier: "no_site", reasons: ["No website on file"] };
  if (s.national === true) return { score: 0, tier: "dead", reasons: ["National brand / franchise HQ — not our ICP"] };

  let score = 0;
  const add = (pts, why) => { score += pts; reasons.push(`+${pts} ${why}`); };

  const marketplaces = Array.isArray(s.marketplaces) ? s.marketplaces : [];
  if (marketplaces.length) add(WEIGHTS.paying_per_lead, `Already paying per lead (${marketplaces.join(", ")})`);
  if (s.competitor_id) add(WEIGHTS.competitor_id, `Running competitor pixel we displace (${s.competitor_id})`);
  if (s.running_ads || (s.ad_spend != null && s.ad_spend > 0)) {
    const spend = s.ad_spend != null && s.ad_spend > 0 ? ` (~$${s.ad_spend}/mo)` : "";
    add(WEIGHTS.running_ads, `Running paid ads${spend}`);
  }
  if (s.call_tracking) add(WEIGHTS.call_tracking, `Call tracking installed (${s.call_tracking})`);
  if (s.field_crm) add(WEIGHTS.field_crm, `Field CRM in use (${s.field_crm})`);
  if (s.has_form === true) add(WEIGHTS.has_form, "Lead-capture form present");
  if (s.ad_pixels) add(WEIGHTS.ad_pixels, `Ad pixels active (${s.ad_pixels})`);
  if (s.rating != null && s.rating >= 4.0 && s.reviews != null && s.reviews >= 20)
    add(WEIGHTS.reputable, `Reputable (${s.rating}★, ${s.reviews} reviews)`);
  if (s.traffic_month != null && s.traffic_month > 100) add(WEIGHTS.traffic, `${s.traffic_month} organic visits/mo`);

  if (score > 100) score = 100;

  let tier = "dead";
  if (score >= TIER_CUTS.hot) tier = "hot";
  else if (score >= TIER_CUTS.warm) tier = "warm";
  else if (score >= TIER_CUTS.cold) tier = "cold";

  if (!reasons.length) reasons.push("No qualifying marketing signals found");
  return { score, tier, reasons };
}
