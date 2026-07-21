# Meta Lead-Gen Campaign Setup — Structure, Naming & Kill/Scale Rules

This is the Mode 2 (Testing Protocol) setup for Consent Resolve's contractor lead-gen. Your **target CPL is $25**, so throughout I've plugged **T = $25** into the multiple-based rules. Everything here mirrors the launcher at `worker/api/crm-meta-launch.js` (OUTCOME_LEADS, US, ad-set-level budget).

---

## 1. Campaign structure

Keep it to **one campaign** and let the ad sets do the segmentation.

- **1 campaign**, objective **Leads (OUTCOME_LEADS)**. Don't spin up a campaign per trade — that fragments budget and makes cross-trade comparison impossible.
- **Ad sets split by trade vertical** — one ad set per trade (HVAC, roofing, plumbing…). Trades have different economics, buying cycles, and audiences; mixing them in one ad set hides which trade actually converts. This is your primary segmentation axis.
- **Advantage+ placements** — let Meta distribute across feed / stories / reels. Don't hand-pick placements unless one is clearly wasting spend.
- **≥5 creatives per ad set.** Meta's auction needs options to optimize against, and single creatives fatigue fast. Advertisers running 5+ variants see meaningfully lower CPA than those running 1–2. Never ship an ad set with 1–2 ads.
- **Budget at the ad-set level** (matches the launcher's ad-set daily budget), so you can fund the trades that convert and starve the ones that don't.

### The learning-phase constraint — this decides how many ad sets you can afford

Meta holds each ad set in **learning** until it gathers **~50 conversion events in a week**. In learning, delivery is unstable and CPL is not trustworthy — you cannot make kill/scale calls on an ad set still learning.

The math that matters for you: at a **$25 CPL**, 50 leads/week ≈ **$1,250/week (~$180/day) per ad set** just to exit learning. So:

- If your total budget can't feed *each* trade ad set ~50 events/week, you have **too many ad sets**. **Consolidate** — merge the low-volume trades into a single "other trades" ad set — so at least one or two exit learning and give you real numbers.
- **Two well-fed ad sets beat six starving ones** stuck in learning forever.
- Practical starting point for "a few trades": launch your **1–2 highest-volume trades as their own ad sets**, and roll the rest into one combined ad set until volume justifies splitting them out. Note any ad set as "still in learning" and don't judge it until it exits.

---

## 2. Naming convention

Apply this **everywhere** — campaign, ad set, ad, and UTMs. Consistent names aren't bureaucracy; they're the join key that lets you later prove *which variable won* (angle vs format vs visual). Sloppy names = un-analyzable results.

```
CR_[objective]_[vertical]_[angle]_[format]_[YYYYMMDD]
```

| Level | Pattern | Example |
|---|---|---|
| Campaign | `CR_[objective]_[YYYYMMDD]` | `CR_leads_20260702` |
| Ad set | `CR_leads_[vertical]_[YYYYMMDD]` | `CR_leads_hvac_20260702` |
| Ad | `CR_leads_[vertical]_[angle]_[format]_[YYYYMMDD]` | `CR_leads_hvac_wastedspend_4x5_20260702` |

**UTMs — mirror the ad name** so landing-page and CRM analytics tie back to the exact creative:

```
utm_campaign=CR_leads_hvac_20260702&utm_content=wastedspend_4x5
```

Conventions to keep tidy:
- `objective` = `leads` (always, for this campaign).
- `vertical` = short trade slug: `hvac`, `roofing`, `plumbing`, etc. Use one slug for a consolidated ad set (e.g. `othertrades`).
- `angle` = the concept slug from the angle library: `wastedspend`, `roimath`, `trust`, `exclusive`, `speed`, etc.
- `format` = aspect ratio: `4x5` (primary), `1x1` (square), `9x16` (story/reels).
- `date` = launch date `YYYYMMDD`.

---

## 3. Kill vs. scale rules (T = $25)

Two mistakes these rules exist to stop: **killing a creative before it's had a fair shot**, and **crowning a winner on noise**. Both cost you money.

### Step 1 — Give every creative a minimum spend before you judge it

- **Minimum spend before any decision = 2 × T = $50.** You cannot call a creative dead on a few dollars — it hasn't served enough impressions to reveal its true CPL. If a creative has spent **< $50**, the only correct action is **wait**.

### Step 2 — Kill the losers

- **Kill** any creative whose **CPL > 2.5 × T = $62.50**, *once it has passed the $50 minimum spend*. It's not going to recover; cut it so budget flows to the survivors.

### Step 3 — Scale the winners (by duplication, never by editing)

A creative qualifies as a fundable winner when **all** of these hold:
- spent **≥ $50** (past minimum), **and**
- **CPL ≤ T ($25)** — ideally at or under target, **and**
- **≥ 100 clicks**, **and**
- its confidence interval **separates** from the runner-up (see significance below).

Then:
- **Scale by duplication:** copy the winning creative/ad set into a **new** ad set with a higher budget.
- **Never edit a live winner.** Changing budget, creative, or audience on a live ad set throws it back into **learning** and you lose the performance you earned. Duplicate instead.

### Step 4 — Statistical significance (don't crown noise)

A creative "winning" on 30 clicks is telling you nothing. Before declaring a winner:

- **Minimum 100 clicks** on each creative you're comparing. Below that, differences are noise.
- **Non-overlapping 95% confidence intervals.** Quick check for a conversion rate `p` over `n` clicks: margin ≈ `1.96 × sqrt(p·(1−p)/n)`. Call A the winner only if `A.rate − A.margin > B.rate + B.margin`. If the bands overlap, it's a tie — keep running.
- **Decide on CPL, not CTR.** A high-CTR creative that doesn't convert is a thumb-stop, not a winner. Use CTR / hook-rate to *diagnose why* something works; use **CPL to decide what to fund**.

> Worked example: A = 6 leads / 140 clicks (4.3%), B = 3 / 120 (2.5%). A's margin ≈ 3.4% → A ∈ [0.9%, 7.7%]; B ∈ [−0.3%, 5.3%]. The intervals overlap → **not** a significant winner yet, even though A looks ~2× better. Keep both running.

### Step 5 — Refresh when a winner fatigues

Even a winner burns out. Flag it for a refresh (a new creative batch — Mode 1 — varying the winning dimension) when **either** fires:
- **Frequency > 3** (the average person has seen it 3+ times), or
- **CTR has dropped ≥ 25% from that creative's own peak.**

Fatigue is an *audience* problem, not a bidding problem — the fix is new creative, **not** a bid tweak.

---

## One-glance decision table (T = $25)

| Situation | Do |
|---|---|
| Creative spent < **$50** (2×T) | **Wait** — too early to judge |
| Spent ≥ $50, **CPL > $62.50** (2.5×T) | **Kill** |
| Spent ≥ $50, **CPL ≤ $25**, ≥100 clicks, CIs separate | **Scale** — duplicate into a new ad set at higher budget |
| "Winner" but <100 clicks or CIs overlap | **Keep running** — not significant |
| Ad set can't hit ~50 events/wk (~$1,250/wk at $25 CPL) | **Consolidate** ad sets |
| Frequency > 3 or CTR down ≥25% from peak | **Refresh** (new creative batch) |
| Want to change a live winner | **Don't** — duplicate instead |

---

## Recommended launch sequence

1. **Campaign:** `CR_leads_20260702`, objective Leads, Advantage+ placements.
2. **Ad sets:** one per high-volume trade (e.g. `CR_leads_hvac_20260702`, `CR_leads_roofing_20260702`), plus a consolidated `CR_leads_othertrades_20260702` if any trade can't sustain ~$180/day. Budget at ad-set level.
3. **Creatives:** ≥5 distinct concepts (different *angles*, not recolors) per ad set, named `CR_leads_[vertical]_[angle]_[format]_[YYYYMMDD]`, UTMs mirrored into `utm_content`. If you need these built, that's a Mode 1 batch — just say the word.
4. **Hold** all kill/scale calls until each creative clears the $50 minimum-spend gate and each ad set exits learning.
5. **Once you have numbers,** paste them back (CTR, CPL, spend, frequency) and I'll run the Mode 3 read: isolate the winning variable and spec the next batch.

---

*Compliance note for whoever writes the creative:* every line of ad copy for these trades must pass the never-say list — no phone-number delivery, no covert-tracking/"spying" language, no income guarantees. We deliver **name + email + intent**, follow-up is by email, and the story is always **consent-first** ("visitors who opt in / raise their hand"), never surveillance.
