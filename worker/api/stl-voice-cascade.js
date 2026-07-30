// Speed-to-Lead — no-answer rep cascade + voicemail fallback (Twilio Programmable Voice).
//   POST /api/stl/twilio/voice-cascade[?step=N]     — sequential rep hunt (primary→backups)
//   POST /api/stl/twilio/voicemail                  — recording complete (Record action)
//   POST /api/stl/twilio/voicemail-transcription    — async transcription callback
// Ruby cold-transfers a live lead to our hunt number (STL_TRANSFER_NUMBER), whose Voice
// webhook points at the cascade. We <Dial> the highest-priority available rep with a
// timeout; on no-answer we advance to the next backup. If everyone misses it, we alert
// the team, schedule an immediate human callback, and let the lead leave a voicemail.
import { ensureStlSchema } from "../_lib/stl/schema.js";
import { logEvent } from "../_lib/stl/classifier.js";
import { twilioVerify } from "../_lib/stl/twilio.js";
import { alert } from "../_lib/stl/adapters.js";

const xesc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const twiml = (inner) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`,
  { headers: { "Content-Type": "text/xml; charset=utf-8" } }
);
const RING_SECONDS = 18;

// The transferred call carries no lead id, so we attribute cascade events to the most
// recent in-flight B1 call by recency (reliable at speed-to-lead volume).
async function recentB1(env, needTransfer) {
  const since = Date.now() - 15 * 60 * 1000;
  const where = needTransfer ? "AND COALESCE(c.transfer_accepted,0)=0" : "";
  return await env.DB.prepare(
    `SELECT c.touchpoint_id, t.lead_id FROM stl_calls c JOIN stl_touchpoints t ON t.id = c.touchpoint_id
      WHERE t.sequence_step='B1_retell' AND t.attempted_at >= ? ${where}
      ORDER BY t.attempted_at DESC LIMIT 1`
  ).bind(since).first().catch(() => null);
}

async function recordTransferAccepted(env, rep, backupLevel, p) {
  try {
    const row = await recentB1(env, true);
    if (row) {
      await env.DB.prepare("UPDATE stl_calls SET transfer_attempted=1, transfer_accepted=1, transfer_rep_id=? WHERE touchpoint_id=?")
        .bind(rep ? rep.id : null, row.touchpoint_id).run();
      await logEvent(env, row.lead_id, "transfer_accepted", { rep: rep ? rep.name : null, rep_phone: rep ? rep.phone : null, backup_level: backupLevel, touchpoint_id: row.touchpoint_id, talk_seconds: parseInt(p.DialCallDuration || "0", 10) || null });
    } else {
      await logEvent(env, null, "transfer_accepted_unmatched", { rep: rep ? rep.name : null, backup_level: backupLevel });
    }
  } catch (_) {}
}

// Nobody answered: alert the team + schedule an immediate human callback for the lead.
async function onExhausted(env, tried) {
  try {
    const row = await recentB1(env, false);
    let phone = null, name = null;
    if (row && row.lead_id) {
      const lead = await env.DB.prepare("SELECT first_name, company, phone FROM stl_leads WHERE id=?").bind(row.lead_id).first().catch(() => null);
      if (lead) { phone = lead.phone; name = [lead.first_name, lead.company].filter(Boolean).join(" · "); }
      await env.DB.prepare("UPDATE stl_calls SET voicemail_left=voicemail_left WHERE touchpoint_id=?").bind(row.touchpoint_id).run().catch(() => {});
      // Immediate human callback ~2 min out (call_human is consent-gated at dispatch).
      await env.DB.prepare(
        `INSERT INTO stl_touchpoints (id, lead_id, sequence_step, channel, actor_type, scheduled_for, template_id, status)
         VALUES (?,?,?,?,?,?,?, 'pending')`
      ).bind(crypto.randomUUID(), row.lead_id, "B_missed_callback", "call_human", "human", Date.now() + 120000, "B4_dial").run().catch(() => {});
    }
    await logEvent(env, row ? row.lead_id : null, "cascade_exhausted", { tried, callback_scheduled: !!(row && row.lead_id) });
    await alert(env, `🔴 Missed transfer — nobody answered${name ? " for " + name : ""}${phone ? " (" + phone + ")" : ""}. Callback scheduled; lead may leave a voicemail.`);
  } catch (_) {}
}

async function handleCascade(env, url, p) {
  const step = Math.max(0, parseInt(url.searchParams.get("step") || "0", 10));
  const now = Date.now();
  const reps = ((await env.DB.prepare(
    `SELECT rp.id, rp.phone, rp.name FROM stl_reps rp JOIN stl_rep_availability a ON a.rep_id = rp.id
      WHERE rp.active=1 AND a.state='available' AND a.starts_at<=? AND a.ends_at>=? AND rp.phone IS NOT NULL AND rp.phone<>''
      ORDER BY COALESCE(rp.priority,100) ASC, rp.id`
  ).bind(now, now).all()).results) || [];

  const status = p.DialCallStatus;
  if (status === "completed" || status === "answered") {
    await recordTransferAccepted(env, reps[Math.max(0, step - 1)] || null, Math.max(0, step - 1), p);
    return twiml("<Hangup/>");
  }
  if (step > 0) await logEvent(env, null, "cascade_no_answer", { step: step - 1, status: status || "n/a" });

  if (step >= reps.length) {
    await onExhausted(env, reps.length);
    const origin = env.STL_PUBLIC_ORIGIN || url.origin;
    // Offer a voicemail; recording completion hits /voicemail, transcription posts later.
    return twiml(
      `<Say voice="alice">Sorry, everyone's on another call right now. Please leave a brief message after the tone and we'll call you right back.</Say>` +
      `<Record maxLength="120" playBeep="true" timeout="4" transcribe="true" transcribeCallback="${xesc(origin)}/api/stl/twilio/voicemail-transcription" action="${xesc(origin)}/api/stl/twilio/voicemail" method="POST"/>` +
      `<Say voice="alice">We didn't catch a message, but we'll call you right back. Goodbye.</Say><Hangup/>`
    );
  }

  const rep = reps[step];
  const origin = env.STL_PUBLIC_ORIGIN || url.origin;
  const action = `${origin}/api/stl/twilio/voice-cascade?step=${step + 1}`;
  // Present the main engine number (…9846) to reps, not the internal hunt number.
  const callerId = env.STL_CALLER_ID || env.TWILIO_FROM_NUMBER || env.STL_TRANSFER_NUMBER || "";
  return twiml(
    `<Dial timeout="${RING_SECONDS}" action="${xesc(action)}" method="POST"${callerId ? ` callerId="${xesc(callerId)}"` : ""}>` +
    `<Number>${xesc(rep.phone)}</Number></Dial>`
  );
}

async function handleVoicemail(env, p) {
  const recUrl = p.RecordingUrl || "";
  const dur = parseInt(p.RecordingDuration || "0", 10) || null;
  const row = await recentB1(env, false);
  if (row) {
    await env.DB.prepare("UPDATE stl_calls SET voicemail_left=1 WHERE touchpoint_id=?").bind(row.touchpoint_id).run().catch(() => {});
    await env.DB.prepare("UPDATE stl_touchpoints SET recording_url=COALESCE(?, recording_url), notes=COALESCE(notes,'')||' [voicemail ' || ? || 's]' WHERE id=?")
      .bind(recUrl || null, dur || 0, row.touchpoint_id).run().catch(() => {});
  }
  await logEvent(env, row ? row.lead_id : null, "voicemail_left", { recording_url: recUrl, seconds: dur, touchpoint_id: row ? row.touchpoint_id : null });
  await alert(env, `📩 New voicemail from a missed-transfer lead${dur ? " (" + dur + "s)" : ""}: ${recUrl || "(recording pending)"}`);
  return twiml(`<Say voice="alice">Thanks — we got your message and we'll be in touch shortly. Goodbye.</Say><Hangup/>`);
}

async function handleTranscription(env, p) {
  const text = p.TranscriptionText || "";
  const st = p.TranscriptionStatus || "";
  const row = await recentB1(env, false);
  if (text) {
    if (row) await env.DB.prepare("UPDATE stl_touchpoints SET transcript=COALESCE(?, transcript) WHERE id=?").bind(text.slice(0, 4000), row.touchpoint_id).run().catch(() => {});
    await logEvent(env, row ? row.lead_id : null, "voicemail_transcription", { status: st, text: text.slice(0, 1500) });
    await alert(env, `📝 Voicemail transcript: “${text.slice(0, 400)}”`);
  }
  return twiml("");
}

export async function onRequestPost({ request, env }) {
  await ensureStlSchema(env);
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const p = {}; if (form) for (const [k, v] of form.entries()) p[k] = v;
  if (!(await twilioVerify(env, request, p))) return new Response("forbidden", { status: 403 });

  if (url.pathname.endsWith("/voicemail-transcription")) return handleTranscription(env, p);
  if (url.pathname.endsWith("/voicemail")) return handleVoicemail(env, p);
  return handleCascade(env, url, p);
}

export async function onRequestGet(ctx) { return onRequestPost(ctx); }
