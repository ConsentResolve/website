// node --test worker/_lib/prospect-score.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreProspect, WEIGHTS, TIER_CUTS } from "./prospect-score.js";

test("no website disqualifies to no_site", () => {
  const r = scoreProspect({ has_site: false });
  assert.equal(r.tier, "no_site");
  assert.equal(r.score, 0);
});

test("national brand disqualifies to dead", () => {
  const r = scoreProspect({ has_site: true, national: true, marketplaces: ["angi.com"] });
  assert.equal(r.tier, "dead");
});

test("marketplace backlink alone is not yet Hot but is Warm", () => {
  const r = scoreProspect({ has_site: true, marketplaces: ["thumbtack.com"] });
  assert.equal(r.score, WEIGHTS.paying_per_lead); // 30
  assert.equal(r.tier, "warm");
});

test("paying-per-lead + running ads clears Hot", () => {
  const r = scoreProspect({ has_site: true, marketplaces: ["angi.com"], running_ads: true });
  assert.equal(r.score, WEIGHTS.paying_per_lead + WEIGHTS.running_ads); // 48
  assert.equal(r.tier, "warm"); // 48 < 50, still warm
});

test("competitor pixel + marketplace is Hot", () => {
  const r = scoreProspect({ has_site: true, marketplaces: ["angi.com"], competitor_id: "rb2b" });
  assert.equal(r.score, 50);
  assert.equal(r.tier, "hot");
});

test("full stack of signals caps at 100 and is Hot", () => {
  const r = scoreProspect({
    has_site: true, marketplaces: ["angi.com", "thumbtack.com"], competitor_id: "warmly",
    running_ads: true, ad_spend: 1200, call_tracking: "callrail", field_crm: "servicetitan",
    has_form: true, ad_pixels: "gtag", rating: 4.8, reviews: 140, traffic_month: 900,
  });
  assert.equal(r.score, 100);
  assert.equal(r.tier, "hot");
});

test("bare site with nothing is dead", () => {
  const r = scoreProspect({ has_site: true });
  assert.equal(r.tier, "dead");
  assert.ok(r.reasons.length);
});

test("reputable-only reaches cold, not warm", () => {
  const r = scoreProspect({ has_site: true, rating: 4.9, reviews: 300, has_form: true });
  assert.equal(r.score, WEIGHTS.reputable + WEIGHTS.has_form); // 11
  assert.equal(r.tier, "cold");
});

test("reasons carry a + points prefix for each signal", () => {
  const r = scoreProspect({ has_site: true, marketplaces: ["angi.com"] });
  assert.ok(r.reasons.every((x) => x.startsWith("+")));
});

test("tier cuts are ordered", () => {
  assert.ok(TIER_CUTS.hot > TIER_CUTS.warm && TIER_CUTS.warm > TIER_CUTS.cold);
});
