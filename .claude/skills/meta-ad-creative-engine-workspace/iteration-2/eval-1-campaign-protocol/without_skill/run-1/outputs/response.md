# Meta Lead-Gen Campaign Protocol — Home-Service Trades (HVAC / Roofing / Plumbing)

Target CPL: **~$25**

This is a complete build-and-operate playbook: account structure, ad-set setup, a naming convention you can sort/filter on, and hard rules for when to kill a creative versus scale it.

---

## 1. Account Structure

### The core decision: one trade per campaign

Do **not** blend HVAC, roofing, and plumbing into a single campaign. Each trade has different seasonality, lead value, buyer intent, and creative language. Meta's optimizer also can't learn a clean pattern if you feed it three unrelated audiences and offers.

**Run three separate campaigns**, one per trade. If budget is tight (< ~$50/day total), start with the trade that has the best margin and shortest sales cycle — usually **HVAC** (repair/replace urgency + high ticket) — prove the funnel, then clone the structure to roofing and plumbing.

### Campaign objective

Use the **Leads** objective. Then choose your conversion location:

- **Instant Forms (on-Meta lead forms)** — cheapest CPL, lowest friction, best for cold traffic and getting to volume fast. Lead quality is lower, so gate it (see below). **Start here** to hit a $25 CPL quickly and get learning data.
- **Website / Landing page** — higher CPL but higher intent and better close rate. Move here once you have a proven landing page and the pixel has enough conversion volume.

Recommendation: **launch on Instant Forms with a higher-intent form** (more on this in §6), migrate top trades to landing-page leads once CPL is stable and you want lead-quality lift.

### Budget: use Advantage Campaign Budget (CBO), mostly

- **CBO (campaign-level budget)** once you have 3+ ad sets and want Meta to shift spend to the winner. This is the default for a mature account.
- **ABO (ad-set-level budget)** during the initial testing phase when you want to *force* equal spend across audiences to get a clean read on each. Use ABO for the first ~2 weeks, then consolidate to CBO.

### The consolidation principle

Meta rewards volume and consolidation. Fewer, better-funded ad sets beat many starved ones. Each ad set needs enough budget to exit the **learning phase**: ~**50 optimization events (leads) in a 7-day rolling window**. At a $25 CPL that's ~$1,250/ad set/week (~$180/day) to fully exit learning.

Realistically at a small budget you won't hit 50 leads/week per ad set right away — so **run fewer ad sets** (1–3 per campaign) and pool budget rather than spreading thin. Starving 6 ad sets guarantees none of them learn.

---

## 2. Ad-Set Structure

Inside each trade campaign, structure ad sets by **audience**, not by creative. (Creatives are tested *within* the ad set.)

### Recommended ad sets per campaign (in priority order)

1. **Broad / Advantage+ audience** — no interest targeting, just geo + age + gender. Let Meta's algorithm find buyers. This is now the **highest-performing setup for lead-gen** in most home-service accounts. Make this your primary ad set.
2. **Geo-radius intent** — tight radius (see below) with no interests, separated only so you can control budget/bidding around your best service area.
3. **(Optional) Interest/behavior stack** — homeowners, "home improvement," "recently moved," household income, etc. Only add this if broad plateaus; broad usually wins.

Don't over-segment. Two well-funded ad sets (Broad + Geo) outperform six narrow ones.

### Targeting settings

- **Geo:** Radius around each service area — **10–20 miles** for dense metro, up to **25–30 miles** rural. Use "people living in this location" (not "recently in"). Exclude areas you won't drive to.
- **Age:** 30–65+ (homeowners skew older; younger renters waste spend). Roofing/HVAC replace buyers skew 35–65.
- **Gender:** All, unless data shows a skew.
- **Detailed targeting:** Leave **empty** on the broad ad set. Turn **ON** "Advantage detailed targeting" expansion.
- **Placements:** **Advantage+ Placements (automatic)**. Don't hand-pick — let Meta optimize. Facebook Feed + Stories + Reels typically deliver the cheapest home-service leads.

