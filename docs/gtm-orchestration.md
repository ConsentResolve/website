# Consent Resolve — GTM orchestration playbook

One **industry wave** at a time. Every channel (cold email, ads, social, owned nurture) carries the
same industry message, timed to compound, measured in one dashboard. Claude conducts the prep,
creative, data, and reporting; the account holder executes sends/spend/exports.

## Roles
| Claude (conductor) | You (account holder) |
|---|---|
| Industry brief + ICP spec, UTM scheme | Apollo export + list verification |
| Build Instantly campaign via API (paused) | Review + launch |
| Generate industry ad + social creative | Set ad budgets, upload audiences |
| Set social calendar to the wave | Approve/auto-post |
| Build Klaviyo flows + push contacts (later) | Klaviyo account/billing |
| **Run the dashboard** (the instrument) | Read it, decide go / next industry |

## Naming & UTM convention (tag everything, every channel)
- **Wave id = `utm_campaign=<industry>_2026`** — e.g. `hvac_2026`. Same on every link in the wave.
- **`utm_source` per channel:** `instantly`, `facebook`, `instagram`, `x`, `linkedin`, `youtube`,
  `tiktok`, `gbp`, `klaviyo`, `retarget_meta`, `retarget_google`.
- **`utm_medium`:** `email` (instantly/klaviyo), `social` (organic), `paid_social` (meta retarget),
  `display` (google retarget), `video` (youtube).
- Demo link template:
  `https://consentresolve.com/demo?utm_source=<src>&utm_medium=<med>&utm_campaign=hvac_2026`
- **Macro-groups** (dashboard `CHGROUP`): Outreach (instantly) · Social (organic) · Retargeting
  (retarget_*) · Email-nurture (klaviyo, *deferred*) · Direct.

## Funnel & data sources
| Stage | Source (today) |
|---|---|
| List size | Apollo (manual input) |
| Emailed / opens / replies / interested | **Instantly API** (to wire) |
| Site visits (by channel + wave) | D1 `traffic` (`/api/hit`: `utm_source`, `utm_campaign`) |
| Demo signups | D1 `participants` (registered) |
| Opted-in / activations | D1 `participants` (`consent_contact`, `enrolled_at`) |
| Cost / CAC | Ad spend (manual input) → cost/demo, cost/customer |

**Industry dimension:** `participants.trade` already tags the conversion side (`hvac`); `traffic.utm_campaign`
tags the source side (`hvac_2026`). v1 uses both cuts side-by-side (participants don't yet carry
`utm_campaign`, so the click→demo join across a single wave is a known seam — fine for now).

## Wave lifecycle (~4–6 weeks)
0. **Prep:** ICP + UTM + creative set + Instantly campaign built (paused).
1. **Cold intro:** Instantly 3-email sequence to the Apollo list. *(grey-area channel — keep soft, CAN-SPAM clean)*
2. **Ads (concurrent):** upload the same list as Meta/Google custom audiences + pixel-retarget `/demo` clickers.
3. **Social (warm/proof):** calendar bends to the active industry so the feed backs up the email/ad.
4. **Owned nurture (Klaviyo — DEFERRED):** engagers who don't convert → permission-based nurture (the consent-first owned engine).
5. **Convert:** `/demo` → register → activate ($7 leads).

## Per-industry research framework (run this for every wave)
Each trade differs — research before targeting:
1. **Pain economics** — $/lead, to whom, resold how many times, real CAC → sets message + proves the contrast.
2. **Lead-buying ecosystem** — which platforms/channels *that trade* buys from.
3. **Buying signals** — observable (lead-platform presence, Google LSA badge) + Apollo (trade-specific tech stack, intent topics, hiring).
4. **Geo** — where demand × CPL × competition concentrate (climate/seasonality/regulation differ per trade).
5. **Decision-maker + size sweet spot.**
6. **Output** — Apollo filter spec + cross-ref enrichment + message angle.

