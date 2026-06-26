// CRM v2 — normalized data model (BUILD-SPEC §3, BUILD-PLAN P0-1/P0-2).
// Tables self-initialize at runtime (CREATE TABLE IF NOT EXISTS), same pattern as
// _lib/crm.js, so no wrangler/migration tooling is needed. Additive: lives alongside
// the legacy crm_leads / crm_activity tables, which the P0-4 migration backfills from.
import { crmSessionEmail } from "./auth.js";

// App-generated ULIDs (spec §3): time-sortable TEXT ids, no autoincrement coordination.
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
export function ulid() {
  let t = Date.now(), ts = "";
  for (let i = 0; i < 10; i++) { ts = B32[t % 32] + ts; t = Math.floor(t / 32); }
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  let r = "";
  for (let i = 0; i < 16; i++) r += B32[rnd[i] % 32];
  return ts + r;
}

// Home-service ICP leans heavily on free email — domain grouping must skip these (spec §4).
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com",
  "live.com", "msn.com", "comcast.net", "sbcglobal.net", "att.net", "verizon.net",
  "me.com", "mac.com", "ymail.com", "protonmail.com", "proton.me", "gmx.com",
]);
export function emailDomain(email) {
  const m = String(email || "").toLowerCase().match(/@([^@\s]+)$/);
  return m ? m[1] : "";
}

// Seed roster (BUILD-PLAN P0-2 — Andy/Aaron/Tyler/Jason). Idempotent via users.email UNIQUE.
const SEED_USERS = [
  { name: "Aaron", email: "aaron@consentresolve.com", role: "admin" },
  { name: "Andy",  email: "andy@consentresolve.com",  role: "sales" },
  { name: "Tyler", email: "tyler@consentresolve.com", role: "sales" },
  { name: "Jason", email: "jason@consentresolve.com", role: "sales" },
];

