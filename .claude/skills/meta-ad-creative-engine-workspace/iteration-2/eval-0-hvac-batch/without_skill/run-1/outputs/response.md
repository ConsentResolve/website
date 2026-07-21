# Meta Lead Ads — HVAC Contractor Batch (Consent Resolve)

**Objective:** Leads (Meta Lead Ads / Instant Forms)
**Offer:** Consent-first exclusive leads — name + email, never resold — **flat $7 a lead**
**Destination / form context:** consentresolve.com/hvac-leads/
**Audience:** HVAC contractors & owners (US home-service), retargeting site visitors + lookalikes
**Image backend:** Recraft (per repo `references/recraft-api.md`)

> DRY DELIVERABLE — no image API was called, no images generated, no campaign created. The Recraft calls below are ready to run but are printed, not executed.

---

## 0. Ground rules baked into this batch

Pulled from the locked voice/pricing canon so nothing drifts:

- Pricing is **flat $7 a lead** everywhere. No "$10", no "first 10 leads", no "free trial."
- **98%** of visitors leave without a trace (canon stat, WordStream). Never "95%."
- We are a **consent-first visitor-identification layer** — never "platform," "inbound," "network."
- Thumbtack/Angi/HomeAdvisor are **shared-lead resellers**, never "platforms." Competitor CPLs if referenced: Thumbtack ~$46, Angi ~$50, HomeAdvisor ~$50, LSA ~$53 blended. A shared Thumbtack lead goes to **4–5** pros.
- Banned-word check passed on all copy below (no *free / instant / seamless / game-changer / solution / leverage / supercharge*, etc.).
- Every lead is **exclusive** (sold once, to one contractor) and **opt-in** (the visitor consented). That is the whole pitch: exclusive + consented + cheap.

---

## 1. The five concepts

Each concept = one distinct hook/angle, so the batch tests different psychology rather than five re-skins of one idea.

| # | Concept | Core angle | Primary emotion | Visual track |
|---|---------|-----------|-----------------|--------------|
| C1 | **"98% Walk Out"** | The leak: almost every site visitor vanishes anonymous | Loss / FOMO | A — line-art (locked brand) |
| C2 | **"$7 vs $46"** | Price contrast against shared-lead resellers | Value / relief | A — line-art diagram |
| C3 | **"Sold once. To you."** | Exclusivity — no 4–5 pros racing to the same lead | Fairness / control | B — photoreal (contractor) |
| C4 | **"They asked. Not scraped."** | Consent-first — these people opted in, name + email | Trust / safety | A — line-art |
| C5 | **"New lead just came in"** | The dream state: leads landing in your inbox for $7 | Aspiration / momentum | B — photoreal (inbox moment) |

Aspect ratios per concept: primary **1080x1350 (4:5)**, plus a **1080x1080** square and a **1080x1920** story cut for the two strongest (C1, C3) so delivery has placement flexibility.

---

## 2. Ad copy

Meta Lead Ads fields: **Primary Text**, **Headline**, **Description**, **CTA button**. On-image text (the thumb-stop hook) is listed separately and is what the Recraft call bakes in.

CTA button for all five: **Sign Up** (maps cleanly to an Instant Form). Alt to test: **Learn More** on C4 (trust angle reads softer).

---

### C1 — "98% Walk Out"

- **On-image hook:** `98% of your site visitors leave without a trace`
- **On-image CTA strip:** `Get them back — $7 a lead`
- **Primary Text:**
  > You paid for the clicks. Then 98% of the people who landed on your HVAC site left without a trace — no name, no call, nothing.
  >
  > Consent Resolve is a consent-first visitor-identification layer. The visitors who opt in, we hand to you as exclusive leads — name and email, sold once, to you. Flat $7 a lead. Never resold.
  >
  > Stop paying to fill someone else's funnel.
- **Headline:** `98% leave. Get them back for $7.`
- **Description:** `Exclusive, opt-in HVAC leads. Name + email. Never resold.`

---

### C2 — "$7 vs $46"

- **On-image hook:** `A shared lead: ~$46, split 4–5 ways`
- **On-image sub:** `An exclusive opt-in lead: $7, yours alone`
- **Primary Text:**
  > Thumbtack sells the same HVAC lead to 4–5 pros for around $46 each. You're not buying a customer — you're buying a bidding war.
  >
  > Consent Resolve does it differently: the visitor opted in on your site, we hand you their name and email as an exclusive lead, and it's a flat $7. One lead, one contractor. Yours.
  >
  > Same money, a dozen exclusive leads instead of one shared scrap.
- **Headline:** `$7 exclusive beats $46 shared`
- **Description:** `Opt-in HVAC leads, sold once — to you. Flat $7.`

---

### C3 — "Sold once. To you."

- **On-image hook:** `Sold once. To you.`
- **On-image sub:** `Exclusive HVAC leads — $7`
- **Primary Text:**
  > Tired of racing four other companies to call the same lead first? With shared-lead resellers, that's the whole model — one lead, 4–5 pros, whoever dials fastest wins.
  >
  > Every Consent Resolve lead is exclusive. The visitor opted in on your site, and we hand their name and email to you and no one else. Flat $7. Never resold.
  >
  > No race. Just your lead.
