// worker/_lib/workflow-engine.js
// The follow-up automation engine (CRM-REBUILD-MASTER Part 3.2/3.4, Part 7.2).
// v0 is Cloudflare-Workflows-free: it runs on the existing */5 cron. Every step
// emits a crm_event, so step-level conversion reporting is a query, not a project.
//
// SAFETY: the entire engine is DORMANT until env.WORKFLOW_ENGINE_ENABLED === "true"
// (same pattern as SOCIAL_AUTOPOST_ENABLED). Shipping it does not send anything.
// SMS (Telnyx) and AI voice (Retell) actions are coded but HOLD until 10DLC approval
// + creds; email (Resend, already live) is the launch channel.
//
// The consent gate (canSend) is checked before EVERY message action — load-bearing.

import {
  ulid, nowIso, ensureRebuildSchema, logEvent, canSend, isSuppressed, consentState,
} from "./crm-rebuild.js";
import { sendEmail as gmailSend } from "./gmail.js";
import { trackedUrl } from "./click-track.js";
import { ensureCrmV2Schema } from "./crm-v2.js";

const enabled = (env) => env.WORKFLOW_ENGINE_ENABLED === "true";

// Conservative quiet-hours window that satisfies every jurisdiction we operate in
// at once (TX 9am–9pm lower bound; FL/OK/WA 8am–8pm upper bound → intersect 9–20).
// Per-recipient state refinement is a documented follow-up.
const QUIET = { open: 9, close: 20 };
const TZ = (env) => env.WORKFLOW_TZ || "America/Chicago";

function tzParts(ms, tz) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date(ms));
  let hh = Number(p.find((x) => x.type === "hour").value) % 24;
  const mm = Number(p.find((x) => x.type === "minute").value);
  return { hh, mm, minsOfDay: hh * 60 + mm };
}
// Returns the soonest sendable epoch-ms for a channel (email: anytime; sms/voice: inside window).
function sendableAt(ms, channel, env) {
  if (channel !== "sms" && channel !== "voice") return ms;
  const { hh, minsOfDay } = tzParts(ms, TZ(env));
  if (hh >= QUIET.open && hh < QUIET.close) return ms;
  const addMins = hh < QUIET.open ? (QUIET.open * 60 - minsOfDay) : (24 * 60 - minsOfDay) + QUIET.open * 60;
  return ms + addMins * 60000;
}

// ---- Default workflow definitions ----------------------------------------
const SPEED_TO_LEAD = {
  id: "speed-to-lead",
  name: "Speed-to-lead",
  trigger: "lead_created",
  goal: JSON.stringify(["replied", "booked", "opted_out"]),
  requires_consent: JSON.stringify(["sms", "voice"]),
  definition: JSON.stringify([
    { channel: "sms",   action: "send_sms",       delay_minutes: 0,    template: "stl_sms1" },
    { channel: "voice", action: "place_ai_call",  delay_minutes: 5,    template: "stl_call" },
    { channel: "email", action: "send_email",     delay_minutes: 0,    template: "stl_email" },
    { channel: null,    action: "wait",           delay_minutes: 1440 },
    { channel: "sms",   action: "send_sms",       delay_minutes: 0,    template: "stl_sms2" },
  ]),
};
const EARN_CONSENT = {
  id: "earn-consent",
  name: "Earn consent (email-only)",
  trigger: "lead_created",
  goal: JSON.stringify(["replied", "booked", "consent_granted", "opted_out"]),
  requires_consent: JSON.stringify([]),
  definition: JSON.stringify([
    { channel: "email", action: "send_email", delay_minutes: 0,    template: "earn_1" },
    { channel: "email", action: "send_email", delay_minutes: 2880, template: "earn_2" },
    { channel: "email", action: "send_email", delay_minutes: 7200, template: "earn_3" },
  ]),
};

