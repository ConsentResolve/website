# Bulk Prospecting Pipeline — Spec

Status: **DRAFT for approval** · Owner: Andy · Drafted 2026-08-03

A batch system that turns a city+trade query into a ranked list of contractors who are
**already paying for leads / already spending on marketing** — the exact people for whom
"$7 flat, consent-first" is an obvious trade-down. It is the bulk, autonomous sibling of the
per-lead **Intel lookup** already shipped in the CRM (`worker/api/crm-lookup.js`): same
DataForSEO calls, run over thousands of domains instead of one, with the results scored,
stored, and reviewable.

The design principle throughout: **spend the cheap signals to eliminate, reserve the
expensive signals for survivors.** Every DataForSEO response returns an exact `cost` field —
we log the real dollars per prospect, so spend is *measured*, never estimated.

---

## 1. What it produces

A `prospects` table in D1, each row a scored contractor:

- Identity: name, domain, phone, city, trade, rating, review count
- Signals: paying-per-lead, running-ads, ad-spend, call-tracking, field-CRM, competitor-ID
  pixel, has-form, traffic/mo, domain-age
- A **fit score** (0–100) and **tier** (Hot / Warm / Cold / Disqualified)
- Provenance: which stages ran, exact `cost` spent, timestamp, raw signal JSON

Surfaced in the CRM at a new `/crm` "Prospecting" tab — filter by tier/trade/city, one-click
**promote to lead** (creates a `contacts`+`companies` row and drops it into the pipeline, with
the enrichment already cached so the Intel panel is pre-populated).

---

## 2. The waterfall (cost-ordered stages)

Each stage GATES the next. A prospect only advances if it still looks worth the next (more
expensive) call. `~$` figures are order-of-magnitude — **the worker records the real returned
`cost` per row**, so we tune against actuals after the first run.

| # | Stage | DataForSEO endpoint | Fan-out | ~Cost | Gate to advance |
|---|-------|--------------------|---------|-------|-----------------|
| 0 | **TAM import** | `business_data/business_listings/search/live` | 1 req → many businesses | cheap/prospect | has a website domain (no site → park in a separate `no_site` bucket, different play) |
| 1 | **Tech fingerprint** | `domain_analytics/technologies/domain_technologies/live` | 1 req/domain | ~$ low | any marketing-maturity hit (call-tracking, pixel, field-CRM, competitor-ID) **OR** advance all if budget allows |
| 2 | **Traffic + ads** | `dataforseo_labs/.../domain_rank_overview/live` | 1 req/domain | ~$ low | running paid ads **or** real organic traffic (budget signal) |
| 3 | **Paying-per-lead** | `backlinks/referring_domains/live` | 1 req/domain | ~$ **highest** | run only on domains that passed 1 or 2 — confirms marketplace backlinks (Angi/Thumbtack/HomeAdvisor/…) |
| 4 | **On-page (optional)** | `on_page/instant_pages` | 1 req/domain | ~$ low | detects a lead-capture form (fit for our capture) — only for Hot/Warm survivors |

Stages 1–3 are **exactly the functions already written** in `crm-lookup.js` (`dfsTech`,
`dataforseoLookup`, `dfsBacklinks`) — the pipeline imports them, so the single-lookup and the
bulk-sweep can never drift apart. Stage 0 (Business Listings) and Stage 4 (On-Page) are the
only new DFS calls to add.

**Why this order:** Business Listings is one request per *city+trade* returning dozens of
businesses, so per-prospect it's the cheapest way to build the TAM. Backlinks is the priciest
per-domain call and also the strongest signal ("already paying per lead"), so it goes last and
only touches domains that already proved they market. This keeps a 1,000-domain sweep from
firing 1,000 backlink calls — typically only the ~20–40% that pass stages 1–2.

---

## 3. Scoring model

Weighted sum, capped at 100. Weights reflect **"how obviously do they need us."**

