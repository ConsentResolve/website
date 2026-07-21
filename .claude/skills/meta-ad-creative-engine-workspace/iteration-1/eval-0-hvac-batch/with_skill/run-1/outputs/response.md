# HVAC Lead-Ad Creative Batch — Consent Resolve

**Mode:** 1 (Creative Batch Generation)
**Objective:** Leads
**Vertical:** HVAC
**Offer:** $7 exclusive, consent-first leads — name + email + what they need, yours alone, never resold
**Destination:** `consentresolve.com/hvac-leads/`
**Date:** 20260702
**Batch size:** 6 distinct concepts (≥5 required; 6 gives Meta's auction real options and covers the angle spread cleanly)

> Compliance gate passed on every line below: no phone/dialer delivery (email follow-up only), no covert-tracking/"spying" language (opt-in framing throughout), no income/ROI guarantees (contractor supplies the math), no banned voice words (free, instant, seamless, etc.). The "~98% leave" stat is framed as *your own site's* bounce — clean.

---

## Angle spread (why these six)

Following the recommended 5-variant recipe from `angles.md`, extended to 6 so we test the two HVAC-hottest angles (ROI-per-job and speed-to-lead) as their own fully trade-flavored executions rather than generic ones:

1. **Wasted ad spend** — the universal opener. Attacks "I already pay for traffic, why doesn't it convert?"
2. **Competitor envy / shared-lead resentment** — the anti-reseller. Attacks "Angi sells me the same lead as 4 other guys."
3. **Consent / trust vs shady data brokers** — the moat. Attacks "isn't this creepy/risky?"
4. **Speed-to-lead (HVAC-flavored)** — attacks "first to follow up wins the job," tuned to seasonal urgency.
5. **ROI per booked job (HVAC-flavored)** — attacks "is this worth it?" with install-ticket math.
6. **Ownership / build-your-own-list** — attacks "I'm renting my pipeline from a platform."

Six genuinely different arguments = a real test, not six paint jobs on one idea. Each concept is built so it differs from the others primarily on **angle**, keeping visual treatment and format mostly constant, so a Mode-3 winner read tells us *which argument* moved HVAC owners.

---

## The batch (one row per variant)

| # | angle | format | visual | primary text (first ~125 chars land the hook) | headline (≤40) | description | recraft call |
|---|-------|--------|--------|-----------------------------------------------|----------------|-------------|--------------|
| 1 | Wasted ad spend | 1080x1350 (4:5) | Brand line-art: a website with visitor figures drifting away, most fading to ghost outlines, one raising a hand | You're paying for those clicks. ~98% land on your site and leave without a trace — and you never find out who they were. The ones who opt in? We hand them back. | Stop paying for traffic that ghosts you | $7 a lead. Name, email, and what they need — yours alone. | call #1 |
| 2 | Competitor envy | 1080x1350 (4:5) | Raster: one HVAC service van in a clean driveway, sharp and singular (vs a faded row of identical vans behind it) | That $80 shared lead? Four other HVAC shops got it too, and you're all racing to reply first. Ours are yours alone — $7, never resold. | One lead. One shop. $7. | No bidding wars. No resold contacts. Just your leads. | call #2 |
| 3 | Consent / trust | 1080x1350 (4:5) | Brand line-art: a homeowner figure raising a hand ("yes"), a clean checkmark, mint accent — nothing scraped or hidden | Every lead opted in. Nobody's identified until they say yes — clean, consent-first, and exclusively yours. Not scraped. Not resold. Not sketchy. | Leads that opted in. Not scraped. | The visitors who raised their hand on your site. | call #3 |
| 4 | Speed-to-lead (HVAC) | 1080x1350 (4:5) | Raster: HVAC owner at a laptop in the shop office, a fresh lead notification on screen, warm natural light | It's 98° and the phone's quiet — but people are on your site right now. When one opts in, you get their name and email while it's hot. Reply before your competitor does. | Follow up while they're still deciding | Real name, real email, the moment they opt in. | call #4 |
| 5 | ROI per booked job (HVAC) | 1080x1350 (4:5) | Brand line-art: a simple balance/scale — one AC install unit on one side, a small "$7" tag on the other | A booked HVAC install is worth thousands. A lead is $7. Do the math on your average ticket — you don't need many to come out ahead. | Do the math on one install | $7 a lead, flat. No contract. You run the numbers. | call #5 |
| 6 | Ownership / list | 1080x1080 (square) | Brand line-art: a contractor holding a tidy contact list labeled "yours," a platform "rental" tag crossed out | Stop renting leads from a platform. The people already visiting your site can become a list you actually own — consent-first, $7 each. | Your traffic. Your leads. Your list. | Own the pipeline instead of renting it. | call #6 |

**Format notes:** Concepts default to **4:5 portrait (1080x1350)** — best mobile feed real estate. #6 is shipped square (1080x1080) as the universal-fallback slot. Once Mode 3 names a winner, generate that winner in **1080x1920 story/reels** before scaling — don't spend story production on unproven concepts.

**Visual-track split:** three brand line-art (#1, #3, #5, #6 — four, actually, for the on-brand/diagrammatic hooks) and two photoreal raster (#2, #4 — where a real van/owner-at-laptop scene sells the moment). This is a deliberate mix so a Mode-3 read can also tell us whether illustrated or photoreal thumb-stops better on HVAC, as a secondary signal.

---

## Naming (apply to ad, ad set, and UTMs)

Pattern from the testing protocol: `CR_[objective]_[vertical]_[angle]_[format]_[YYYYMMDD]`

| # | ad name |
|---|---------|
| 1 | `CR_leads_hvac_wastedspend_4x5_20260702` |
| 2 | `CR_leads_hvac_competitorenvy_4x5_20260702` |
| 3 | `CR_leads_hvac_consenttrust_4x5_20260702` |
| 4 | `CR_leads_hvac_speedtolead_4x5_20260702` |
| 5 | `CR_leads_hvac_roimath_4x5_20260702` |
| 6 | `CR_leads_hvac_ownership_1x1_20260702` |

All six run in one **Leads** ad set (`CR_leads_hvac_20260702`), Advantage+ placements, ad-set-level budget — mirrors `worker/api/crm-meta-launch.js` (OUTCOME_LEADS, US). UTM `content` = the ad name so Mode 3 can trace each click back to its angle.

---

## Recraft image-generation calls

Both routes below are provided for each image: **(A)** the bundled `scripts/recraft_ad.py` command (preferred — curl-routed to dodge Recraft's Cloudflare TLS-fingerprint ban, handles SVG→PNG rasterization for brand-track, reads the key from `~/.config/recraft/key`), and **(B)** the raw JSON request body if calling the endpoint directly (`POST https://external.api.recraft.ai/v1/images/generations`, `Authorization: Bearer <key>`).

On-image text is placed via the script's headline (top band `[0.07, 0.07, 0.93, 0.27]`) and CTA (bottom band `[0.07, 0.77, 0.93, 0.93]`) layout controls — kept short and high-contrast to stay clear of Meta's text-heavy delivery penalty. Confirm the live `text_layout` field name and the v4.1 raster `model` string on the first call of the batch, then lock them in.

Brand track uses locked `style_id` `214dccd1-dca3-43e6-b005-c664e1b33338` (line-art: white fills, navy outlines, mint accent). Raster track drives brand via the palette (navy `#0A1628`, mint `#00E5A0`, off-white `#F4F6F8`) + style prompt until a saved raster brand style exists.

---

### Image 1 — Wasted ad spend (brand line-art, 4:5)

**(A) Script command**
```bash
python3 scripts/recraft_ad.py \
  --track brand \
  --size 1080x1350 \
  --prompt "A website browser window with small visitor figures walking away and fading into faint ghost outlines, most of them nearly gone; a single figure near the site raises one hand. Clean diagram, centered, generous margins." \
  --headline "98% leave without a trace" \
  --cta "Get the opt-ins back — \$7 a lead" \
  --out working/batches/hvac-20260702/1_wastedspend_4x5.png
```

**(B) Raw JSON body**
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "n": 1,
  "style_id": "214dccd1-dca3-43e6-b005-c664e1b33338",
  "prompt": "A website browser window with small visitor figures walking away and fading into faint ghost outlines, most of them nearly gone; a single figure near the site raises one hand. Clean diagram, centered, generous margins.\n\nConsent Resolve brand: clean, trustworthy, plain, contractor-friendly. Navy (#0A1628), mint accent (#00E5A0), off-white. No stock-photo cheese, no clutter, generous margins so nothing clips.",
  "text_layout": [
    {"text": "98% leave without a trace", "bbox": [0.07, 0.07, 0.93, 0.27]},
    {"text": "Get the opt-ins back — $7 a lead", "bbox": [0.07, 0.77, 0.93, 0.93]}
  ]
}
```

---

### Image 2 — Competitor envy (photoreal raster, 4:5)

**(A) Script command**
```bash
python3 scripts/recraft_ad.py \
  --track raster \
  --size 1080x1350 \
  --prompt "One crisp, well-lit HVAC service van parked in a clean suburban driveway, sharp and singular in the foreground; behind it a faded row of near-identical generic vans blurring into the background. Confident, not cheesy, natural daylight." \
  --headline "One lead. One shop. \$7." \
  --cta "Yours alone. Never resold." \
  --out working/batches/hvac-20260702/2_competitorenvy_4x5.png
```

**(B) Raw JSON body**
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "n": 1,
  "style": "realistic_image",
  "colors": [{"rgb": [10, 22, 40]}, {"rgb": [0, 229, 160]}, {"rgb": [244, 246, 248]}],
  "prompt": "One crisp, well-lit HVAC service van parked in a clean suburban driveway, sharp and singular in the foreground; behind it a faded row of near-identical generic vans blurring into the background. Confident, not cheesy, natural daylight.\n\nConsent Resolve brand: clean, trustworthy, plain, contractor-friendly. Navy (#0A1628), mint accent (#00E5A0), off-white. No stock-photo cheese, no clutter, generous margins so nothing clips.",
  "text_layout": [
    {"text": "One lead. One shop. $7.", "bbox": [0.07, 0.07, 0.93, 0.27]},
    {"text": "Yours alone. Never resold.", "bbox": [0.07, 0.77, 0.93, 0.93]}
  ]
}
```

---

### Image 3 — Consent / trust (brand line-art, 4:5)

**(A) Script command**
```bash
python3 scripts/recraft_ad.py \
  --track brand \
  --size 1080x1350 \
  --prompt "A friendly homeowner figure raising one hand to say yes beside a website, with a clean checkmark badge and a small mint shield icon signalling consent. Nothing hidden or scraped. Warm, honest, centered, generous margins." \
  --headline "Nobody's ID'd until they say yes" \
  --cta "Consent-first leads — \$7 each" \
  --out working/batches/hvac-20260702/3_consenttrust_4x5.png
```

**(B) Raw JSON body**
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "n": 1,
  "style_id": "214dccd1-dca3-43e6-b005-c664e1b33338",
  "prompt": "A friendly homeowner figure raising one hand to say yes beside a website, with a clean checkmark badge and a small mint shield icon signalling consent. Nothing hidden or scraped. Warm, honest, centered, generous margins.\n\nConsent Resolve brand: clean, trustworthy, plain, contractor-friendly. Navy (#0A1628), mint accent (#00E5A0), off-white. No stock-photo cheese, no clutter, generous margins so nothing clips.",
  "text_layout": [
    {"text": "Nobody's ID'd until they say yes", "bbox": [0.07, 0.07, 0.93, 0.27]},
    {"text": "Consent-first leads — $7 each", "bbox": [0.07, 0.77, 0.93, 0.93]}
  ]
}
```

---

### Image 4 — Speed-to-lead / HVAC (photoreal raster, 4:5)

**(A) Script command**
```bash
python3 scripts/recraft_ad.py \
  --track raster \
  --size 1080x1350 \
  --prompt "An HVAC business owner in a shop office at a laptop, calm and focused, a fresh new-lead notification card glowing on the screen; warm natural light through a window, summer-afternoon feel. Real, not stocky." \
  --headline "They're on your site right now" \
  --cta "Email them back while it's hot" \
  --out working/batches/hvac-20260702/4_speedtolead_4x5.png
```

**(B) Raw JSON body**
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "n": 1,
  "style": "realistic_image",
  "colors": [{"rgb": [10, 22, 40]}, {"rgb": [0, 229, 160]}, {"rgb": [244, 246, 248]}],
  "prompt": "An HVAC business owner in a shop office at a laptop, calm and focused, a fresh new-lead notification card glowing on the screen; warm natural light through a window, summer-afternoon feel. Real, not stocky.\n\nConsent Resolve brand: clean, trustworthy, plain, contractor-friendly. Navy (#0A1628), mint accent (#00E5A0), off-white. No stock-photo cheese, no clutter, generous margins so nothing clips.",
  "text_layout": [
    {"text": "They're on your site right now", "bbox": [0.07, 0.07, 0.93, 0.27]},
    {"text": "Email them back while it's hot", "bbox": [0.07, 0.77, 0.93, 0.93]}
  ]
}
```

---

### Image 5 — ROI per booked job / HVAC (brand line-art, 4:5)

**(A) Script command**
```bash
python3 scripts/recraft_ad.py \
  --track brand \
  --size 1080x1350 \
  --prompt "A simple, clean balance scale: on one side a single outdoor AC condenser unit representing a booked install, on the other a small price tag reading '\$7'. The install side clearly outweighs. Minimal diagram, centered, generous margins." \
  --headline "One install vs a \$7 lead" \
  --cta "Do the math on your ticket" \
  --out working/batches/hvac-20260702/5_roimath_4x5.png
```

**(B) Raw JSON body**
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "n": 1,
  "style_id": "214dccd1-dca3-43e6-b005-c664e1b33338",
  "prompt": "A simple, clean balance scale: on one side a single outdoor AC condenser unit representing a booked install, on the other a small price tag reading '$7'. The install side clearly outweighs. Minimal diagram, centered, generous margins.\n\nConsent Resolve brand: clean, trustworthy, plain, contractor-friendly. Navy (#0A1628), mint accent (#00E5A0), off-white. No stock-photo cheese, no clutter, generous margins so nothing clips.",
  "text_layout": [
    {"text": "One install vs a $7 lead", "bbox": [0.07, 0.07, 0.93, 0.27]},
    {"text": "Do the math on your ticket", "bbox": [0.07, 0.77, 0.93, 0.93]}
  ]
}
```

---

### Image 6 — Ownership / list (brand line-art, square)

**(A) Script command**
```bash
python3 scripts/recraft_ad.py \
  --track brand \
  --size 1080x1080 \
  --prompt "A contractor figure holding a tidy contact list labeled 'yours', standing beside their own website; a small 'rental' platform tag is crossed out with a mint X. Ownership over renting. Clean, centered, generous margins." \
  --headline "Your traffic. Your leads. Your list." \
  --cta "Own it — \$7 a lead, no contract" \
  --out working/batches/hvac-20260702/6_ownership_1x1.png
