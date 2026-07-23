-- 0001_crm_foundation.sql
-- CRM rebuild — Foundation (Part 3.1 / Part 7.1 of CRM-REBUILD-MASTER.md).
-- Additive + idempotent. Introduces the append-only event log, consent ledger,
-- generalized suppressions, the workflow engine tables, and lifecycle/attribution
-- columns on contacts. Coexists with the live v1+v2 schema; nothing is dropped.
--
-- NOTE: the CRM event log is `crm_events` (NOT `events`) — `events` already exists
-- in schema.sql for the public demo (participants). Do not conflate them.
--
-- Apply on prod via either:
--   npx wrangler d1 migrations apply consentresolve-demo --remote
-- or the runtime idempotent applier ensureRebuildSchema() in _lib/crm-rebuild.js
-- (triggered by GET /api/crm/rebuild/migrate?ensure=1, admin-gated).

-- ---------------------------------------------------------------------------
-- crm_events — append-only source of truth. Every state change is one immutable
-- row. All rebuild analytics derive from here. Merges v2 `activities` + demo
-- `events` concepts for the CRM domain.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_events (
  id               TEXT PRIMARY KEY,             -- ULID (time-sortable)
  type             TEXT NOT NULL,                -- see vocabulary below
  contact_id       TEXT,                         -- contacts.id (nullable: pre-identity/system)
  company_id       TEXT,
  conversation_id  TEXT,
  deal_id          TEXT,
  workflow_run_id  TEXT,
  channel          TEXT,                         -- email|sms|voice|chat|meta|system
  source           TEXT,                         -- meta|instantly|site|demo|apollo|manual|crisp|chatwoot
  actor_id         TEXT,                         -- users.id when human; NULL when system/automation
  meta             TEXT,                         -- JSON payload (message id, disclosure, template, etc.)
  cost_cents       INTEGER NOT NULL DEFAULT 0,   -- per-event unit cost (Telnyx/Retell) → cost-per-lead
  occurred_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_crm_events_contact  ON crm_events(contact_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_crm_events_type     ON crm_events(type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_crm_events_conv     ON crm_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_run      ON crm_events(workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_deal     ON crm_events(deal_id);
-- Event type vocabulary (documented, not enforced):
--   lead_created, contacted, sms_sent, sms_delivered, sms_failed,
--   call_placed, call_answered, voicemail_reached, email_sent, email_opened,
--   replied, booked, signed_up, script_installed, activated, opted_out,
--   consent_granted, consent_revoked, stage_changed, lifecycle_changed,
--   owner_assigned, deal_created, sequence_enrolled, sequence_step_completed,
--   sequence_exited, note_added, site_visit, link_clicked, suppressed

-- ---------------------------------------------------------------------------
-- consent_records — the consent ledger. Append-only; grants AND revocations are
-- rows. Retain >= 5 years. Also a marketable product feature. Promotes the
-- proto fields on participants (consent_text_version/ip/user_agent/consented_at).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_records (
  id               TEXT PRIMARY KEY,             -- ULID
  contact_id       TEXT,                         -- contacts.id (nullable: pre-contact capture)
  email            TEXT,                         -- denormalized for keyless lookups
  phone            TEXT,
  channel          TEXT NOT NULL,                -- email|sms|voice
  action           TEXT NOT NULL,                -- granted|revoked
  basis            TEXT,                         -- PEWC|PEC|legitimate_interest
  disclosure_text  TEXT,                         -- exact text shown at capture
  capture_method   TEXT,                         -- meta_lead_form|get_started|preference_center|stop_keyword|import
  source_url       TEXT,
  ip               TEXT,
  user_agent       TEXT,
  proof_ref        TEXT,                         -- artifact pointer (row id / screenshot)
  occurred_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_consent_contact ON consent_records(contact_id, channel, occurred_at);
CREATE INDEX IF NOT EXISTS idx_consent_email   ON consent_records(email, channel);

-- ---------------------------------------------------------------------------
-- suppressions — channel-specific do-not-contact, written instantly on
-- STOP/revocation. Generalizes the legacy `crm_suppressions` (email-only).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppressions (
  id           TEXT PRIMARY KEY,                 -- ULID
  contact_id   TEXT,
  email        TEXT,
  phone        TEXT,
  channel      TEXT NOT NULL DEFAULT 'all',      -- all|email|sms|voice
  reason       TEXT,
  source       TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppress_email_ch ON suppressions(email, channel);
CREATE INDEX IF NOT EXISTS idx_suppress_phone ON suppressions(phone);
CREATE INDEX IF NOT EXISTS idx_suppress_contact ON suppressions(contact_id);

-- ---------------------------------------------------------------------------
-- workflows — sequence definitions. `definition` is JSON: an ordered list of
-- steps [{ id, channel, action, delay_minutes, template, branch }].
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflows (
  id               TEXT PRIMARY KEY,             -- ULID or slug
  name             TEXT NOT NULL,
  trigger          TEXT NOT NULL,                -- lead_created|reply_received|no_answer|script_installed|stage_changed|manual
  goal             TEXT,                         -- JSON list of exit events: ["replied","booked","opted_out"]
  definition       TEXT NOT NULL,                -- JSON ordered steps
  requires_consent TEXT,                         -- JSON list of channels needing PEWC before running (e.g. ["sms","voice"])
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------------------
-- workflow_runs — per-contact execution state. One active run per (workflow, contact).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_runs (
  id               TEXT PRIMARY KEY,             -- ULID
  workflow_id      TEXT NOT NULL,
  contact_id       TEXT NOT NULL,
  conversation_id  TEXT,
  deal_id          TEXT,
  status           TEXT NOT NULL DEFAULT 'active',  -- active|completed|exited|paused|error
  current_step     INTEGER NOT NULL DEFAULT 0,
  next_run_at      TEXT,                         -- when the next step is due (NULL = waiting on goal / done)
  exit_reason      TEXT,                         -- replied|booked|opted_out|completed|error
  last_error       TEXT,
  enrolled_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_wfrun_due ON workflow_runs(status, next_run_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wfrun_contact_wf ON workflow_runs(workflow_id, contact_id);

-- ---------------------------------------------------------------------------
-- workflow_steps — per-step execution log (also mirrored into crm_events).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_steps (
  id            TEXT PRIMARY KEY,                -- ULID
  run_id        TEXT NOT NULL,
  step_index    INTEGER NOT NULL,
  channel       TEXT,
  action        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending|sent|skipped|failed|deferred
  detail        TEXT,
  scheduled_at  TEXT,
  executed_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_wfstep_run ON workflow_steps(run_id, step_index);

-- ---------------------------------------------------------------------------
-- contacts: lifecycle stage (funnel position) separate from live lead_status,
-- plus first-touch / latest-touch attribution and a dormancy marker for Nurture.
-- (ALTER ADD COLUMN is not IF-NOT-EXISTS in SQLite; the runtime applier guards
-- with PRAGMA table_info. Under `wrangler d1 migrations apply` each file runs once.)
-- ---------------------------------------------------------------------------
ALTER TABLE contacts ADD COLUMN lifecycle_stage TEXT DEFAULT 'lead';  -- lead|mql|sql|opportunity|customer
ALTER TABLE contacts ADD COLUMN utm_first  TEXT;   -- JSON first-touch {source,medium,campaign,content,term,fbclid,gclid,at}
ALTER TABLE contacts ADD COLUMN utm_latest TEXT;   -- JSON latest-touch
ALTER TABLE contacts ADD COLUMN dormant_since TEXT;
