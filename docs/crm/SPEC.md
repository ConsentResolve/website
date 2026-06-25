# Consent Resolve CRM — Product Spec v0.1 (DRAFT)

> Status: draft for review. Sequence: **specs → visual mockup → build**. This doc is
> the living spec; we iterate here before any mockup or code.

## 1. Purpose

A single internal system that is the **one place to run marketing + sales** for
Consent Resolve — built to turn the GTM machine into a **repeatable, measurable
funnel with real data**, organized **per industry** (HVAC, roofing, …).

It answers, at any moment:
- Where are my leads, from every source, and what's their status / dollar value?
- What did each channel cost and what did it return (real ROAS), by industry?
- What's scheduled to go out on social this week/month?
- Am I on pace for my goal (e.g. *10 customers in 45 days*) — and if not, what do I change?

## 2. Guiding principles

- **Build on the stack we already have.** Cloudflare Worker + D1 already hold the
  leads (`participants`), the event log (`events`), pageview traffic (`traffic`),
  the social queue (`social_queue`), and an aggregating `/api/analytics`. The CRM
  is a new **`/crm` app + `/api/crm/*` endpoints on the same Worker** — not a new
  platform. Cheap, fully owned, already integrated.
- **Industry is the organizing dimension.** Every lead, campaign, spend row, and
  report is tagged with an industry so we can slice HVAC vs roofing cleanly. Ties
  to the existing `utm_campaign={industry}_2026` convention.
- **Consent-first stays intact.** RB2B-identified visitors (no consent banner) are
  usable for **retargeting + sales intel only**, never dropped into cold outreach.
  The CRM enforces and labels this.
- **One source of truth for warm leads.** Tools (Instantly, Crisp, Apollo) remain
  feeders; the CRM is the system of record once someone is a lead.

## 3. Users & roles

| Role | Who | Access |
|---|---|---|
| Admin | Aaron | Everything incl. spend, goals, settings, integrations |
| Sales | Tyler | Leads, pipeline, reply, status, $; read analytics |
| Exec | execs | Read-only dashboards (funnel, ROAS, goals) |

**4 users total** (Aaron = Admin, Tyler = Sales, +2 to assign). Auth reuses the existing
Worker session/key gating; roles are a column on a small `users` table.

## 4. Data model (D1)

New tables (alongside existing `participants`, `events`, `traffic`, `social_queue`):

- **`industries`** — slug, name, active. The 17 trades; "active wave" flag.
- **`campaigns`** — id, industry, channel (`instantly|meta|google|social|organic|referral`),
  external_id (Instantly campaign id, Meta campaign id…), `utm_campaign`, status, created_at.
- **`leads`** — the unified record. `id, source, industry, name, email, phone, company,
  domain, owner_user, stage, status (open|won|lost|closed), value_usd, consent_status
  (consented|identified|unknown), first_seen, last_activity, campaign_id, utm_source/medium/content,
  notes`. **Dedup key: email (fallback domain).** Demo signups in `participants` are mapped/mirrored in.
- **`lead_activity`** — timeline rows: `lead_id, type (email_out|email_in|chat|page_view|
  status_change|note|task|call), body, actor, at, meta`. (Extends/reuses `events`.)
- **`spend`** — `id, industry, channel/tool (instantly|apollo|crisp|meta|google|other),
  period (month), amount_usd, source (manual|api), note`. Subscriptions = manual; ad spend = API-pulled.
- **`subscribers`** — mailing list: `email, name, industry, status (subscribed|active|unsub),
  source, engagement_score, last_engaged`. Promotes to `leads` when "active."
- **`goals`** — `id, industry, metric (customers|revenue|leads), target, window_days,
  start, status`, plus a generated `plan` blob.
- `social_queue` (existing) feeds the calendar; `spend` + `leads` feed ROAS.

## 5. Feature modules (mapped to your requirements)

