# Consent Resolve CRM — Build Spec

**Owner:** Aaron Phillips (CMO)
**For:** Stefan Dimitrov (Head of Engineering)
**Status:** v1 — ready to scope into tickets
**Stack:** Cloudflare (Workers, Pages, D1, Queues, Durable Objects, Cron Triggers, R2, KV)

---

## 1. What this is

An internal CRM for a 6-person team that does two things:

1. **Conversations** — a unified, Gmail-like inbox aggregating Instantly campaign replies, `hello@consentresolve.com` email, Crisp chat, and Meta Lead Ads, with assignment, presence ("who's looking/replying"), an Apollo-powered profile panel, and four reply actions (Open / Follow-up / Archive / Convert to Lead).
2. **Leads** — a lightweight pipeline (no stages; manual close % + close date) on a band-organized board, with deal attributes, an owner, direct reply, and a funnel/forecast analytics layer.

**Design philosophy: orchestration, not re-implementation.** We already own Instantly, Apollo, Crisp, and Google Workspace. The CRM is the connective tissue + the pipeline + the analytics + the profile. Each source tool stays the system of record for *sending on its own channel*; we mirror inbound into D1 for unified read/search/analytics and route outbound back through the origin.

---

## 2. Architecture & data flow

```
INBOUND
  source (Instantly / Gmail / Crisp / Meta) 
    → webhook or poll 
    → Worker (receiver) 
    → Queue (normalize) 
    → identity resolution 
    → D1 write 
    → ping Presence DO → fan-out "new message" to connected clients

OUTBOUND (reply)
  UI 
    → Worker 
    → Queue (send, with retry) 
    → ChannelAdapter.sendReply() → origin tool 
    → write outbound message to D1

SNOOZE / FOLLOW-UP
  Cron Trigger (every 1 min) 
    → sweep conversations WHERE status='snoozed' AND snooze_until <= now 
    → set status='open', unread=1 
    → ping Presence DO + notify assignee
```

**Mirror-by-copy, send-to-origin.** We store a normalized copy of every message in D1 so search, assignment, profile, and analytics keep working even when a source API is slow or down. Sends always route back through the originating tool/identity.

---

## 3. Data model (D1 / SQLite DDL)

IDs are app-generated ULIDs (TEXT) — events arrive via queues/webhooks, so we avoid autoincrement coordination. Timestamps are ISO-8601 TEXT. Money is INTEGER cents. Booleans are INTEGER 0/1. JSON blobs are TEXT.

