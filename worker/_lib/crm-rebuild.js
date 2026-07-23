// worker/_lib/crm-rebuild.js
// Foundation for the CRM rebuild (CRM-REBUILD-MASTER.md Part 3.1 / Part 7.1):
//   - ensureRebuildSchema(env): idempotent runtime applier for 0001_crm_foundation.sql
//   - crm_events append-only log (logEvent)
//   - consent ledger + suppressions primitives (recordConsent, addSuppression,
//     isSuppressed, consentState) — the load-bearing consent gate
//   - lifecycle helpers
// Coexists with _lib/crm.js (v1) and _lib/crm-v2.js (v2); nothing here is destructive.

const nowIso = () => new Date().toISOString();

// Crockford base32 ULID — time-sortable TEXT id (matches the v2 id shape).
const _ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid(seedTime) {
  let t = (seedTime || Date.now());
  let time = "";
  for (let i = 9; i >= 0; i--) { time = _ENC[t % 32] + time; t = Math.floor(t / 32); }
  let rand = "";
  const buf = new Uint8Array(16);
  (globalThis.crypto || crypto).getRandomValues(buf);
  for (let i = 0; i < 16; i++) rand += _ENC[buf[i] % 32];
  return time + rand;
}

let _ensured = false;
async function ensureRebuildSchema(env) {
  if (_ensured) return;
  const ddl = [
    `CREATE TABLE IF NOT EXISTS crm_events (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, contact_id TEXT, company_id TEXT,
      conversation_id TEXT, deal_id TEXT, workflow_run_id TEXT, channel TEXT, source TEXT,
      actor_id TEXT, meta TEXT, cost_cents INTEGER NOT NULL DEFAULT 0,
      occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    `CREATE INDEX IF NOT EXISTS idx_crm_events_contact ON crm_events(contact_id, occurred_at)`,
    `CREATE INDEX IF NOT EXISTS idx_crm_events_type ON crm_events(type, occurred_at)`,
    `CREATE INDEX IF NOT EXISTS idx_crm_events_conv ON crm_events(conversation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_crm_events_run ON crm_events(workflow_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_crm_events_deal ON crm_events(deal_id)`,
    `CREATE TABLE IF NOT EXISTS consent_records (
      id TEXT PRIMARY KEY, contact_id TEXT, email TEXT, phone TEXT, channel TEXT NOT NULL,
      action TEXT NOT NULL, basis TEXT, disclosure_text TEXT, capture_method TEXT,
      source_url TEXT, ip TEXT, user_agent TEXT, proof_ref TEXT,
      occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    `CREATE INDEX IF NOT EXISTS idx_consent_contact ON consent_records(contact_id, channel, occurred_at)`,
    `CREATE INDEX IF NOT EXISTS idx_consent_email ON consent_records(email, channel)`,
    `CREATE TABLE IF NOT EXISTS suppressions (
      id TEXT PRIMARY KEY, contact_id TEXT, email TEXT, phone TEXT,
      channel TEXT NOT NULL DEFAULT 'all', reason TEXT, source TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_suppress_email_ch ON suppressions(email, channel)`,
    `CREATE INDEX IF NOT EXISTS idx_suppress_phone ON suppressions(phone)`,
    `CREATE INDEX IF NOT EXISTS idx_suppress_contact ON suppressions(contact_id)`,
    `CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, trigger TEXT NOT NULL, goal TEXT,
      definition TEXT NOT NULL, requires_consent TEXT, enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    `CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, contact_id TEXT NOT NULL,
      conversation_id TEXT, deal_id TEXT, status TEXT NOT NULL DEFAULT 'active',
      current_step INTEGER NOT NULL DEFAULT 0, next_run_at TEXT, exit_reason TEXT, last_error TEXT,
      enrolled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    `CREATE INDEX IF NOT EXISTS idx_wfrun_due ON workflow_runs(status, next_run_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_wfrun_contact_wf ON workflow_runs(workflow_id, contact_id)`,
    `CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL, step_index INTEGER NOT NULL, channel TEXT,
      action TEXT, status TEXT NOT NULL DEFAULT 'pending', detail TEXT, scheduled_at TEXT,
      executed_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
    `CREATE INDEX IF NOT EXISTS idx_wfstep_run ON workflow_steps(run_id, step_index)`,
  ];
  await env.DB.batch(ddl.map((s) => env.DB.prepare(s)));

  // Guarded ALTERs on contacts (ADD COLUMN is not IF-NOT-EXISTS in SQLite).
  try {
    const info = await env.DB.prepare(`PRAGMA table_info(contacts)`).all();
    const cols = new Set((info.results || []).map((r) => r.name));
    const adds = [];
    if (!cols.has("lifecycle_stage")) adds.push(`ALTER TABLE contacts ADD COLUMN lifecycle_stage TEXT DEFAULT 'lead'`);
    if (!cols.has("utm_first")) adds.push(`ALTER TABLE contacts ADD COLUMN utm_first TEXT`);
    if (!cols.has("utm_latest")) adds.push(`ALTER TABLE contacts ADD COLUMN utm_latest TEXT`);
    if (!cols.has("dormant_since")) adds.push(`ALTER TABLE contacts ADD COLUMN dormant_since TEXT`);
    for (const s of adds) { try { await env.DB.prepare(s).run(); } catch (_) {} }
  } catch (_) { /* contacts may not exist yet on a truly fresh DB; ensureCrmV2Schema creates it */ }

  _ensured = true;
}

// ---- crm_events: the append-only log. Everything that happens gets a row. ----
async function logEvent(env, e) {
  await ensureRebuildSchema(env);
  const id = ulid();
  await env.DB.prepare(
    `INSERT INTO crm_events (id,type,contact_id,company_id,conversation_id,deal_id,workflow_run_id,channel,source,actor_id,meta,cost_cents,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, e.type, e.contactId || null, e.companyId || null, e.conversationId || null,
    e.dealId || null, e.workflowRunId || null, e.channel || null, e.source || null,
    e.actorId || null, e.meta ? JSON.stringify(e.meta) : null, e.costCents || 0,
    e.occurredAt || nowIso()
  ).run();
  return id;
}

// ---- Consent ledger ----
async function recordConsent(env, c) {
  await ensureRebuildSchema(env);
  const id = ulid();
  await env.DB.prepare(
    `INSERT INTO consent_records (id,contact_id,email,phone,channel,action,basis,disclosure_text,capture_method,source_url,ip,user_agent,proof_ref,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, c.contactId || null, c.email || null, c.phone || null, c.channel, c.action,
    c.basis || null, c.disclosureText || null, c.captureMethod || null, c.sourceUrl || null,
    c.ip || null, c.userAgent || null, c.proofRef || null, c.occurredAt || nowIso()
  ).run();
  // Mirror into the event log so analytics/timeline see it.
  await logEvent(env, {
    type: c.action === "revoked" ? "consent_revoked" : "consent_granted",
    contactId: c.contactId, channel: c.channel, source: c.source || c.captureMethod,
    meta: { basis: c.basis, method: c.captureMethod },
  });
  return id;
}

async function addSuppression(env, s) {
  await ensureRebuildSchema(env);
  const id = ulid();
  await env.DB.prepare(
    `INSERT INTO suppressions (id,contact_id,email,phone,channel,reason,source)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(email,channel) DO UPDATE SET reason=excluded.reason, source=excluded.source`
  ).bind(id, s.contactId || null, s.email || null, s.phone || null, s.channel || "all", s.reason || null, s.source || null).run();
  await logEvent(env, { type: "suppressed", contactId: s.contactId, channel: s.channel === "all" ? null : s.channel, meta: { reason: s.reason } });
  return id;
}

// Is this contact/email/phone suppressed on `channel` (or all)?
async function isSuppressed(env, { contactId, email, phone, channel }) {
  await ensureRebuildSchema(env);
  const row = await env.DB.prepare(
    `SELECT 1 FROM suppressions
      WHERE (channel = 'all' OR channel = ?)
        AND ( (? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?) OR (? IS NOT NULL AND contact_id = ?) )
      LIMIT 1`
  ).bind(channel || "all", email || null, email || null, phone || null, phone || null, contactId || null, contactId || null).first();
  return !!row;
}

// Latest consent action per channel for a contact/email → { email:'granted', sms:'revoked', voice:null }
async function consentState(env, { contactId, email }) {
  await ensureRebuildSchema(env);
  const rows = await env.DB.prepare(
    `SELECT channel, action, occurred_at FROM consent_records
      WHERE (? IS NOT NULL AND contact_id = ?) OR (? IS NOT NULL AND email = ?)
      ORDER BY occurred_at ASC`
  ).bind(contactId || null, contactId || null, email || null, email || null).all();
  const state = { email: null, sms: null, voice: null };
  for (const r of (rows.results || [])) state[r.channel] = r.action; // last write wins (ordered ASC)
  return state;
}

// The load-bearing gate: may we send on `channel` to this contact right now?
// PEWC (granted) required for sms/voice; email allowed unless suppressed/revoked.
async function canSend(env, { contactId, email, phone, channel }) {
  if (await isSuppressed(env, { contactId, email, phone, channel })) return { ok: false, reason: "suppressed" };
  const st = await consentState(env, { contactId, email });
  if (channel === "sms" || channel === "voice") {
    if (st[channel] !== "granted") return { ok: false, reason: "no_pewc" };
  } else if (channel === "email") {
    if (st.email === "revoked") return { ok: false, reason: "email_revoked" };
  }
  return { ok: true };
}

export {
  ulid, nowIso, ensureRebuildSchema, logEvent,
  recordConsent, addSuppression, isSuppressed, consentState, canSend,
};