### A. Unified Leads Inbox + Pipeline  — **MVP**
One list of leads from **every source**, with filters (industry, source, stage, owner).
| Source | How it lands in the CRM |
|---|---|
| Website / demo forms | Already in D1 `participants` → mirrored into `leads` (done: signups now also email `hello@`). |
| Instantly cold-email replies | **Via the Gmail API** — replies land in the 4 connected sending inboxes, so the CRM reads them directly (no Instantly webhook/upgrade). Instantly API stays read-only for aggregate campaign stats. |
| Crisp live chat | Crisp REST API / webhook → new conversation w/ captured email → lead. |
| RB2B identified visitors | RB2B webhook → lead flagged `consent_status=identified` (retarget/intel only, not outreach). |
| Meta lead / manual | Manual "+ Add lead"; optional Meta lead-form ingest later. |

- **Reply from your Gmail (full two-way, MVP):** **Gmail API (OAuth)** on the connected Google accounts — read incoming + send replies **inside the CRM**, threaded on the lead. This is *also* how cold-email replies are ingested (they arrive in the 4 sending inboxes), so no Instantly upgrade is needed. Scopes: `gmail.readonly` + `gmail.send` (or `gmail.modify`) per account. Setup: a Google Cloud project with the Gmail API enabled + per-account OAuth consent.
- **Pipeline:** stages New → Contacted → Qualified → Demo → Proposal → **Won / Lost / Closed**, drag-or-click status, plus **deal `value_usd`** and **owner**. Notes + tasks per lead.

### B. Per-industry marketing analytics  — **MVP**
Every view filterable by industry. Funnel per industry built from real data:
**spend → impressions/clicks (`traffic`) → leads → demos → won**, with derived
**CPL, cost/demo, CAC, win-rate**. Reuses + extends `/api/analytics` (already has
by_campaign / by_source / by trade).

### C. Marketing spend + ROAS  — **MVP (core), live-pull in P2**
- Log spend per **tool/channel × industry × month**: Instantly sub, Apollo sub,
  Crisp sub, ad spend. Tool subscriptions entered manually; **ad spend pulled live**
  from the Meta API (already wired in `/api/analytics`), Google later.
- **ROAS reporting:** revenue (sum of `won` `value_usd`) ÷ spend, by industry / channel
  / period; plus CAC and blended cost-per-booked-job. This is the "real data" engine.

