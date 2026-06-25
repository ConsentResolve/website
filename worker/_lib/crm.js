// CRM data layer (D1). Tables self-initialize at runtime (CREATE TABLE IF NOT
// EXISTS) — same pattern as the traffic beacon — so no local wrangler/migration
// step is needed. crm_leads is the system of record for warm leads; demo-form
// signups in `participants` are mirrored in automatically.

import { uuid, nowIso } from "./db.js";

export async function ensureCrmSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS crm_leads (
      id TEXT PRIMARY KEY,
      source TEXT,            -- instantly | demo | crisp | rb2b | manual
      industry TEXT,          -- trade slug (hvac, roofing, …)
      name TEXT, email TEXT, phone TEXT, company TEXT, domain TEXT,
      owner TEXT,
      stage TEXT DEFAULT 'new',        -- new|contacted|qualified|demo|proposal
      status TEXT DEFAULT 'open',      -- open|won|lost|closed
      value_usd REAL DEFAULT 0,
      consent_status TEXT DEFAULT 'consented', -- consented|identified|unknown
      utm_source TEXT, utm_campaign TEXT,
      notes TEXT,
      created_at TEXT, last_activity TEXT
    )`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_email ON crm_leads(email)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS crm_activity (
      id TEXT PRIMARY KEY, lead_id TEXT, type TEXT, body TEXT, actor TEXT, at TEXT
    )`),
  ]);
}

// Pull demo-form signups (participants) into crm_leads. Idempotent via the
// email unique index — only inserts emails not already present.
export async function syncFromParticipants(env) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO crm_leads
      (id, source, industry, name, email, phone, company, stage, status, consent_status, created_at, last_activity)
    SELECT p.id, 'demo', p.trade, p.name, p.email, p.phone, p.business_name,
           CASE WHEN p.consented_at IS NOT NULL THEN 'qualified' ELSE 'new' END,
           'open', 'consented', p.created_at, COALESCE(p.consented_at, p.created_at)
    FROM participants p
    WHERE p.email IS NOT NULL AND p.email != ''
      AND p.email NOT IN (SELECT email FROM crm_leads WHERE email IS NOT NULL)
  `).run();
}

export async function listLeads(env, opts = {}) {
  await ensureCrmSchema(env);
  await syncFromParticipants(env);
  const where = [], binds = [];
  if (opts.industry && opts.industry !== "all") { where.push("industry = ?"); binds.push(opts.industry); }
  if (opts.source && opts.source !== "all") { where.push("source = ?"); binds.push(opts.source); }
  const q = "SELECT * FROM crm_leads" + (where.length ? " WHERE " + where.join(" AND ") : "") +
            " ORDER BY last_activity DESC LIMIT 500";
  const { results } = await env.DB.prepare(q).bind(...binds).all();
  return results || [];
}

export async function getLead(env, id) {
  await ensureCrmSchema(env);
  const lead = await env.DB.prepare("SELECT * FROM crm_leads WHERE id = ?").bind(id).first();
  if (!lead) return null;
  const acts = (await env.DB.prepare(
    "SELECT type, body, actor, at FROM crm_activity WHERE lead_id = ? ORDER BY at DESC LIMIT 100"
  ).bind(id).all()).results || [];
  // Demo leads share their id with a participant — surface that event history too.
  let events = [];
  try {
    events = (await env.DB.prepare(
      "SELECT event_type AS type, metadata AS body, created_at AS at FROM events WHERE participant_id = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(id).all()).results || [];
  } catch (_) {}
  return { lead, activity: acts, events };
}

const EDITABLE = ["stage", "status", "value_usd", "owner", "notes", "industry", "name", "phone", "company"];

export async function updateLead(env, id, fields) {
  await ensureCrmSchema(env);
  const keys = Object.keys(fields).filter((k) => EDITABLE.includes(k));
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const vals = keys.map((k) => (k === "value_usd" ? Number(fields[k]) || 0 : fields[k]));
  await env.DB.prepare(`UPDATE crm_leads SET ${set}, last_activity = ? WHERE id = ?`)
    .bind(...vals, nowIso(), id).run();
}

export async function addActivity(env, leadId, type, body, actor) {
  await ensureCrmSchema(env);
  await env.DB.prepare("INSERT INTO crm_activity (id, lead_id, type, body, actor, at) VALUES (?,?,?,?,?,?)")
    .bind(uuid(), leadId, type, body || "", actor || "system", nowIso()).run();
  await env.DB.prepare("UPDATE crm_leads SET last_activity = ? WHERE id = ?").bind(nowIso(), leadId).run();
}

// Insert/merge a lead from any source (manual add + future Crisp/RB2B/Instantly ingest).
export async function upsertLead(env, lead) {
  await ensureCrmSchema(env);
  const id = lead.id || uuid();
  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO crm_leads
      (id, source, industry, name, email, phone, company, domain, owner, stage, status,
       value_usd, consent_status, utm_source, utm_campaign, notes, created_at, last_activity)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET
      name = COALESCE(excluded.name, crm_leads.name),
      phone = COALESCE(excluded.phone, crm_leads.phone),
      company = COALESCE(excluded.company, crm_leads.company),
      last_activity = excluded.last_activity
  `).bind(
    id, lead.source || "manual", lead.industry || null, lead.name || null, lead.email || null,
    lead.phone || null, lead.company || null, lead.domain || null, lead.owner || null,
    lead.stage || "new", lead.status || "open", Number(lead.value_usd) || 0,
    lead.consent_status || "consented", lead.utm_source || null, lead.utm_campaign || null,
    lead.notes || null, now, now
  ).run();
  return id;
}
