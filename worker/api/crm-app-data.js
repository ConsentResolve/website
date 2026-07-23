// worker/api/crm-app-data.js  ->  GET /api/crm/app
// Real-data read endpoint for the rebuild frontend + migration verification.
// Returns fixture-shaped slices backed by the new tables (consent_records,
// workflows/runs/steps, crm_events) and v2 (conversations/contacts). The frozen
// /crm/app can Object.assign these onto its window.* globals (fixture->fetch swap).
// Session-gated (cr_crm). This is the growing API contract — clean screens first.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser } from "../_lib/crm-v2.js";
import { ensureRebuildSchema } from "../_lib/crm-rebuild.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureRebuildSchema(env);
  const me = await currentUser(request, env).catch(() => null);

  // ---- Consent ledger (backed by consent_records) ----
  const consentRows = (await env.DB.prepare(
    `SELECT cr.occurred_at ts, cr.channel, cr.action, cr.basis, cr.capture_method method,
            c.full_name name, co.name company
       FROM consent_records cr
       LEFT JOIN contacts c ON c.id = cr.contact_id
       LEFT JOIN companies co ON co.id = c.company_id
      ORDER BY cr.occurred_at DESC LIMIT 100`
  ).all()).results || [];
  const CONSENT_LEDGER = consentRows.map((r) => ({
    ts: r.ts, name: r.name || "—", co: r.company || "", ch: [r.channel],
    action: r.action, basis: r.basis, method: r.method,
  }));
  const consentSummary = firstRow(await env.DB.prepare(
    `SELECT
       (SELECT COUNT(DISTINCT contact_id) FROM consent_records WHERE action='granted') granted_contacts,
       (SELECT COUNT(*) FROM suppressions) suppressions,
       (SELECT COUNT(*) FROM consent_records) total_records`
  ).all());

  // ---- Sequences (backed by workflows + runs + steps) ----
  const wfs = (await env.DB.prepare("SELECT * FROM workflows WHERE enabled=1").all()).results || [];
  const SEQUENCES = [];
  for (const w of wfs) {
    const runs = firstRow(await env.DB.prepare(
      `SELECT COUNT(*) enrolled,
              SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active,
              SUM(CASE WHEN exit_reason='replied' THEN 1 ELSE 0 END) replied,
              SUM(CASE WHEN exit_reason='booked' THEN 1 ELSE 0 END) booked,
              SUM(CASE WHEN exit_reason='opted_out' THEN 1 ELSE 0 END) opted_out
         FROM workflow_runs WHERE workflow_id=?`
    ).bind(w.id).all());
    const stepStats = (await env.DB.prepare(
      `SELECT s.step_index step_index, s.channel channel, s.action action, s.status status, COUNT(*) n
         FROM workflow_steps s JOIN workflow_runs r ON r.id=s.run_id
        WHERE r.workflow_id=? GROUP BY s.step_index, s.status ORDER BY s.step_index`
    ).bind(w.id).all()).results || [];
    let def = []; try { def = JSON.parse(w.definition); } catch (_) {}
    SEQUENCES.push({
      id: w.id, name: w.name, trigger: w.trigger,
      consent: safeJson(w.requires_consent, []),
      metrics: {
        active: runs.active || 0, enrolled: runs.enrolled || 0,
        replied: runs.replied || 0, booked: runs.booked || 0, opted_out: runs.opted_out || 0,
      },
      steps: def.map((s, i) => ({
        idx: i, ch: s.channel, action: s.action, delay_minutes: s.delay_minutes,
        sent: stepStats.filter((x) => x.step_index === i && x.status === "sent").reduce((a, x) => a + x.n, 0),
        skipped: stepStats.filter((x) => x.step_index === i && x.status === "skipped").reduce((a, x) => a + x.n, 0),
      })),
    });
  }

  // ---- Inbox summary (conversations by status) + funnel (crm_events) ----
  const buckets = firstRow(await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) open,
       SUM(CASE WHEN status='snoozed' THEN 1 ELSE 0 END) snoozed,
       SUM(CASE WHEN status='archived' THEN 1 ELSE 0 END) archived,
       COUNT(*) total FROM conversations`
  ).all());
  const funnel = {};
  for (const t of ["lead_created", "contacted", "replied", "booked", "signed_up", "activated"]) {
    funnel[t] = firstRow(await env.DB.prepare("SELECT COUNT(DISTINCT contact_id) n FROM crm_events WHERE type=?").bind(t).all())?.n || 0;
  }

  return json({
    ok: true,
    me: me ? { name: me.name, email: me.email, role: me.role } : null,
    CONSENT_LEDGER, consentSummary,
    SEQUENCES,
    inbox: { buckets },
    funnel,
    generated_at: new Date().toISOString(),
    _note: "real-data slices for the rebuild UI + migration verification; growing per screen",
  }, {}, cors);
}

function firstRow(res) { return (res.results && res.results[0]) || {}; }
function safeJson(s, d) { try { return JSON.parse(s); } catch (_) { return d; } }