```

**(B) Raw JSON body**
```json
{
  "model": "recraftv3",
  "size": "1080x1080",
  "response_format": "url",
  "n": 1,
  "style_id": "214dccd1-dca3-43e6-b005-c664e1b33338",
  "prompt": "A contractor figure holding a tidy contact list labeled 'yours', standing beside their own website; a small 'rental' platform tag is crossed out with a mint X. Ownership over renting. Clean, centered, generous margins.\n\nConsent Resolve brand: clean, trustworthy, plain, contractor-friendly. Navy (#0A1628), mint accent (#00E5A0), off-white. No stock-photo cheese, no clutter, generous margins so nothing clips.",
  "text_layout": [
    {"text": "Your traffic. Your leads. Your list.", "bbox": [0.07, 0.07, 0.93, 0.27]},
    {"text": "Own it — $7 a lead, no contract", "bbox": [0.07, 0.77, 0.93, 0.93]}
  ]
}
```

---

## Run all six in one pass

```bash
mkdir -p working/batches/hvac-20260702

# 1 — wasted spend (brand)
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "A website browser window with small visitor figures walking away and fading into faint ghost outlines, most of them nearly gone; a single figure near the site raises one hand. Clean diagram, centered, generous margins." \
  --headline "98% leave without a trace" --cta "Get the opt-ins back — \$7 a lead" \
  --out working/batches/hvac-20260702/1_wastedspend_4x5.png

