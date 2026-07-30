// Speed-to-Lead — internal test console API (build step 9). CRM-gated.
//   GET  /api/stl/admin           → settings + metrics + recent leads + violations + reps
//   POST /api/stl/admin {action}  → set_settings | inject | tick | seed_rep |
//                                    mark_transfer | revoke | reset_tests
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureStlSchema } from "../_lib/stl/schema.js";
import { getSettings, setSetting, DEFAULTS } from "../_lib/stl/settings.js";
import { createLead } from "../_lib/stl/classifier.js";
import { scheduleLead, tick, revoke } from "../_lib/stl/runner.js";

const all = async (env, sql, ...b) => { try { return (await env.DB.prepare(sql).bind(...b).all()).results || []; } catch (_) { return []; } };
const one = async (env, sql, ...b) => { try { return (await env.DB.prepare(sql).bind(...b).first()) || {}; } catch (_) { return {}; } };
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
function p95(arr) { if (!arr.length) return null; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]; }

async function metrics(env) {
  // Speed to first ring (Population B) — first call attempt minus created_at.
  const firstCalls = await all(env,
    `SELECT l.created_at c, MIN(t.attempted_at) a FROM stl_leads l
       JOIN stl_touchpoints t ON t.lead_id=l.id
      WHERE l.population='B' AND t.channel IN ('call_ai','call_human') AND t.attempted_at IS NOT NULL
      GROUP BY l.id`);
  const ringDeltas = firstCalls.map((r) => (r.a - r.c) / 1000).filter((x) => x >= 0);
  const slaBreaches = firstCalls.filter((r) => (r.a - r.c) > 5 * 60 * 1000).length;

  const aContacted = await one(env,
    `SELECT COUNT(DISTINCT l.id) n FROM stl_leads l JOIN stl_touchpoints t ON t.lead_id=l.id
      WHERE l.population='A' AND t.status='sent' AND (t.completed_at - l.created_at) <= 3600000`);
  const aTotal = await one(env, "SELECT COUNT(*) n FROM stl_leads WHERE population='A'");
  const gv = await one(env, "SELECT COUNT(*) n FROM stl_gate_violations");
  const cookieLeak = await one(env,
    `SELECT COUNT(*) n FROM stl_consent_events WHERE kind='cookie_banner' AND (channel_email+channel_sms+channel_phone_hum+channel_phone_ai) > 0`);
  const byStatus = await all(env, "SELECT status, COUNT(*) n FROM stl_touchpoints GROUP BY status");
  const byMode = await all(env, "SELECT dispatch_mode, COUNT(*) n FROM stl_touchpoints WHERE dispatch_mode IS NOT NULL GROUP BY dispatch_mode");
  const leads = await one(env, "SELECT COUNT(*) n, SUM(population='A') a, SUM(population='B') b FROM stl_leads");
  const dialsSent = await one(env, "SELECT COUNT(*) n FROM stl_touchpoints WHERE channel IN ('call_ai','call_human') AND status='sent'");

  return {
    leads_total: leads.n || 0, leads_A: leads.a || 0, leads_B: leads.b || 0,
    speed_to_first_ring_p95_s: p95(ringDeltas),
    sla_breach_rate_pct: pct(slaBreaches, firstCalls.length),
    identified_contacted_60m_pct: pct(aContacted.n || 0, aTotal.n || 0),
    window_compliance_dials_sent: dialsSent.n || 0,      // all sent dials are in-window by construction
    gate_violations: gv.n || 0,                          // target 0
    cookie_leak_flags: cookieLeak.n || 0,                // target 0 (classifier bug detector)
    touchpoints_by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    dispatch_by_mode: Object.fromEntries(byMode.map((r) => [r.dispatch_mode, r.n])),
  };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureStlSchema(env);
  const settings = await getSettings(env);
  const leads = await all(env,
    `SELECT id, created_at, population, status, first_name, last_name, company, trade, email, phone, is_test
       FROM stl_leads ORDER BY created_at DESC LIMIT 40`);
  const tps = await all(env,
    `SELECT id, lead_id, sequence_step, channel, status, scheduled_for, attempted_at, outcome, consent_check, block_reason, dispatch_mode
       FROM stl_touchpoints WHERE lead_id IN (SELECT id FROM stl_leads ORDER BY created_at DESC LIMIT 40)
      ORDER BY scheduled_for ASC`);
  const violations = await all(env, "SELECT * FROM stl_gate_violations ORDER BY attempted_at DESC LIMIT 20");
  const reps = await all(env, "SELECT id, name, phone, active FROM stl_reps ORDER BY name");
  return json({ ok: true, settings, defaults: DEFAULTS, metrics: await metrics(env), leads, touchpoints: tps, violations, reps }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureStlSchema(env);
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const action = body.action;

  try {
    if (action === "set_settings") {
      for (const k of Object.keys(DEFAULTS)) if (k in (body.settings || {})) await setSetting(env, k, body.settings[k]);
      return json({ ok: true, settings: await getSettings(env) }, {}, cors);
    }
    if (action === "inject") {
      // Build a test lead payload. Population B if consent.* set, else A.
      const p = { ...(body.lead || {}), is_test: true };
      if (body.population === "B" && !p.consent) p.consent = { email: true, sms: true, phone_human: true, phone_ai: true, grade: "written" };
      p.kind = p.kind || (body.population === "B" ? "form_submit" : "cookie_banner");
      const { leadId, population, revokeToken } = await createLead(env, p);
      const lead = await env.DB.prepare("SELECT * FROM stl_leads WHERE id=?").bind(leadId).first();
      await scheduleLead(env, lead);
      return json({ ok: true, lead_id: leadId, population, revoke_token: revokeToken }, {}, cors);
    }
    if (action === "tick") {
      const summary = await tick(env, body.limit || 100);
      return json({ ok: true, summary }, {}, cors);
    }
    if (action === "seed_rep") {
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO stl_reps (id, name, phone, email, active) VALUES (?,?,?,?,1)")
        .bind(id, body.name || "Test Rep", body.phone || "+15555550100", body.email || null).run();
      const now = Date.now();
      await env.DB.prepare("INSERT INTO stl_rep_availability (id, rep_id, starts_at, ends_at, state) VALUES (?,?,?,?, 'available')")
        .bind(crypto.randomUUID(), id, now - 3600000, now + 30 * 86400000).run();
      return json({ ok: true, rep_id: id }, {}, cors);
    }
    if (action === "mark_transfer") {
      // Test helper: simulate Ruby's warm transfer being accepted on a lead's B1 call.
      const tp = await env.DB.prepare("SELECT id FROM stl_touchpoints WHERE lead_id=? AND sequence_step='B1_retell' ORDER BY scheduled_for DESC LIMIT 1").bind(body.lead_id).first();
      if (tp) await env.DB.prepare("UPDATE stl_calls SET answered=1, transfer_attempted=1, transfer_accepted=1, transfer_latency_s=? WHERE touchpoint_id=?").bind(body.latency_s || 12, tp.id).run();
      return json({ ok: true }, {}, cors);
    }
    if (action === "revoke") {
      const r = await revoke(env, { leadId: body.lead_id, via: "admin" });
      return json(r, {}, cors);
    }
    if (action === "reset_tests") {
      // Delete only test leads and their children.
      const ids = (await all(env, "SELECT id FROM stl_leads WHERE is_test=1")).map((r) => r.id);
      for (const id of ids) {
        for (const tbl of ["stl_touchpoints", "stl_consent_events", "stl_meetings", "stl_gate_violations", "stl_events", "stl_calls"]) {
          await env.DB.prepare(`DELETE FROM ${tbl} WHERE lead_id=?`).bind(id).run().catch(() => {});
        }
        await env.DB.prepare("DELETE FROM stl_leads WHERE id=?").bind(id).run().catch(() => {});
      }
      return json({ ok: true, deleted: ids.length }, {}, cors);
    }
    return json({ ok: false, error: "unknown_action" }, { status: 400 }, cors);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 }, cors);
  }
}
