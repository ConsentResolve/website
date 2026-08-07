// worker/api/crm-rebuild-migrate.js
// Migrate the CURRENT CRM's data into the rebuild's new tables (crm_events,
// consent_records, suppressions) and set contacts.lifecycle_stage.
// Runs AFTER the v1->v2 contact/company/deal backfill (/api/crm/migrate?run=1).
//
//   GET /api/crm/rebuild/migrate            -> dry-run preview (counts)
//   GET /api/crm/rebuild/migrate?ensure=1   -> just create the new tables (no data)
//   GET /api/crm/rebuild/migrate?run=1       -> execute backfill (idempotent, re-runnable)
//
// Admin-gated (cr_crm session + users.role='admin'). Idempotent: every backfilled
// row uses a deterministic id + INSERT OR IGNORE, so re-runs are safe and additive.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, isAdmin } from "../_lib/crm-v2.js";
import { ensureRebuildSchema } from "../_lib/crm-rebuild.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
export async function onRequestGet(ctx) { return run(ctx); }
export async function onRequestPost(ctx) { return run(ctx); }

const J = (o) => (o == null ? null : JSON.stringify(o));
async function batchIgnore(env, rows) {
  // rows: array of prepared statements; chunk to stay within D1 batch limits.
  for (let i = 0; i < rows.length; i += 40) {
    await env.DB.batch(rows.slice(i, i + 40));
  }
}

// crm_activity.type / demo event_type -> crm_events.type
function mapActivityType(t) {
  const s = (t || "").toLowerCase();
  if (s.includes("repl")) return "replied";
  if (s.includes("book")) return "booked";
  if (s.includes("email")) return "email_sent";
  if (s.includes("sms") || s.includes("text")) return "sms_sent";
  if (s.includes("call") || s.includes("voice")) return "call_placed";
  if (s.includes("stage")) return "stage_changed";
  if (s.includes("consent")) return "consent_granted";
  if (s.includes("note")) return "note_added";
  return "note_added";
}
function mapDemoEvent(t) {
  return ({ registered: "lead_created", visited: "site_visit", emailed: "email_sent",
            enrolled: "signed_up", consented: "consent_granted" })[t] || "note_added";
}