# 2 — competitor envy (raster)
python3 scripts/recraft_ad.py --track raster --size 1080x1350 \
  --prompt "One crisp, well-lit HVAC service van parked in a clean suburban driveway, sharp and singular in the foreground; behind it a faded row of near-identical generic vans blurring into the background. Confident, not cheesy, natural daylight." \
  --headline "One lead. One shop. \$7." --cta "Yours alone. Never resold." \
  --out working/batches/hvac-20260702/2_competitorenvy_4x5.png

# 3 — consent / trust (brand)
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "A friendly homeowner figure raising one hand to say yes beside a website, with a clean checkmark badge and a small mint shield icon signalling consent. Nothing hidden or scraped. Warm, honest, centered, generous margins." \
  --headline "Nobody's ID'd until they say yes" --cta "Consent-first leads — \$7 each" \
  --out working/batches/hvac-20260702/3_consenttrust_4x5.png

# 4 — speed-to-lead HVAC (raster)
python3 scripts/recraft_ad.py --track raster --size 1080x1350 \
  --prompt "An HVAC business owner in a shop office at a laptop, calm and focused, a fresh new-lead notification card glowing on the screen; warm natural light through a window, summer-afternoon feel. Real, not stocky." \
  --headline "They're on your site right now" --cta "Email them back while it's hot" \
  --out working/batches/hvac-20260702/4_speedtolead_4x5.png