async function seedWorkflows(env) {
  await ensureRebuildSchema(env);
  for (const w of [SPEED_TO_LEAD, EARN_CONSENT]) {
    await env.DB.prepare(
      `INSERT INTO workflows (id,name,trigger,goal,definition,requires_consent,enabled)
       VALUES (?,?,?,?,?,?,1)
       ON CONFLICT(id) DO UPDATE SET definition=excluded.definition, goal=excluded.goal,
         requires_consent=excluded.requires_consent, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    ).bind(w.id, w.name, w.trigger, w.goal, w.definition, w.requires_consent).run();
  }
}

// ---- Message templates (compliant copy) ----------------------------------
const BRAND = "Consent Resolve";
function tpl(env, id, c) {
  const first = (c.full_name || "there").split(" ")[0];
  // Pref-center CTA routed through the tracked redirect so nurture clicks land in the CRM.
  const PREF_CENTER = trackedUrl(env, { dest: "/get-started/", email: c.email, campaign: "nurture", label: id });
  const t = {
    stl_sms1: () => ({ text: `Hi ${first}, ${c.owner || "Andy"} at ${BRAND} — we turn your website visitors into exclusive $7 leads. Want the 2-min version? Reply STOP to opt out.` }),
    stl_sms2: () => ({ text: `${first}, still happy to show you how ${BRAND} recovers the 98% of site visitors who leave without filling a form. Reply YES for a quick look. STOP to opt out.` }),
    stl_call: () => ({ script: `Hi${first !== "there" ? " " + first : ""}, this is an AI assistant calling on behalf of ${BRAND}. I'll be quick — we help home-service businesses turn the website visitors who leave without filling out a form into exclusive leads. Is now an OK time for about sixty seconds?` }),
    stl_email: () => ({
      subject: `${first}, the 98% of your site visitors who leave without a trace`,
      html: emailShell(`Hi ${first},`, `Most contractors capture only the ~2% of website visitors who fill out a form. ${BRAND} identifies the rest — with consent — and delivers them as <b>exclusive</b> leads at a flat $7. No shared leads, no long contracts.<br><br>Worth a 10-minute look?`, c),
    }),
    earn_1: () => ({
      subject: `${first}, a consent-first way to get more leads from your site`,
      html: emailShell(`Hi ${first},`, `You're getting website traffic — but ~98% leave without ever filling out a form. ${BRAND} recovers those visitors, with their consent, and turns them into exclusive leads.<br><br>If you'd like calls and texts too, you can opt in here: <a href="${PREF_CENTER}">set your contact preferences</a>.`, c),
    }),
    earn_2: () => ({
      subject: `${first}, quick follow-up from ${BRAND}`,
      html: emailShell(`Hi ${first},`, `Just circling back — contractors using ${BRAND} recover leads they were otherwise losing entirely. Reply and I'll send a 60-second sample, or <a href="${PREF_CENTER}">opt in for a call</a>.`, c),
    }),
    earn_3: () => ({
      subject: `${first}, last note (for now)`,
      html: emailShell(`Hi ${first},`, `I'll stop here so I'm not a pest. If recovering the visitors your forms miss sounds useful, just reply — or <a href="${PREF_CENTER}">book a quick call</a>.`, c),
    }),
  }[id];
  return t ? t() : { subject: `${BRAND}`, html: emailShell(`Hi ${first},`, `Reaching out from ${BRAND}.`, c) };
}
function emailShell(greeting, body, c) {
  const addr = "1907 Gulf Way #1, St Pete Beach, FL 33706";
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0e1c2e">
    <p>${greeting}</p><p>${body}</p>
    <p>— ${c.owner || "Andy"}, ${BRAND}</p>
    <hr style="border:none;border-top:1px solid #e5e9f0;margin:18px 0">
    <p style="font-size:12px;color:#8496a6">${BRAND} · ${addr}<br>
    You received this because you expressed interest in lead generation. <a href="https://consentresolve.com/api/unsubscribe?c=${encodeURIComponent(c.id || "")}">Unsubscribe</a>.</p></div>`;
}

// ---- Providers ------------------------------------------------------------
// Sends through the connected Google Workspace mailbox (hello@consentresolve.com) —
// no sending-domain DNS to verify. Name kept for call-site stability.
async function sendResend(env, { to, subject, html, text, unsubUrl }, dry) {
  if (dry) return { ok: true, id: "dry-preview", dry: true, preview: { to, subject } };
  const from = env.FROM_EMAIL || "Consent Resolve <hello@consentresolve.com>";
  // RFC 8058 one-click unsubscribe → required by Gmail/Yahoo for bulk senders + boosts deliverability.
  const headers = unsubUrl ? { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
  const g = await gmailSend(env, { to, subject, html, text, from, replyTo: env.REPLY_TO || "hello@consentresolve.com", headers });
  if (!g.ok) return { ok: false, error: `gmail_${g.error || "failed"}` };
  return { ok: true, id: g.id };
}
// HOLD-FOR-MORNING: Telnyx SMS. Coded; inert until TELNYX_API_KEY + 10DLC approval.
async function sendTelnyxSms(env, { to, text }, dry) {
  if (dry) return { ok: true, id: "dry-preview", dry: true, preview: { to, text } };
  if (!env.TELNYX_API_KEY || !env.TELNYX_FROM_NUMBER) return { ok: false, error: "telnyx_not_configured", hold: true };
  const r = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TELNYX_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.TELNYX_FROM_NUMBER, to, text }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j?.data?.id } : { ok: false, error: `telnyx_${r.status}` };
}
// HOLD-FOR-MORNING: Retell AI voice. Coded; inert until RETELL_API_KEY.
async function placeRetellCall(env, { to, script }, dry) {
  if (dry) return { ok: true, id: "dry-preview", dry: true, preview: { to } };
  if (!env.RETELL_API_KEY || !env.RETELL_AGENT_ID || !env.RETELL_FROM_NUMBER) return { ok: false, error: "retell_not_configured", hold: true };
  const r = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from_number: env.RETELL_FROM_NUMBER, to_number: to, override_agent_id: env.RETELL_AGENT_ID, retell_llm_dynamic_variables: { opening: script } }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j?.call_id } : { ok: false, error: `retell_${r.status}` };
}

// ---- Enrollment -----------------------------------------------------------
async function loadContact(env, contactId) {
  return env.DB.prepare(
    `SELECT c.id, c.full_name, c.primary_email email, c.phone, c.source, u.name owner
       FROM contacts c LEFT JOIN deals d ON d.primary_contact_id=c.id
       LEFT JOIN users u ON u.id=d.owner_id WHERE c.id=? LIMIT 1`
  ).bind(contactId).first();
}

// Enroll one contact. Routes speed-to-lead (has SMS PEWC) vs earn-consent. Idempotent
// via uq_wfrun_contact_wf. Returns {runId, workflow} or {skipped}.
async function enrollContact(env, { contactId, conversationId, dealId, source }) {
  await ensureRebuildSchema(env); await ensureCrmV2Schema(env);
  const c = await loadContact(env, contactId);
  if (!c) return { skipped: "no_contact" };
  // Note: the former source==='apollo' outreach block was removed 2026-07-29 at the
  // owner's direction — identified visitors accepted the cookie banner (lawful basis
  // captured), so identified/prospected leads are eligible for automation. The
  // suppression (opted-out) and already-enrolled checks below still apply.
  if (await isSuppressed(env, { contactId, email: c.email, channel: "all" })) return { skipped: "suppressed" };
  const st = await consentState(env, { contactId, email: c.email });
  const workflowId = st.sms === "granted" ? "speed-to-lead" : "earn-consent";
  // already enrolled?
  const existing = await env.DB.prepare("SELECT id FROM workflow_runs WHERE workflow_id=? AND contact_id=?").bind(workflowId, contactId).first();
  if (existing) return { skipped: "already_enrolled", runId: existing.id };
  const runId = ulid();
  const def = JSON.parse((await env.DB.prepare("SELECT definition FROM workflows WHERE id=?").bind(workflowId).first())?.definition || "[]");
  const firstDelay = (def[0]?.delay_minutes || 0);
  const nextAt = new Date(sendableAt(Date.now() + firstDelay * 60000, def[0]?.channel, env)).toISOString();
  await env.DB.prepare(
    `INSERT INTO workflow_runs (id,workflow_id,contact_id,conversation_id,deal_id,status,current_step,next_run_at)
     VALUES (?,?,?,?,?, 'active', 0, ?)`
  ).bind(runId, workflowId, contactId, conversationId || null, dealId || null, nextAt).run();
  await logEvent(env, { type: "sequence_enrolled", contactId, conversationId, dealId, workflowRunId: runId, source, meta: { workflow: workflowId } });
  return { runId, workflow: workflowId };
}

// ---- Goal handling: reply/booked/opt-out exits active runs for a contact ----
async function handleGoalEvent(env, { contactId, goal }) {
  await ensureRebuildSchema(env);
  const runs = (await env.DB.prepare(
    `SELECT r.id, r.workflow_id, w.goal FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id
      WHERE r.contact_id=? AND r.status='active'`
  ).bind(contactId).all()).results || [];
  let exited = 0;
  for (const r of runs) {
    const goals = JSON.parse(r.goal || "[]");
    if (!goals.includes(goal)) continue;
    await env.DB.prepare("UPDATE workflow_runs SET status='exited', exit_reason=?, next_run_at=NULL, updated_at=? WHERE id=?")
      .bind(goal, nowIso(), r.id).run();
    await logEvent(env, { type: "sequence_exited", contactId, workflowRunId: r.id, meta: { reason: goal } });
    exited++;
  }
  if (goal === "opted_out") {
    const c = await loadContact(env, contactId);
    if (c) { const { addSuppression } = await import("./crm-rebuild.js"); await addSuppression(env, { contactId, email: c.email, phone: c.phone, channel: "all", reason: "opted_out", source: "workflow" }); }
  }
  return exited;
}

// ---- The cron tick --------------------------------------------------------
// Process every run whose next step is due. Returns a summary.
async function processDueRuns(env, { limit = 50, dry = false } = {}) {
  if (!dry && !enabled(env)) return { skipped: "disabled" };
  await ensureRebuildSchema(env); await seedWorkflows(env);
  const now = nowIso();
  const due = (await env.DB.prepare(
    "SELECT * FROM workflow_runs WHERE status='active' AND next_run_at IS NOT NULL AND next_run_at<=? ORDER BY next_run_at ASC LIMIT ?"
  ).bind(now, limit).all()).results || [];
  const out = { processed: 0, emailed: 0, skipped: 0, deferred: 0, exited: 0, completed: 0, dry };
  for (const run of due) {
    try { await stepRun(env, run, out, dry); } catch (e) {
      await env.DB.prepare("UPDATE workflow_runs SET last_error=?, updated_at=? WHERE id=?").bind(String(e).slice(0, 200), now, run.id).run();
    }
    out.processed++;
  }
  return out;
}

async function stepRun(env, run, out, dry) {
  const wf = await env.DB.prepare("SELECT * FROM workflows WHERE id=?").bind(run.workflow_id).first();
  const steps = JSON.parse(wf?.definition || "[]");
  let idx = run.current_step;
  const c = await loadContact(env, run.contact_id);
  if (!c) { await completeRun(env, run, "no_contact"); return; }

  // Advance through skip/wait steps until we either send, defer, or finish.
  while (idx < steps.length) {
    const step = steps[idx];
    const ch = step.channel;

    if (step.action === "wait") { idx++; continue; }

    // Consent gate before any message action.
    if (ch === "sms" || ch === "voice" || ch === "email") {
      const gate = await canSend(env, { contactId: run.contact_id, email: c.email, phone: c.phone, channel: ch });
      if (!gate.ok) {
        if (gate.reason === "suppressed") { await exitRun(env, run, "suppressed", out); return; }
        // no PEWC (sms/voice) or email revoked → skip this step, keep the sequence moving (email carries it).
        await logStep(env, run, idx, ch, step.action, "skipped", gate.reason);
        await logEvent(env, { type: "sequence_step_completed", contactId: run.contact_id, workflowRunId: run.id, channel: ch, meta: { step: idx, status: "skipped", reason: gate.reason } });
        out.skipped++; idx++; continue;
      }
    }

    // Quiet hours (sms/voice only): defer the whole run to window-open.
    if (ch === "sms" || ch === "voice") {
      const okAt = sendableAt(Date.now(), ch, env);
      if (okAt > Date.now() + 60000) {
        await scheduleAt(env, run, idx, new Date(okAt).toISOString());
        out.deferred++; return;
      }
    }

    // Execute the action.
    const res = await executeStep(env, run, c, step, idx, out, dry);
    if (res === "exit") return;
    if (res === "retry") {
      // A genuine send failure (provider error, not an unconfigured-provider hold and not a
      // skip). DON'T advance the drip — that would silently drop this touch. Reschedule the
      // SAME step with exponential backoff, bounded so a permanently-failing step eventually
      // gives up instead of looping forever.
      const attempts = await failedAttempts(env, run.id, idx);
      if (attempts >= 4) {
        await logStep(env, run, idx, ch, step.action, "skipped", "gave_up_after_retries");
        out.skipped++; idx++; continue; // move on so the run isn't stuck
      }
      const backoffMin = Math.min(240, 15 * Math.pow(2, attempts)); // 15m,30m,60m,120m…
      await scheduleAt(env, run, idx, new Date(sendableAt(Date.now() + backoffMin * 60000, ch, env)).toISOString());
      out.deferred++; return;
    }
    // schedule the NEXT step (if any) after its delay; else complete.
    const next = steps[idx + 1];
    if (!next) { await completeRun(env, run, "completed"); out.completed++; return; }
    const at = new Date(sendableAt(Date.now() + (next.delay_minutes || 0) * 60000, next.channel, env)).toISOString();
    await scheduleAt(env, run, idx + 1, at);
    return; // one action per tick per run
  }
  await completeRun(env, run, "completed"); out.completed++;
}

async function executeStep(env, run, c, step, idx, out, dry) {
  const t = tpl(env, step.template, c);
  let res, type, cost = 0;
  if (step.action === "send_email") {
    if (!c.email) { await logStep(env, run, idx, "email", step.action, "skipped", "no_email"); out.skipped++; return; }
    res = await sendResend(env, { to: c.email, subject: t.subject, html: t.html, text: t.text, unsubUrl: c.id ? "https://consentresolve.com/api/unsubscribe?c=" + encodeURIComponent(c.id) : undefined }, dry);
    type = dry ? "email_preview" : "email_sent";
    if (!dry) await maybeCreateMessage(env, run, c, "email", t.subject, t.html);
  } else if (step.action === "send_sms") {
    if (!c.phone) { await logStep(env, run, idx, "sms", step.action, "skipped", "no_phone"); out.skipped++; return; }
    res = await sendTelnyxSms(env, { to: c.phone, text: t.text }, dry);
    type = dry ? "sms_preview" : "sms_sent"; cost = dry ? 0 : 1; // ~$0.0085/seg → tracked in cents rounded to 1 for now
  } else if (step.action === "place_ai_call") {
    if (!c.phone) { await logStep(env, run, idx, "voice", step.action, "skipped", "no_phone"); out.skipped++; return; }
    res = await placeRetellCall(env, { to: c.phone, script: t.script }, dry);
    type = dry ? "call_preview" : "call_placed"; cost = dry ? 0 : 10;
  } else { await logStep(env, run, idx, step.channel, step.action, "skipped", "unknown_action"); out.skipped++; return; }

  if (res.ok) {
    await logStep(env, run, idx, step.channel, step.action, dry ? "preview" : "sent", res.id || "");
    await logEvent(env, { type, contactId: run.contact_id, conversationId: run.conversation_id, workflowRunId: run.id, channel: step.channel, costCents: cost, meta: { step: idx, provider_id: res.id, template: step.template, dry: dry || undefined, preview: res.preview } });
    if (step.action === "send_email") out.emailed++;
  } else if (res.hold) {
    // Provider not configured yet (Telnyx/Retell) → treat as skipped, keep sequence moving.
    await logStep(env, run, idx, step.channel, step.action, "skipped", res.error);
    await logEvent(env, { type: "sequence_step_completed", contactId: run.contact_id, workflowRunId: run.id, channel: step.channel, meta: { step: idx, status: "hold", reason: res.error } });
    out.skipped++;
  } else {
    // Genuine provider failure (e.g. Gmail 429, network). Log it and signal a retry so the
    // caller reschedules THIS step instead of advancing past a touch that never landed.
    await logStep(env, run, idx, step.channel, step.action, "failed", res.error);
    await logEvent(env, { type: step.channel === "sms" ? "sms_failed" : "sequence_step_completed", contactId: run.contact_id, workflowRunId: run.id, channel: step.channel, meta: { step: idx, status: "failed", error: res.error } });
    out.failed = (out.failed || 0) + 1;
    return dry ? undefined : "retry";
  }
}

// How many times step `idx` of this run has already failed — bounds the retry backoff.
async function failedAttempts(env, runId, idx) {
  try {
    const r = await env.DB.prepare(
      "SELECT COUNT(*) n FROM workflow_steps WHERE run_id=? AND step_index=? AND status='failed'"
    ).bind(runId, idx).first();
    return (r && r.n) || 0;
  } catch (_) { return 0; }
}

// Mirror an outbound automation email into the inbox conversation so the team sees it.
async function maybeCreateMessage(env, run, c, channel, subject, html) {
  if (!run.conversation_id) return;
  try {
    await env.DB.prepare(
      `INSERT INTO messages (id,conversation_id,direction,channel,body_text,body_html,sent_at)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(ulid(), run.conversation_id, "out", channel, subject, html, nowIso()).run();
    await env.DB.prepare("UPDATE conversations SET last_message_at=?, last_message_preview=? WHERE id=?")
      .bind(nowIso(), (subject || "").slice(0, 120), run.conversation_id).run();
  } catch (_) {}
}

