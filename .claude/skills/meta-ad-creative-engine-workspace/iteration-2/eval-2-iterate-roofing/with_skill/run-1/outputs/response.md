# Roofing ad set — read the results & what to make next (Mode 3)

**Bottom line:** Creative **A (wasted-spend, 4:5)** is your winner — it's the only creative that
hit target CPL on a trustworthy sample. **Kill B.** Don't crown **C** yet: its CPL looks great but
the sample is too small and it's fatigued — resolve it in the next batch. Then **refresh by
varying one dimension** (wasted-spend executions), and **scale A by duplication**.

Target CPL **T = $30**. Minimum spend to judge = **2×T = $60**. Kill line = **CPL > 2.5×T = $75**.

---

## 1. The numbers, straightened out

| # | Angle / format | Impr | Clicks | CTR | Leads | CVR | CPL | Spend¹ | Freq | 95% CI on CVR |
|---|---|---|---|---|---|---|---|---|---|---|
| **A** | wasted-spend, 4:5 | 8,200 | 210 | **2.56%** | 9 | **4.29%** | **$31** | ~$279 | 2.1 | [1.55%, 7.03%] |
| B | competitor-envy, 4:5 | 7,900 | 180 | 2.28% | 4 | 2.22% | **$58** | ~$232 | 2.0 | [0.07%, 4.38%] |
| C | ROI-math, square | 9,500 | 95 | **1.00%** | 5 | 5.26% | **$27** | ~$135 | **3.4** | [0.77%, 9.75%] |

¹ Spend is inferred (CPL × leads); you gave CPL + leads, not raw spend. All three cleared the
$60 minimum-spend floor, so every one is fair to judge.

---

## 2. What each creative is telling you

**A — wasted-spend, 4:5 → the winner. Scale it.**
$31 CPL is essentially dead-on target ($30) on a real 210-click sample (well past the 100-click
significance floor). Healthy 2.56% CTR, frequency 2.1 (no fatigue). This is the reliable roofing
argument. **Action: scale by duplicating A into a fresh, higher-budget ad set. Do NOT edit live A**
— changing budget/creative/audience on the live ad set throws it back into learning and you lose
what it earned.

**B — competitor-envy, 4:5 → kill it.**
$58 CPL is ~1.9×T, and its CVR (2.22%) is the worst of the three on a real 180-click sample. Its
CTR (2.28%) is fine — people click — but they don't convert. That's a thumb-stop, not a winner.
It's not quite over the hard 2.5×T = $75 kill line, but it's the clear loser on a trustworthy
sample with no path to target. **Action: kill B; move its budget to A (and the refresh below).**

**C — ROI-math, square → tempting, but NOT a proven winner. Do not scale.**
$27 CPL is the lowest number on the page and it's easy to want to crown it — but two protocol
flags say "not yet":
- **Under-sampled:** 95 clicks is *below the 100-click floor*. Differences under that are noise.
- **CIs overlap:** C's CVR CI [0.77%, 9.75%] overlaps A's [1.55%, 7.03%]. A does not lead C to
  significance and C does not lead A — statistically it's a tie, so the lower CPL isn't real yet.
- **Fatigued & weak hook:** frequency **3.4 (> 3)** and CTR **1.00%** — under half of A/B. The
  square format is showing the same people too often and few are clicking. That low CTR is
  probably *suppressing* volume, which is why it's stuck under 100 clicks.

So C's cheap CPL is unresolved — plausibly real, but masked by a tiny, fatigued sample. **Action:
re-run a fresh, non-fatigued ROI-math control to actually resolve it — don't scale it on this
data.**

**One-glance decisions:**

| Creative | Verdict | Why |
|---|---|---|
| A | **Scale** (duplicate into new ad set) | On target, 210 clicks, no fatigue |
| B | **Kill** | ~2×T CPL, worst CVR, real sample |
| C | **Keep testing, don't scale** | <100 clicks, CIs overlap A, freq 3.4 fatigue |

---

## 3. What to make next — the refresh batch (Mode 1, varying ONE dimension)

