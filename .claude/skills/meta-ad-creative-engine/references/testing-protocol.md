# Campaign testing protocol (Mode 2)

The discipline here is what turns "we ran some ads" into "we know what works." The rules exist to
stop two classic mistakes: killing a creative before it's had a fair shot, and crowning a winner
on noise. CPL target is **supplied by the user** (still being dialed in) — everything below is
expressed as *multiples* of that target so the protocol works whatever the number turns out to be.

## Campaign structure

- **1 campaign**, objective **Leads** (OUTCOME_LEADS). This matches the launcher at
  `worker/api/crm-meta-launch.js`.
- **Ad sets split by trade vertical** (HVAC, roofing, plumbing…). Trades have different economics
  and audiences; mixing them in one ad set hides which trade actually converts.
- **Advantage+ placements** — let Meta distribute across feed/stories/reels; don't hand-pick
  unless a placement is clearly wasting spend.
- **≥5 creatives per ad set** — Meta needs options to optimize; this is the same reason Mode 1
  never ships 1–2.
- **Budget** at the ad-set level (mirrors the launcher's ad-set daily budget).

## Naming convention (apply everywhere)

`CR_[objective]_[vertical]_[angle]_[format]_[YYYYMMDD]`

- Campaign: `CR_leads_hvac_20260702`
- Ad set: `CR_leads_hvac_[vertical]_20260702`
- Ad: `CR_leads_hvac_wastedspend_4x5_20260702`
- **UTM**: mirror the ad name into `utm_content` so landing-page/CRM analytics tie back to the
  exact creative. `utm_campaign=CR_leads_hvac_20260702&utm_content=wastedspend_4x5`.

Consistent names are not bureaucracy — they're the join key that makes Mode 3's "which variable
won" analysis possible. Sloppy names = un-analyzable results.

## Learning phase

Meta holds an ad set in **learning** until it gathers ~**50 conversion events in a week**. In
learning, delivery is unstable and CPL is not trustworthy. Implication:

- If your total lead volume can't give *each* ad set ~50 events/week, you have **too many ad
  sets**. Consolidate — merge low-volume verticals into one ad set — so at least one exits
  learning and gives you real numbers. Two well-fed ad sets beat six starving ones.
- Don't make judgment calls on an ad set still in learning. Note "still in learning" and wait.

## Kill / scale rules

Let **T = the user's target CPL**.

1. **Minimum spend before judging a creative:** **2 × T**. You cannot call a creative dead on a
   few dollars — it hasn't had enough impressions to show its true CPL. Wait for it to spend at
   least 2×T before deciding anything.
2. **Kill** a creative whose **CPL > 2.5 × T** *after* it has passed the minimum-spend threshold.
   It's not going to recover; cut it so budget flows to survivors.
3. **Scale winners by duplication.** Copy the winning creative/ad set into a **new** ad set with
   higher budget. **Never edit a live winner** (changing budget/creative/audience on a live ad set
   throws it back into learning and you lose the performance you earned).
4. **Refresh** (loop to Mode 1) when a winner fatigues — see the significance + fatigue section.

## Statistical significance — don't crown noise

A creative that's "winning" on 30 clicks is telling you nothing. Before declaring a winner:

- **Minimum 100 clicks** on each creative being compared. Below that, differences are noise.
- **Non-overlapping confidence intervals.** Compute a rough 95% CI on each creative's conversion
  rate and only call a winner if the intervals don't overlap. Quick check for a rate `p` over `n`
  clicks: the 95% margin ≈ `1.96 × sqrt(p·(1−p)/n)`. If `A.rate − A.margin > B.rate + B.margin`,
  A genuinely leads; if the bands overlap, it's a tie — keep running or call it even.
- **Prefer CPL over CTR for the *money* decision.** A high-CTR creative that doesn't convert is a
  thumb-stop, not a winner. Use CTR/hook-rate to diagnose *why* (creative grabbed attention), CPL
  to decide *what to fund*.

Worked example: Creative A = 6 leads / 140 clicks (4.3%), B = 3 / 120 (2.5%).
A.margin ≈ 1.96·sqrt(.043·.957/140) ≈ 3.4% → A ∈ [0.9%, 7.7%]; B ∈ [−0.3%, 5.3%]. Intervals
overlap → **not** a significant winner yet despite A looking ~2× better. Keep both running.

## Fatigue triggers (hand-off to Mode 3)

Flag a creative for refresh when either fires:
- **Frequency > 3** (the average person has seen it 3+ times), or
- **CTR has dropped ≥ 25% from that creative's own peak.**

Fatigue is an audience problem, not a bidding problem — the fix is new creative (Mode 1 refresh
batch varying the winning dimension), not a bid tweak.

## The one-glance decision table

| Situation | Do |
|---|---|
| Creative spent < 2×T | Wait — too early to judge |
| Spent ≥ 2×T, CPL > 2.5×T | Kill |
| Spent ≥ 2×T, CPL ≤ T, ≥100 clicks, CIs separate | Scale (duplicate into new ad set) |
| "Winner" but <100 clicks or CIs overlap | Keep running — not significant |
| Ad set can't hit ~50 events/wk | Consolidate ad sets |
| Frequency > 3 or CTR down ≥25% from peak | Refresh (Mode 1) |
| Want to change a live winner | Don't — duplicate instead |
