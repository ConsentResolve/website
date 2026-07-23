# CRM Rebuild — Design Decisions Log

Running log of the design phase (Part 6 of CRM-REBUILD-MASTER.md). Tried / killed / why.
**Rule Zero:** no application code until Phase F freeze. Fixtures + tokens + static pages only.

---

## Phase A — Foundations

### Job statements (pinned)
- **Sales (Andy, Tyler, Jason):** "Show me every lead that needs a human RIGHT NOW, with
  enough context to reply in one click."
- **Admin (Aaron):** "Show me what's working — which source, sequence step, and message
  produces replies / bookings / activations, and what it costs."
> Every element on every screen must serve one of these or be cut.

### Complaints → testable requirements
| Complaint | Requirement (testable) |
|---|---|
| Hard to use | Any core task ≤ 3 clicks from anywhere; a new user is productive untrained. |
| Source cumbersome | A colored **SourceChip** on every surface a lead appears — inbox row, thread header, contact card, pipeline card, analytics row. Zero clicks to know where it came from. |
| Status cumbersome | A two-line status block everywhere: **lifecycle stage** + live **SequenceState** ("Step 2 of 4 · AI call in 22 min"). |

### Screen inventory (design order)
1. **Inbox** — home; ~80% of sales time. ← building first
2. Contact 360
3. Pipeline
4. Command Center / Analytics (per-source funnel, sequence performance, spend/ROAS, cost-per-lead)
5. **Sequences** — the workflow as a diagram with step-level conversion stats printed ON it (the new organ)
6. Consent — the ledger view, designed as the brand differentiator
7. Settings / Integrations

Screens 1–4 = make-or-break. 5 = new organ. 6–7 = half-days.

### Navigation
Real-URL tabs (`/crm/<section>`), global ⌘K search (jump to any contact/company/conversation),
persistent **"Needs attention"** counter (SLA breaches, failed sends, consent-blocked items).

---

## Phase B — Design system

### Theme decision — **DECIDED: B — Light workspace** (2026-07-22, Aaron)
Aaron reviewed both in the live prototype and chose **Light**. Rationale: reads faster for
dense data work, "clean and trustworthy" suits a consent-first brand. Dark stays available via
the toggle but Light is the default and the design target. All subsequent screens build on Light.

### (original A/B framing, kept for the record)
Per the master doc, prototype the SAME Inbox fixture in both candidate themes side-by-side and
pick with the team in ~an hour. The Inbox prototype ships with a **live Dark/Light toggle** so
Aaron + the reps can flip between them on the real screen and choose.
- **A — Dark navy** (`#0a1628` / mint `#00e5a0`): disciplined contrast; mint reserved for primary
  actions + positive states; 4-step surface elevation. Matches the marketing brand.
- **B — Light workspace** (paper surfaces, navy as text/structure, mint as the single action color):
  reads faster for dense data work; "clean and trustworthy" suits a consent-first brand.
> DECISION: _pending_ — record the pick + rationale here after the team looks at both.

### Source-chip palette (same hue everywhere, incl. charts)
Meta = blue · Instantly = purple · Chatwoot = teal · Site/Demo = green · Apollo = amber · Manual = gray.

### Component inventory (built during Inbox, reused everywhere)
SourceChip · LifecycleBadge · SequenceState (with pause/skip controls — the signature element) ·
ConsentBadge (per-channel ✓/⊘/◌, click → ledger) · SLATimer (amber @5min, red @15) · Timeline ·
Composer (channel-aware) · KanbanCard · StatTile · FunnelBar · DataTable · EmptyState.

---

## Build log

