// Speed-to-Lead — SequenceRunner (cron-driven). build step 4.
//  scheduleLead()  — lay down the cadence's touchpoints on lead creation
//  tick()          — cron entry: gate + dispatch every due touchpoint
//  graduate()      — A→B on a new consent event (re-enter at B2)
//  revoke()        — stop everything, honor within seconds
import { ensureStlSchema } from "./schema.js";
import { sequenceFor, SEQUENCE_B_ON_GRADUATION } from "./sequences.js";
import { nextWindowOpen, inWindow } from "./windows.js";
import { gate } from "./gate.js";
import { dispatch, alert } from "./adapters.js";
import { renderTemplate } from "./templates.js";
import { addConsentEvent, classifyPopulation, logEvent } from "./classifier.js";
import { getSettings } from "./settings.js";
import { mirrorTouchpoint } from "./crm-bridge.js";
import { toE164 } from "../phone.js";

const uid = () => crypto.randomUUID();

async function fromName(env) { return env.STL_FROM_NAME || "Consent Resolve"; }

// Create pending touchpoints for a lead's whole sequence.
export async function scheduleLead(env, lead, steps) {
  await ensureStlSchema(env);
  const seq = steps || sequenceFor(lead.population, lead.is_demo);
  const base = lead.created_at || Date.now();
  for (const s of seq) {
    let at = base + s.offset * 1000;
    if (s.windowed && !lead.is_demo) at = nextWindowOpen(at, lead.trade, lead.timezone);
    await env.DB.prepare(
      `INSERT INTO stl_touchpoints
         (id, lead_id, sequence_step, channel, actor_type, actor_id, scheduled_for, template_id, status)
       VALUES (?,?,?,?,?,?,?,?, 'pending')`
    ).bind(uid(), lead.id, s.step, s.channel, s.actor, null, at, s.template).run();
  }
  await logEvent(env, lead.id, "sequence_scheduled", { population: lead.population, steps: seq.length });
}

// Highest-priority rep who is currently available (1=primary, then backups). If nobody
// is available, returns null → Ruby confirms the slot instead of transferring.
async function pickRep(env) {
  const now = Date.now();
  return await env.DB.prepare(
    `SELECT rp.* FROM stl_reps rp
       JOIN stl_rep_availability a ON a.rep_id = rp.id
      WHERE rp.active=1 AND a.state='available' AND a.starts_at<=? AND a.ends_at>=?
      ORDER BY COALESCE(rp.priority, 100) ASC, rp.id
      LIMIT 1`
  ).bind(now, now).first().catch(() => null);
}

// True if we've already sent an SMS to this lead within `withinMs` — used to collapse
// colliding text paths (scheduled confirmation vs missed-call text-back) into one.
async function recentlySentSms(env, leadId, withinMs) {
  const cutoff = Date.now() - withinMs;
  const r = await env.DB.prepare(
    "SELECT 1 x FROM stl_touchpoints WHERE lead_id=? AND channel='sms' AND status='sent' AND completed_at>=? LIMIT 1"
  ).bind(leadId, cutoff).first().catch(() => null);
  return !!r;
}

async function latestMeeting(env, leadId) {
  return await env.DB.prepare(
    "SELECT * FROM stl_meetings WHERE lead_id=? ORDER BY created_at DESC LIMIT 1"
  ).bind(leadId).first().catch(() => null);
}

async function b1Transferred(env, leadId) {
  const r = await env.DB.prepare(
    `SELECT c.transfer_accepted FROM stl_calls c
       JOIN stl_touchpoints t ON t.id=c.touchpoint_id
      WHERE t.lead_id=? AND t.sequence_step='B1_retell' AND c.transfer_accepted=1 LIMIT 1`
  ).bind(leadId).first().catch(() => null);
  return !!r;
}

