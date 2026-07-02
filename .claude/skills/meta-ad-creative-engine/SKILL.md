---
name: meta-ad-creative-engine
description: >-
  Produce, test, and iterate Meta (Facebook/Instagram) lead-gen ad creatives for
  Consent Resolve's home-service-contractor funnel. Generates hook × angle × format
  variant matrices with ready-to-run Recraft image calls, a campaign testing / kill-scale
  protocol, and winner-iteration logic. Use this whenever the user mentions ad creatives,
  an ad batch, a Meta/Facebook campaign, creative testing, iterating on ads, a CPL check,
  refreshing fatigued ads, or generating/varying ad concepts — even if they don't name the
  skill. Meta + Recraft only. Enforces the consent-first compliance rules (no phone-delivery
  claims, no covert-tracking language, no income guarantees) on every line of copy.
---

# Meta Ad Creative Engine

You produce and manage the creative side of Consent Resolve's Meta lead-gen. This skill
turns a loose ask ("make me some HVAC ads", "which creative is winning?", "refresh the
roofing batch") into a disciplined, compliant, test-ready output.

**Consent Resolve in one line:** a consent-first website-visitor *identification* platform
for home-service contractors (roofing, HVAC, plumbing + 14 other trades). We hand a
contractor the anonymous visitors who left their site — as opt-in, consent-first leads
(name + email + what they need), $7 each, exclusively theirs, never resold. B2B. We sell to
contractor owners and their marketers.

**Read `references/compliance.md` before writing a single word of ad copy.** The consent-first
positioning is the whole brand; a creative that implies covert tracking or promises phone
numbers is not just off-brand, it can get the ad account flagged. Compliance is not a final
check — it shapes the hook.

## Brand & voice: the style guide is law

Every word and image you produce must conform to Consent Resolve's living **style guide** — not a
paraphrase of it. The style guide is the single source of truth for voice, tone, wording, palette,
and type; hardcoded rules drift, the style guide doesn't. **Before writing copy, read the voice
canon**; before choosing a visual treatment, skim the brand/illustration pages. Prefer the repo
source when you're in the repo (always matches the current branch), else fetch the live page:

- **Voice / tone / wording** — `src/pages/style-guide/voice.astro` (live: `https://consentresolve.com/style-guide/voice/`).
  This defines the plain-spoken, anti-hype, slightly-irreverent contractor voice, the banned/
  preferred word lists, reading level, and the canonical positioning language. Your ad copy must
  read like it came from this page.
- **Visual brand** — `src/pages/style-guide/typography.astro` and `illustrations.astro`
  (live: `https://consentresolve.com/style-guide/`). Fonts, palette, and the illustration style
  that the locked Recraft brand `style_id` renders. On-image text and photoreal color choices
  should match these.

If this skill's `references/compliance.md` ever disagrees with the style guide, **the style guide
wins** — treat compliance.md as the ads-specific compliance layer on top of it, and flag the drift
so it gets reconciled. After drafting a batch, it's worth running the repo's **`voice-check`**
skill (it lints against `voice.astro`) as the enforcement pass.

## Which mode am I in?

Pick by what the user is actually holding:

- They want *new creative* / a *batch* / are starting a campaign → **Mode 1: Batch Generation**
- They're *setting up the campaign* / asking how to structure or judge a test → **Mode 2: Testing Protocol**
- They have *numbers* (CTR, CPL, spend, frequency) and want the *next move* → **Mode 3: Iterate on Winners**

Modes chain: a batch (1) gets launched under the protocol (2) and later refined from results (3).
When unsure, ask one question ("do you want fresh concepts, or should I read results and tell
you what to make next?") rather than guessing.

---

## Mode 1 — Creative Batch Generation

**Goal:** never ship 1–2 ads. WordStream's data is blunt: advertisers running 5+ creative
variants see 20–30% lower CPA than those running 1–2, because Meta's auction needs options to
optimize against and single creatives fatigue fast. So a batch is **≥5 distinct concepts**, and
"distinct" means different *angles*, not the same idea recolored.

**Inputs to confirm (ask if missing):** campaign goal, trade vertical(s), the offer, the
landing destination (a `/[trade]-leads/` page or the native Instant Form), and the CPL target
if known (it only matters for Mode 2, so don't block on it).

**Process:**

1. **Pick the angle spread.** Draw ≥5 from the angle library in `references/angles.md` (wasted
   ad spend, competitor envy, ROI-per-booked-job, consent/trust vs shady data brokers,
   speed-to-lead, and the per-trade variants). Spread them — a batch that's five flavors of
   "wasted spend" isn't a real test. Each angle should attack a different belief the contractor
   holds.

2. **Build the variant matrix.** For each concept, decide: angle × visual treatment
   (photoreal raster vs the line-art brand style) × format. Formats and sizes:
   - `1080x1350` (4:5 portrait) — **primary**, best feed real estate on mobile
   - `1080x1080` (square) — universal fallback
   - `1080x1920` (story/reels)
   Default a batch to 4:5 first; add square/story for the concepts you'd actually scale.

3. **Write the Meta copy for each variant** (this is what runs, the image supports it):
   - **Primary text** — first ~125 chars must land the hook before the "See more" fold
   - **Headline** — ≤40 chars
   - **Description** — one supporting line
   Write in Consent Resolve's voice **as defined by the style-guide voice canon** (see the
   "Brand & voice" section above — read `voice.astro` first): plain-spoken, contractor-friendly,
   anti-hype, a little irreverent. No corporate throat-clearing. Match its banned/preferred word
   lists and reading level, then run every line past `references/compliance.md`.

4. **Generate the Recraft call for each image.** Follow `references/recraft-api.md`. Use the
   bundled `scripts/recraft_ad.py` — it's the proven curl-routed pattern (Recraft Cloudflare-
   blocks Python's TLS fingerprint) with `style_id`, size, and text-layout support. Two visual
   tracks:
   - **Illustrated / doodle concepts** → the locked brand `style_id`
     `214dccd1-dca3-43e6-b005-c664e1b33338` (line-art: white fills, navy outlines, mint accent —
     the same style as the whole site, so ads feel on-brand).
   - **Photoreal raster concepts** → Recraft v4.1 raster (a contractor at a laptop, a truck, a
     rooftop). There is no *raster* brand style saved yet, so either (a) drive brand with an
     explicit palette + style prompt, or (b) create a raster brand style once from site
     reference images (steps in `references/recraft-api.md`) and reuse its id.
   Place the headline and CTA text with Recraft's text-layout controls so the on-image words sit
   where you want them, not wherever the model drops them.

5. **Emit the batch as a table** the user can act on. One row per variant:

   | # | angle | format | visual | primary text (125) | headline (40) | description | recraft call |
   |---|-------|--------|--------|--------------------|---------------|-------------|--------------|

   Then list the exact `scripts/recraft_ad.py` commands (or the raw JSON bodies) so the images
   can be generated in one pass. Save the batch spec to `working/batches/<vertical>-<date>.md`
   so Mode 3 can trace what was tested.

---

## Mode 2 — Campaign Testing Protocol

The full decision rules live in `references/testing-protocol.md` — read it when setting up or
judging a test. The essentials:

- **Structure:** 1 campaign (Leads objective), ad sets split by trade vertical, Advantage+
  placements, ≥5 creatives per ad set. This mirrors the launcher at
  `worker/api/crm-meta-launch.js` (OUTCOME_LEADS, US, ad-set-level budget).
- **Naming (apply to campaign, ad set, ad, and UTMs):**
  `CR_[objective]_[vertical]_[angle]_[format]_[YYYYMMDD]` — e.g.
  `CR_leads_hvac_wastedspend_4x5_20260702`. Consistent names are what make Mode 3 possible.
- **Learning phase:** an ad set needs ~50 conversion events/week to exit learning. If lead
  volume can't feed multiple ad sets that fast, **consolidate** — fewer, better-fed ad sets beat
  many starved ones stuck in learning.
- **Kill / scale (CPL target is user-supplied):** give each creative a minimum spend before you
  judge it (default **2× target CPL** — you can't call a creative dead on $4 of spend). Then
  **kill** creatives whose CPL > **2.5× target** past that threshold; **scale** winners by
  duplicating them into fresh ad sets — never edit a live winner (it re-enters learning).
- **Significance:** don't declare a winner on <100 clicks or when confidence intervals overlap.
  A creative that's "ahead" on 30 clicks is noise. Details + the CI check in the reference.

---

## Mode 3 — Iterate on Winners

**Input:** a performance export or pasted metrics (CTR, CPL, hook/thumb-stop rate, spend,
frequency).

**Process:**

1. **Isolate the winning variable.** The whole point of the matrix in Mode 1 is that variants
   differ on *one* axis at a time, so a winner tells you *which* axis won — the angle, the
   visual treatment, or the headline. Name it explicitly ("the ROI-math angle beat trust 2:1 at
   equal spend; visual treatment was a wash").

2. **Generate the next batch varying ONE dimension**, holding the winners constant. If the ROI
   angle won, the next batch is five ROI-angle executions with different visuals/headlines — not
   five new angles. This is how you climb, not wander.

3. **Update the winners log** at `working/winners-log.md`: what won, the hypothesis for *why*,
   and what you're testing next. Over time this log is the most valuable artifact here — it's the
   accumulated theory of what moves contractors.

4. **Watch for fatigue.** Flag it when **frequency > 3** or **CTR drops ≥25% from that
   creative's peak**. Fatigue means the audience has seen it too often; the fix is a refresh
   batch (loop back to Mode 1), not a bid change.

**Winners-log entry format:**
```
## <date> — <vertical>
- Tested: <the variable varied, e.g. "angle: wasted-spend vs ROI-math vs trust">
- Held constant: <what didn't change>
- Winner: <variant + the metric it won on>
- Sample: <clicks / spend / whether CIs separated>
- Hypothesis: <why we think it won>
- Next: <the one dimension the next batch varies>
```

---

## Reference files

- `references/compliance.md` — the never-say list. Read first, every time.
- `references/angles.md` — angle library + example hooks per trade vertical.
- `references/recraft-api.md` — Recraft call templates, brand-style setup, text placement.
- `references/testing-protocol.md` — the full Mode 2 decision rules and significance math.

## Bundled script

- `scripts/recraft_ad.py` — generate one ad image via Recraft (curl-routed, `style_id`, size,
  optional text layout). Use it instead of re-writing the API call each batch.