### D. Mailing list + nurture  — **Phase 2**
- `subscribers` list (from demo signups who didn't buy, opt-ins, warm replies).
- Nurture sequences via **Resend + our Worker** (built-in; no Instantly/Klaviyo).
- Track engagement; when a subscriber crosses an **"active" threshold** (opens/clicks/
  visits), auto-create a `lead` and notify the owner.

### E. Social media calendar  — **MVP (read-only)**
- **Week + month** views of everything scheduled/published, across platforms, sourced
  from the existing `social_queue` (+ `social/cards.json`, `resource-cards.json`).
  Color by platform/status. Editing/scheduling = Phase 2.

### F. Goals engine (AI-assisted)  — **Phase 2**
- Set a goal: e.g. *10 new customers in 45 days* (optionally per industry).
- The engine reads **real conversion rates** (click→lead→demo→won) and current pace,
  computes the **required top-of-funnel** (how many leads/clicks/spend needed), compares
  to current trajectory, and **recommends specific moves** with the existing stack
  (load N more Apollo leads, raise Meta budget $X/day, launch a second wave, tighten
  reply SLA) — or flags that the goal isn't reachable and what would have to change.
  Powered by Claude over the CRM's own numbers.

### G. Integrations layer
| Tool | Direction | Used for |
|---|---|---|
| **Instantly** | pull (API) / webhook | campaigns, cold-reply leads, sent/open/reply stats |
| **Apollo.io** | manual import (current flow) + spend | lead source + spend line |
| **RB2B** | webhook in | identified-visitor leads → **retargeting audience + chat personalization** (intel only) |
| **Crisp** | API/webhook | chat → leads; chat volume; cost line |
| **Meta Ads** | pull (API) + push | spend/impressions/conversions; sync audiences |
| **Google Ads** | future | retargeting + spend |
| **Social framework** | pull | calendar + per-platform engagement into analytics |

> **Flagged as possibly-separate project (your note):** RB2B → Crisp **personalization**
> (greeting a known visitor by company in chat). The CRM will *store* RB2B leads and can
> *trigger* it, but the live-chat personalization UX may be its own build. Marked out of
> MVP.

## 6. Compliance guardrails (carried into the CRM)

- `consent_status` on every lead. **`identified` (RB2B) leads cannot be added to cold
  email/SMS** — UI blocks it; they're for retargeting + intel only.
- Consented (demo/opt-in) leads get the full nurture path.
- CAN-SPAM / TCPA framing preserved; unsubscribe honored across lists.

## 7. Technical approach

- **Backend:** Cloudflare Worker + D1 (+ KV/R2 as needed). New `/api/crm/*` routes;
  reuse `/api/analytics`, `participants`, `events`, `traffic`, `social_queue`.
- **Frontend:** a gated `/crm` admin UI (single-page, same brand as `/dashboard`/`/admin`).
- **Ingestion:** webhooks where supported (Crisp, RB2B, Instantly-if-Hypergrowth);
  scheduled Worker polls otherwise (Instantly API, Meta insights — cron already exists).
- **Auth/roles:** existing session/key + a `users.role` column.

## 8. Proposed MVP (Phase 1) — the "initial feature set"

The smallest thing that makes the funnel real and reviewable:
1. **Unified Leads + Pipeline** (A): demo/website + manual + Crisp + **cold-reply ingest via Gmail**;
   status, $ value, owner, notes; **full two-way Gmail reply inside the CRM**.
2. **Per-industry funnel analytics** (B).
3. **Spend + ROAS** (C): manual tool spend + live Meta ad spend; revenue from `won`.
4. **Social calendar** (E): read-only week/month from `social_queue`.

**Deferred to Phase 2+:** mailing list/nurture (D), goals engine (F),
RB2B↔Crisp personalization, Google Ads, advanced multi-touch attribution.

## 9. Phasing

- **P1 (MVP):** A (core, incl. **Gmail two-way**), B, C (core), E (read-only). → a working single pane + real ROAS.
- **P2:** list + nurture (D, Resend+Worker), goals engine (F), RB2B lead ingest + audience sync, social calendar editing.
- **P3:** Google Ads, automation/playbooks, multi-touch attribution, forecasting.

## 10. KPI definitions (so ROAS is honest)

Lead, MQL/active, demo (registered+consented), customer (won), revenue (`value_usd` of won),
spend (tool subs + ad spend), **CPL, cost/demo, CAC, ROAS = revenue/spend, win-rate** —
all sliceable by industry + channel + period. (Finalize exact definitions in review.)

## 11. Decisions (LOCKED 2026-06-25)

1. **Reply from Gmail:** ✅ **Full Gmail-API two-way inside the CRM.** Read + send as the connected Google accounts, threaded on the lead. Replies are NOT routed through Instantly. → moved into **MVP**.
2. **Instantly cold-reply ingest:** ✅ **Via the Gmail API, not Instantly.** Cold-email replies land in the 4 connected Gmail inboxes, so the same Gmail integration that powers replying also *ingests* replies — **no Hypergrowth/Unibox upgrade needed.** Instantly's API is used **read-only for aggregate stats** (sent/open/reply/interested) in analytics only.
3. **Nurture engine:** ✅ **Resend + our Worker** (built-in). No Instantly/Klaviyo for nurture.
4. **Revenue/$ entry:** ✅ **Manual on "Won"** for now. Billing/Stripe deferred.
5. **Users:** ✅ **4 users** (Aaron = Admin; Tyler = Sales; +2 — roles assignable). Names/roles TBC.
6. **RB2B ↔ Crisp personalization:** ✅ **Separate project** — out of CRM scope. The CRM still stores RB2B leads.
7. **Hosting:** ✅ **Cloudflare Workers + D1.**