// The cron tick: process due, pending touchpoints.
export async function tick(env, limit = 50) {
  await ensureStlSchema(env);
  const settings = await getSettings(env);
  const now = Date.now();
  const due = ((await env.DB.prepare(
    `SELECT t.*, l.population, l.trade, l.timezone, l.is_demo, l.status AS lead_status
       FROM stl_touchpoints t JOIN stl_leads l ON l.id=t.lead_id
      WHERE t.status='pending' AND t.scheduled_for<=?
      ORDER BY t.scheduled_for ASC LIMIT ?`
  ).bind(now, limit).all()).results) || [];

  const summary = { processed: 0, sent: 0, blocked: 0, skipped: 0, deferred: 0, failed: 0, simulated: 0 };
  for (const t of due) {
    summary.processed++;
    // Lead no longer active → cancel.
    if (["revoked", "lost", "won"].includes(t.lead_status)) {
      await setStatus(env, t.id, "canceled", { notes: `lead ${t.lead_status}` }); summary.skipped++; continue;
    }
    // B4 skip if B1 warm-transfer succeeded.
    const stepDef = stepMeta(t.sequence_step);
    if (stepDef && stepDef.skipIfTransferred && (await b1Transferred(env, t.lead_id))) {
      await setStatus(env, t.id, "skipped", { notes: "B1 transfer accepted" }); summary.skipped++; continue;
    }
    // Window enforcement at dispatch time — never dial outside §5; defer instead.
    // Demo leads bypass windows so the shareable end-to-end flow never stalls.
    if (stepDef && stepDef.windowed && !t.is_demo && !inWindow(now, t.trade, t.timezone)) {
      const next = nextWindowOpen(now, t.trade, t.timezone);
      await env.DB.prepare("UPDATE stl_touchpoints SET scheduled_for=? WHERE id=?").bind(next, t.id).run();
      summary.deferred++; continue;
    }

    // SMS de-dupe: never send two texts to the same lead inside 90s, no matter the
    // source (a scheduled B2 + a missed-call text-back can otherwise collide when a
    // backlog drains or the Retell webhook races the tick). Defer, don't drop — the
    // later text still goes out once the window clears (unless it's since canceled).
    if (t.channel === "sms" && (await recentlySentSms(env, t.lead_id, 90 * 1000))) {
      await env.DB.prepare("UPDATE stl_touchpoints SET scheduled_for=? WHERE id=?").bind(now + 90 * 1000, t.id).run();
      summary.deferred++; continue;
    }

    // THE GATE — every outbound touch, no bypass.
    const g = await gate(env, t.lead_id, t.channel, `runner:${t.sequence_step}`);
    if (!g.ok) {
      await setStatus(env, t.id, "blocked", { consent_check: "blocked", block_reason: g.reason });
      await alert(env, `GATE VIOLATION blocked ${t.channel} to lead ${t.lead_id}: ${g.reason}`);
      summary.blocked++; continue;
    }

    // Build ctx + render + dispatch.
    const lead = await env.DB.prepare("SELECT * FROM stl_leads WHERE id=?").bind(t.lead_id).first();
    const rep = (t.channel === "call_human" || t.channel === "call_ai") ? await pickRep(env) : null;
    const meeting = await latestMeeting(env, t.lead_id);
    const revokeToken = await currentRevokeToken(env, t.lead_id);
    const ctx = {
      lead, rep, meeting, step: t.sequence_step, touchpointId: t.id,
      fromName: await fromName(env), repPhone: rep ? rep.phone : (env.STL_REP_PHONE || ""),
      bookingLink: env.STL_BOOKING_LINK || "https://consentresolve.com/book",
      revokeUrl: revokeToken ? `${env.STL_PUBLIC_ORIGIN || "https://consentresolve.com"}/consent/revoke?t=${revokeToken}` : "",
    };
    const rendered = renderTemplate(t.template_id, ctx);
    const res = await dispatch(env, settings, t.channel, ctx, rendered);

    // Record call rows for voice channels.
    if (t.channel === "call_ai" || t.channel === "call_human") {
      await env.DB.prepare(
        `INSERT OR REPLACE INTO stl_calls (touchpoint_id, lead_id, provider, provider_call_id, answered, voicemail_left, textback_ask, transfer_rep_id)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(t.id, t.lead_id, t.channel === "call_ai" ? "retell" : "twilio", res.providerRef || null,
        0, 0, rendered.textback_ask ? 0 : null, rep ? rep.id : null).run();
    }

    const status = res.outcome === "failed" || res.outcome === "sms_failed" ? "failed"
      : res.act === "paused" ? "pending" : "sent";
    await setStatus(env, t.id, status, {
      attempted_at: now, completed_at: res.act === "paused" ? null : now,
      outcome: res.outcome, consent_check: "pass", provider_ref: res.providerRef || null,
      dispatch_mode: res.act, actor_id: rep ? rep.id : (t.channel === "call_ai" ? "ruby" : "system"),
      notes: res.detail || null,
    });
    // Mirror the touch into the CRM timeline (system of record) unless paused.
    // Never let a CRM-mirror hiccup break the dispatch loop.
    if (res.act !== "paused") { try { await mirrorTouchpoint(env, lead, t, res); } catch (_) {} }

    if (res.act === "paused") { summary.skipped++; }
    else if (status === "failed") {
      summary.failed++;
      await logEvent(env, t.lead_id, "send_failed", { channel: t.channel, step: t.sequence_step, detail: res.detail || null });
      await alert(env, `Live ${t.channel} FAILED for lead ${t.lead_id} (${t.sequence_step}): ${res.detail || "unknown"}`);
    } else { summary.sent++; if (res.act === "simulate") summary.simulated++; }
  }
  return summary;
}

function stepMeta(step) {
  const all = [...sequenceFor("A"), ...sequenceFor("B")];
  return all.find((s) => s.step === step) || null;
}

async function currentRevokeToken(env, leadId) {
  const r = await env.DB.prepare(
    "SELECT revoke_token FROM stl_consent_events WHERE lead_id=? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1"
  ).bind(leadId).first().catch(() => null);
  return r ? r.revoke_token : null;
}

async function setStatus(env, tpId, status, fields = {}) {
  const cols = ["status=?"], vals = [status];
  for (const [k, v] of Object.entries(fields)) { cols.push(`${k}=?`); vals.push(v); }
  vals.push(tpId);
  await env.DB.prepare(`UPDATE stl_touchpoints SET ${cols.join(", ")} WHERE id=?`).bind(...vals).run();
}

// Testing safety valve: if a lead's phone matches a rep's, that rep is almost certainly
// the person running the test — park them OFFLINE for 30 min so Ruby's transfer doesn't
// dial the same phone that's already on the call. Auto-returns after 30 min.
export async function parkRepMatchingPhone(env, phone) {
  try {
    const p = toE164(phone) || phone;
    if (!p) return null;
    const rep = await env.DB.prepare("SELECT id, name FROM stl_reps WHERE phone=?").bind(p).first().catch(() => null);
    if (!rep) return null;
    const now = Date.now();
    await env.DB.prepare("DELETE FROM stl_rep_availability WHERE rep_id=?").bind(rep.id).run().catch(() => {});
    // Available again 30 min from now → effectively away for the next 30 minutes.
    await env.DB.prepare("INSERT INTO stl_rep_availability (id, rep_id, starts_at, ends_at, state) VALUES (?,?,?,?, 'available')")
      .bind(uid(), rep.id, now + 30 * 60 * 1000, now + 365 * 86400000).run().catch(() => {});
    await logEvent(env, null, "rep_parked_for_test", { rep: rep.name, phone: p });
    return { parked: rep.name };
  } catch (_) { return null; }
}

// Missed-dial text-back: when a call goes unanswered, text the lead from our number.
// Idempotent-ish — skips if a text-back was already queued for this lead in the last 30
// min so B1 + a later human dial don't both fire one. Consent-gated at dispatch.
export async function maybeTextbackOnNoAnswer(env, leadId, afterTag) {
  await ensureStlSchema(env);
  const cutoff = Date.now() - 30 * 60 * 1000;
  const recent = await env.DB.prepare(
    "SELECT 1 x FROM stl_touchpoints WHERE lead_id=? AND sequence_step IN ('B1_textback','DIAL_textback') AND scheduled_for>=? LIMIT 1"
  ).bind(leadId, cutoff).first().catch(() => null);
  if (recent) return false;
  await env.DB.prepare(
    `INSERT INTO stl_touchpoints (id, lead_id, sequence_step, channel, actor_type, scheduled_for, template_id, status)
     VALUES (?,?,?,?,?,?,?, 'pending')`
  ).bind(uid(), leadId, "DIAL_textback", "sms", "system", Date.now() + 15000, "B2_sms", "pending").run().catch(() => {});
  await logEvent(env, leadId, "dial_textback", { after: afterTag || null });
  return true;
}

// A→B graduation on a new consent event (spec §7). Re-enter at B2, never re-run B1.
export async function graduate(env, leadId, consentPayload) {
  await ensureStlSchema(env);
  const lead = await env.DB.prepare("SELECT * FROM stl_leads WHERE id=?").bind(leadId).first();
  if (!lead) return { ok: false, error: "no_lead" };
  await addConsentEvent(env, leadId, { ...consentPayload, kind: consentPayload.kind || "form_submit" });
  // Cancel remaining pending Sequence-A touchpoints.
  await env.DB.prepare("UPDATE stl_touchpoints SET status='canceled', notes='graduated to B' WHERE lead_id=? AND status='pending'").bind(leadId).run();
  await env.DB.prepare("UPDATE stl_leads SET population='B', updated_at=? WHERE id=?").bind(Date.now(), leadId).run();
  const bLead = { ...lead, population: "B", created_at: Date.now() };
  await scheduleLead(env, bLead, SEQUENCE_B_ON_GRADUATION);
  await logEvent(env, leadId, "graduated_A_to_B", {});
  return { ok: true };
}

// Revocation — stop everything, honor within seconds (spec §4, §8.5).
export async function revoke(env, { token, leadId, via }) {
  await ensureStlSchema(env);
  let lid = leadId;
  if (!lid && token) {
    const r = await env.DB.prepare("SELECT lead_id FROM stl_consent_events WHERE revoke_token=? LIMIT 1").bind(token).first().catch(() => null);
    lid = r ? r.lead_id : null;
  }
  if (!lid) return { ok: false, error: "not_found" };
  const now = Date.now();
  await env.DB.prepare("UPDATE stl_consent_events SET revoked_at=?, revoked_via=? WHERE lead_id=? AND revoked_at IS NULL")
    .bind(now, via || "link", lid).run();
  await env.DB.prepare("UPDATE stl_touchpoints SET status='canceled', notes='revoked' WHERE lead_id=? AND status='pending'").bind(lid).run();
  await env.DB.prepare("UPDATE stl_leads SET status='revoked', updated_at=? WHERE id=?").bind(now, lid).run();
  await logEvent(env, lid, "revoked", { via });
  return { ok: true, leadId: lid };
}