- **2026-07-22 (v27 — Sequences + Analytics + Consent, built in one pass)** — Three more screens,
  reachable from the rail (view-switcher: Inbox/Pipeline/Sequences/Analytics/Consent).
  • **Sequences** (🔁, "the new organ"): sidebar of 3 workflows (Speed-to-lead, Earn-consent,
    Onboarding); each rendered as a step-flow diagram with step-level conversion stats printed ON
    it (entered → delivered/answered/opened → replied/booked/opt-out), the AI-call voicemail
    branch called out, consent-required chips, header metrics (active/enrolled/reply/goal/opt-out).
  • **Analytics** (📊, Command Center): 8 KPI tiles, lead→customer funnel bars, leads/day sparkline,
    by-source table (leads/reply/demos/active/spend/cost-per-lead/cost-per-demo/est-ROAS w/ chips),
    ad-spend-by-channel bars, sequence-performance table. Numbers reconciled (sources sum to totals;
    est-ROAS labeled with its $2,340/yr assumption).
  • **Consent** (🛡️, the differentiator): compliance KPIs (271 consented / 8 suppressions / 63%
    PEWC / 100% backed), consent-by-channel summary, "how consent is captured" (PEWC / email-only /
    CAN-SPAM / STOP), and the **ledger** — click any row to expand the *proof* (exact consent
    language, basis, form, IP, timestamp + "the record we can produce if challenged").
  Fixtures added to inbox.data.js: SEQUENCES, ANALYTICS, CONSENT_LEDGER. Voice kept (98%, $7,
  consent-first, real sources, "book the job"). Remaining rail screen: ⚙️ Settings.

- **2026-07-22 (Inbox deep-build, v2→v26)** — After the Phase-D theme lock (Light), the Inbox
  grew into a full working prototype over ~25 review iterations. Highlights: Open/Auto/Snoozed
  buckets; owner assignment; live lead-age clocks; dark→light Status panel with a Paused/Auto
  automation switch that re-buckets + recolors the step tracker; auto-enrichment "Fit & site"
  (website/FB/GMB/paid-search/tracking/ad-spend/traffic); middle-section tabs **Reply · Activity ·
  Intel · Task · Deal** (icons); Reply composer with a consent-gated **SMS/Email channel switch**;
  **Task** tab (auto-lookup contact/social data that syncs to Intel + manual follow/join/like
  actions with one-click deep links, roll-up counter on rows); **Deal** tab (stage pipeline +
  trial signup w/ console username + 100→100k traffic slider predicting deal size @2%×$7); deal
  **stage pills** + live **pipeline total** on the list; **delete/snooze** row actions; right pane
  removed (3-column full-width middle). **Next phase started: Pipeline board** (screen 2) — rail
  nav (Inbox ⇄ Pipeline), kanban by stage with drag-drop, per-column + open-pipeline totals,
  click-through back to the conversation. Files: screens/inbox.{html,data.js,render.js};
  inbox-artifact.html = inlined published twin.
- **2026-07-22** — Workspace created (`proto/`). Wrote `styles/tokens.css` (both themes +
  source-chip palette + tabular-num type scale). Wrote `fixtures/inbox.json` (14 conversations
  covering the ugly cases: all channels, provisional/no-company contacts, consent-blocked vs
  consented, mid-sequence, replied-exit, opted-out, AI-call→voicemail, failed SMS, long + 1-msg
  threads, HOT + cold). Built **Screen 1: Inbox** (`screens/inbox.html`) — 3-column layout with
  every signature component, live theme toggle. First artifact up for review.
- **2026-07-22 (v2, Aaron feedback)** — Theme LOCKED to Light. Reworked the Inbox from a passive
  list into an **action queue** per 5 feedback points:
  (1) **Open = manual-task queue only** — each row carries an explicit instruction (DO/FIX tag +
  "Reply now — he asked …") so a rep knows the exact next move; landing defaults here with a
  "these need a human" header (feedback #1 + #5).
  (2) New **Auto** bucket/tab — everything mid-sequence, no action needed; promotes to Open on a
  reply or a failed send (feedback #2). Buckets: open/auto/snoozed/suppressed on each fixture.
  (3) **Gmail-style email thread** — email-channel convos render as stacked Gmail message cards
  (from/to, subject header, ✓opened, reply box); SMS/chat keep bubbles (feedback #3).
  (4) **Clarity strip** on every thread header — "What happened / when" + "You/Auto next step /
  when" (feedback #4). Data: `last{label,ts,tone}` + `next{kind,label,when,tone}` per fixture.
  Split render into `inbox.data.js` + `inbox.render.js`; `inbox-artifact.html` = inlined
  self-contained twin, published for online review.