| Signal | Source stage | Weight | Rationale |
|--------|-------------|-------:|-----------|
| Marketplace backlink (paying per lead) | 3 | **+30** | Buying $60–300 shared leads today; $7 flat exclusive is a no-brainer |
| Competitor ID pixel (RB2B / Retention / Warmly / Customers.ai) | 1 | **+20** | We *displace* this directly — warmest possible fit |
| Running paid ads / paid traffic | 2 | **+18** | Has budget + lead intent right now |
| Call tracking (CallRail / WhatConverts) | 1 | **+10** | Measures lead ROI → will grasp CPL math |
| Field CRM (ServiceTitan / Jobber / Housecall) | 1 | **+10** | Operationally able to act on leads fast |
| Lead-capture form present | 4 | **+6** | Ready surface for consent-first capture |
| Ad pixels (Meta / Google) | 1 | **+5** | Actively marketing |
| Rating ≥4.0 **and** ≥20 reviews | 0 | **+5** | Real, reputable local business |
| Organic traffic > 100 /mo | 2 | **+4** | Genuine web presence |
| **Disqualify:** no website | 0 | — | Different product |
| **Disqualify:** national brand / franchise HQ | 0 | — | Not our ICP |

**Tiers:** Hot ≥ 50 · Warm 25–49 · Cold 10–24 · Dead < 10.
Function is pure and unit-testable: `scoreProspect(signals) -> {score, tier, reasons[]}`.
`reasons[]` is the human-readable "why" list the CRM shows on the card.

---

## 4. D1 schema

```sql
-- worker/prospecting.sql  (idempotent, applied by ensureProspectingSchema)
CREATE TABLE IF NOT EXISTS prospects (
  id            TEXT PRIMARY KEY,           -- domain-derived stable id
  domain        TEXT UNIQUE,                -- normalized, no www
  name          TEXT,
  phone         TEXT,
  city          TEXT,
  region        TEXT,                        -- state
  trade         TEXT,                        -- our canonical trade slug
  rating        REAL,
  reviews       INTEGER,
  score         INTEGER DEFAULT 0,
  tier          TEXT DEFAULT 'unscored',     -- hot|warm|cold|dead|no_site|unscored
  signals       TEXT,                        -- JSON blob (parsed signal object)
  stages_run    TEXT,                        -- JSON array e.g. ["tam","tech","traffic"]
  cost_cents    INTEGER DEFAULT 0,           -- summed real DFS cost ×100
  status        TEXT DEFAULT 'new',          -- new|promoted|suppressed
  promoted_contact_id TEXT,                   -- FK once promoted to a lead
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prospects_tier  ON prospects(tier, trade);
CREATE INDEX IF NOT EXISTS idx_prospects_city  ON prospects(city, trade);

-- one row per sweep, for cost accounting + resumability
CREATE TABLE IF NOT EXISTS prospect_runs (
  id          TEXT PRIMARY KEY,
  query       TEXT,                          -- JSON {trade, city, region, limit}
  stage       TEXT,                          -- current waterfall stage
  counts      TEXT,                          -- JSON {found, tech, traffic, backlinks, hot, warm}
  cost_cents  INTEGER DEFAULT 0,
  status      TEXT DEFAULT 'running',        -- running|done|error|paused
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
```

De-dupe by `domain UNIQUE` — a domain already scored is skipped (or refreshed if stale),
so overlapping city sweeps don't re-spend on the same contractor.

---

## 5. The worker

**`worker/api/prospecting.js`** — new route `/api/crm/prospecting` (gated by `crmAuthed`, same
as every CRM endpoint):

- `POST {action:"sweep", trade, city, region, limit}` → kicks a run. Because a full sweep can
  fire hundreds of DFS calls (many seconds), it runs **in stages via cron continuation**, not
  one blocking request:
  - The POST does Stage 0 (Business Listings) synchronously, inserts `new` prospects + a
    `prospect_runs` row at `stage='tech'`, returns immediately with the TAM count.
  - A **new cron branch** in `worker/index.js scheduled()` (e.g. `"*/2 * * * *"` or reuse an
    existing tick) picks up runs where `status='running'`, processes the next stage for a
    **bounded batch** (e.g. 25 domains/tick to respect subrequest + time limits), advances the
    stage, and marks `done` when the waterfall completes. This is the same drip pattern the
    social queue already uses — safe, resumable, no long-held request.
