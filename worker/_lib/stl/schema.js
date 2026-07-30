// Speed-to-Lead Engine — D1 schema (namespaced `stl_` to sit alongside the
// existing CRM tables without collision). Idempotent; runs guarded on first use.
//
// Mirrors the handoff spec §3, adapted to this JS/D1 worker: INTEGER epoch-ms
// timestamps, TEXT ids (crypto.randomUUID). One shared DB binding (env.DB).
let _ready = false;

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS stl_leads (
     id TEXT PRIMARY KEY,
     created_at INTEGER NOT NULL,
     population TEXT NOT NULL CHECK(population IN ('A','B')),
     status TEXT NOT NULL,               -- active|booked|won|lost|nurture|revoked
     first_name TEXT, last_name TEXT, company TEXT,
     trade TEXT,                         -- roofing|plumbing|hvac|electrical|other
     email TEXT, phone TEXT,
     phone_type TEXT,                    -- mobile|landline|voip
     timezone TEXT NOT NULL,
     state TEXT,
     ad_source TEXT, campaign_id TEXT, landing_page TEXT, session_id TEXT,
     assigned_rep_id TEXT,
     is_test INTEGER NOT NULL DEFAULT 0,
     updated_at INTEGER )`,
  `CREATE TABLE IF NOT EXISTS stl_consent_events (
     id TEXT PRIMARY KEY,
     lead_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     kind TEXT NOT NULL,                 -- cookie_banner|form_submit|inbound_call|inbound_sms|chat_phone|verbal_on_call
     channel_email INTEGER NOT NULL DEFAULT 0,
     channel_sms INTEGER NOT NULL DEFAULT 0,
     channel_phone_hum INTEGER NOT NULL DEFAULT 0,
     channel_phone_ai INTEGER NOT NULL DEFAULT 0,
     consent_grade TEXT NOT NULL,        -- written|oral|none
     exact_language TEXT NOT NULL,
     state TEXT,
     ip TEXT, user_agent TEXT, page_url TEXT,
     recording_url TEXT,
     revoke_token TEXT,
     revoked_at INTEGER, revoked_via TEXT )`,
  `CREATE TABLE IF NOT EXISTS stl_touchpoints (
     id TEXT PRIMARY KEY,
     lead_id TEXT NOT NULL,
     sequence_step TEXT NOT NULL,        -- B1_retell, A3_email2, etc.
     channel TEXT NOT NULL,              -- email|sms|call_ai|call_human|chat
     actor_type TEXT NOT NULL,           -- ai|human|system
     actor_id TEXT,
     scheduled_for INTEGER NOT NULL,
     attempted_at INTEGER, completed_at INTEGER,
     outcome TEXT,                       -- §8.1 disposition enum
     duration_seconds INTEGER,
     consent_check TEXT,                 -- pass|blocked
     block_reason TEXT,
     template_id TEXT,
     provider_ref TEXT,
     recording_url TEXT, transcript TEXT,
     dispatch_mode TEXT,                 -- simulate|live (what actually happened)
     notes TEXT,
     status TEXT NOT NULL DEFAULT 'pending' )`, // status: pending|sent|blocked|skipped|canceled|failed
  `CREATE TABLE IF NOT EXISTS stl_calls (
     touchpoint_id TEXT PRIMARY KEY,
     lead_id TEXT NOT NULL,
     provider TEXT NOT NULL,             -- retell|twilio
     provider_call_id TEXT,
     ring_seconds INTEGER,
     answered INTEGER NOT NULL DEFAULT 0,
     disclosure_ok INTEGER,
     transfer_attempted INTEGER NOT NULL DEFAULT 0,
     transfer_accepted INTEGER NOT NULL DEFAULT 0,
     transfer_latency_s INTEGER,
     transfer_rep_id TEXT,
     pull_forward INTEGER NOT NULL DEFAULT 0,
     voicemail_left INTEGER NOT NULL DEFAULT 0,
     textback_ask INTEGER )`,
  `CREATE TABLE IF NOT EXISTS stl_meetings (
     id TEXT PRIMARY KEY,
     lead_id TEXT NOT NULL,
     calcom_booking_id TEXT,
     created_at INTEGER NOT NULL,
     scheduled_for INTEGER NOT NULL,
     original_slot INTEGER,
     set_by_actor_type TEXT,             -- ai|human|self
     set_by_actor_id TEXT,
     showed INTEGER,
     outcome TEXT )`,
  `CREATE TABLE IF NOT EXISTS stl_reps (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     phone TEXT NOT NULL,
     email TEXT,
     active INTEGER NOT NULL DEFAULT 1 )`,
  `CREATE TABLE IF NOT EXISTS stl_rep_availability (
     id TEXT PRIMARY KEY,
     rep_id TEXT NOT NULL,
     starts_at INTEGER NOT NULL,
     ends_at INTEGER NOT NULL,
     state TEXT NOT NULL )`,               // state: available|on_call|away
  `CREATE TABLE IF NOT EXISTS stl_gate_violations (
     id TEXT PRIMARY KEY,
     lead_id TEXT NOT NULL,
     attempted_at INTEGER NOT NULL,
     channel TEXT NOT NULL,
     reason TEXT NOT NULL,
     caller TEXT,
     alerted INTEGER NOT NULL DEFAULT 0 )`,
  `CREATE TABLE IF NOT EXISTS stl_settings (
     k TEXT PRIMARY KEY,
     v TEXT NOT NULL,
     updated_at INTEGER )`,
  `CREATE TABLE IF NOT EXISTS stl_events (
     id TEXT PRIMARY KEY,
     lead_id TEXT,
     at INTEGER NOT NULL,
     kind TEXT NOT NULL,
     detail TEXT )`,
  `CREATE INDEX IF NOT EXISTS idx_stl_tp_due ON stl_touchpoints(status, scheduled_for)`,
  `CREATE INDEX IF NOT EXISTS idx_stl_tp_lead ON stl_touchpoints(lead_id, scheduled_for)`,
  `CREATE INDEX IF NOT EXISTS idx_stl_consent_lead ON stl_consent_events(lead_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_stl_consent_token ON stl_consent_events(revoke_token)`,
];

export async function ensureStlSchema(env) {
  if (_ready) return;
  for (const sql of STATEMENTS) {
    try { await env.DB.prepare(sql).run(); } catch (_) { /* already exists / benign */ }
  }
  _ready = true;
}

// Test helper — force a re-run (used by admin "reset").
export function _resetStlSchemaFlag() { _ready = false; }
