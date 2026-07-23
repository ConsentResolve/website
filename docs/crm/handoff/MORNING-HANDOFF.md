# CRM Rebuild — Morning Handoff (overnight build)

**Branch:** `crm-rebuild-foundation` (NOT merged, NOT deployed — deploy is your call).
**Scope tonight:** Part 7.1 (Foundation) + Part 7.2 (follow-up engine, email-first) from
`proto/CRM-REBUILD-MASTER.md`, plus the data migration and serving the frozen frontend
behind the existing auth. Everything is additive and dormant — **the live site and the
current `/crm` are untouched and keep working.**

Nothing here has been deployed and no automation can send anything until you (a) deploy
this branch and (b) flip `WORKFLOW_ENGINE_ENABLED=true`.

---

## What got built (all committed on `crm-rebuild-foundation`)

### 1. Foundation schema — real migrations
- `worker/migrations/0001_crm_foundation.sql` — the canonical numbered migration.
- `worker/_lib/crm-rebuild.js` — `ensureRebuildSchema()` runtime applier (idempotent,
  mirrors the .sql; guards the `contacts` ALTERs with PRAGMA), plus the consent-gate
  primitives: `logEvent`, `recordConsent`, `addSuppression`, `isSuppressed`,
  `consentState`, **`canSend`** (checked before every SMS/voice/email action).

New tables: **`crm_events`** (append-only source of truth — note the name; `events`
already belongs to the public demo), **`consent_records`** (the ledger, grants + revocations,
≥5yr), **`suppressions`** (generalizes `crm_suppressions`), **`workflows` / `workflow_runs`
/ `workflow_steps`**. New `contacts` columns: `lifecycle_stage`, `utm_first`, `utm_latest`,
`dormant_since`.

Validated: applies clean on SQLite; worker builds; all values confirmed.

### 2. Data migration — "migrate the current CRM into this one"
- `worker/api/crm-rebuild-migrate.js` → `/api/crm/rebuild/migrate` (admin-gated, idempotent
  via deterministic ids + `INSERT OR IGNORE`; dry-run by default).
- Backfills `crm_events` from `crm_leads`, `crm_activity`, v2 `messages`, `deals`, the demo
  `events` table; `consent_records` from `participants` (+ demo consent) and
  `crm_leads.consent_status='consented'`; `suppressions` from legacy `crm_suppressions`;
  sets `contacts.lifecycle_stage` from deals.

### 3. Follow-up engine — the centerpiece (email-first)
- `worker/_lib/workflow-engine.js` — cron-driven (runs on the existing `*/5` cron; **no new
  Cloudflare bindings required for v0**). Two seeded sequences: **speed-to-lead**
  (SMS→AI-call→email→next-day-SMS) and **earn-consent** (email-only). On enroll it routes by
  consent: SMS-PEWC present → speed-to-lead, else earn-consent. Every step emits a
  `crm_event` (step-level reporting is a query). Consent gate + conservative quiet-hours
  (9am–8pm America/Chicago — intersects TX/FL/OK/WA) enforced. Auto-enroll sweep reacts to
  new inbound conversations (approximates "emit lead_created → engine reacts" without editing
  every ingest handler).
- `worker/api/crm-workflow.js` → `/api/crm/workflow` (admin): status, `?tick=1` (run once),
  `?seed=1`, POST `{enroll:{contactId}}` / `{goal:{contactId,goal}}`.
- **Email** sends via Resend (already integrated). **SMS (Telnyx)** and **AI voice (Retell)**
  are fully coded but **HOLD** — inert until their secrets exist (see below); the engine
  skips them and keeps the email track moving.
- **Dormant by default:** the whole engine no-ops unless `WORKFLOW_ENGINE_ENABLED=true`.
  Validated: build + all engine SQL/semantics (routing, dedup, apollo-exclusion, goal exits).

### 4. Auth — carried over, no new system
- `/crm/app` (new frozen UI) and every new endpoint reuse the existing **Google → `cr_crm`
  cookie** session (`_lib/auth.js`, `crm-auth.js`). Admin ops gate on `isAdmin` (users.role).
  No second auth system; nothing to migrate — the login you have is the login.

### 5. Frozen frontend served behind login
- `worker/crm-app.html` (built from `proto/screens`) served by `worker/crm-app.js` at
  **`/crm/app`**, gated by `cr_crm`, with a branded Google sign-in fallback. Coexists with
  legacy `/crm`. Currently runs on its bundled **demo fixtures** — the shell, live behind
  login. The per-screen data swap is the top follow-on task (below).

---

## Deploy + run (YOUR steps — I did not touch prod)