async function run({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden", message: "Admin role required." }, { status: 403 }, cors);

  const url = new URL(request.url);
  await ensureCrmV2Schema(env);
  await ensureRebuildSchema(env);
  if (url.searchParams.get("ensure") === "1") {
    return json({ ok: true, ensured: true, note: "new tables created; no data backfilled" }, {}, cors);
  }
  const dry = url.searchParams.get("run") !== "1";

  // Build an email -> {contactId, companyId} map once (v2 contacts).
  const contacts = (await env.DB.prepare(
    "SELECT id, company_id, lower(primary_email) email FROM contacts WHERE primary_email IS NOT NULL"
  ).all()).results || [];
  const byEmail = new Map();
  for (const c of contacts) byEmail.set(c.email, { contactId: c.id, companyId: c.company_id });
  const resolve = (email) => byEmail.get((email || "").trim().toLowerCase()) || {};

  const counts = { events: 0, consent: 0, suppressions: 0, lifecycle: 0 };
  const evRows = [], conRows = [], supRows = [];
  const ev = (id, type, ref, extra = {}) => evRows.push(env.DB.prepare(
    `INSERT OR IGNORE INTO crm_events (id,type,contact_id,company_id,conversation_id,deal_id,channel,source,actor_id,meta,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, type, ref.contactId || null, ref.companyId || null, extra.conversationId || null,
         extra.dealId || null, extra.channel || null, extra.source || null, extra.actorId || null,
         J(extra.meta), extra.occurredAt || new Date().toISOString()));
  const con = (id, ch, action, r) => conRows.push(env.DB.prepare(
    `INSERT OR IGNORE INTO consent_records (id,contact_id,email,phone,channel,action,basis,disclosure_text,capture_method,ip,user_agent,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, r.contactId || null, r.email || null, r.phone || null, ch, action, r.basis || null,
         r.disclosure || null, r.method || null, r.ip || null, r.ua || null, r.occurredAt || new Date().toISOString()));

  // ---- A. crm_events backfill ----
  // A1. crm_leads -> lead_created
  const leads = (await env.DB.prepare("SELECT * FROM crm_leads").all()).results || [];
  for (const l of leads) {
    const ref = resolve(l.email);
    ev(`bf-lead-${l.id}`, "lead_created", ref, {
      source: l.source, occurredAt: l.created_at,
      meta: { industry: l.industry, utm_source: l.utm_source, utm_campaign: l.utm_campaign, consent_status: l.consent_status },
    });
  }
  // A2. crm_activity -> mapped events (resolve contact via lead email)
  const leadEmailById = new Map(leads.map((l) => [l.id, l.email]));
  const acts = (await env.DB.prepare("SELECT * FROM crm_activity").all()).results || [];
  for (const a of acts) {
    const ref = resolve(leadEmailById.get(a.lead_id));
    ev(`bf-act-${a.id}`, mapActivityType(a.type), ref, { occurredAt: a.at, meta: { orig_type: a.type, body: a.body, actor: a.actor } });
  }
  // A3. v2 messages -> sent/replied events
  const msgs = (await env.DB.prepare(
    `SELECT m.id, m.direction, m.channel, m.sent_at, c.contact_id, c.company_id, m.conversation_id
       FROM messages m JOIN conversations c ON c.id = m.conversation_id`
  ).all()).results || [];
  for (const m of msgs) {
    const type = m.direction === "in" ? "replied"
      : m.channel === "sms" ? "sms_sent" : m.channel === "voice" ? "call_placed" : "email_sent";
    ev(`bf-msg-${m.id}`, type, { contactId: m.contact_id, companyId: m.company_id },
       { channel: m.channel, conversationId: m.conversation_id, occurredAt: m.sent_at });
  }
  // A4. v2 deals -> deal_created (+ won/lost)
  const deals = (await env.DB.prepare("SELECT * FROM deals").all()).results || [];
  for (const d of deals) {
    ev(`bf-deal-${d.id}`, "deal_created", { contactId: d.primary_contact_id, companyId: d.company_id },
       { dealId: d.id, occurredAt: d.created_at, meta: { value_cents: d.value_cents } });
    if (d.lead_status === "won" || d.lead_status === "lost") {
      ev(`bf-dealend-${d.id}`, d.lead_status === "won" ? "booked" : "stage_changed",
         { contactId: d.primary_contact_id, companyId: d.company_id },
         { dealId: d.id, occurredAt: d.won_lost_at || d.updated_at, meta: { lead_status: d.lead_status } });
    }
  }
  // A5. demo events table -> mapped
  let demoEvents = [];
  try {
    demoEvents = (await env.DB.prepare(
      `SELECT e.id, e.event_type, e.created_at, p.email FROM events e JOIN participants p ON p.id = e.participant_id`
    ).all()).results || [];
  } catch (_) { /* demo tables may be absent */ }
  for (const e of demoEvents) {
    if (e.event_type === "consented") continue; // consent handled in section B
    ev(`bf-demoevt-${e.id}`, mapDemoEvent(e.event_type), resolve(e.email), { source: "demo", occurredAt: e.created_at });
  }

  // ---- B. consent_records backfill ----
  // B1. participants (demo/get-started signups)
  let participants = [];
  try {
    participants = (await env.DB.prepare(
      "SELECT id,email,phone,consent_contact,consent_text_version,ip,user_agent,consented_at,created_at FROM participants"
    ).all()).results || [];
  } catch (_) {}
  for (const p of participants) {
    const consented = p.consent_contact === 1 || p.consented_at;
    if (!consented) continue;
    const ref = resolve(p.email);
    const base = { contactId: ref.contactId, email: p.email, phone: p.phone, disclosure: p.consent_text_version,
                   method: "get_started", ip: p.ip, ua: p.user_agent, occurredAt: p.consented_at || p.created_at };
    con(`bf-part-${p.id}-email`, "email", "granted", { ...base, basis: "PEC" });
    if (p.consent_contact === 1) {
      // NOTE (review w/ counsel): treats the demo contact-consent checkbox as PEWC for SMS/voice.
      con(`bf-part-${p.id}-sms`, "sms", "granted", { ...base, basis: "PEWC" });
      con(`bf-part-${p.id}-voice`, "voice", "granted", { ...base, basis: "PEWC" });
    }
  }
  // B2. crm_leads.consent_status='consented' -> email grant. 'identified'/'unknown' -> none.
  for (const l of leads) {
    if (l.consent_status === "consented") {
      const ref = resolve(l.email);
      con(`bf-leadconsent-${l.id}-email`, "email", "granted",
          { contactId: ref.contactId, email: l.email, basis: "PEC", method: "import", occurredAt: l.created_at });
    }
  }

  // ---- C. suppressions backfill (legacy crm_suppressions, email-only) ----
  let legacySupp = [];
  try {
    legacySupp = (await env.DB.prepare("SELECT email, reason, source, created_at FROM crm_suppressions").all()).results || [];
  } catch (_) {}
  for (const s of legacySupp) {
    const r = (s.reason || "").toLowerCase();
    const channel = r.includes("bounce") ? "email" : r.includes("unsub") || r.includes("stop") ? "all" : "email";
    supRows.push(env.DB.prepare(
      `INSERT OR IGNORE INTO suppressions (id,email,channel,reason,source,created_at) VALUES (?,?,?,?,?,?)`
    ).bind(`bf-supp-${s.email}-${channel}`, s.email, channel, s.reason || null, s.source || "legacy", s.created_at || new Date().toISOString()));
  }

  counts.events = evRows.length;
  counts.consent = conRows.length;
  counts.suppressions = supRows.length;

  if (dry) {
    return json({ ok: true, dry: true, would_write: counts,
      note: "preview only — run /api/crm/migrate?run=1 first (v1->v2), then this with ?run=1" }, {}, cors);
  }

  // Apply (INSERT OR IGNORE makes each idempotent).
  await batchIgnore(env, evRows);
  await batchIgnore(env, conRows);
  await batchIgnore(env, supRows);

  // ---- D. (retired) lifecycle_stage backfill — Stage is now derived from the deal, so there
  // is nothing to populate. The dormant contacts.lifecycle_stage column is left untouched.
  counts.lifecycle = 0;

  return json({ ok: true, dry: false, migrated: counts,
    sources: { leads: leads.length, activities: acts.length, messages: msgs.length, deals: deals.length,
               demo_events: demoEvents.length, participants: participants.length, legacy_suppressions: legacySupp.length } }, {}, cors);
}