async function logStep(env, run, idx, channel, action, status, detail) {
  await env.DB.prepare(
    `INSERT INTO workflow_steps (id,run_id,step_index,channel,action,status,detail,executed_at) VALUES (?,?,?,?,?,?,?,?)`
  ).bind(ulid(), run.id, idx, channel || null, action || null, status, (detail || "").slice(0, 300), nowIso()).run();
}
async function scheduleAt(env, run, stepIdx, iso) {
  await env.DB.prepare("UPDATE workflow_runs SET current_step=?, next_run_at=?, updated_at=? WHERE id=?").bind(stepIdx, iso, nowIso(), run.id).run();
}
async function completeRun(env, run, reason) {
  await env.DB.prepare("UPDATE workflow_runs SET status='completed', exit_reason=?, next_run_at=NULL, updated_at=? WHERE id=?").bind(reason, nowIso(), run.id).run();
  await logEvent(env, { type: "sequence_exited", contactId: run.contact_id, workflowRunId: run.id, meta: { reason } });
}
async function exitRun(env, run, reason, out) {
  await env.DB.prepare("UPDATE workflow_runs SET status='exited', exit_reason=?, next_run_at=NULL, updated_at=? WHERE id=?").bind(reason, nowIso(), run.id).run();
  await logEvent(env, { type: "sequence_exited", contactId: run.contact_id, workflowRunId: run.id, meta: { reason } });
  out.exited++;
}

