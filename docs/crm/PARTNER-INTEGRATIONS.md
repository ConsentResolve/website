# Partner Integration Plan

Source of truth for targets: the "Integration Partners" Google Sheet
(snapshot in [integration-partners.csv](./integration-partners.csv), pulled 2026-07-21).
46 platforms, prioritized 1 (do first) → 4 (skip for now).

The job to be done: when ConsentResolve recovers a consented lead from a
contractor's website, push that lead into the tool the contractor already
lives in. Everything below is in service of that one flow:

```
recovered lead (normalized) ──► connector adapter ──► partner CRM/FSM
```

## What the sheet actually says, grouped by build shape

The 46 rows collapse into five build shapes. Build effort clusters by
auth/API model, not by vendor, so one adapter pattern per shape covers
many partners.

### 1. OAuth app + marketplace listing (real "native integration")
- **Jobber** — GraphQL + OAuth2 + webhooks, free dev account, app store
  via Developer Center review. 350k+ pros. *Sheet priority 1.*
- **ServiceTitan** — OAuth2 but partner-gated, paid tiers with annual
  dues + security review. ~100k contractors. *Priority 2 slow burn;
  also unlocks FieldRoutes (pest) which is now a ServiceTitan product.*
- Mailchimp, Square Appointments — open OAuth + app directories, trivial
  builds, low strategic value (priority 2–3).

### 2. Per-customer API key (customer pastes a key into our dashboard)
- **Workiz** — open REST + webhooks, owns locksmith/garage-door/appliance. *Priority 1.*
- **JobNimbus** — open REST, API key; 8k+ roofing businesses. *Priority 1.*
- **JobTread** — open API (Pave query language) + webhooks + an official
  API Developer Certification; most dev-friendly construction platform. *Priority 1.*
- Housecall Pro (already works this way for us per-customer; a *listed*
  native integration needs a BD relationship, not a portal), Leap,
  Service Fusion (PRO-plan customers only), FieldPulse, Kickserv,
  SingleOps — **SingleOps has a Lead Entry API literally purpose-built
  for pushing external leads in**; easiest technical fit in tree care.

### 3. Partner/BD-gated APIs (apply first, build second)
AccuLynx, FieldRoutes, PestPac + RealGreen (one WorkWave BD relationship
covers both), Podium, Service Autopilot, CallRail (formal tech-partner
application). Start applications early — the approval clock, not the
code, is the critical path.

### 4. Zapier-only platforms (~15 rows)
DripJobs, ZenMaid, PaintScout, Orbisx, Estimate Rocket, BookingKoala,
Briostack, and most of the priority-4 list have no public API but do
have Zapier connectors. **One published ConsentResolve Zapier app
covers all of them at once** — this is the single highest-leverage
build in the whole sheet.

### 5. Co-marketing, not integration
Hatch (priority 1 — complement, not competitor: we recover the visitor,
Hatch runs the follow-up sequence), CompanyCam, Roofr, ResponsiBid,
NiceJob/Broadly. These are partnership conversations, not code.

## Recommended build order

| Phase | Ship | Why |
|-------|------|-----|
| 0 | Generic outbound webhook + Zapier app | Covers every partner on day one, including the 15 Zapier-only tools and anything gated. Unblocks sales immediately. |
| 1 | Jobber (OAuth + marketplace) | Only priority-1 with a self-serve app store; listing = distribution + logo credibility. |
| 1 | Workiz, JobNimbus, JobTread (API-key adapters) | Open APIs, small builds, each owns a hero trade (locksmith/garage, roofing, GC). |
| 1 | Hatch co-marketing conversation | No code; sheet says their partner page explicitly fits our category. |
| 2 | Start gated applications in parallel: ServiceTitan partner program, CallRail tech partner, AccuLynx, WorkWave BD | Long approval lead times; file now, build when approved. |
| 3 | SingleOps, Leap, Service Fusion, Mailchimp | On-demand as verticals show traction. |

## Architecture sketch (for this branch)

One normalized lead payload, one adapter interface, N adapters:

```ts
interface RecoveredLead {
  email: string; phone?: string; name?: string;
  address?: string; trade?: string;
  consent: { ts: string; policyVersion: string; sourceUrl: string };
  session: { pages: string[]; firstSeen: string; lastSeen: string };
}

interface PartnerAdapter {
  slug: string;                       // "jobber", "workiz", ...
  auth: "oauth2" | "api_key" | "webhook";
  pushLead(lead: RecoveredLead, creds: PartnerCreds): Promise<PushResult>;
}
```

- Adapters live in the worker (`worker/_lib/partners/<slug>.js`), invoked
  from a single delivery queue with retry + dead-letter, so every partner
  gets identical retry/telemetry behavior.
- OAuth token storage and per-customer API keys both hang off the customer
  record; the adapter declares which it needs.
- The consent metadata travels with every push — it's the product's whole
  differentiator, so every adapter writes it into the partner's notes/custom
  fields even when the partner has no first-class field for it.

## Jobber build (landed on `partner-integrations-test`; completed on `claude/jobber-consentresolve-integration-r0nsjx`)

Adapter: `worker/_lib/partners/jobber.js` · routes: `worker/api/partners-jobber.js`
· delivery dispatch: `worker/_lib/partners/deliver.js` · offline tests:
`node scripts/test-jobber.mjs`.

The recovered-lead loop is now wired end to end: a demo consent
(`worker/api/consent.js`) normalizes the participant into the shared
`RecoveredLead` shape and fans it out via `deliverLeadToPartners()` after the
response (waitUntil) — skipped silently until a partner account is actually
connected, and each delivery is logged both to `partner_deliveries` and to the
participant's event timeline (`partner_delivery`). New adapters plug into
`deliver.js`, not into the consent flow.

Endpoints (all under the existing CRM gate):
`GET /api/partners/jobber/auth` (start OAuth) · `/callback` · `/status`
· `POST /api/partners/jobber/push` (test-push a lead) · `POST …/webhook`
(HMAC-verified; handles APP_DISCONNECT — a marketplace-review requirement).

To go live: create the app in Jobber's Developer Center (client read/write
scopes; callback + webhook URLs are in the header of `partners-jobber.js`),
`wrangler secret put JOBBER_CLIENT_ID` / `JOBBER_CLIENT_SECRET`, then visit
`/api/partners/jobber/auth` from a `/crm` session.

Consent-note mutation: the original build used `clientNoteCreate`, but that
field was **removed** from the Mutation type; the current mutation is
`clientCreateNote(clientId:, input: ClientCreateNoteInput)` where the input
carries `{ message, attachments, pinned, linkedTo }`. **Verified live**
(GraphiQL against a dev account, API 2025-04-16, 2026-07-29): the adapter's
exact mutation — including the `clientNote { id }` payload selection and
`pinned: true`, which keeps the consent receipt at the top of the client's
notes — executed cleanly. Note failures stay non-fatal to the lead push by
design.

## Site-claims drift (flag, don't fix yet)

`src/data/integrations.ts` (the marketing claims spine) lists GoHighLevel,
Salesforce, HubSpot, etc. — but none of the sheet's priority-1 trade
platforms except Jobber/Housecall Pro/ServiceTitan. Workiz, JobNimbus, and
JobTread are absent. Per that file's own note, anything not shippable as
native by launch must be rephrased "via Zapier or webhook." Reconcile the
spine with this plan once phase-1 adapters are real.