- **Headline:** `One lead. One contractor. You.`
- **Description:** `Exclusive, consent-first HVAC leads. $7 each, never resold.`

---

### C4 — "They asked. Not scraped."

- **On-image hook:** `These leads opted in`
- **On-image sub:** `Name + email. Never resold. $7.`
- **Primary Text:**
  > Not a scraped list. Not a purchased database. Every Consent Resolve lead is someone who visited your HVAC site and opted in — consent first, always.
  >
  > We hand you their name and email as an exclusive lead, sold once, for a flat $7. Clean, consented, and yours to work.
  >
  > The kind of lead you can actually feel good about calling.
- **Headline:** `Consent-first HVAC leads — $7`
- **Description:** `Opt-in visitors, name + email, exclusive. Never resold.`

---

### C5 — "New lead just came in"

- **On-image hook:** `New lead just came in.`
- **On-image sub:** `Name + email. Exclusive. $7.`
- **Primary Text:**
  > Picture your inbox: a new HVAC lead lands — real name, real email, someone who opted in on your site — and it cost you $7. Not $46. Not shared with 4 other companies. Yours.
  >
  > That's Consent Resolve: a consent-first visitor-identification layer that turns the visitors you already paid for into exclusive leads. Never resold.
  >
  > Fill the calendar without feeding a bidding war.
- **Headline:** `Exclusive HVAC leads, $7 each`
- **Description:** `Opt-in name + email leads, sold once — to you.`

---

## 3. Image-generation calls (Recraft — DRY, not executed)

Conventions per `references/recraft-api.md`:
- Track **A** = locked line-art brand style (`style_id = 214dccd1-dca3-43e6-b005-c664e1b33338`), returns SVG → rasterize to PNG.
- Track **B** = photoreal raster; no raster brand style saved yet, so drive brand via palette + style prompt (navy `#0A1628`, mint accent, clean, natural light, no stock-photo cheese).
- On-image text via `text_layout` (normalized bbox `[x_min,y_min,x_max,y_max]`); confirm exact field name on first live call.
- Key read from `~/.config/recraft/key`; route via curl (Cloudflare 1010 gotcha).

The bundled wrapper is preferred over hand-rolled requests. **Bundled-script form** for each, then the **raw JSON body** it emits.

Output dir convention: `working/batches/hvac-20260702/`.

---

### C1 — "98% Walk Out" (Track A, line-art)

```bash
python3 scripts/recraft_ad.py \
  --track brand \
  --size 1080x1350 \
  --prompt "Line-art scene: a crowd of small figures walking out of an open doorway shaped like a browser window, fading to faint outlines as they leave; one figure turns back. Navy outlines, white fills, single mint accent on the figure turning back. Clean, lots of negative space, centered." \
  --headline "98% of your site visitors leave without a trace" \
  --cta "Get them back — \$7 a lead" \
  --out working/batches/hvac-20260702/c1_98walkout_4x5.png
```

Raw body:
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "style_id": "214dccd1-dca3-43e6-b005-c664e1b33338",
  "prompt": "Line-art scene: a crowd of small figures walking out of an open doorway shaped like a browser window, fading to faint outlines as they leave; one figure turns back. Navy outlines, white fills, single mint accent on the figure turning back. Clean, lots of negative space, centered.",
  "text_layout": [
    {"text": "98% leave without a trace", "bbox": [0.08, 0.06, 0.92, 0.24]},
    {"text": "Get them back — $7 a lead", "bbox": [0.08, 0.80, 0.92, 0.93]}
  ]
}
```
Also queue **1080x1080** and **1080x1920** cuts (same prompt, adjust bbox y-values for the taller story frame).

---

### C2 — "$7 vs $46" (Track A, line-art diagram)

```bash
python3 scripts/recraft_ad.py \
  --track brand \
  --size 1080x1350 \
  --prompt "Line-art split comparison diagram. Left side: a single lead card with 5 hands reaching for it, labeled with a price tag. Right side: one lead card handed to one contractor, clean. Navy outlines, white fills, mint accent on the single right-side card. Balanced two-column layout, centered." \
  --headline "Shared: ~\$46, split 4–5 ways" \
  --cta "Exclusive: \$7, yours alone" \
  --out working/batches/hvac-20260702/c2_7vs46_4x5.png
```

Raw body:
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "style_id": "214dccd1-dca3-43e6-b005-c664e1b33338",
  "prompt": "Line-art split comparison diagram. Left side: a single lead card with 5 hands reaching for it, labeled with a price tag. Right side: one lead card handed to one contractor, clean. Navy outlines, white fills, mint accent on the single right-side card. Balanced two-column layout, centered.",
  "text_layout": [
    {"text": "Shared lead: ~$46, split 4–5 ways", "bbox": [0.06, 0.07, 0.94, 0.20]},
    {"text": "Exclusive lead: $7, yours alone", "bbox": [0.06, 0.80, 0.94, 0.93]}
  ]
}
```