The winning *variable* is the **wasted-spend angle** in **4:5**. Mode 3 says: hold the winner
constant and vary one axis. So the next batch is **wasted-spend executions** varying **visual
treatment (line-art vs photoreal) + on-image headline**, all 4:5 — *not* five brand-new angles.
Plus one clean, non-fatigued **ROI-math** control at 4:5 to settle C (fresh format kills the
square's fatigue and low CTR).

All copy below is roofing-tuned and run past `compliance.md`: no phone/dialer, no covert-tracking
language, no guarantees, no banned words (free/instant/etc.). "~98% leave without a trace" is
framed as *your own site's bounce* — clean.

| # | Angle | Format | Visual | Primary text (≤125 first) | Headline (≤40) | Description |
|---|---|---|---|---|---|---|
| R1 | wasted-spend | 4:5 | line-art (brand) | After a storm everyone Googles roofers. ~98% who land on your site leave without a trace. Get them back. | Stop paying for traffic that ghosts | Opt-in roofing leads, $7 each, yours alone. |
| R2 | wasted-spend | 4:5 | photoreal (roof, golden hour) | You already paid for those clicks. Most of the homeowners who hit your site just leave — you never find out who. | The clicks you bought, ghosting you | Their name, email, and what they need — $7 a lead. |
| R3 | wasted-spend | 4:5 | line-art (brand) | The homeowners who visited your roofing site and didn't call aren't gone. You just can't see them yet. | 98% leave without a trace | Turn opt-in visitors into exclusive leads. |
| R4 | wasted-spend | 4:5 | photoreal (contractor at laptop) | Storm season traffic is expensive. When they bounce, that spend evaporates — unless you can follow up by email. | Get storm traffic back by email | Consent-first, never resold. $7 a lead, flat. |
| R5 | ROI-math (control) | 4:5 | line-art (brand) | A booked roof is worth thousands. A lead is $7. Do the math on your average ticket — you don't need many to win. | One booked roof pays for a lot | Opt-in leads, yours alone, no contract. |

**Why this spread:** R1–R4 vary *visual treatment* (line-art × 2 vs photoreal × 2) and *headline*
on the proven wasted-spend angle — so the winner tells you cleanly whether photoreal or line-art
moves roofers, with the angle held fixed. R5 is a fresh 4:5 ROI-math execution to re-test C
without the square's fatigue and low CTR. That's a real one-axis test, not five paint jobs.

Naming (per protocol): `CR_leads_roofing_wastedspend_4x5_20260702` etc.; mirror into
`utm_content=wastedspend_4x5`.

---

## 4. Recraft calls (DRY — not executed)

Per `references/recraft-api.md`. `--track brand` = locked line-art style_id
`214dccd1-dca3-43e6-b005-c664e1b33338` (SVG→PNG); `--track raster` = photoreal v4.1.
**These are printed for review only; no image API was called and no campaign was created.**

```bash
# R1 — wasted-spend, line-art, 4:5
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "Line-art diagram: a roof/house with many homeowner figures walking away, only a few raising a hand; navy outlines, white fills, mint accent." \
  --headline "Stop paying for traffic that ghosts" \
  --cta "$7 a lead — yours alone" \
  --out working/batches/roofing-20260702/r1_wastedspend_lineart_4x5.png

# R2 — wasted-spend, photoreal, 4:5
python3 scripts/recraft_ad.py --track raster --size 1080x1350 \
  --prompt "A roofer on a residential roof at golden hour, clean and trustworthy, natural light, navy #0A1628 + mint accent palette, no stock-photo cheese." \
  --headline "The clicks you bought, ghosting you" \
  --cta "Get them back — $7 a lead" \
  --out working/batches/roofing-20260702/r2_wastedspend_photo_4x5.png

# R3 — wasted-spend, line-art, 4:5
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "Line-art: a website window with a faint '98%' of visitor silhouettes fading out; navy outlines, white fills, mint accent." \
  --headline "98% leave without a trace" \
  --cta "Turn them into $7 leads" \
  --out working/batches/roofing-20260702/r3_wastedspend_lineart_4x5.png

# R4 — wasted-spend, photoreal, 4:5
python3 scripts/recraft_ad.py --track raster --size 1080x1350 \
  --prompt "A roofing contractor at a laptop reviewing new leads, warm natural light, navy + mint brand palette, clean and credible." \
  --headline "Get storm traffic back by email" \
  --cta "$7 a lead, flat" \
  --out working/batches/roofing-20260702/r4_wastedspend_photo_4x5.png

# R5 — ROI-math control, line-art, 4:5
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "Line-art: a simple balance scale, one booked roof outweighing a stack of $7 lead tags; navy outlines, white fills, mint accent." \
  --headline "One booked roof pays for a lot" \
  --cta "Do the math — $7 each" \
  --out working/batches/roofing-20260702/r5_roimath_lineart_4x5.png
```

---

## 5. Immediate actions checklist

1. **Scale A** — duplicate `CR_leads_roofing_wastedspend_4x5` into a new higher-budget ad set. Do
   not edit live A.
2. **Kill B** (competitor-envy) — reallocate its budget.
3. **Don't touch C's budget** — retire the fatigued square; it re-runs as R5 (fresh 4:5).
4. **Launch the R1–R5 refresh batch** under the same ad set / naming / UTM convention.
5. Re-check in ~50 conversion events; compare R1–R4 to isolate line-art vs photoreal on the
   wasted-spend angle, and read R5 vs A to finally resolve ROI-math.

*Winners log updated at `working/winners-log.md` (2026-07-02 — roofing entry).*
