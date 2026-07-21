# Meta lead-gen campaign structure — multi-trade, $25 target CPL

Here's the setup for the Consent Resolve contractor lead-gen campaign. Everything below is the Mode 2 testing protocol tuned to your **target CPL, T = $25**.

---

## 1. Campaign structure

**One campaign, Leads objective (OUTCOME_LEADS).** This matches the launcher at `worker/api/crm-meta-launch.js`. Don't spin up a campaign per trade — you want all trades competing under one optimization umbrella and one clean reporting view.

- **Objective:** Leads.
- **Ad sets split by trade vertical.** One ad set per trade (HVAC, roofing, plumbing…). Trades have different economics and audiences; mixing them in a single ad set hides which trade actually converts.
- **Placements:** Advantage+ (let Meta distribute across feed/stories/reels). Don't hand-pick placements unless one is clearly wasting spend.
- **Budget lives at the ad-set level** (mirrors the launcher's ad-set daily budget), so you can fund trades independently.
- **≥5 creatives per ad set.** Meta's auction needs options to optimize against, and single creatives fatigue fast. Never run an ad set on 1–2 ads.

### The "how many ad sets" gut-check (do this before launch)

Meta holds an ad set in **learning** until it gathers **~50 conversion events per week**. In learning, delivery is unstable and CPL is not trustworthy — you can't make decisions on it.

So the real constraint isn't "how many trades do I have," it's **can each ad set get ~50 leads/week?**

- At **$25 CPL**, 50 leads/week ≈ **~$175/day per ad set** (50 × $25 ÷ 7) to exit learning cleanly.
- If you can't feed every trade that fast, you have **too many ad sets.** Consolidate — merge the low-volume trades into one shared ad set — so at least one exits learning and gives you real numbers. **Two well-fed ad sets beat six starving ones stuck in learning.**

Practical starting shape for "a few trades": launch your 1–2 highest-volume trades as their own ad sets, and put the rest into a single "other trades" ad set until volume justifies splitting them out.

---

## 2. Naming convention

Apply the **same pattern to campaign, ad set, ad, and UTMs** — the consistent name is the join key that makes later "which variable won" analysis possible. Sloppy names = un-analyzable results.

```
CR_[objective]_[vertical]_[angle]_[format]_[YYYYMMDD]
```

| Level | Example |
|---|---|
| Campaign | `CR_leads_multitrade_20260702` |
| Ad set (per trade) | `CR_leads_hvac_20260702` |
| Ad (creative) | `CR_leads_hvac_wastedspend_4x5_20260702` |
| UTM | `utm_campaign=CR_leads_hvac_20260702&utm_content=wastedspend_4x5` |

**Mirror the ad name into `utm_content`** so the landing page (`/[trade]-leads/`) and the CRM tie every lead back to the exact creative that produced it. The campaign name goes in `utm_campaign`, the `[angle]_[format]` tail goes in `utm_content`. Without this, Mode 3 iteration is guesswork.

Format tokens: `4x5` (1080×1350, primary), `1x1` (square), `9x16` (story/reels).

---

## 3. Kill vs. scale rules (at T = $25)

Two dollar thresholds do all the work. Let **T = $25**.

| Threshold | Value at $25 CPL | Meaning |
|---|---|---|
| Minimum spend before judging a creative | **2 × T = $50** | Below this, the creative hasn't had enough impressions to show its true CPL. Don't touch it. |
| Kill line | **CPL > 2.5 × T = $62.50** | After it's passed $50 spend, a creative running above this isn't going to recover. Cut it. |

**The rules:**

1. **Wait until a creative has spent $50** before you judge it. You cannot call a creative dead on a few dollars of spend — that's noise, not a verdict.
2. **Kill** any creative that has spent ≥ $50 **and** is running a **CPL above $62.50**. Cutting it lets budget flow to the survivors.
3. **Scale winners by duplication.** Copy the winning creative/ad set into a **new** ad set with a higher budget. **Never edit a live winner** — changing its budget, creative, or audience throws the ad set back into learning and you lose the performance you earned. Duplicate, don't edit.
4. **Refresh** (make new creative) when a winner fatigues — see below.

### Don't crown a winner on noise

Before you call anything a winner and scale it, both must be true:

- **≥ 100 clicks** on each creative you're comparing. Below that, differences are noise — a creative "ahead" on 30 clicks is telling you nothing.
- **Confidence intervals don't overlap.** Rough 95% margin on a conversion rate `p` over `n` clicks: `1.96 × sqrt(p·(1−p)/n)`. Only call a winner if `A.rate − A.margin > B.rate + B.margin`. If the bands overlap, it's a tie — keep both running.

And judge the **money decision on CPL, not CTR.** A high-CTR creative that doesn't convert is a thumb-stop, not a winner. Use CTR/hook-rate to *diagnose why* something worked; use CPL to decide *what to fund.*

### Fatigue → refresh (not a bid change)

Flag a creative for a refresh batch when **either** fires:

- **Frequency > 3** (the average person has seen it 3+ times), or
- **CTR has dropped ≥ 25% from that creative's own peak.**

Fatigue is an audience problem, not a bidding problem. The fix is new creative varying the winning dimension, not a bid tweak.

---

## One-glance decision table (T = $25)

| Situation | Do |
|---|---|
| Creative spent < $50 | Wait — too early to judge |
| Spent ≥ $50, CPL > $62.50 | **Kill** |
| Spent ≥ $50, CPL ≤ $25, ≥100 clicks, CIs separate | **Scale** (duplicate into new ad set) |
| "Winner" but < 100 clicks or CIs overlap | Keep running — not significant |
| Ad set can't hit ~50 leads/week (~$175/day) | Consolidate ad sets |
| Frequency > 3 or CTR down ≥25% from peak | Refresh creative |
| Want to change a live winner | Don't — duplicate instead |

---

## TL;DR

- **1 campaign** (Leads) → **ad sets by trade** → **≥5 creatives each**, Advantage+ placements, ad-set-level budget.
- Only split a trade into its own ad set if it can pull **~50 leads/week (~$175/day at $25 CPL)**; otherwise consolidate.
- Name everything `CR_leads_[trade]_[angle]_[format]_[date]` and mirror it into `utm_content`.
- **Judge nothing under $50 spend. Kill above $62.50 CPL. Scale (by duplicating) only with ≥100 clicks and separated confidence intervals. Refresh at frequency >3 or CTR −25% from peak. Never edit a live winner.**