### Bidding

- Start on **Highest Volume (lowest cost)** — no bid cap. Let it find your natural CPL.
- Only add a **Cost-per-result goal** (soft cap around $25–30) once you have stable data and want to protect CPL as you scale. Setting a cap too early strangles delivery and prevents learning.

---

## 3. Naming Convention

A good name lets you read performance at a glance and filter in Ads Manager without opening anything. Use a delimiter Meta won't choke on (` | ` or `_`). Keep field order consistent across all three levels.

### Campaign

```
[Trade]_[Objective]_[Geo]_[ConvLocation]_[YYYYMM]
```

Example:
```
HVAC_Leads_Waco_InstantForm_202607
ROOF_Leads_Waco_LandingPage_202607
PLUMB_Leads_Temple_InstantForm_202607
```

### Ad Set

```
[Audience]_[GeoRadius]_[Age]_[BudgetType]
```

Examples:
```
Broad_20mi_35-65_CBO
GeoRadius_15mi_30-65_ABO
Interest-Homeowner_20mi_35-65_CBO
```

### Ad / Creative

```
[Format]_[Angle]_[Hook]_[v##]
```

- **Format:** IMG, VID, CAR (carousel), UGC
- **Angle:** the offer/message theme (Offer, Urgency, Trust, BeforeAfter, Financing, Seasonal)
- **Hook:** 2–3 word shorthand of the opening line/visual
- **v##:** iteration number

Examples:
```
VID_Urgency_ACdown-summer_v01
IMG_Offer_79dollar-tuneup_v03
UGC_Trust_customer-review_v02
CAR_BeforeAfter_roof-replace_v01
```

### Why this works

- Filter Ads Manager by `HVAC_` to see one trade, or search `_Urgency_` across everything to compare that angle.
- The `v##` tells you instantly which iteration is live so you never confuse a winner with a retired variant.
- `YYYYMM` on the campaign lets you archive by cohort and spot seasonal patterns year over year.

**Rule:** the name is set at creation and never changed after spend starts (renaming resets nothing but breaks your reporting history). Spin up a `v02` instead of editing a live ad.

---

## 4. Kill vs. Scale Rules

Set your **statistical floor first**: no decision on a creative until it has spent **at least 1.5–2× your target CPL with zero leads**, or accumulated enough data to trust the number. At $25 CPL, that's roughly **$40–50 spend and/or ~1,000 impressions** as the minimum before you judge.

### KILL a creative when:

