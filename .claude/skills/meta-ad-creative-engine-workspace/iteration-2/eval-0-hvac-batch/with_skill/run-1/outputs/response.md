# HVAC Lead-Ad Creative Batch — Consent Resolve

**Mode:** 1 (Creative Batch Generation)
**Vertical:** HVAC
**Objective:** Leads (OUTCOME_LEADS)
**Offer:** $7 exclusive, consent-first leads — real name + consented email + what they were shopping for. Yours alone, never resold.
**Landing:** `https://consentresolve.com/hvac-leads/`
**CPL target:** not supplied — not needed for Mode 1 (only gates the Mode 2 kill/scale math). Supply it before launch.
**Batch date / naming stub:** `20260702`

> DRY RUN — no Recraft calls fired, no credits spent, no campaign created. Everything below is the written spec: concepts, ad copy, and the exact image-generation calls ready to run in one pass.

---

## Compliance pre-check (ran before writing copy)

Every line below was gated against `references/compliance.md` **and** the style-guide voice canon (`voice.astro`) before it was written, not after:

- **No phone-number delivery.** Payoff is always name + consented email + intent; follow-up framed as warm inbound / "they come back and call you" or "email them back" — never "get their number," never a dialer.
- **No covert-tracking / spy language.** Every concept says the visitor *opted in* / *raised their hand* / *consented*. No unmask/de-anonymize/track/fingerprint.
- **No income or ROI guarantees.** The ROI angle uses *the contractor's own math as illustration* ("a booked install is worth thousands — do the math"), never "you'll book X" or "double your jobs."
- **No banned words** (free, instant, seamless, supercharge, world-class, game-changer, unlock, etc.). Price stated honestly as "$7 a lead, flat." Never "free" — first leads / $7 each.
- **B2B framing.** About "your shop / your site / your traffic," never a personal-attribute call-out (Meta Special Category safe).
- **Confidence over fear.** Shared-lead resellers and wasted spend are named as problems, matter-of-fact — no "you're about to get sued" doom.
- **Positioning lock respected.** We *replace* shared-lead resellers (Thumbtack/Angi/HomeAdvisor) and *complement* the contractor's own ads/SEO/LSA — never frame their own traffic sources as the enemy.

Recommend running the batch through the repo `voice-check` skill as the enforcement pass before launch (flagged per SKILL.md).

---

## The angle spread (6 concepts, 6 distinct arguments)

Following the `angles.md` recipe — a real test, not five paint jobs on one idea. Each concept attacks a different belief the HVAC owner holds:

| # | Angle | Belief it attacks | Why it's in an HVAC batch |
|---|-------|-------------------|---------------------------|
| 1 | Wasted ad spend | "I already pay for traffic — why isn't it converting?" | Universal opener; the leak every contractor feels |
| 2 | Competitor envy / shared-lead resentment | "Angi sells my lead to 4 other guys" | Near-universal HVAC grievance; we're the anti-reseller |
| 3 | ROI per booked job | "Is $7 a lead even worth it?" | HVAC installs are high-ticket — the math is lopsided in our favor |
| 4 | Consent / trust vs data brokers | "Isn't this creepy or risky?" | Our moat; consent-first is why it's safe *and* different |
| 5 | Speed-to-lead | "First to follow up wins the job" | Seasonal HVAC urgency — heat wave, phone not ringing |
| 6 | HVAC-flavored seasonal urgency | "It's 98° and the calls stopped" | Trade-specific execution of the speed/waste beat |

---

## Variant matrix

Primary format is **4:5 portrait (1080x1350)** for every concept (best mobile feed real estate). The two concepts I'd actually scale first (#1 wasted-spend and #3 ROI-math) also get a **1080x1080 square** and a **1080x1920 story** so they're ready to duplicate into fresh ad sets without a second generation pass.

Visual tracks: **brand** = locked line-art `style_id` (white/navy/mint, on-brand doodle — best for the diagram/concept hooks). **raster** = photoreal Recraft v4.1 (a real HVAC owner, a truck, a rooftop — best for the emotional/seasonal hooks).