```sql
-- COMPANIES (the contractor business; B2B account grouping)
CREATE TABLE companies (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  domain        TEXT,                 -- null for free-email-only contacts
  apollo_org_id TEXT,
  enrichment    TEXT,                 -- JSON: firmographics from Apollo
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_companies_domain ON companies(domain);

-- CONTACTS (a person; belongs to at most one company)
CREATE TABLE contacts (
  id              TEXT PRIMARY KEY,
  company_id      TEXT REFERENCES companies(id),
  full_name       TEXT,
  primary_email   TEXT,
  phone           TEXT,
  title           TEXT,
  apollo_person_id TEXT,
  enrichment      TEXT,               -- JSON: person-level Apollo enrichment
  source          TEXT,               -- first-touch source
  is_provisional  INTEGER NOT NULL DEFAULT 0,  -- anonymous chat/social, no email yet
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_email ON contacts(primary_email);

-- CONTACT IDENTIFIERS (the key to identity resolution: one contact, many keys)
CREATE TABLE contact_identifiers (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT NOT NULL REFERENCES contacts(id),
  type        TEXT NOT NULL,          -- email | phone | crisp_session | meta_psid | instantly_lead_id | social_handle
  value       TEXT NOT NULL,
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, value)                 -- the match index
);

-- CHANNEL ACCOUNTS (per connected mailbox/account; tells the send adapter which identity to use)
CREATE TABLE channel_accounts (
  id                  TEXT PRIMARY KEY,
  channel             TEXT NOT NULL,  -- instantly | email | crisp | meta_lead
  label               TEXT,           -- e.g. "Roofing sending domain", "hello@"
  external_account_id TEXT,           -- eaccount (Instantly), Gmail address, Crisp website_id, Meta page_id
  credentials_ref     TEXT,           -- KV key / secret binding name (never store secrets in D1)
  is_active           INTEGER NOT NULL DEFAULT 1
);

-- CONVERSATIONS
CREATE TABLE conversations (
  id                 TEXT PRIMARY KEY,
  contact_id         TEXT REFERENCES contacts(id),
  company_id         TEXT REFERENCES companies(id),   -- denormalized for fast rollup
  channel            TEXT NOT NULL,   -- instantly | email | crisp | meta_lead | demo_form
  source_detail      TEXT,            -- campaign/vertical (roofing|hvac|plumbing), landing page, ad id
  channel_account_id TEXT REFERENCES channel_accounts(id),
  external_thread_id TEXT,            -- Instantly thread_id, Gmail threadId, Crisp session_id
  subject            TEXT,
  status             TEXT NOT NULL DEFAULT 'open',  -- open | snoozed | archived | converted
  snooze_until       TEXT,
  assignee_id        TEXT REFERENCES users(id),
  unread             INTEGER NOT NULL DEFAULT 1,
  last_message_at    TEXT,
  last_message_preview TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_conv_status_snooze ON conversations(status, snooze_until);
CREATE INDEX idx_conv_assignee ON conversations(assignee_id);
CREATE INDEX idx_conv_company ON conversations(company_id);
CREATE INDEX idx_conv_lastmsg ON conversations(last_message_at);

-- MESSAGES
CREATE TABLE messages (
  id                   TEXT PRIMARY KEY,
  conversation_id      TEXT NOT NULL REFERENCES conversations(id),
  direction            TEXT NOT NULL,  -- in | out
  channel              TEXT NOT NULL,
  author_id            TEXT REFERENCES users(id),  -- null for inbound/system
  external_message_id  TEXT,
  in_reply_to_external TEXT,           -- for email threading (References/In-Reply-To)
  body_text            TEXT,
  body_html            TEXT,
  attachments          TEXT,           -- JSON; files live in R2, this holds metadata + keys
  sent_at              TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_msg_conv ON messages(conversation_id, sent_at);

-- DEALS (a lead; layered on company+contact, NOT a copy of the conversation)
CREATE TABLE deals (
  id                  TEXT PRIMARY KEY,
  company_id          TEXT NOT NULL REFERENCES companies(id),
  primary_contact_id  TEXT REFERENCES contacts(id),
  origin_conversation_id TEXT REFERENCES conversations(id),
  owner_id            TEXT NOT NULL REFERENCES users(id),
  title               TEXT,
  value_cents         INTEGER,
  close_probability   INTEGER,         -- 0-100, manual
  expected_close_date TEXT,            -- manual
  lead_status         TEXT NOT NULL DEFAULT 'active',  -- active | won | lost
  won_lost_at         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_deals_owner ON deals(owner_id, lead_status);
CREATE INDEX idx_deals_close ON deals(expected_close_date);

-- USERS (max 6)
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'sales',  -- admin | sales | exec
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ACTIVITIES (audit log; powers per-person analytics + "who did what")
CREATE TABLE activities (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES users(id),
  entity_type TEXT NOT NULL,  -- conversation | deal | contact | company
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,  -- assigned | status_changed | replied | converted | note | enriched | prob_changed | won | lost
  meta        TEXT,           -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_act_entity ON activities(entity_type, entity_id);
CREATE INDEX idx_act_actor ON activities(actor_id, created_at);

-- NOTES (internal, on a contact or conversation)
CREATE TABLE notes (
  id              TEXT PRIMARY KEY,
  author_id       TEXT REFERENCES users(id),
  conversation_id TEXT REFERENCES conversations(id),
  contact_id      TEXT REFERENCES contacts(id),
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Presence is **ephemeral** (lives in the Durable Object, never in D1).

---

## 4. Identity resolution

The make-or-break logic. On every inbound event, after extracting identifiers:

```
1. For each identifier (email, phone, crisp_session, meta_psid, instantly_lead_id):
     lookup contact_identifiers WHERE (type, value) matches.
2. If a match → attach event to that contact.
3. If NO match and an EMAIL is present:
     - create contact (is_provisional = 0)
     - resolve company:
         a. extract email domain
         b. if domain is in FREE_EMAIL_DOMAINS → skip domain grouping
         c. else find/create company by domain
         d. else (free email) → try Apollo org by enriched company name
         e. else → leave company_id NULL (ungrouped; manual assign later)
4. If NO email (anonymous chat / social handle only):
     - create provisional contact (is_provisional = 1) keyed on the session/handle identifier
     - flag for merge when an email later appears
5. SUGGEST-MERGE (never auto-merge on fuzzy):
     when a new email-bearing contact shares name + company with a provisional one,
     surface a merge suggestion in the UI.