// Auto-enroll sweep: react to new inbound conversations without touching every ingest
// handler (approximates the "emit lead_created → engine reacts" inversion). Gated by flag.
async function autoEnrollSweep(env, { hours = 24, limit = 30 } = {}) {
  if (!enabled(env)) return { skipped: "disabled" };
  await ensureRebuildSchema(env); await seedWorkflows(env);
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const convs = (await env.DB.prepare(
    `SELECT cv.id conv_id, cv.contact_id, cv.channel, ct.source
       FROM conversations cv JOIN contacts ct ON ct.id=cv.contact_id
      WHERE cv.created_at>=? AND cv.contact_id IS NOT NULL AND ct.source IS NOT 'apollo'
        AND NOT EXISTS (SELECT 1 FROM workflow_runs r WHERE r.contact_id=cv.contact_id)
      ORDER BY cv.created_at DESC LIMIT ?`
  ).bind(since, limit).all()).results || [];
  let enrolled = 0;
  for (const cv of convs) {
    const r = await enrollContact(env, { contactId: cv.contact_id, conversationId: cv.conv_id, source: cv.channel });
    if (r.runId && !r.skipped) enrolled++;
  }
  return { enrolled, scanned: convs.length };
}

// Called from the */5 cron.
async function tick(env) {
  if (!enabled(env)) return { skipped: "disabled" };
  const a = await autoEnrollSweep(env, {});
  const p = await processDueRuns(env, {});
  return { autoEnroll: a, process: p };
}

export {
  enabled, seedWorkflows, enrollContact, handleGoalEvent, processDueRuns,
  autoEnrollSweep, tick, sendableAt, tpl, sendTelnyxSms, sendResend, placeRetellCall,
};
