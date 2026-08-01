// worker/api/crm-workflow.js
// Control + observability for the follow-up engine. Admin-gated.
//   GET  /api/crm/workflow             -> status (enabled?, workflow defs, run counts)
//   GET  /api/crm/workflow?tick=1      -> run one engine tick now (auto-enroll + process due)
//   GET  /api/crm/workflow?seed=1      -> (re)seed default workflow definitions
//   POST /api/crm/workflow  {enroll:{contactId,conversationId?}}  -> enroll one contact
//   POST /api/crm/workflow  {goal:{contactId,goal}}              -> apply a goal exit
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { isAdmin, findOrCreateContactByEmail } from "../_lib/crm-v2.js";
import { ensureRebuildSchema, recordConsent, isSuppressed } from "../_lib/crm-rebuild.js";
import { seedWorkflows, enrollContact, handleGoalEvent, tick, processDueRuns, sendTelnyxSms, sendResend, placeRetellCall, tpl, enabled } from "../_lib/workflow-engine.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);
  const url = new URL(request.url);
  await ensureRebuildSchema(env);
  await seedWorkflows(env);

  if (url.searchParams.get("tick") === "1") return json({ ok: true, tick: await tick(env) }, {}, cors);
  // DRY-RUN: process due runs with all real sends stubbed (email/SMS/voice). Safe while the
  // engine is DORMANT and pre-10DLC — exercises routing, consent gate, quiet hours, templates.
  // Only processes runs already enrolled (via ?testEnroll / enroll) — does NOT auto-enroll the DB.
  if (url.searchParams.get("preview") === "1") return json({ ok: true, dryRun: true, note: "no real messages sent; email/SMS/voice stubbed", result: await processDueRuns(env, { dry: true }) }, {}, cors);
  if (url.searchParams.get("seed") === "1") { await seedWorkflows(env); return json({ ok: true, seeded: true }, {}, cors); }

  const workflows = (await env.DB.prepare("SELECT id,name,trigger,enabled FROM workflows").all()).results || [];
  const byStatus = (await env.DB.prepare("SELECT status, COUNT(*) n FROM workflow_runs GROUP BY status").all()).results || [];
  const dueNow = (await env.DB.prepare("SELECT COUNT(*) n FROM workflow_runs WHERE status='active' AND next_run_at<=?").bind(new Date().toISOString()).first())?.n || 0;
  const recentSteps = (await env.DB.prepare("SELECT channel,action,status,COUNT(*) n FROM workflow_steps GROUP BY channel,action,status ORDER BY n DESC LIMIT 20").all()).results || [];
  return json({
    ok: true,
    enabled: enabled(env),
    note: enabled(env) ? "engine is LIVE" : "engine is DORMANT — set WORKFLOW_ENGINE_ENABLED=true to activate",
    workflows, runs_by_status: byStatus, due_now: dueNow, steps: recentSteps,
    providers: {
      email: "gmail (hello@consentresolve.com)",
      sms: env.TELNYX_API_KEY ? "configured" : "HOLD: TELNYX_API_KEY + 10DLC",
      voice: env.RETELL_API_KEY ? "configured" : "HOLD: RETELL_API_KEY",
    },
  }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);
  const body = await request.json().catch(() => ({}));
  await ensureRebuildSchema(env); await seedWorkflows(env);
  if (body.enroll?.contactId) return json({ ok: true, result: await enrollContact(env, body.enroll) }, {}, cors);
  if (body.goal?.contactId) return json({ ok: true, exited: await handleGoalEvent(env, body.goal) }, {}, cors);
  // CONTROLLED SINGLE SEND: fire one real SMS to a chosen number to verify delivery, WITHOUT
  // enabling the whole engine. Inert (returns hold) until TELNYX_API_KEY + TELNYX_FROM_NUMBER
  // exist and the toll-free number is verified. Refuses suppressed numbers.
  if (body.testSms?.to) {
    const to = String(body.testSms.to).trim();
    const text = String(body.testSms.text || "Consent Resolve test message. Reply STOP to opt out, HELP for help.");
    if (await isSuppressed(env, { phone: to, channel: "sms" })) return json({ ok: false, error: "suppressed", note: "this number opted out" }, {}, cors);
    const result = await sendTelnyxSms(env, { to, text });
    return json({ ok: result.ok === true, result, note: result.hold ? "Telnyx not configured yet — set TELNYX_API_KEY + TELNYX_FROM_NUMBER after verification" : undefined }, {}, cors);
  }
  // CONTROLLED SINGLE EMAIL: render a real engine template + send via Resend to one address,
  // to verify delivery + rendering + the working unsubscribe, WITHOUT enrolling anyone. Email is
  // already live, so this sends a real message. Refuses suppressed addresses.
  if (body.testEmail?.to) {
    const to = String(body.testEmail.to).trim();
    if (await isSuppressed(env, { email: to.toLowerCase(), channel: "email" })) return json({ ok: false, error: "suppressed", note: "this address opted out" }, {}, cors);
    const template = String(body.testEmail.template || "earn_1"); // earn_1|earn_2|earn_3|stl_email
    const c = { id: "test", full_name: body.testEmail.name || "there", email: to, owner: "Andy" };
    const t = tpl(template, c);
    const result = await sendResend(env, { to, subject: t.subject, html: t.html, text: t.text, unsubUrl: "https://consentresolve.com/api/unsubscribe?c=test" });
    return json({ ok: result.ok === true, template, subject: t.subject, result }, {}, cors);
  }
  // CONTROLLED SINGLE CALL: place one real Retell AI call to a chosen number so you can HEAR the
  // agent, WITHOUT enrolling anyone or needing voice consent (this is an internal test to your own
  // phone). Inert (returns hold) until RETELL_API_KEY + RETELL_AGENT_ID + RETELL_FROM_NUMBER exist.
  if (body.testCall?.to) {
    const to = String(body.testCall.to).trim();
    if (await isSuppressed(env, { phone: to, channel: "voice" })) return json({ ok: false, error: "suppressed" }, {}, cors);
    const script = body.testCall.script || tpl("stl_call", { full_name: body.testCall.name || "there", owner: "Andy" }).script;
    const result = await placeRetellCall(env, { to, script });
    return json({ ok: result.ok === true, script, result, note: result.hold ? "Retell not configured yet — set RETELL_API_KEY + RETELL_AGENT_ID + RETELL_FROM_NUMBER" : undefined }, {}, cors);
  }
  // TURNKEY TEST: create/find a test contact, optionally grant SMS (PEWC) consent so it routes
  // to the SMS-first speed-to-lead sequence, then enroll. Pair with GET ?preview=1 to advance it.
  // Nothing sends here; sends only happen on a dry ?preview tick (all stubbed) or the live engine.
  if (body.testEnroll?.email) {
    const t = body.testEnroll;
    const contactId = await findOrCreateContactByEmail(env, t.email, { name: t.name || "Test Lead", phone: t.phone || null, source: "test" });
    if (t.smsConsent && t.phone) {
      await recordConsent(env, { contactId, phone: t.phone, channel: "sms", action: "granted", basis: "PEWC (test harness)", captureMethod: "test_harness", source: "test" });
    }
    const result = await enrollContact(env, { contactId });
    return json({ ok: true, contactId, smsConsent: !!(t.smsConsent && t.phone), routedTo: result.workflow || result.skipped || null, result }, {}, cors);
  }
  return json({ error: "bad_request", message: "expected {enroll:{contactId}} or {goal:{contactId,goal}}" }, { status: 400 }, cors);
}