```

`FREE_EMAIL_DOMAINS` = gmail.com, yahoo.com, outlook.com, hotmail.com, aol.com, icloud.com, live.com, msn.com, comcast.net, … (maintain as a config list).

**ICP note:** home-service contractors frequently use free email, so domain-grouping will miss many. The Apollo-org and manual fallbacks are not edge cases here — they're the common path. Expect a meaningful share of contacts to land ungrouped until enriched or manually placed.

---

## 5. Channel adapters

Every channel implements one contract. Outbound is **not** 1:1 with inbound channel (see Meta below).

```typescript
type ChannelType = 'instantly' | 'email' | 'crisp' | 'meta_lead' | 'demo_form';

interface NormalizedInbound {
  identifiers: { type: string; value: string }[];
  channel: ChannelType;
  externalThreadId?: string;
  externalMessageId?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: AttachmentMeta[];
  sourceDetail?: string;        // campaign/vertical, ad id, landing page
  sentAt: string;
}

interface SendReplyInput {
  conversationId: string;
  channelAccount: ChannelAccount;
  replyToExternalId?: string;   // e.g. Instantly email uuid, Gmail message id
  bodyText: string;
  bodyHtml?: string;
}

interface ChannelAdapter {
  channel: ChannelType;
  parseInbound(payload: unknown, account: ChannelAccount): Promise<NormalizedInbound[]>;
  sendReply(input: SendReplyInput): Promise<{ externalMessageId: string }>;
  capabilities: { canSend: boolean; sendWindowHours: number | null };
}
```

**Per-adapter notes:**

- **Instantly** — Inbound: reply webhook (or poll `GET /api/v2/emails`). Outbound: `POST /api/v2/emails/reply` with `eaccount` (the originating warmed mailbox) + `reply_to_uuid`. *Critical:* replies must go back out the same sending mailbox/domain the thread came in on (roofing reply → roofing domain), never from `hello@`, or we break deliverability and threading. `canSend: true`, no window.
- **Email / `hello@`** — Now its own Google Workspace mailbox, decoupled from Instantly. Inbound: Gmail API `watch` + Pub/Sub push → on notification, `history.list` to pull new messages. Outbound: `messages.send` preserving `threadId` + `References`/`In-Reply-To` headers. `canSend: true`.
- **Crisp** — Inbound: webhook `message:received`. Outbound: REST send-message to the conversation (Crisp emails the visitor if they're offline). `canSend: true`.
- **Meta Lead Ads** — Inbound: `leadgen` webhook → fetch the lead via Graph API (full_name, email, phone, custom fields). This is a **form source**, not a messaging channel: `canSend: false`. **Outbound routing:** when a user replies to a `meta_lead` (or `demo_form`) conversation, the reply is sent via the **email adapter** using the captured address — or flagged "call only" if just a phone exists. This is the whole reason we sidestep the Meta DM 24-hour-window problem: we never reply via Messenger, we reply by email/phone.

**Outbound channel selection rule:** native messaging channels (instantly, email, crisp) reply on their own channel; form sources (meta_lead, demo_form) reply via email when an address exists, else surface as a call task.

---

## 6. Reply actions & status machine

The four actions map directly to `conversations.status`:

| Action | Effect |
|---|---|
| **A. Open / Active** | `status = 'open'` |
| **B. Future Follow-up** | `status = 'snoozed'`, `snooze_until = <datetime>` → Cron resurfaces |
| **C. Archive / Delete** | `status = 'archived'` (soft; keep row for analytics — recommend never hard-delete) |
| **D. Convert to Lead** | create `deals` row linked to conversation + company + contact; `status = 'converted'`. Conversation stays linked and replyable. |

**Snooze sweep (Cron, every 1 min):**

```sql
UPDATE conversations
   SET status = 'open', unread = 1, updated_at = datetime('now')
 WHERE status = 'snoozed'
   AND snooze_until <= datetime('now');
