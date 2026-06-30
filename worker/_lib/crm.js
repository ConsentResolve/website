// CRM data layer (D1). Tables self-initialize at runtime (CREATE TABLE IF NOT
// EXISTS) — same pattern as the traffic beacon — so no local wrangler/migration
// step is needed. crm_leads is the system of record for warm leads; demo-form
// signups in `participants` are mirrored in automatically.

import { uuid, nowIso } from "./db.js";
import { isAuthed, crmSessionEmail } from "./auth.js";

// Shared gate for CRM endpoints: admin session OR ?key=<CRM_KEY|DASHBOARD_KEY>.
export function crmKey(env) {
  return env.CRM_KEY || env.DASHBOARD_KEY || "cr-dash-2026";
}
export async function crmAuthed(request, env) {
  if (await isAuthed(request, env)) return true;           // /admin password session
  return Boolean(await crmSessionEmail(request, env));     // Google CRM sign-in only (cr_crm cookie)
}
// Token for inbound webhooks (Crisp, RB2B). Separate secret if set, else the CRM key.
export function crmWebhookToken(env) { return env.CRM_WEBHOOK_TOKEN || crmKey(env); }

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
  const where = ["status != 'deleted'"], binds = [];
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

// Soft-delete: keep the row (so demo signups aren't re-imported by sync) but
// hide it from the list + analytics.
export async function deleteLead(env, id) {
  await ensureCrmSchema(env);
  await env.DB.prepare("UPDATE crm_leads SET status='deleted', last_activity=? WHERE id=?").bind(nowIso(), id).run();
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
  if (lead.email) {
    const row = await env.DB.prepare("SELECT id FROM crm_leads WHERE email=?").bind(lead.email).first();
    if (row && row.id) return row.id;
  }
  return id;
}

// ── Spend (manual tool subs + ad spend) ─────────────────────────────────────
export async function ensureSpend(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS crm_spend (
    id TEXT PRIMARY KEY, industry TEXT, channel TEXT, amount_usd REAL,
    period TEXT, note TEXT, created_at TEXT
  )`).run();
}
export async function listSpend(env) {
  await ensureSpend(env);
  return (await env.DB.prepare("SELECT * FROM crm_spend ORDER BY created_at DESC LIMIT 300").all()).results || [];
}
export async function addSpend(env, s) {
  await ensureSpend(env);
  await env.DB.prepare("INSERT INTO crm_spend (id, industry, channel, amount_usd, period, note, created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(uuid(), s.industry || null, s.channel || "other", Number(s.amount_usd) || 0, s.period || null, s.note || null, nowIso()).run();
}
export async function deleteSpend(env, id) {
  await ensureSpend(env);
  await env.DB.prepare("DELETE FROM crm_spend WHERE id=?").bind(id).run();
}

// ── Per-industry funnel + ROAS ──────────────────────────────────────────────
export async function computeAnalytics(env) {
  await ensureCrmSchema(env);
  await ensureSpend(env);
  await syncFromParticipants(env);
  const leadRows = (await env.DB.prepare(
    "SELECT COALESCE(industry,'(unknown)') AS ind, COUNT(*) AS leads, SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) AS won, SUM(CASE WHEN status='won' THEN value_usd ELSE 0 END) AS revenue FROM crm_leads WHERE status != 'deleted' GROUP BY ind"
  ).all()).results || [];
  const demoRows = (await env.DB.prepare(
    "SELECT trade AS ind, COUNT(*) AS demos FROM participants WHERE consented_at IS NOT NULL GROUP BY trade"
  ).all()).results || [];
  const spendRows = (await env.DB.prepare(
    "SELECT COALESCE(industry,'(unknown)') AS ind, channel, SUM(amount_usd) AS amt FROM crm_spend GROUP BY ind, channel"
  ).all()).results || [];

  const map = {};
  const row = (ind) => map[ind] || (map[ind] = { industry: ind, visits: 0, leads: 0, demos: 0, won: 0, revenue: 0, spend: 0 });
  leadRows.forEach((r) => { const x = row(r.ind); x.leads = r.leads || 0; x.won = r.won || 0; x.revenue = r.revenue || 0; });
  demoRows.forEach((r) => { if (r.ind) row(r.ind).demos = r.demos || 0; });
  const byChannel = {};
  spendRows.forEach((r) => { row(r.ind).spend += r.amt || 0; byChannel[r.channel] = (byChannel[r.channel] || 0) + (r.amt || 0); });

  for (const ind of Object.keys(map)) {
    try {
      const v = await env.DB.prepare("SELECT COUNT(*) AS n FROM traffic WHERE path LIKE ?").bind("/" + ind + "-leads%").first();
      map[ind].visits = (v && v.n) || 0;
    } catch (_) {}
  }

  const industries = Object.values(map).map((x) => {
    x.cpl = x.leads ? Math.round(x.spend / x.leads) : 0;
    x.cac = x.won ? Math.round(x.spend / x.won) : 0;
    x.winRate = x.demos ? Math.round((100 * x.won) / x.demos) : 0;
    x.roas = x.spend ? Math.round((x.revenue / x.spend) * 10) / 10 : 0;
    return x;
  }).sort((a, b) => b.leads - a.leads);

  const totals = industries.reduce((t, x) => {
    t.visits += x.visits; t.leads += x.leads; t.demos += x.demos; t.won += x.won; t.revenue += x.revenue; t.spend += x.spend; return t;
  }, { visits: 0, leads: 0, demos: 0, won: 0, revenue: 0, spend: 0 });
  totals.roas = totals.spend ? Math.round((totals.revenue / totals.spend) * 10) / 10 : 0;
  totals.cac = totals.won ? Math.round(totals.spend / totals.won) : 0;
  totals.cpl = totals.leads ? Math.round(totals.spend / totals.leads) : 0;
  return { industries, totals, byChannel };
}

// ── Social calendar (published + scheduled from social_queue) ───────────────
export async function socialCalendar(env) {
  try {
    return (await env.DB.prepare(
      "SELECT platform, status, resource_slug, post_url, COALESCE(published_at, scheduled_at) AS at FROM social_queue WHERE COALESCE(published_at, scheduled_at) IS NOT NULL ORDER BY at DESC LIMIT 400"
    ).all()).results || [];
  } catch (_) { return []; }
}
