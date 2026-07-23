# Consent Resolve CRM Rebuild — Master Document

> **The one document.** Blueprint + current-state findings + vendors + costs + compliance +
> the design-first process, in build order. Feed this (plus CURRENT-STATE.md) to Claude Code.
>
> **RULE ZERO — READ FIRST: No application code is written until the design phase is
> complete and frozen (Part 6, Phase F).** No backend endpoints, no workflow engine, no
> integrations, no "just wiring up one thing." The only code permitted before the freeze is
> the design prototype itself: static Astro pages, CSS tokens, components, and JSON fixture
> files. If a task requires a live API, a database call, or a vendor SDK — it is out of
> scope until the freeze. Add a fixture instead.

---

## Part 1 — Why we're rebuilding

**The three complaints with the current CRM:**
1. Hard to use.
2. Lacks automation — leads dump into an inbox for manual review; nothing happens on its own.
3. Figuring out where a lead came from and what its status is, is cumbersome.

**The goals of the rebuild:**
1. A fully automated speed-to-lead sequence: **SMS → AI voice call → (no answer) email →
   next-day SMS**, applied to every lead source, gated by consent.
2. Full visibility: per-source, per-step, per-message performance. "What's working" is a
   glance, not an investigation.
3. An interface the team actually finds easy — designed and user-tested BEFORE it's built.

**Why speed-to-lead is the centerpiece:** companies responding to a lead within ~2 minutes
convert at roughly double the rate of the ~40-minute average; most contractors take 5+
minutes (often a full day). An automated first touch in seconds is the single highest-ROI
feature in this project, worth more than any UI improvement.

**What this is NOT:** not a from-scratch teardown. The current v2 data model
(companies/contacts/contact_identifiers/conversations/messages/deals), the unified inbox,
the OAuth token store, Meta CAPI with consent-gated dedup, and the
`consent_status=identified` outreach block are all keepers. The rebuild = new foundation
(events + consent ledger + migrations + one unified model) + one big new organ (the
workflow engine) + a redesigned frontend.

---

## Part 2 — Current state: keep / kill / fix

**KEEP (carry into rebuild):**
- v2 schema as the base data model (ULIDs, contact_identifiers cross-channel identity map).
- Unified inbox concept and channel-adapter pattern (webhook in → conversations/messages →
  outbound via provider API → periodic backfill sweep).
- `social_tokens` single OAuth store + in-CRM browser re-auth pattern.
- Consent guardrail: `identified` (Apollo/Leadsy visitors) blocked from outreach. Load-bearing.
- Meta CAPI with `event_id` dedup, consent-gated pixel.
- Real-URL tab navigation (`/crm/<section>`).
- All integrations catalog (Gmail, Meta suite, Instantly, Apollo, GBP, Google Ads, GSC/GA4,
  IndexNow, X, Buffer) — inert-until-secrets pattern preserved.

**KILL:**
- v1 lead model (`crm_leads`/`crm_activity`/`crm_spend` as system of record). v2 wins;
  migrate the v1 consumers (Analytics v1, Spend/ROAS, social calendar, legacy Leads UI).
- Self-creating runtime schema (`ensureCrmSchema` pattern) → real numbered .sql migrations.
- Crisp (replaced by Chatwoot — see Part 4).
- Vestigial `?key=` on cookie-authed routes.
- The single inlined vanilla-JS frontend file → component-based frontend from the design phase.

