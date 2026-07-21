# Meta Lead-Gen Campaign Protocol — Home-Service Trades (HVAC / Roofing / Plumbing)

**Target CPL: ~$25**

This is a build-and-manage playbook for running Meta (Facebook/Instagram) lead-gen for multiple home-service trades out of one ad account. It covers account structure, ad set setup, a naming convention, and hard rules for when to kill vs. scale a creative.

---

## 1. Guiding principles (read first)

1. **One trade = one campaign.** HVAC, roofing, and plumbing have different buyers, seasonality, urgency, and CPLs. Never blend them into a single campaign — you'll never be able to read the data or budget cleanly.
2. **Keep it flat.** Meta's delivery system (Advantage+ / broad targeting + machine learning) works best when you give it volume and few restrictions. Resist the urge to build 15 narrow ad sets. Fewer, better-fed ad sets exit the learning phase faster.
3. **Optimize for the real event, not the cheap event.** Optimize for *leads* (or better, *qualified leads* once you have volume), not link clicks or landing-page views. A $4 click that never converts is more expensive than a $25 lead.
4. **Decisions are made on cost-per-result and volume, not vanity metrics.** CTR and CPM are diagnostic, not decision criteria.

---

## 2. Recommended account structure

Use a **CBO / Advantage Campaign Budget** structure per trade. Budget lives at the campaign level and Meta distributes it to the best-performing ad set.

```
AD ACCOUNT
│
├── CAMPAIGN: HVAC — Leads
│   ├── Ad Set: Broad (25mi radius, 25–65+, Advantage+ audience)
│   ├── Ad Set: (optional) Storm/Emergency intent
│   └── Ad Set: (optional) Retargeting (site + engagers)
│
├── CAMPAIGN: Roofing — Leads
│   ├── Ad Set: Broad
│   ├── Ad Set: (optional) Storm-damage window
│   └── Ad Set: (optional) Retargeting
│
└── CAMPAIGN: Plumbing — Leads
    ├── Ad Set: Broad (emergency + planned)
    └── Ad Set: (optional) Retargeting
```

### Campaign level
- **Objective:** Leads.
- **Delivery:** Instant Form (on-Meta lead form) OR Conversion-to-site (Pixel/CAPI lead event). Start with Instant Forms for cheapest volume; layer in a site-conversion campaign once you can trust lead quality. Instant Forms are cheaper per lead but lower intent — expect to filter harder.
- **Budget:** CBO. Start each trade at **$40–$75/day** so you can realistically hit the ~50-conversions/week you need to exit learning at a $25 CPL. (At $25 CPL, $50/day ≈ 2 leads/day ≈ 14/week per ad set — you want the campaign as a whole clearing ~50/week.)

### Ad set level
- **Start broad, not narrow.** One primary "Broad" ad set: location + age/gender only, let Advantage+ audience expand. For trades, geography is the real targeting lever — homeowners in your service radius.
- **Location:** Service-area radius (typically 15–30 miles) around the shop, or specific ZIPs/counties you actually serve. Use "people living in this location," not "recently in."
- **Age:** 30–65+ for HVAC/roofing (homeowners); plumbing similar. Skew older = more homeowners.
- **Exclusions:** Exclude past leads / customer list to avoid re-paying for the same people.
- **Placements:** Advantage+ placements (automatic). Don't hand-pick unless data forces it.
- **Only add a second/third ad set when it tests a genuinely different lever** (emergency intent, storm season, retargeting) — not just a copy of Broad.

### Ad (creative) level
- **3–5 creatives per ad set** at launch. Enough for Meta to pick a winner; not so many that budget spreads too thin to learn.
- Mix formats: at least one static image, one short video/UGC-style, one before/after or offer-led image.
- Keep the offer explicit ("$79 tune-up," "Free roof inspection," "$0 dispatch fee") — offer beats cleverness in trades.

---

## 3. Naming convention

A consistent name is what lets you read a report at a glance and roll data up later. Use a pipe-delimited, left-to-right hierarchy so names sort predictably.

### Format

**Campaign:**
```
[Trade] | [Objective] | [Geo] | [Funnel] | [YYYY-MM]
```
Example: `HVAC | Leads | Tyler-TX | Cold | 2026-07`

**Ad Set:**
```
[Audience] | [GeoRadius] | [Age] | [Placement] | [v#]
```
Example: `Broad | 25mi | 30-65 | Adv+ | v1`
Example: `Retargeting | 25mi | 30-65 | Adv+ | v1`

**Ad / Creative:**
```
[Format] | [Angle] | [Offer] | [Hook] | [v#]
```
Example: `Video | Emergency | $79-Tuneup | BrokenAC-Summer | v1`
Example: `Static | BeforeAfter | Free-Inspect | StormDamage | v2`