On-image text is intentionally short (a hook band + a $7 CTA band) to stay clear of Meta's text-heavy delivery penalty. The Meta copy below is what actually runs; the image supports it.

| # | Angle | Format(s) | Visual | Primary text (hook in first ~125 chars) | Headline (≤40) | Description | On-image headline / CTA |
|---|-------|-----------|--------|------------------------------------------|----------------|-------------|--------------------------|
| 1 | Wasted ad spend | 4:5 + 1:1 + 9:16 | brand (line-art "98% leave" diagram) | You already paid for those clicks. About 98% of the folks who hit your site leave without a name — and you never find out who they were. Now you can get the ones who opt in. | 98% of your site leaves anonymous | Real names, consented emails. $7 each, yours alone. | "98% leave without a name" / "Get them back — $7 a lead" |
| 2 | Competitor envy | 4:5 | raster (HVAC owner in truck, unimpressed) | That Angi lead you paid up to $100 for? Four other shops got the same one. Ours are yours alone — $7 flat, never resold. | One lead. One HVAC shop. $7. | Stop racing 4 guys to the same call. Own yours. | "Their lead. And 4 other shops'." / "Yours alone — $7 flat" |
| 3 | ROI per booked job | 4:5 + 1:1 + 9:16 | brand (line-art scale: 1 install vs stack of $7 leads) | A booked HVAC install is worth thousands. A consented lead is $7. Do the math on your average ticket — you don't need many to come out ahead. | Do the math on a $7 lead | One booked install pays for a lot of these. | "$7 a lead vs one booked install" / "You do the math" |
| 4 | Consent / trust | 4:5 | brand (line-art homeowner tapping a consent "Yes") | Every lead opted in on your own site. Nobody's identified until they say yes. Not scraped, not resold — real names and consented emails, yours. | Leads that opted in. Not scraped. | Consent-first. Yours alone. $7 a lead, flat. | "Nobody's ID'd 'til they say yes" / "Consent-first leads — $7" |
| 5 | Speed-to-lead | 4:5 | raster (HVAC owner at laptop, new lead landing) | The homeowner who left your site 10 minutes ago is still deciding on that AC swap. Email them back — real name, consented email — before the other shop does. | Reach them while it's hot | Warm inbound, the moment they leave your site. $7 each. | "Still deciding. Reach them back." / "$7 a lead, yours alone" |
| 6 | HVAC seasonal urgency | 4:5 | raster (rooftop AC unit, heat-shimmer, hot summer sky) | It's 98° and the phone went quiet — but people are on your site right now shopping for a new system. Get the ones who opt in, name and consented email, $7 each. | It's 98°. They're on your site. | Turn heat-wave traffic into leads you own. | "It's 98°. The phone's quiet." / "They're on your site — $7 each" |

**Batch spec should be saved** (per Mode 1 step 5) to `working/batches/hvac-20260702.md` so Mode 3 can trace what was tested. (Not written in this DRY run — noted for the live run.)

---

## Full Meta copy per variant (ready to paste)

### Variant 1 — Wasted ad spend (brand / 4:5, 1:1, 9:16)
- **Primary text:** You already paid for those clicks. About 98% of the folks who hit your site leave without a name — and you never find out who they were. Now you get the ones who opt in: real name, consented email, and what they were shopping for. $7 a lead, yours alone.
- **Headline:** 98% of your site leaves anonymous
- **Description:** Real names, consented emails. $7 each, yours alone.

### Variant 2 — Competitor envy (raster / 4:5)
- **Primary text:** That Angi lead you paid up to $100 for? Four other shops got the same one. Consent Resolve hands you leads that are yours alone — a real name and a consented email from a homeowner who opted in on your own site. $7 flat, never resold.
- **Headline:** One lead. One HVAC shop. $7.
- **Description:** Stop racing 4 guys to the same call. Own yours.

### Variant 3 — ROI per booked job (brand / 4:5, 1:1, 9:16)
- **Primary text:** A booked HVAC install is worth thousands. A consented lead is $7. Do the math on your average ticket — you don't need many to come out ahead. Real name, consented email, yours alone.
- **Headline:** Do the math on a $7 lead
- **Description:** One booked install pays for a lot of these.