- `GET ?tier=hot&trade=hvac&city=…` → paged prospect list for the UI.
- `POST {action:"promote", id}` → `findOrCreateCompany` + create contact, copy `signals` into
  `companies.enrichment` (so the Intel panel is pre-filled), set `status='promoted'`, drop into
  pipeline at `lifecycle_stage='prospect'`.
- `POST {action:"suppress", id}` → mark dead so it never resurfaces.

**Reused as-is:** `dfsTech`, `dataforseoLookup`, `dfsBacklinks`, `normDomain`,
`findOrCreateCompany`, `ensureCrmV2Schema`. **New:** `dfsBusinessListings(env, {trade, city})`,
`dfsOnPageForm(env, domain)` (optional), `scoreProspect(signals)`, `ensureProspectingSchema`.

---

## 6. Cost model

Real spend is measured (the `cost` field), but the shape to expect:

- **Stage 0** dominates fan-out and is cheapest per prospect (one request → dozens of records).
- **Stages 1–2** touch every domain that has a site — the bulk of spend on a mixed list.
- **Stage 3 (backlinks)** is the priciest call but only fires on the ~20–40% that already
  signaled marketing budget — the gate is what keeps a sweep affordable.
- A `prospect_runs.cost_cents` running total + a per-tier cost readout in the UI means you see
  "this Tampa HVAC sweep found 41 Hot prospects and cost $3.80" before deciding to scale.

A hard **per-run cost ceiling** (`limit` + an optional `max_cost_cents`) stops a runaway sweep;
when hit, the run pauses at `status='paused'` and logs what it dropped (no silent truncation).

---

## 7. Build phases

1. **Schema + scoring** — `prospecting.sql`, `ensureProspectingSchema`, pure `scoreProspect()`
   + a `node --test` for the scorer. (No API spend; fully testable.)
2. **Stage 0 importer** — `dfsBusinessListings`; `POST sweep` does TAM import only, inserts
   `new` prospects. Verify against one real city+trade, eyeball the returned businesses.
3. **Waterfall cron** — the staged drip (tech → traffic → backlinks), batch-bounded, writing
   score/tier/cost. Reuses the three existing DFS fns.
4. **CRM Prospecting tab** — list + filters + cost readout + promote/suppress. Mirrors the
   Intel panel's signal chips so the two feel like one system.
5. **On-page form check (optional)** — Stage 4, only if the form signal proves worth the call.

Each phase is independently shippable and deploys through the now-unblocked GitHub Actions
workflow.

---

## 8. Decisions — LOCKED 2026-08-03

1. **TAM source:** DataForSEO Business Listings (self-contained; no dependency on SmallBiz Intel).
2. **Geo:** Manual `(trade, city)` per sweep.
3. **Promotion:** Manual review → promote (nothing auto-enters the pipeline).
4. **Cost ceiling:** Yes — default `max_cost_cents = 500` ($5/sweep); pause + log on hit.
5. **Refresh:** first score is final until a manual re-run (revisit after first live sweeps).

## 8b. Original open questions (for reference)

1. **Geography seed** — do you want to feed it (trade, city) pairs manually, or seed from a
   fixed target-market list (e.g. the FL metros)? This sets how Stage 0 is driven.
2. **Business Listings vs. an existing TAM source** — DataForSEO Business Listings is the
   simplest, but you've mentioned Outscraper / RefUSA / Places elsewhere (SmallBiz Intel). Use
   DFS here for cohesion, or pull TAM from that shared business DB when it exists?
3. **Cost ceiling** — a default `max_cost_cents` per sweep (e.g. $5) so it can't surprise you?
4. **Refresh policy** — re-score a prospect after N days, or treat first score as final until
   manually re-run?
5. **Auto-promote** — leave promotion manual (review-then-promote), or auto-promote everything
   that scores Hot straight into the pipeline?
```