let _ensured = false;
export async function ensureCrmV2Schema(env) {
  if (_ensured) return;
  const S = (sql) => env.DB.prepare(sql);
  await env.DB.batch([
    S(`CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, name TEXT, domain TEXT, apollo_org_id TEXT, enrichment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    S(`CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain)`),
    S(`CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY, company_id TEXT, full_name TEXT, primary_email TEXT, phone TEXT,
      title TEXT, apollo_person_id TEXT, enrichment TEXT, source TEXT,
      is_provisional INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    S(`CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id)`),
    S(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(primary_email)`),
    S(`CREATE TABLE IF NOT EXISTS contact_identifiers (
      id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(type, value))`),
    S(`CREATE TABLE IF NOT EXISTS channel_accounts (
      id TEXT PRIMARY KEY, channel TEXT NOT NULL, label TEXT, external_account_id TEXT,
      credentials_ref TEXT, is_active INTEGER NOT NULL DEFAULT 1)`),
    S(`CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, contact_id TEXT, company_id TEXT, channel TEXT NOT NULL,
      source_detail TEXT, channel_account_id TEXT, external_thread_id TEXT, subject TEXT,
      status TEXT NOT NULL DEFAULT 'open', snooze_until TEXT, assignee_id TEXT,
      unread INTEGER NOT NULL DEFAULT 1, last_message_at TEXT, last_message_preview TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    S(`CREATE INDEX IF NOT EXISTS idx_conv_status_snooze ON conversations(status, snooze_until)`),
    S(`CREATE INDEX IF NOT EXISTS idx_conv_assignee ON conversations(assignee_id)`),
    S(`CREATE INDEX IF NOT EXISTS idx_conv_company ON conversations(company_id)`),
    S(`CREATE INDEX IF NOT EXISTS idx_conv_lastmsg ON conversations(last_message_at)`),
    S(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, direction TEXT NOT NULL,
      channel TEXT NOT NULL, author_id TEXT, external_message_id TEXT, in_reply_to_external TEXT,
      body_text TEXT, body_html TEXT, attachments TEXT, sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    S(`CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, sent_at)`),
    S(`CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, primary_contact_id TEXT,
      origin_conversation_id TEXT, owner_id TEXT NOT NULL, title TEXT, value_cents INTEGER,
      close_probability INTEGER, expected_close_date TEXT,
      lead_status TEXT NOT NULL DEFAULT 'active', won_lost_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    S(`CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id, lead_status)`),
    S(`CREATE INDEX IF NOT EXISTS idx_deals_close ON deals(expected_close_date)`),
    S(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'sales', active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    S(`CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY, actor_id TEXT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, meta TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    S(`CREATE INDEX IF NOT EXISTS idx_act_entity ON activities(entity_type, entity_id)`),
    S(`CREATE INDEX IF NOT EXISTS idx_act_actor ON activities(actor_id, created_at)`),
    S(`CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY, author_id TEXT, conversation_id TEXT, contact_id TEXT,
      body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`),
  ]);
  for (const u of SEED_USERS) {
    await env.DB.prepare(
      `INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING`
    ).bind(ulid(), u.name, u.email, u.role).run();
  }
  _ensured = true;
}

export async function getUserByEmail(env, email) {
  if (!email) return null;
  return await env.DB.prepare("SELECT * FROM users WHERE lower(email)=lower(?)").bind(email).first();
}
// Maps the logged-in Google session -> users row (P0-2). Null if not a seeded user.
export async function currentUser(request, env) {
  const email = await crmSessionEmail(request, env);
  if (!email) return null;
  await ensureCrmV2Schema(env);
  return await getUserByEmail(env, email);
}
export async function adminUserId(env) {
  const r = await env.DB.prepare("SELECT id FROM users WHERE role='admin' AND active=1 ORDER BY created_at LIMIT 1").first();
  return r ? r.id : null;
}

export async function addActivityV2(env, { actorId, entityType, entityId, action, meta }) {
  await env.DB.prepare(
    `INSERT INTO activities (id, actor_id, entity_type, entity_id, action, meta) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(ulid(), actorId || null, entityType, entityId, action, meta ? JSON.stringify(meta) : null).run();
}

// Find or create a company. Prefer domain match (non-free-email); else fall back to a
// name-keyed company with NULL domain (the common free-email path for this ICP, spec §4).
export async function findOrCreateCompany(env, { name, domain }) {
  const dom = (domain || "").toLowerCase().trim();
  if (dom && !FREE_EMAIL_DOMAINS.has(dom)) {
    const ex = await env.DB.prepare("SELECT id FROM companies WHERE lower(domain)=?").bind(dom).first();
    if (ex) return ex.id;
    const id = ulid();
    await env.DB.prepare("INSERT INTO companies (id, name, domain) VALUES (?, ?, ?)").bind(id, name || dom, dom).run();
    return id;
  }
  if (name) {
    const ex = await env.DB.prepare("SELECT id FROM companies WHERE domain IS NULL AND lower(name)=lower(?)").bind(name).first();
    if (ex) return ex.id;
    const id = ulid();
    await env.DB.prepare("INSERT INTO companies (id, name) VALUES (?, ?)").bind(id, name).run();
    return id;
  }
  const id = ulid();
  await env.DB.prepare("INSERT INTO companies (id, name) VALUES (?, ?)").bind(id, "(unknown)").run();
  return id;
}

// Identity v0 (P1-6): match an email to a contact via contact_identifiers, else create
// the contact + its company. Full resolution engine (provisional/merge) is P2-3.
export async function findOrCreateContactByEmail(env, email, opts = {}) {
  const e = String(email || "").toLowerCase().trim();
  if (!e) return null;
  const idr = await env.DB.prepare(
    "SELECT contact_id FROM contact_identifiers WHERE type='email' AND value=?"
  ).bind(e).first();
  if (idr) return idr.contact_id;
  const companyId = await findOrCreateCompany(env, { name: opts.company, domain: emailDomain(e) });
  const contactId = ulid();
  await env.DB.prepare(
    "INSERT INTO contacts (id, company_id, full_name, primary_email, phone, source, is_provisional) VALUES (?, ?, ?, ?, ?, ?, 0)"
  ).bind(contactId, companyId, opts.name || null, e, opts.phone || null, opts.source || null).run();
  await env.DB.prepare(
    "INSERT INTO contact_identifiers (id, contact_id, type, value, verified) VALUES (?, ?, 'email', ?, 1) ON CONFLICT(type, value) DO NOTHING"
  ).bind(ulid(), contactId, e).run();
  return contactId;
}

// One conversation per (channel, external_thread_id). Updates rollup on each new message.
export async function upsertConversationByThread(env, c) {
  const ex = await env.DB.prepare(
    "SELECT id FROM conversations WHERE channel=? AND external_thread_id=?"
  ).bind(c.channel, c.externalThreadId || "").first();
  if (ex) {
    await env.DB.prepare(
      "UPDATE conversations SET last_message_at=?, last_message_preview=?, contact_id=COALESCE(contact_id, ?), company_id=COALESCE(company_id, ?), unread=CASE WHEN ?=1 THEN 1 ELSE unread END, updated_at=datetime('now') WHERE id=?"
    ).bind(c.lastAt || null, c.preview || null, c.contactId || null, c.companyId || null, c.incoming ? 1 : 0, ex.id).run();
    return ex.id;
  }
  const id = ulid();
  await env.DB.prepare(
    "INSERT INTO conversations (id, contact_id, company_id, channel, source_detail, channel_account_id, external_thread_id, subject, status, unread, last_message_at, last_message_preview) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)"
  ).bind(id, c.contactId || null, c.companyId || null, c.channel, c.sourceDetail || null,
         c.channelAccountId || null, c.externalThreadId || null, c.subject || null,
         c.incoming ? 1 : 0, c.lastAt || null, c.preview || null).run();
  return id;
}

// Insert a message, deduped on external_message_id (idempotent re-polls).
export async function insertMessageOnce(env, m) {
  if (m.externalMessageId) {
    const ex = await env.DB.prepare("SELECT id FROM messages WHERE external_message_id=?").bind(m.externalMessageId).first();
    if (ex) return { id: ex.id, existed: true };
  }
  const id = ulid();
  await env.DB.prepare(
    "INSERT INTO messages (id, conversation_id, direction, channel, author_id, external_message_id, in_reply_to_external, body_text, body_html, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, m.conversationId, m.direction, m.channel, m.authorId || null, m.externalMessageId || null,
         m.inReplyTo || null, m.bodyText || null, m.bodyHtml || null, m.sentAt || null).run();
  return { id, existed: false };
}