**FIX (config-level, allowed before design freeze because it's not application code):**
- consentresolve.com DNS verification for Resend (currently sending from
  tryconsentresolve.com — fix the DNS records, verify the domain).
- Add SMS/voice consent (PEWC) language to Meta lead forms and the demo signup NOW, so
  consented contacts accumulate while SMS approval and the build are pending. This is
  form-copy + disclosure changes, not code.

**KNOWN GAP #1 (the whole point):** ingest creates contact + conversation and stops — no
auto-reply, no deal, no owner, no SLA timer. The workflow engine (Part 3) replaces every
bespoke follow-up with one channel-agnostic pipeline.

---

## Part 3 — Target architecture (what gets built AFTER design freeze)

### 3.1 Data model (D1, real migrations)
Everything below already exists in v2 except the four marked NEW:
- companies / contacts / contact_identifiers / conversations / messages / deals / users /
  notes / channel_accounts — carried over.
- **NEW `events`** — append-only source of truth. Every state change is an immutable row:
  `lead_created`, `sms_sent`, `sms_delivered`, `call_placed`, `call_answered`,
  `voicemail_reached`, `email_sent`, `email_opened`, `replied`, `booked`, `signed_up`,
  `script_installed`, `activated`, `opted_out`, `consent_granted`, `consent_revoked`,
  `stage_changed`, `sequence_enrolled`, `sequence_step_completed`, `sequence_exited`.
  Merges the current `activities` + demo `events` concepts. All analytics derive from here.
- **NEW `consent_records`** — the consent ledger. Append-only: contact_id, channel
  (email|sms|voice), type (PEWC|PEC), exact disclosure text shown, capture method,
  source URL, IP, user agent, timestamp, proof artifact ref. Grants AND revocations are
  rows. The current `participants.consent_text_version/ip/user_agent/consented_at` is the
  proto-version — promote it. Retain ≥5 years. This is also a marketable product feature.
- **NEW `workflows` / `workflow_runs` / `workflow_steps`** — sequence definitions +
  per-contact execution state.
- **NEW `suppressions`** (generalize the existing `crm_suppressions`) — channel-specific
  do-not-contact, written instantly on STOP/revocation.
- contacts gains: `lifecycle_stage` (Lead → MQL → SQL → Opportunity → Customer) as a
  separate field from live `lead_status` — the HubSpot lesson: "where in the funnel"
  and "what's happening right now" are different questions.

### 3.2 Workflow engine (Cloudflare-native)
- **Cloudflare Workflows** for durable execution: steps auto-retry; wait steps cost $0
  while sleeping (a next-day follow-up hibernates free).
- **Queues** for fan-out and decoupling ingest from processing.
- **Durable Objects** for per-contact serialization (no double-enrollment races) and
  alarm-based scheduling (quiet-hours deferral).
- **Cron** for materialized funnel-view refresh, snooze sweeps, dormant re-engagement.
- Engine model: **triggers** (`lead_created`, `reply_received`, `no_answer`,
  `stage_changed`, `script_installed`, goal met) → **actions** (`send_sms`,
  `place_ai_call`, `send_email`, `create_deal`, `assign_owner`, `add_tag`, `notify`,
  `move_stage`) → **wait steps** → **if/else branches** → **goal events** that exit early
  (replied / booked / activated / opted out).
- **The inversion:** ingest handlers stop doing follow-up logic. They emit `lead_created`;
  the engine does everything else. Every step emits events, so step-level conversion
  reporting is a query, not a project.

### 3.3 The consent gate (non-negotiable)
The engine checks `consent_records` + `suppressions` **before every SMS or voice action**:
- SMS/voice PEWC present → main sequence.
- Absent (cold Instantly leads, un-consented Meta leads) → **email-only "earn consent"
  branch** driving to a preference-center page where they opt in. Only after opt-in does
  the SMS/AI-call path unlock.
- STOP or any reasonable revocation → instant suppression + revocation record + sequence exit.

### 3.4 The launch sequence (v1 definition)
Trigger: `lead_created` (any source) → consent gate →
1. **SMS** immediately (identity + "Reply STOP to opt out"; keep to one 160-char segment).
2. **AI call (Retell)** ~5 min later if no reply. AI disclosure in the opening sentence.
   AMD detects voicemail → leave short VM → branch.
3. **Email** if the call wasn't answered.
4. **Wait to next day** (zero-cost sleep; resume only inside the allowed window) → follow-up SMS.
Goal events (reply/booked) exit the sequence and move the deal stage. Quiet hours enforced:
8am–9pm recipient-local federal; **9am–9pm for Texas; 8am–8pm for FL/OK/WA**. Outside the
window → Durable Object alarm defers to window-open.

### 3.5 Analytics & attribution
- Funnel: **Lead → Contacted → Replied → Booked → Signed up → ACTIVATED → Paying**,
  per source, per sequence step, per message — all derived from `events` via
  cron-refreshed materialized views.
- UTM + `fbclid`/`gclid` captured at first touch, persisted; store first-touch AND
  latest-touch.
- Meta CAPI (already live) extended: send Schedule (booked) and activation events
  server-side with shared event_id dedup, `action_source: "system_generated"` for
  CRM-originated events.
- Per-lead cost tracking: write Telnyx/Retell unit costs onto send/call events so
  cost-per-lead and cost-per-activation are queryable.

### 3.6 Activation (signups exist, zero activations)
- Activation event: **tracking script installed + first resolved contact delivered.**
- Event-triggered (not calendar) onboarding: welcome within minutes with ONE CTA
  (install the script) → branch on script-detected → 24h reminder + offer a concierge
  install call → dormant re-engagement sweeps for stalled signups.
- Instrument signup → install → first-resolved-visitor so the drop-off step is visible.

---

## Part 4 — Vendors, integrations, costs

| Role | Choice | Why | Cost |
|---|---|---|---|
| SMS | **Telnyx** (10DLC approval in progress) | ~50% cheaper than Twilio; owns network; SIP trunk doubles for Retell BYOC | $0.004/msg + ~$0.003 carrier surcharge ≈ $0.0075–0.0085/segment; ~$10/mo campaign fee; $1/mo number; ~$20–60 one-time registration |
| AI voice | **Retell AI** | Signs every webhook by default; native AMD/voicemail detection; batch API with calling-hour windows; best Workers fit | $0.07/min voice engine + LLM ($0.003–0.01/min for a mid-tier model) + telephony ($0 via Telnyx SIP vs $0.015 via Retell's Twilio) ≈ **$0.09–0.11/min realistic**. Pay-as-you-go, no subscription. Skip Branded Caller ID ($200/mo) at launch. |
| Transactional email | **Resend** (already integrated) on the verified consentresolve.com domain | Already wired; fine at this volume. Revisit Postmark only if deliverability disappoints. | Existing plan |
| Cold email | **Instantly** (unchanged) | Stays on its own throwaway domains. NEVER from the brand domain. | Existing |
| Live chat | **Chatwoot** (replaces Crisp) | Open source; same primitives as Crisp (webhooks in, Application API out, agent-bot) | Cloud ~$19–39/agent to start; self-host on a small VPS later if desired (Rails+Postgres — cannot run on Workers) |

**Chatwoot scope decision (settled):** chat channel ONLY. Website widget + webhooks feed
the custom inbox (channel `chatwoot`); replies go out through the Chatwoot API. It does
NOT become the omnichannel inbox — our inbox is where intel, consent state, deals, and
sequence state live. Migration: stand up → dual-run beside Crisp → backfill → cut over →
delete crm-crisp.js. (Implementation happens post-freeze; account setup/config is fine
anytime.)

**Monthly cost model** (~$0.09/min blended voice, 1 call attempt + 3 SMS per lead):

| Leads/mo | SMS | Voice | Total |
|---|---|---|---|
| 100 | ~$14 | ~$14 | **~$28** |
| 300 | ~$20 | ~$40 | **~$60** |
| 1,000 | ~$45 | ~$135 | **~$180** |

≈ **$0.18–0.30 per lead** for the full sequence. Budget $100/mo for the first 90 days.
Cost movers: extra call attempts (~2× voice), ElevenLabs voices (+$0.07/min), heavyweight
LLMs (up to 27× LLM cost — unnecessary for a scripted qualification call).

---

## Part 5 — Compliance rules (bake into design AND engine)

- AI voice = "artificial or prerecorded voice" under TCPA (FCC ruling, Feb 2024). Marketing
  AI calls and marketing SMS require **prior express written consent (PEWC)**. Penalties
  $500–$1,500 per message/call, uncapped, private right of action.
- Revocation (April 2025 rules): consumers can revoke by ANY reasonable method, not just
  STOP. Honor immediately (10 business days is the legal max). One clarification message
  allowed within 5 minutes, no promo content.
- Quiet hours: federal 8am–9pm local; TX 9am–9pm; FL/OK/WA 8am–8pm. TX SB 140 (Sept 2025)
  extends telemarketing rules to texts, with registration/bond requirements worth counsel
  review given our Texas base.
- Disclose the AI voice in the first/second sentence of every AI call.
- Consent records retained ≥5 years.

**Per-source consent status:**

| Source | SMS / AI call allowed? | Action |
|---|---|---|
| Website signups | YES, once the signup form carries a clear unchecked PEWC checkbox | Add checkbox + log exact text/timestamp/IP (form-copy change — do now) |
| Meta Lead Forms | ONLY with explicit PEWC disclosure in the form + captured proof | Add disclosure to forms now; capture consent text via webhook. Until then treat as cold. |
| Instantly cold leads | **NO. Never.** | Email-only earn-consent branch → preference center opt-in unlocks SMS/voice |
| Apollo/Leadsy `identified` visitors | **NO outreach at all** (existing guardrail) | Unchanged — intel/retargeting only |

**This is not legal advice** — have TCPA counsel review the consent language, AI call
script, and per-source flows before the sequence goes live.

---

## Part 6 — THE DESIGN PHASE (do this first; nothing in Part 3 gets coded until Phase F)

### The method: prototype in the production stack
No Figma. Every screen is a real Astro page styled by final design tokens, powered by
hardcoded JSON fixtures that mimic future API responses. The mockup IS the frontend;
the fixtures become the API contract; the build phase is a fixture→fetch swap. Claude
Code iterates screens with screenshot-critique loops; the team tests in a real browser.

Prototype repo layout:
```
/proto
  /fixtures        contacts.json, inbox.json, contact-360.json, pipeline.json,
                   analytics.json, workflows.json, consent.json
  /src/pages/crm   one .astro page per screen (imports fixtures directly — NO fetch)
  /src/components  chips, timeline, composer, kanban, stat tiles…
  /src/styles      tokens.css (single source of truth)
  DECISIONS.md     running log: tried, killed, why
```

### Phase A — Foundations (half a day)
1. **Job statements**, pinned at the top of DECISIONS.md:
   - Sales (Andy, Tyler, Jason): "Show me every lead that needs a human RIGHT NOW, with
     enough context to reply in one click."
   - Admin (Aaron): "Show me what's working — which source, sequence step, and message
     produces replies/bookings/activations, and what it costs."
   Every element on every screen must serve one of these or be cut.
2. **Complaints → testable requirements:**
   - Hard to use → any core task ≤3 clicks from anywhere; new user productive untrained.
   - Source cumbersome → colored **SourceChip on every surface** a lead appears
     (inbox row, thread header, contact card, pipeline card, analytics rows). Zero clicks.
   - Status cumbersome → two-line status block everywhere: **lifecycle stage** + live
     **SequenceState** ("Step 2 of 4 · AI call in 22 min").
3. **Screen inventory, in design order:**
   1. Inbox (home; 80% of sales time) · 2. Contact 360 · 3. Pipeline ·
   4. Command Center/Analytics (per-source funnel, sequence performance, spend/ROAS,
   cost-per-lead) · 5. **Sequences** (the workflow rendered as a diagram with step-level
   conversion stats printed ON it) · 6. Consent (ledger view — design it like the brand
   differentiator it is) · 7. Settings/Integrations.
   Screens 1–4 are make-or-break; 5 is the new organ; 6–7 are half-days.
4. **Navigation:** keep real-URL tabs; add global ⌘K search (jump to any contact/company/
   conversation) and a persistent "Needs attention" counter (SLA breaches, failed sends,
   consent-blocked items).

### Phase B — Design system (half a day)
1. **Theme decision, made deliberately:** prototype the same Inbox fixture in two token
   files side-by-side — (a) current dark navy `#0a1628`/mint `#00e5a0` with disciplined
   contrast (mint reserved for primary actions + positive states, 4-step surface
   elevation), vs (b) light workspace (paper-white surfaces, navy as text/structure,
   mint as the single action color — "clean and trustworthy" suits a consent-first
   brand, and dense data work usually reads faster on light). Pick in an hour with the
   team looking at both. Log it.
2. **tokens.css:** surfaces ×4, text ×3, borders, action, success/warn/danger; the
   **source-chip palette** (one hue per source — Meta blue, Instantly purple, Chatwoot
   teal, site/demo green, Apollo amber, manual gray — the SAME hue everywhere including
   charts); type scale with tabular numerals for all metrics; spacing, radius, shadow;
   150ms motion, reduced-motion respected.
3. **Component inventory** (build during screen 1, reuse everywhere): SourceChip ·
   LifecycleBadge · SequenceState (with pause/skip controls) · ConsentBadge (per-channel
   ✓/⊘/◌, click → ledger) · SLATimer (amber at 5 min, red at 15) · Timeline · Composer
   (channel-aware) · KanbanCard · StatTile · FunnelBar · DataTable · EmptyState (every
   empty state instructs the next action).

### Phase C — Fixture data (half a day; do NOT skip)
Design dies on real-data messiness, so fixtures must include the ugly cases: 60+ inbox
conversations across ALL channels (email, instantly, chatwoot, meta_lead, demo_form, sms,
ai_call); contacts with no name / no company / provisional; a 40-message thread and a
1-message thread; a consent-blocked lead beside a consented one; a lead mid-sequence, one
that replied (exited), one that opted out, one whose AI call hit voicemail, one failed
SMS; analytics with a zero-lead source, spend-but-no-conversion source, and one runaway
winner; timestamps from "2 min ago" to "3 months ago." Shape fixtures to the Part 3.1
schema so the post-freeze swap is mechanical.

### Phase D — Build the prototype (screens in priority order; 4–6 days)
Per-screen loop: (1) 10-minute brief — the screen's single job, the 3 questions it must
answer at a glance, what's out of scope; (2) two ASCII-wireframe layout concepts → pick
one, log why; (3) build from tokens + components + fixtures; (4) screenshot-critique
against the Phase A requirements — information density errs DENSE (a CRM is a workbench),
keyboard focus visible, works at 1280px and 1680px, mobile is a read-only triage view;
(5) remove one thing before calling it done. Loading/empty/error/"nothing needs you"
states ship with every screen — the best inbox state is "Inbox zero — next sequence touch
fires at 2:14 PM."

**Signature element (spend the boldness here, keep everything else quiet):** the
**SequenceState widget** — a horizontal step-tracker showing the automation in flight
(done steps, current step with countdown, upcoming, exit reason). Compact on inbox rows,
full on thread header, Contact 360, and pipeline cards. It is the single answer to
"what's the status?" and it makes the automation visible, which is what builds the
team's trust in it.

### Phase E — Usability testing (2–3 days elapsed, 3 rounds max)
Andy, Tyler, Jason **separately** (groups defer to the loudest voice). Tasks, not tours;
watch silently; time everything; ask "what did you expect?" at every hesitation.
1. "A new Facebook lead just came in. Find it; tell me where it came from, what the
   system already did, and what happens next." (target <20s, zero clicks for source/status)
2. "Find every lead needing a human reply right now; answer the oldest."
3. "Tyler's out — reassign his open conversations to Jason."
4. "Which source made us the most money last month? Which sequence step leaks the most?"
5. "This contact asked us to stop texting. Show me proof we complied."
6. "Move the Hendersons' deal to 76–99% and set a close date."
Test → fix → retest. If a task still fails in round 3, the design is wrong, not the user.

### Phase F — FREEZE (the gate that unlocks coding)
1. Tag the prototype `v1-ux-freeze`. **The prototype is the spec** — no separate doc to drift.
2. **Fixtures → API contract:** each fixture's shape becomes its endpoint's response
   schema. Stefan builds to match.
3. One-page component README (props, states, where used) + DECISIONS.md ride along.
4. Only now: finalize the engineering spec (Part 3 detail + endpoint contracts from
   fixtures + any priorities the testing changed) and start Part 7.

---

## Part 7 — Build phases (POST-FREEZE ONLY)

1. **Foundation:** real migrations; unify on v2 (migrate v1 consumers); events table;
   consent ledger; suppressions; wire the frozen frontend to real endpoints
   (fixture→fetch swap + auth).
2. **Workflow engine, email-only launch:** Workflows/Queues/DO engine with `send_email`,
   `create_deal`, `assign_owner`, `wait`, `branch`, goal exits. Speed-to-lead sequence
   runs email-first while SMS approval pends. Consent gate + quiet-hours logic built and
   battle-tested here where blast radius is small.
3. **Chatwoot cutover:** webhook ingestion + outbound API, dual-run vs Crisp, backfill,
   cut over, remove Crisp.
4. **SMS activation (gated on 10DLC approval):** `send_sms` action via Telnyx; inbound
   SMS + STOP → suppression + revocation record; flip the sequence to SMS-first for
   consented leads; everyone else stays in the earn-consent email branch.
5. **AI voice + activation:** Retell `place_ai_call` action (verify `x-retell-signature`
   with Web Crypto against the raw body); AMD branches; onboarding/activation sequences
   (script-installed trigger, concierge-call offer, dormant re-engagement).
6. **Later:** visual workflow builder UI, lead scoring, sentiment/next-best-action,
   consent ledger as a customer-facing product feature.

---

## Part 8 — Open decisions & standing cautions

- Theme (dark vs light) — decided in Phase B with the team.
- Chatwoot Cloud vs self-host — start Cloud; revisit at scale.
- TX SB 140 registration/bond — ask counsel whether Consent Resolve's outbound falls in scope.
- Retell LLM/voice selection — start cheap (mid-tier LLM, standard voice), A/B answer and
  booking rates before paying for premium components.
- All vendor prices are 2026 third-party estimates; confirm in writing at signup.
- **Standing rule, restated:** if a task can't be done with fixtures, tokens, components,
  and static pages, it waits for the freeze.