---

### C3 — "Sold once. To you." (Track B, photoreal)

```bash
python3 scripts/recraft_ad.py \
  --track raster \
  --size 1080x1350 \
  --prompt "Photoreal: a confident HVAC contractor in a clean work shirt standing beside a service van in a residential driveway, checking a phone, calm and in control (not rushed). Warm natural morning light, shallow depth of field. Navy and mint brand palette in wardrobe/accents, no logos, no stock-photo cheese, authentic." \
  --headline "Sold once. To you." \
  --cta "Exclusive HVAC leads — \$7" \
  --out working/batches/hvac-20260702/c3_soldonce_4x5.png
```

Raw body:
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "style": "realistic_image",
  "colors": [
    {"rgb": [10, 22, 40]},
    {"rgb": [45, 212, 191]}
  ],
  "prompt": "Photoreal: a confident HVAC contractor in a clean work shirt standing beside a service van in a residential driveway, checking a phone, calm and in control (not rushed). Warm natural morning light, shallow depth of field. Navy and mint brand palette in wardrobe/accents, no logos, no stock-photo cheese, authentic.",
  "text_layout": [
    {"text": "Sold once. To you.", "bbox": [0.08, 0.07, 0.92, 0.22]},
    {"text": "Exclusive HVAC leads — $7", "bbox": [0.08, 0.81, 0.92, 0.93]}
  ]
}
```
Also queue **1080x1920** story cut.

---

### C4 — "They asked. Not scraped." (Track A, line-art)

```bash
python3 scripts/recraft_ad.py \
  --track brand \
  --size 1080x1350 \
  --prompt "Line-art: a hand raising to volunteer/opt in above a simple consent checkbox that is checked, with a clean lead card (name + email fields) beside it. Navy outlines, white fills, mint accent on the checkmark. Simple, trustworthy, centered, generous negative space." \
  --headline "These leads opted in" \
  --cta "Name + email. Never resold. \$7." \
  --out working/batches/hvac-20260702/c4_theyasked_4x5.png
```

Raw body:
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "style_id": "214dccd1-dca3-43e6-b005-c664e1b33338",
  "prompt": "Line-art: a hand raising to volunteer/opt in above a simple consent checkbox that is checked, with a clean lead card (name + email fields) beside it. Navy outlines, white fills, mint accent on the checkmark. Simple, trustworthy, centered, generous negative space.",
  "text_layout": [
    {"text": "These leads opted in", "bbox": [0.08, 0.07, 0.92, 0.22]},
    {"text": "Name + email. Never resold. $7.", "bbox": [0.08, 0.81, 0.92, 0.93]}
  ]
}
```

---

### C5 — "New lead just came in" (Track B, photoreal)

```bash
python3 scripts/recraft_ad.py \
  --track raster \
  --size 1080x1350 \
  --prompt "Photoreal close-up: an HVAC business owner at a tidy desk glancing at a laptop screen with a subtle smile as a new-lead notification appears; screen glow soft, no readable UI text. Warm natural light, navy and mint accents in the scene, clean modern small-office feel, authentic, no stock-photo cheese." \
  --headline "New lead just came in." \
  --cta "Exclusive. \$7. Never resold." \
  --out working/batches/hvac-20260702/c5_newlead_4x5.png
```

Raw body:
```json
{
  "model": "recraftv3",
  "size": "1080x1350",
  "response_format": "url",
  "style": "realistic_image",
  "colors": [
    {"rgb": [10, 22, 40]},
    {"rgb": [45, 212, 191]}
  ],
  "prompt": "Photoreal close-up: an HVAC business owner at a tidy desk glancing at a laptop screen with a subtle smile as a new-lead notification appears; screen glow soft, no readable UI text. Warm natural light, navy and mint accents in the scene, clean modern small-office feel, authentic, no stock-photo cheese.",
  "text_layout": [
    {"text": "New lead just came in.", "bbox": [0.08, 0.07, 0.92, 0.22]},
    {"text": "Exclusive. $7. Never resold.", "bbox": [0.08, 0.81, 0.92, 0.93]}
  ]
}
```

---

## 4. Batch summary / launch notes

- **5 concepts × primary 4:5**, with square + story cuts on C1 and C3 → **9 image assets** to generate when this goes live.
- **Testing:** run all five as one Meta ad set on the Leads objective, let delivery find the winning hook, then scale the top 1–2 into their own budget. C1 (loss) and C2 (price contrast) are the strongest bets; C4 (trust) is the safest for cold/lookalike audiences.
- **On-image text kept short** (hook + CTA only) to stay clear of Meta's text-heavy delivery penalty.
- **Compliance:** copy makes only supportable claims — exclusive, opt-in, name + email, flat $7, never resold. The 98% figure and competitor CPLs match the site canon. No "free," no guarantees, no fabricated testimonials.
- **Before a live batch:** confirm the current Recraft raster `model` string and the exact `text_layout` field name against Recraft docs (per recraft-api.md note), then lock into `scripts/recraft_ad.py`.

*(DRY run — nothing above was executed.)*