### Rules for names
- **Never edit a live ad's creative in place** — that resets learning and pollutes the name. Duplicate, change, bump the `v#`.
- The `v#` at the end is the single most useful token: it tells you which iteration won.
- Keep tokens from a controlled vocabulary (Trade ∈ {HVAC, Roofing, Plumbing}; Format ∈ {Static, Video, Carousel, UGC}; Funnel ∈ {Cold, Retargeting}). Consistency > cleverness.
- Encode the **angle** (Emergency, Maintenance, Cost-Savings, Trust/Reviews, BeforeAfter, Seasonal) so you can later ask "which angle wins across all three trades?"

---

## 4. Kill vs. scale rules

**Nothing gets judged before it exits the learning phase.** Give an ad set/creative time to spend, then judge on cost-per-lead against the $25 target. Rough spend gate: don't kill on impulse before a creative has spent **~1.5–2× your target CPL (~$40–$50)** with zero leads, and don't declare a winner before **~50 conversions** at the ad-set level.

### The learning-phase guardrail
- Let each new ad set accumulate ~50 optimization events before major edits. Editing budget >20%, audience, or creative mid-learning restarts learning — avoid it.

### KILL a creative when:
- It has spent **~2× target CPL ($50) with 0 leads** → cut it. No signal.
- Its CPL is **> ~$40 (≈1.6× target)** after a meaningful sample (15–20+ leads) while sibling creatives sit at/under $25 → cut it; it's dragging the average.
- **CTR (link) < ~0.8%** *and* CPL above target → the hook is failing; kill.
- **Frequency > 2.5–3.0** in a 7-day window with **rising CPL / falling CTR** → creative fatigue. Kill or refresh (new hook/thumbnail), don't just wait.
- Lead **quality** is bad (junk names, no-answers, wrong service area) even if CPL looks great → kill or re-target. Cheap garbage leads are the classic Instant-Form trap.

### KEEP / iterate a creative when:
- CPL is **$25–$40** and volume is decent → keep running, but spin a `v#+1` variant testing a new hook/thumbnail to try to push it under target.
- Metrics are borderline but it's **still in learning / under the $50 spend gate** → let it finish; don't kill early.

### SCALE a creative/ad set when:
- CPL is **consistently ≤ $25** across **50+ leads** and several days (not one lucky day), with acceptable lead quality.
- **How to scale — slowly.** Raise budget **~20% every 2–3 days**. Big jumps (2×+) re-trigger learning and usually spike CPL.
- **Horizontal scaling (preferred for trades):**
  - Duplicate the winning creative into a **new geo** (next town/ZIP cluster).
  - Duplicate into a **retargeting** ad set.
  - Duplicate the winning *angle* across the **other two trades** (a "Free Inspection" hook that wins for roofing often wins for HVAC).
- Duplicate the winning ad set (fresh learning) rather than over-inflating one ad set past the point of diminishing returns.

### Portfolio-level rule
- **Always have ≥1 new creative in test** per active campaign. Winners fatigue; your job is to have the next winner already warming up. Target testing 3–5 new creatives per trade per week.

---

## 5. Quick reference table

| Situation | CPL vs. $25 target | Sample | Action |
|---|---|---|---|
| No leads yet | — | Spent > $50 | **Kill** |
| Way over target | > $40 | 15–20+ leads | **Kill** |
| Slightly over | $25–$40 | 15+ leads | **Iterate** (new hook, bump v#) |
| On target | ~$25 | 50+ leads | **Keep**, spin variant |
| Under target, quality good | ≤ $25 | 50+ leads, multi-day | **Scale** +20%/2–3 days, then duplicate horizontally |
| Frequency > 3, CPL rising | any | 7-day window | **Refresh creative** (fatigue) |
| Cheap but junk leads | ≤ $25 | any | **Kill / re-target** |

---

## 6. First-30-days sequence

1. **Week 1:** Launch one Broad ad set per trade, 3–5 creatives each, CBO at $40–$75/day. Don't touch anything — let learning run.
2. **Week 2:** First kill pass. Cut the zero-lead and >$40 CPL creatives. Refill each ad set with 2–3 new variants of what's working.
3. **Week 3:** Identify winners (≤$25 CPL, 50+ leads). Begin +20% scaling. Cross-pollinate winning angles across trades.
4. **Week 4:** Add retargeting ad sets, expand winning creatives into adjacent geos, and formalize the always-be-testing cadence (3–5 fresh creatives/trade/week).

**Guard the whole thing on lead quality, not just CPL.** A $22 CPL that closes at 5% is worse than a $30 CPL that closes at 20%. Once you have sales data, re-optimize toward cost-per-*booked-job*, not cost-per-form-fill.