# 5 — ROI math HVAC (brand)
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "A simple, clean balance scale: on one side a single outdoor AC condenser unit representing a booked install, on the other a small price tag reading '\$7'. The install side clearly outweighs. Minimal diagram, centered, generous margins." \
  --headline "One install vs a \$7 lead" --cta "Do the math on your ticket" \
  --out working/batches/hvac-20260702/5_roimath_4x5.png

# 6 — ownership (brand, square)
python3 scripts/recraft_ad.py --track brand --size 1080x1080 \
  --prompt "A contractor figure holding a tidy contact list labeled 'yours', standing beside their own website; a small 'rental' platform tag is crossed out with a mint X. Ownership over renting. Clean, centered, generous margins." \
  --headline "Your traffic. Your leads. Your list." --cta "Own it — \$7 a lead, no contract" \
  --out working/batches/hvac-20260702/6_ownership_1x1.png
```

---

## Notes for launch (hand-off to Mode 2)

- **CPL target** wasn't supplied — it doesn't block the batch, but set it before judging the test. Kill/scale math (min spend = 2× target CPL; kill at CPL > 2.5× target; don't call a winner under 100 clicks) needs it.
- All six go in **one Leads ad set**, Advantage+ placements. If HVAC lead volume can't feed ~50 conversions/week, don't split into more ad sets — a starved ad set stalls in learning. Consolidate.
- **Destination:** `consentresolve.com/hvac-leads/` with UTMs `utm_source=meta&utm_medium=paid&utm_campaign=CR_leads_hvac_20260702&utm_content=<ad name>`. (If you'd rather use the native Instant Form for lower friction, that's a Mode-2 structure decision — the copy above works for either.)
- **Batch spec** should be saved to `working/batches/hvac-20260702.md` per the skill so Mode 3 can trace what was tested.
- On the first generation call, confirm the live Recraft v4.1 raster `model` string and the `text_layout` field name; the structure above is correct, only those exact strings may need a one-line update in `scripts/recraft_ad.py`.

### Compliance re-check (final gate — all clear)
- No phone/dialer delivery anywhere; every follow-up beat is "email them back / reply / follow up." ✅
- No covert-tracking or "spying/unmask/de-anonymize" language; every concept uses opt-in / raised-hand / consent framing. ✅
- No income or ROI guarantees; #5 hands the math to the contractor ("do the math on your ticket"), never promises a return. ✅
- No banned voice words (free, instant, seamless, supercharge, etc.). ✅
- "~98% leave" framed as the contractor's own site bounce, not surveillance. ✅