## HVAC — Wave #1 (researched)
**Pain economics:** Angi $15–85/lead +~$300/yr resold to **3–8**; Thumbtack $10–75 to 3–5; Angi effective
CAC ≈ **$2,500**; paid-search CPL **$70–150 (to $250 in hot metros)**, LSA HVAC ~$63. → $7 exclusive
consent-first lead is a different universe, not a discount.

**Geo: Texas metros — Dallas–Fort Worth, Houston, San Antonio, Austin.** Highest CPL + competition (Dallas
named most-competitive), Sun-Belt year-round cooling demand, **Central-Time aligned with our inboxes**.
Wave #2–3 expansion: Phoenix/Tucson, Atlanta, Tampa/Orlando, Charlotte, Las Vegas.

**Apollo ICP (pull this list for me):**
- Industry: HVAC / Heating, Ventilation & Air Conditioning (NAICS 238220)
- Location: DFW, Houston, San Antonio, Austin metros
- Headcount: 5–75 (core 10–50)
- Titles: Owner / President / Founder / GM / Marketing Manager
- **Buying-signal technologies (tiered — see scoring in `apollo_to_instantly.py`):**
  - *Tier 1 — buying leads / running ads now (web-detectable, strongest):* CallRail, CallTrackingMetrics, Marchex, WhatConverts, DialPad (call tracking = they measure bought leads); Google/Microsoft Ads pixels; Scorpion, Blue Corona, Hibu (hired a marketing agency)
  - *Tier 2 — sophisticated operator + budget:* ServiceTitan, Housecall Pro, Jobber, FieldEdge, Service Fusion, Workiz (FSM/CRM); Podium, Birdeye, NiceJob (reputation)
  - *Tier 3 — growth-minded:* Intercom/Drift/tawk (webchat), HubSpot, Hotjar, Calendly/Acuity
  - **Detectability caveat:** Apollo reliably detects *web-visible* tech (call tracking, ad pixels, chat, review widgets); back-office FSM (ServiceTitan etc.) is detected less reliably (via job postings) → weighted lower. Per-trade, extend Tier-2 with that trade's stack (e.g. roofing: EagleView, HOVER, AccuLynx).
- **Intent topics:** HVAC marketing / lead generation
- Verified email (<3% bounce); prefer named inboxes over `info@`
- **Cross-ref pass:** flag accounts present on Angi/Thumbtack/HomeAdvisor or with a Google LSA badge (= buying now)

**Lead scoring:** when the Apollo export is fed in, Claude ranks by buying signals (tech present, size,
title seniority, metro, platform presence) so the hottest accounts send first.

**Message angle:** the shared-lead treadmill — a $149 HVAC lead split across 5 contractors vs. a $7
exclusive consent-first lead. Tie to local CPL math per metro.

**Channels & UTMs:** Instantly `utm_source=instantly` · Meta/Google retarget `retarget_meta`/`retarget_google`
· organic social `facebook|instagram|x|youtube|tiktok|gbp` — all `utm_campaign=hvac_2026`.

**Targets (set baselines):** open % / reply %, click→demo %, demos, activations, cost/demo, cost/customer.

## Dashboard (the instrument)
Per-wave funnel + channel attribution + cost. Built on `/api/analytics` (D1) + R2 metrics + (to wire)
Instantly & Klaviyo APIs + ad-spend input. See `scripts/gen_dashboard.py`.

## Social rework
Make the scheduler **campaign-aware**: during a wave it pulls the industry creative set and tags posts
`utm_campaign=<industry>_2026`. Keep the weekday calendar and the no-shop-talk-on-LinkedIn rule.

## Klaviyo — DEFERRED (parked by request)
Owned/warm nurture engine, distinct from cold Instantly. Sources: demo signups, warm Instantly replies,
lead-math/newsletter opt-ins, customers. To wire after the rest is running: Klaviyo API for list-growth
+ flow engagement into the dashboard, and contact push-in. **Reminder lives here.**
