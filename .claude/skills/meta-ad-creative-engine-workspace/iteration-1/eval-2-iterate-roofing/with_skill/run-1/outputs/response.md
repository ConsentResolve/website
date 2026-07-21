# Roofing ad set — last week's read + next batch

**Mode 3: Iterate on Winners.** Target CPL (T) = **$30**. So the protocol thresholds are:
minimum spend before judging = 2×T = **$60**, kill line = 2.5×T = **$75 CPL**, and you can't
crown a winner on **<100 clicks** or when confidence intervals overlap.

## The numbers, filled in

Spend is reconstructed as leads × CPL (Meta didn't give it to you directly, but it's forced by the CPL):

| Creative | Angle | Format | Impr | Clicks | CTR | Leads | CPL | Spend | CVR (lead/click) | Freq |
|---|---|---|---|---|---|---|---|---|---|---|
| **A** | wasted-spend | 4:5 | 8,200 | 210 | 2.56% | 9 | **$31** | ~$279 | 4.29% | 2.1 |
| **B** | competitor-envy | 4:5 | 7,900 | 180 | 2.28% | 4 | $58 | ~$232 | 2.22% | 2.0 |
| **C** | ROI-math | square | 9,500 | 95 | 1.00% | 5 | **$27** | ~$135 | 5.26% | 3.4 |

All three have cleared the minimum-spend gate (each spent well past $60), so every one is fair to judge.

## Which is winning — and the honest caveat

**Short answer: Creative A (wasted-spend) is your winner to fund.** But the reason is about
*reliability*, not just the CPL number — so let me show the work, because the raw CPL column is
a little misleading.

**On CPL alone**, C ($27) edges A ($31) — both are at/under the $30 target, and B ($58) is nearly
2× target and the clear loser.

**But you cannot crown C**, for two reasons the protocol is explicit about:

1. **C has only 95 clicks — below the 100-click significance floor.** Its $27 CPL is riding on
   just **5 leads**. One lead either way swings it from $22 to $34. That's noise, not a verdict.

2. **C vs A confidence intervals overlap.** Rough 95% CIs on conversion rate:
   - A: 4.29% ± 2.74% → **[1.55%, 7.03%]** (over 210 clicks — tight, trustworthy)
   - C: 5.26% ± 4.49% → **[0.77%, 9.75%]** (over 95 clicks — huge band, unreliable)
   - The bands overlap heavily, so **C is not a statistically distinguishable winner over A.** Its
     apparent CPL edge is inside the margin of error.

**A, by contrast, is the trustworthy result:** 210 clicks, 9 leads, $31 CPL — essentially on
target with a real sample behind it. It's the creative you can bank on.

**B is a kill.** $58 CPL is under the 2.5×T ($75) hard-kill line, so it's not an *automatic* cut —
but it's nearly double target, it has the worst CVR (2.22%) of the three despite a healthy 2.28%
CTR and 180 clicks (a real sample), and its CI [0.07%, 4.38%] sits clearly below A's center. It's
not going to recover. **Cut it and move that budget to A.**

**Verdict:**
- **Scale: A (wasted-spend, 4:5)** — the reliable winner, on-target CPL, best-sampled. Duplicate
  it into a fresh ad set at higher budget. **Do not edit the live A** — that throws it back into
  learning and you lose the performance you earned.
- **Kill: B (competitor-envy)** — worst CPL and worst CVR, on a real sample.
- **Keep running a little longer: C (ROI-math)** — promising CPL but under-sampled *and* fatiguing
  (see below). Don't scale it on 95 clicks; don't kill it either. See the fatigue note.

## Fatigue flag on C — read this before you spend another dollar on it

**Creative C has frequency 3.4, past the frequency > 3 fatigue trigger.** That reframes C's whole
story. Its 1.00% CTR is *half* of A's and B's — and at freq 3.4 with 9,500 impressions on a small
audience, that low CTR is very likely fatigue, not a bad hook: the audience has seen it 3–4× and
stopped clicking. So C is simultaneously (a) under-sampled on clicks and (b) already worn out at
the impression level. You can't get a clean read on the ROI-math angle from this creative anymore —
it needs a **refresh**, not a scale decision. That's exactly why ROI-math earns a slot in the next
batch rather than a scale-up here.

A (freq 2.1) and B (freq 2.0) are both under the fatigue line — their numbers are clean reads.

---