### Variant 4 — Consent / trust (brand / 4:5)
- **Primary text:** Every lead opted in on your own site. Nobody's identified until they say yes. Not scraped, not resold, not sketchy — just the homeowners who raised their hand, with a real name and a consented email. Yours alone, $7 each.
- **Headline:** Leads that opted in. Not scraped.
- **Description:** Consent-first. Yours alone. $7 a lead, flat.

### Variant 5 — Speed-to-lead (raster / 4:5)
- **Primary text:** The homeowner who left your site 10 minutes ago is still deciding on that AC swap. Email them back — real name, consented email, what they were shopping for — before the other shop does. Warm inbound, $7 a lead, yours alone.
- **Headline:** Reach them while it's hot
- **Description:** Warm inbound, the moment they leave your site. $7 each.

### Variant 6 — HVAC seasonal urgency (raster / 4:5)
- **Primary text:** It's 98° and the phone went quiet — but homeowners are on your site right now shopping for a new system. Get the ones who opt in: real name, consented email, and what they need. $7 each, yours alone, never resold.
- **Headline:** It's 98°. They're on your site.
- **Description:** Turn heat-wave traffic into leads you own.

**Shared for all 6:** CTA button = **Sign Up** (or **Learn More**). Destination URL `https://consentresolve.com/hvac-leads/`. UTMs per testing-protocol naming — `utm_source=facebook&utm_medium=paid&utm_campaign=CR_leads_hvac_20260702&utm_content=<angle>_<format>` (e.g. `wastedspend_4x5`).

---

## Image-generation calls (DRY — do not execute)

