// Speed-to-Lead — Retell (AI voice) webhook. build step 7 + step 10 (disclosure).
//   POST /api/stl/retell/webhook
// Updates the call record from call_started / call_ended / call_analyzed events and
// verifies Ruby's AI-disclosure phrase in the transcript (spec §8.4 — 100%, hard fail).
import { ensureStlSchema } from "../_lib/stl/schema.js";
import { logEvent } from "../_lib/stl/classifier.js";
import { alert } from "../_lib/stl/adapters.js";
import { verifyHmac } from "../_lib/stl/verify.js";
import { mirrorInboundCall, mirrorInboundSmsRetell, openLiveChat } from "../_lib/stl/crm-bridge.js";
import { revoke } from "../_lib/stl/runner.js";
import { json } from "../_lib/http.js";

// The agent must identify as an AI AND by name. Any transcript missing either is a P1.
// The name is read from env (STL_AGENT_NAME, default "Mack") so renaming the agent never
// silently fails the disclosure check.
const DISCLOSURE_RE = /\b(a[n]?\s+)?(ai|artificial intelligence)\b/i;
// STOP-equivalents — mirror of the set the Twilio inbound handler honors.
const STOP_RE = /\b(stop|stopall|unsubscribe|cancel|end|quit|remove me|opt ?out|don'?t (text|call|contact)( me)?)\b/i;
const agentNameRe = (env) => {
  const n = String((env && env.STL_AGENT_NAME) || "Mack").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${n}\\b`, "i");
};

export async function onRequestPost({ request, env }) {
  await ensureStlSchema(env);
  const raw = await request.text().catch(() => "");
  if (!(await verifyHmac(env, raw, request.headers.get("x-retell-signature"), env.RETELL_API_KEY))) {
    return json({ ok: false, error: "bad_signature" }, { status: 401 });
  }
  let ev = {};
  try { ev = raw ? JSON.parse(raw) : {}; } catch (_) { return json({ ok: false }, { status: 400 }); }

  // Retell's chat/SMS agent posts chat_* events to this same webhook. Mirror inbound SMS
  // into the CRM (separate payload shape from calls — a `chat` object, not `call`).
  if (ev.chat || /chat|sms/i.test(String(ev.event || ev.event_type || ""))) {
    // chat_started → open the conversation immediately (live), so the team can watch it.
    if (/chat_started|chat_ongoing/i.test(String(ev.event || ev.event_type || ""))) {
      const r = await openLiveChat(env, ev).catch((e) => ({ ok: false, error: String(e).slice(0, 140) }));
      return json({ ok: true, chat_started: true, ...r });
    }
    const r = await mirrorInboundSmsRetell(env, ev).catch((e) => ({ ok: false, error: String(e).slice(0, 140) }));
    // Honor STOP-equivalents even though the text was handled by Retell, so our engine
    // also marks the lead opted-out (Twilio's Messaging Service opt-out blocks sends too).
    if (r && r.text && STOP_RE.test(String(r.text))) {
      const lead = await env.DB.prepare("SELECT id FROM stl_leads WHERE phone=? ORDER BY created_at DESC LIMIT 1").bind(String(r.from || "")).first().catch(() => null);
      if (lead) await revoke(env, { leadId: lead.id, via: "sms_stop" }).catch(() => {});
    }
    return json({ ok: true, sms: true, ...r });
  }

  const call = ev.call || ev.data || ev;
  const meta = call.metadata || {};
  const tpId = meta.touchpoint_id;
  const eventName = ev.event || ev.event_type || call.call_status;
  // No touchpoint_id → not an engine-dispatched outbound call. If it's an INBOUND call
  // (someone dialing our number, answered by Mack), mirror it into the CRM Inbox so the
  // team sees it alongside every other channel. Only on a final event (has transcript).
  if (!tpId) {
    // No engine touchpoint → outbound engine calls always carry a touchpoint_id, so any
    // final call event that reaches here with a caller number is an inbound call. Don't
    // depend on an exact direction string (Retell's field varies) — just exclude outbound.
    const finalEv = ["call_ended", "ended", "call_analyzed"].includes(eventName);
    const looksInbound = call.direction !== "outbound" && (call.from_number || call.from);
    if (finalEv && looksInbound) {
      const r = await mirrorInboundCall(env, call, eventName).catch((e) => ({ ok: false, error: String(e).slice(0, 140) }));
      return json({ ok: true, inbound: true, ...r });
    }
    return json({ ok: true, note: "no touchpoint_id", event: eventName || null, dir: call.direction || null });
  }

  const transcript = call.transcript || (Array.isArray(call.transcript_object)
    ? call.transcript_object.map((t) => `${t.role}: ${t.content}`).join("\n") : "") || "";
  const answered = ["ended", "call_ended", "call_analyzed", "ongoing"].includes(eventName) && call.disconnection_reason !== "dial_no_answer" ? 1 : 0;
  const durationS = call.duration_ms ? Math.round(call.duration_ms / 1000) : (call.call_length_seconds || null);
  const disclosureOk = transcript ? (DISCLOSURE_RE.test(transcript) && agentNameRe(env).test(transcript) ? 1 : 0) : null;

  await env.DB.prepare(
    `UPDATE stl_calls SET provider_call_id=COALESCE(?, provider_call_id), answered=?, disclosure_ok=COALESCE(?, disclosure_ok) WHERE touchpoint_id=?`
  ).bind(call.call_id || null, answered, disclosureOk, tpId).run().catch(() => {});

  if (transcript) {
    await env.DB.prepare("UPDATE stl_touchpoints SET transcript=?, duration_seconds=COALESCE(?, duration_seconds), outcome=? WHERE id=?")
      .bind(transcript.slice(0, 8000), durationS, answered ? "connected_dm" : "no_answer", tpId).run().catch(() => {});
  }

  if (disclosureOk === 0) {
    await alert(env, `P1: Retell call ${call.call_id || tpId} missing AI-disclosure phrase in transcript.`);
    await logEvent(env, meta.lead_id || null, "disclosure_fail", { touchpoint_id: tpId, call_id: call.call_id });
  }

  // Did Ruby invoke the transfer tool? Mark transfer_attempted (the cascade marks
  // transfer_accepted when a rep answers). Together these drive the transfer-accept rate.
  const transferred = /transfer/i.test(call.disconnection_reason || "") || !!call.transfer_destination_number
    || /transfer_to_rep|transfer_call/i.test(transcript);
  if (transferred) {
    await env.DB.prepare("UPDATE stl_calls SET transfer_attempted=1 WHERE touchpoint_id=?").bind(tpId).run().catch(() => {});
    await logEvent(env, meta.lead_id || null, "transfer_attempted", { touchpoint_id: tpId, call_id: call.call_id });
  }

  // Missed-call text-back: if Ruby's call wasn't answered, text the lead right away from
  // the same number they saw ring (SMS is on this number). Runs once, only on the final
  // call event, and replaces the later B2 confirmation so we don't double-text. The
  // consent gate still applies at dispatch (Population B has SMS consent).
  const ended = ["call_ended", "ended", "call_analyzed"].includes(eventName);
  if (ended && answered === 0 && meta.lead_id) {
    const exists = await env.DB.prepare("SELECT 1 x FROM stl_touchpoints WHERE lead_id=? AND sequence_step='B1_textback' LIMIT 1").bind(meta.lead_id).first().catch(() => null);
    if (!exists) {
      await env.DB.prepare("UPDATE stl_touchpoints SET status='canceled', notes='replaced by missed-call text-back' WHERE lead_id=? AND sequence_step='B2_sms' AND status='pending'").bind(meta.lead_id).run().catch(() => {});
      await env.DB.prepare(
        `INSERT INTO stl_touchpoints (id, lead_id, sequence_step, channel, actor_type, scheduled_for, template_id, status)
         VALUES (?,?,?,?,?,?,?, 'pending')`
      ).bind(crypto.randomUUID(), meta.lead_id, "B1_textback", "sms", "system", Date.now() + 15000, "B2_sms", "pending").run().catch(() => {});
      await logEvent(env, meta.lead_id, "missed_call_textback", { touchpoint_id: tpId });
    }
  }
  return json({ ok: true });
}