## What to make next — the refresh/iterate batch

**The winning variable is the ANGLE: wasted-spend (A) is the reliable performer; competitor-envy
(B) is beaten; ROI-math (C) is unresolved (promising CPL, but fatigued and under-sampled).**
Mode 3 says the next batch varies **one dimension** and holds the winner constant. So the next
batch is **five wasted-spend executions**, varying *visual treatment and headline* — not five new
angles. That's how you climb on the angle that's working instead of restarting the test.

**One deliberate exception:** carry **one** fresh ROI-math execution into the batch. C's CPL was
genuinely good and the only reason we can't trust it is sample + fatigue — a clean, non-fatigued
ROI-math creative resolves that question for the price of one slot. Everything else stays
wasted-spend so the test still has a clear held-constant axis.

**Held constant:** roofing vertical, wasted-spend angle (4 of 5), **4:5 portrait format** (A's
format won; C's square also happens to be the fatigued/low-CTR one, so we default the batch to 4:5
— the format that's carrying the reliable winner). Landing destination unchanged.

**Varied:** headline + visual treatment (illustrated brand line-art vs photoreal roof/storm raster).

All copy below is run through `references/compliance.md` — no phone/dialer claims, no covert-tracking
language, no guarantees, no banned voice words (free/instant/etc.). The ~98% waste stat is framed as
*your own site's bounce*, which is clean.

| # | angle | format | visual | primary text (~125 chars) | headline (≤40) | description |
|---|---|---|---|---|---|---|
| 1 | wasted-spend | 4:5 | line-art brand | You paid for the storm traffic. ~98% of those roofing searchers left your site without a trace — and you never found out who. | Stop paying for roofers who ghost you | Turn your own site traffic into leads that are yours alone. $7 each. |
| 2 | wasted-spend | 4:5 | photoreal (roof + laptop) | After a hailstorm everyone Googles roofers. Most land on your site, don't call, and vanish. Those aren't gone — you just can't see them yet. | The visitors who didn't call aren't gone | Consent-first roofing leads. Name, email, what they need. Never resold. |
| 3 | wasted-spend | 4:5 | line-art brand | Your Google and LSA spend is buying clicks. Almost all of them bounce off your site silently. That's traffic you already paid for, leaking. | The leak in your roofing lead spend | Recover the opt-in visitors you're already paying to send to your site. |
| 4 | wasted-spend | 4:5 | photoreal (storm rooftop) | Storm season floods your site with roofing traffic. The ~98% who leave without calling are homeowners you paid to reach — and lost. | Storm traffic you paid for, walking away | Get back the ones who raised their hand. $7 a lead, flat. No contract. |
| 5 | ROI-math *(control)* | 4:5 | line-art brand | A booked roof replacement is worth thousands. A consent-first lead is $7. Do the math on your average ticket — you don't need many to win. | Do the roof math on a $7 lead | One booked job pays for a lot of leads. You supply the numbers. |

**Why this spread:** rows 1–4 pit the winning wasted-spend angle across the two visual tracks
(line-art vs photoreal) and four headline variations, so the *next* winner tells you cleanly
whether visual treatment or headline moves the needle *within* the angle that already works.
Row 5 is the single clean ROI-math read that resolves whether C's good CPL was real or a
fatigued mirage. Naming per protocol, e.g. `CR_leads_roofing_wastedspend_4x5_20260702`, with
`utm_content=wastedspend_4x5` mirrored into the URL so next week's read ties back to the exact
creative.

**Image generation (dry run):** each row would be produced with `scripts/recraft_ad.py` — line-art
rows on the locked brand `style_id 214dccd1-dca3-43e6-b005-c664e1b33338`, photoreal rows on Recraft
v4.1 raster with an explicit navy/mint/white brand palette prompt, headline + CTA placed via
Recraft's text-layout controls. No image API was called for this deliverable.

## Do-this-Monday checklist

1. **Scale A** — duplicate the wasted-spend 4:5 into a fresh, higher-budget ad set. Don't touch live A.
2. **Kill B** — competitor-envy is beaten on a real sample; reclaim its budget.
3. **Pause C for refresh** — it's fatigued (freq 3.4) and under-sampled; don't judge the ROI angle off it.
4. **Launch the 5-variant refresh batch above** — 4 wasted-spend executions + 1 clean ROI-math control.
5. **Re-read next week** once each new creative clears $60 spend and 100 clicks.