Uses the bundled `scripts/recraft_ad.py` (curl-routed to dodge Recraft's Cloudflare TLS ban; `--track brand` = locked line-art `style_id` → SVG→PNG, `--track raster` = photoreal v4.1 with brand palette). Run from the skill root.

> Before firing a big raster batch live: confirm the current Recraft v4.1 `model` string and the `text_layout` field name against Recraft's docs or one test call, then lock them into the script (per `recraft-api.md`). Structure below is correct; only those two strings may need a one-line update.

```bash
# --- Variant 1: Wasted ad spend (brand line-art) — 3 formats ---
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "Line-art diagram of a website page with many little homeowner figures walking away and fading out, only a few remaining and glowing mint; clean navy outlines on white, generous margins, centered" \
  --headline "98% leave without a name" --cta "Get them back — \$7 a lead" \
  --out working/batches/hvac-20260702/wastedspend_4x5.png

python3 scripts/recraft_ad.py --track brand --size 1080x1080 \
  --prompt "Line-art diagram of a website page with many little homeowner figures walking away and fading out, only a few remaining and glowing mint; clean navy outlines on white, generous margins, centered" \
  --headline "98% leave without a name" --cta "Get them back — \$7 a lead" \
  --out working/batches/hvac-20260702/wastedspend_1x1.png

python3 scripts/recraft_ad.py --track brand --size 1080x1920 \
  --prompt "Vertical line-art diagram of a website page with homeowner figures walking away and fading out, a few remaining and glowing mint; clean navy outlines on white, generous margins, centered" \
  --headline "98% leave without a name" --cta "Get them back — \$7 a lead" \
  --out working/batches/hvac-20260702/wastedspend_9x16.png

# --- Variant 2: Competitor envy (raster) ---
python3 scripts/recraft_ad.py --track raster --size 1080x1350 \
  --prompt "A weary HVAC business owner in a work shirt sitting in the cab of his service truck, unimpressed, glancing at his phone; warm natural daylight, realistic, no stock-photo cheese, navy and mint accents in the scene" \
  --headline "Their lead. And 4 other shops'." --cta "Yours alone — \$7 flat" \
  --out working/batches/hvac-20260702/competitor_4x5.png

# --- Variant 3: ROI per booked job (brand line-art) — 3 formats ---
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "Line-art balance scale: on one side a single large HVAC system / booked-install icon, on the other side a tall stack of small \$7 lead tickets; navy outlines on white, mint accent, centered, generous margins" \
  --headline "\$7 a lead vs one booked install" --cta "You do the math" \
  --out working/batches/hvac-20260702/roi_4x5.png

python3 scripts/recraft_ad.py --track brand --size 1080x1080 \
  --prompt "Line-art balance scale: one large HVAC booked-install icon vs a tall stack of small \$7 lead tickets; navy outlines on white, mint accent, centered, generous margins" \
  --headline "\$7 a lead vs one booked install" --cta "You do the math" \
  --out working/batches/hvac-20260702/roi_1x1.png

python3 scripts/recraft_ad.py --track brand --size 1080x1920 \
  --prompt "Vertical line-art balance scale: one large HVAC booked-install icon vs a tall stack of small \$7 lead tickets; navy outlines on white, mint accent, centered, generous margins" \
  --headline "\$7 a lead vs one booked install" --cta "You do the math" \
  --out working/batches/hvac-20260702/roi_9x16.png

# --- Variant 4: Consent / trust (brand line-art) ---
python3 scripts/recraft_ad.py --track brand --size 1080x1350 \
  --prompt "Line-art of a homeowner's hand tapping a friendly on-site consent banner with a mint 'Yes' button, a small checkmark badge nearby; navy outlines on white, mint accent, centered, generous margins" \
  --headline "Nobody's ID'd 'til they say yes" --cta "Consent-first leads — \$7" \
  --out working/batches/hvac-20260702/consent_4x5.png

# --- Variant 5: Speed-to-lead (raster) ---
python3 scripts/recraft_ad.py --track raster --size 1080x1350 \
  --prompt "An HVAC business owner at a small office desk looking at a laptop as a new lead notification arrives, a slight satisfied reaction; warm natural daylight, realistic, clean, navy and mint accents in the scene, no stock-photo cheese" \
  --headline "Still deciding. Reach them back." --cta "\$7 a lead, yours alone" \
  --out working/batches/hvac-20260702/speed_4x5.png

# --- Variant 6: HVAC seasonal urgency (raster) ---
python3 scripts/recraft_ad.py --track raster --size 1080x1350 \
  --prompt "A rooftop residential HVAC condenser unit under a hot hazy summer sky with visible heat shimmer, suburban neighborhood below; realistic, warm, high-contrast, navy and mint accents subtly present, no stock-photo cheese" \
  --headline "It's 98°. The phone's quiet." --cta "They're on your site — \$7 each" \
  --out working/batches/hvac-20260702/seasonal_4x5.png
```

**Total assets:** 10 images (6 concepts; #1 and #3 in all 3 formats, the rest 4:5 only).

---

## Hand-off to Mode 2 (launch, for reference)

When Aaron launches this batch:
- **1 campaign**, objective Leads: `CR_leads_hvac_20260702`.
- **1 ad set**, HVAC only: `CR_leads_hvac_20260702` — Advantage+ placements, ad-set-level budget (mirrors `worker/api/crm-meta-launch.js`).
- **All 10 creatives in the one ad set** — ≥5 satisfied, gives Meta options to optimize and avoids single-creative fatigue. One HVAC ad set (not split further) so it can chase ~50 conversion events/week and exit learning instead of starving.
- **Ad names:** `CR_leads_hvac_<angle>_<format>_20260702`, e.g. `CR_leads_hvac_wastedspend_4x5_20260702`, mirrored into `utm_content`.
- **Supply the CPL target before judging.** Then: min spend 2×T before calling any creative; kill CPL > 2.5×T; scale winners by *duplicating* into fresh ad sets (never edit a live winner); don't crown a winner under 100 clicks or with overlapping CIs.

## Notes / flags
- The destination `consentresolve.com/hvac-leads/` does **not** yet exist as a page in the repo (`src/pages/` has no `hvac-leads` route). Confirm the page is live before spending, or the ads will send clicks to a 404. Flagging so it's built first.
- No CPL target was provided — fine for this creative batch, but it gates the entire Mode 2 kill/scale decision. Get the number before launch.