1. **Review the branch**, then deploy:
   ```
   git checkout crm-rebuild-foundation
   npx wrangler deploy            # or merge to main and let CI deploy
   ```
2. **Apply the foundation schema to prod D1** (additive; safe). Either:
   ```
   npx wrangler d1 migrations apply consentresolve-demo --remote
   ```
   or just hit (schema self-applies via the runtime applier on first call):
   ```
   GET https://consentresolve.com/api/crm/rebuild/migrate?ensure=1   (signed in as admin)
   ```
3. **Migrate the data** (dry-run first, then run):
   ```
   GET /api/crm/migrate?run=1                 # existing v1->v2 (contacts/companies/deals)
   GET /api/crm/rebuild/migrate               # dry-run preview of new-table backfill
   GET /api/crm/rebuild/migrate?run=1         # execute (idempotent, re-runnable)
   ```
4. **Verify** the new UI: visit `/crm/app` (sign in with Google). Check
   `/api/crm/workflow` shows the seeded workflows + provider status.
5. **When ready to turn on automation** (email only, safe first): set
   `WORKFLOW_ENGINE_ENABLED=true`. Watch `/api/crm/workflow` and the `crm_events` table.
   Test end-to-end with `/api/crm/workflow?tick=1` and a single test contact via
   `POST /api/crm/workflow {enroll:{contactId}}` before letting the cron auto-enroll.

---

## HOLD FOR MORNING — needs you / external access (coded, inert)

| Item | Why held | Unblock |
|---|---|---|
| **SMS (Telnyx)** | 10DLC approval + no creds here | Set `TELNYX_API_KEY`, `TELNYX_FROM_NUMBER`; approve 10DLC. Engine auto-uses it. |
| **AI voice (Retell)** | No account/creds | Set `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_FROM_NUMBER`. |
| **Resend from consentresolve.com** | DNS unverified (still tryconsentresolve.com) | Verify domain in Resend; set `FROM_EMAIL` to the consentresolve.com sender. |
| **Chatwoot cutover** | Part 7.3, replaces Crisp | Stand up Chatwoot; separate task — not started tonight. |
| **Deploy + prod D1 migrate + engine enable** | Production-mutating; your gate | Steps above, when you're ready. |
| **TCPA counsel review** | Compliance | Review the consent copy, the AI-call script (`workflow-engine.js` `tpl`), the quiet-hours window, and the assumption below. |

**Assumption to confirm (flagged in code):** the demo/get-started "contact consent"
checkbox was backfilled as PEWC for SMS/voice. If that checkbox's disclosure text is NOT
full PEWC, treat those as email-only until re-consented (change is in
`crm-rebuild-migrate.js` section B1).

---

## Remaining work (the honest next steps, in order)

1. **Per-screen fixture→fetch swap** (Task: "Serve frozen frontend wired to real endpoints").
   The frozen `/crm/app` reads `window.DATA/ENRICH/DIRECTORY/SEQUENCES/ANALYTICS/
   CONSENT_LEDGER/INTEL/NURTURE/SITESPY`. Build `/api/crm/app` endpoints returning those exact
   shapes from v2 + `crm_events`, and add a bootstrap to the served page that fetches and
   `Object.assign`s them onto `window` before init (build.py can emit a "live" variant).
   Cleanest mappings first: **Consent** (from `consent_records`), **Sequences** (from
   `workflows`/`workflow_runs`/`workflow_steps`), then **Inbox** (conversations+messages).
2. **Emit `lead_created` from ingest handlers** (meta/demo/instantly/crisp) so enrollment is
   event-driven rather than the conversation-sweep approximation.
3. **Wire reply/booked/opt-out → `handleGoalEvent`** in the inbox reply + STOP paths so
   sequences exit the moment a human replies.
4. **Cutover:** once `/crm/app` is data-wired and tested, point `/crm` at it and retire the
   legacy `worker/crm.js`.
5. **Later (Part 7.5/6):** Cloudflare Workflows/Queues/DO upgrade (durable waits), Chatwoot,
   activation sequences, visual workflow builder.

## Files added/changed tonight
```
worker/migrations/0001_crm_foundation.sql   (new)
worker/_lib/crm-rebuild.js                   (new)
worker/_lib/workflow-engine.js               (new)
worker/api/crm-rebuild-migrate.js            (new)
worker/api/crm-workflow.js                   (new)
worker/crm-app.js + worker/crm-app.html      (new — served /crm/app)
worker/index.js                              (routes + */5 cron tick + /crm/app)
wrangler.jsonc                               (unchanged net; custom rule tried+reverted)
```