| Signal | Threshold |
|---|---|
| **No leads at spend floor** | Spent **≥ $50 (2× CPL) with 0 leads** → kill |
| **CPL way over target** | CPL **> $40 (1.6× target)** after ≥ 3–5 leads → kill |
| **CTR dead** | Link CTR **< 0.8%** after 1,000+ impressions (creative isn't earning attention) → kill |
| **Fatigue** | Frequency **> 2.5–3.0** AND CPL rising 30%+ week-over-week → kill/refresh |
| **Cost per lead climbing** | 3 consecutive days of rising CPL on a previously-good ad → refresh creative |

Kill fast. A creative bleeding money at 0 leads past 2× CPL is not going to "turn around" — that's the sunk-cost trap.

### KEEP / LET RIDE when:

- CPL is between **$18–$32** (a reasonable band around your $25 target). Don't touch a working ad — no edits, no budget jumps.
- It has leads but hasn't hit the spend floor yet → give it more data.

### SCALE a creative when:

| Signal | Threshold |
|---|---|
| **CPL beating target** | CPL **≤ $20 (20%+ under target)** across **≥ 15–20 leads** (enough to trust) |
| **Stable, not a fluke** | Held that CPL for **3+ consecutive days** |
| **Healthy frequency** | Frequency still **< 2.0** (room to spend more before fatigue) |

**How to scale (don't break learning):**
- Raise budget **20–30% every 3–4 days** — *not* a 2× overnight jump, which throws the ad set back into learning phase and spikes CPL.
- Alternatively, **duplicate the winning ad into a new/broader ad set** (or new geo) and fund that, leaving the original untouched. This preserves the proven performer while you expand.
- When one creative clearly wins in an ABO ad set, **consolidate budget into it via CBO** and let Meta press the advantage.

### Lead-quality gate (critical for Instant Forms)

CPL alone is a vanity metric if the leads don't close. Track **Cost per *Qualified* Lead** — a lead that's a real homeowner in your service area with a real job. If a $18 CPL creative produces junk (renters, out-of-area, tire-kickers) and a $28 creative produces booked appointments, **the $28 creative wins.** Reconcile Ads Manager against your CRM weekly and judge on qualified CPL, not raw CPL.

---

## 5. Creative Testing Cadence

- Launch each ad set with **3–4 creatives** across **different angles** (e.g., Offer, Urgency, Trust). Don't test 4 versions of the same idea — test 4 *ideas*.
- Let Meta pick the winner within the ad set (don't manually pause on day 1).
- **Refresh 1–2 new creatives per week** per active ad set to fight fatigue. Home-service audiences in a fixed geo are small and burn out fast — frequency climbs quickly, so a steady creative pipeline is non-negotiable.
- Keep a **"proven winners" swipe file** — retired top performers you can re-launch as `v02` seasonally.

---

## 6. Trade-Specific Notes

**HVAC** — Highest urgency + seasonality. Push seasonal angles hard: "AC out this summer?" / "Beat the summer rush — tune-up now." Financing angles convert on replacements. Instant Form + a $XX tune-up offer gets cheap top-of-funnel leads. Expect your **lowest CPL** here.

**Roofing** — High ticket, longer consideration, storm/insurance-driven. **Before/After** and **storm-damage inspection** angles win. Lead quality matters more (many "just curious" leads), so use qualifying form questions ("Do you own the home?", "Age of roof?"). CPL runs **higher than HVAC** — budget for $25–40 and judge on qualified CPL.

**Plumbing** — Split between emergency (drain/leak, high intent, converts instantly) and planned (repipe, water heater). Emergency angles get the cheapest, highest-close leads. "Same-day service" + phone-forward CTAs work well. Consider a **click-to-call** or website destination for emergencies since form-fills lose urgent buyers.

### Instant Form quality tuning
Use the **"Higher intent" form type** (adds a review step) and **1–2 custom qualifying questions** (homeowner y/n, zip, service needed). This raises CPL slightly but strips out the junk that torpedoes your close rate — net win on cost-per-qualified-lead.

---

## 7. Quick-Start Checklist

1. One **Leads** campaign per trade, named `[Trade]_Leads_[Geo]_InstantForm_[YYYYMM]`.
2. **ABO for 2 weeks** to get clean per-audience reads, then consolidate to **CBO**.
3. **1–2 ad sets**: `Broad_20mi_35-65` (primary) + optional `GeoRadius_15mi`. Advantage+ placements. No interest targeting on broad.
4. **3–4 creatives per ad set**, different angles, named `[Format]_[Angle]_[Hook]_[v##]`.
5. **Highest Volume** bidding, no cap, until CPL stabilizes near $25.
6. **Higher-intent Instant Form** + qualifying questions.
7. Judgment floor: **$50 spend / 1,000 impressions** before killing.
8. **Kill** at $50/0 leads or CPL > $40; **scale** at CPL ≤ $20 over 15+ leads by +20–30% every 3–4 days.
9. Refresh **1–2 creatives/week** per ad set; watch frequency (refresh at 2.5–3.0).
10. Reconcile against CRM weekly — optimize on **qualified CPL**, not raw CPL.