```
After the update, the Worker pings the Presence DO to fan-out and notifies the assignee.

---

## 7. Presence & collaboration (right-sized for 6 users)

**One workspace-wide Durable Object**, not one per conversation (at this scale per-conversation DOs are over-built).

- Clients open a WebSocket to the presence DO and send a heartbeat: `{ userId, viewing: conversationId|null, composing: bool }`.
- The DO holds an in-memory map and broadcasts presence deltas to all connected clients: "Tyler is viewing conv X", "Jason is replying to conv Y".
- Soft-lock only — at 6 people we *warn* ("Jason is replying"), we don't block.
- 30-second TTL per presence entry to clear stale entries on disconnect.
- The same DO is the fan-out point for new-message events: after a D1 write, the Worker pings the DO → clients update their inbox live.

Assignment itself is just `conversations.assignee_id` + an `activities` row; the DO only broadcasts the *live* state.

---

## 8. Leads pipeline & board

No stages. A deal carries a manual `close_probability` (0–100), a manual `expected_close_date`, and a `lead_status` (active / won / lost — needed so we can compute win rate and clear closed deals; 0% ≠ lost, 100% ≠ won-until-trial-converts).

**Board:** columns are **probability bands** computed client-side: 0–25 / 26–50 / 51–75 / 76–99 / **Won**. A toggle switches to a **close-month** view for forecasting. Dragging a card to a new band issues `PATCH /deals/:id { close_probability }`. Cards show: company, primary contact, deal size, weighted value (`value_cents × prob / 100`), close date, owner. Clicking a card opens the linked conversation thread for direct reply.

---

## 9. Analytics

Designed around what matters for a marketing-led company: **source/vertical attribution** and **forecast**, not stage velocity (which we traded away with the no-stages decision).

**Weighted pipeline forecast by month:**
```sql
SELECT strftime('%Y-%m', expected_close_date) AS month,
       SUM(value_cents * close_probability / 100.0) AS weighted_value_cents,
       COUNT(*) AS deals
  FROM deals
 WHERE lead_status = 'active'
 GROUP BY month
 ORDER BY month;
```

**Source / vertical attribution** (which Instantly domain, lead-ad, demo, or chat produces deals that close):
```sql
SELECT c.channel, c.source_detail,
       COUNT(DISTINCT cv.id) AS conversations,
       COUNT(DISTINCT d.id)  AS leads,
       SUM(CASE WHEN d.lead_status = 'won' THEN 1 ELSE 0 END) AS won
  FROM conversations cv
  JOIN conversations c ON c.id = cv.id
  LEFT JOIN deals d ON d.origin_conversation_id = cv.id
 GROUP BY c.channel, c.source_detail;
```

**Other dashboard metrics:**
- **Funnel:** conversations → converted-to-lead → won, with rates.
- **Per-owner:** active deals, weighted pipeline, win rate (won / (won+lost)).
- **Per-rep activity** (from `activities`): replies sent, conversions, notes.
- **Speed-to-lead:** time between an inbound message and the first outbound reply — the single most important operational metric for the home-service ICP. Surface it per rep and per source.

---

## 10. Enrichment policy (Apollo)

Two **distinct** layers — don't conflate them:

1. **Passive intent** (on-site Apollo JS): mostly **company-level** reverse-IP de-anonymization ("someone from Acme Roofing visited /pricing"). Person-level is U.S.-only, requires the paid Inbound add-on, and can lag up to ~7 days. Treat this as a *prioritization/warm-up signal*, not a real-time identity source.
2. **Real profile** (Apollo enrichment API): on-demand, keyed on a captured email from a form/reply/chat. This is the reliable person + firmographic data for the profile panel.

**Rules:**
- Enrichment is an **on-demand button**, never auto-on-arrival (saves Apollo credits; keeps the consent-first brand clean).
- Cache results in KV (or `contacts.enrichment` / `companies.enrichment`) with a TTL; log every enrich to `activities` with provenance.
- The join that creates value: Apollo JS says "Acme is browsing" → `john@acme.com` fills the demo form → merge the anonymous visit into the contact. The reliable join key is the captured email.

---

## 11. Suggested build sequence (toward March 1)

- **Phase 0** — D1 schema + Worker skeleton + simple auth (6 users).
- **Phase 1 (MVP, highest pain relief)** — Gmail (`hello@`) + Instantly inbound→D1, inbox UI, reply, status A/B/C/D, Cron snooze.
- **Phase 2** — Crisp + Meta Lead adapters; identity resolution + company grouping; profile panel + on-demand Apollo enrich.
- **Phase 3** — Leads pipeline + board + convert flow.
- **Phase 4** — Presence DO; analytics dashboard.

Phases 1 + 3 are the ROI core; presence and full analytics can trail launch.

---

## 12. Open items & risks

- **Meta App Review is a schedule risk.** Lead-access via the leadgen webhook needs a Meta app with the right permissions + review, which can take weeks-to-months. **Start the Meta app + lead-access review now** or it blocks Phase 2.
- **Gmail API** needs OAuth + Pub/Sub topic setup for push; budget a day for the plumbing.
- **Apollo credits** — set a monthly enrichment budget; on-demand only.
- **D1 ceiling** (~10 GB / single-DB) is irrelevant at this volume, but never hard-delete — archive.
- **Sending-domain hygiene** — keep `hello@` permanently off the cold-sending domain now that it's decoupled.
- **Free-email company grouping** — the Apollo-org / manual fallback is the common path for this ICP, not an edge case. Build the UI for manual company assignment early.
- **Verify exact endpoints at build** for Crisp webhooks and Gmail history pull — described here by mechanism; confirm current method names against live docs.
