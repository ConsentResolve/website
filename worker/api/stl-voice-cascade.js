// Speed-to-Lead — sequential no-answer rep cascade (Twilio Programmable Voice).
//   POST /api/stl/twilio/voice-cascade[?step=N]
// Ruby cold-transfers a live lead to our "hunt" number (STL_TRANSFER_NUMBER); that
// number's Voice webhook points here. We <Dial> the highest-priority available rep with
// a timeout; on no-answer/busy/failed Twilio re-hits this with the next step and we ring
// the next backup. When someone answers, the lead + rep are bridged; if all fail, we
// apologize and hang up. build: real cascade (primary → backups).
import { ensureStlSchema } from "../_lib/stl/schema.js";
import { logEvent } from "../_lib/stl/classifier.js";
import { twilioVerify } from "../_lib/stl/twilio.js";

const xesc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const twiml = (inner) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`,
  { headers: { "Content-Type": "text/xml; charset=utf-8" } }
);
const RING_SECONDS = 18;

// A rep picked up the cascade → attribute it to the most recent in-flight B1 call
// (the transferred call carries no lead id, so we match by recency) and mark the
// transfer accepted. Feeds the transfer-accept-rate metric + B4 skip-if-transferred.
async function recordTransferAccepted(env, rep, backupLevel, p) {
  try {
    const since = Date.now() - 15 * 60 * 1000;
    const row = await env.DB.prepare(
      `SELECT c.touchpoint_id FROM stl_calls c JOIN stl_touchpoints t ON t.id = c.touchpoint_id
        WHERE t.sequence_step='B1_retell' AND t.attempted_at >= ? AND COALESCE(c.transfer_accepted,0)=0
        ORDER BY t.attempted_at DESC LIMIT 1`
    ).bind(since).first();
    if (row) {
      await env.DB.prepare("UPDATE stl_calls SET transfer_attempted=1, transfer_accepted=1, transfer_rep_id=? WHERE touchpoint_id=?")
        .bind(rep ? rep.id : null, row.touchpoint_id).run();
      await logEvent(env, null, "transfer_accepted", { rep: rep ? rep.name : null, rep_phone: rep ? rep.phone : null, backup_level: backupLevel, touchpoint_id: row.touchpoint_id, talk_seconds: parseInt(p.DialCallDuration || "0", 10) || null });
    } else {
      await logEvent(env, null, "transfer_accepted_unmatched", { rep: rep ? rep.name : null, backup_level: backupLevel });
    }
  } catch (_) {}
}

export async function onRequestPost({ request, env }) {
  await ensureStlSchema(env);
  const url = new URL(request.url);
  const step = Math.max(0, parseInt(url.searchParams.get("step") || "0", 10));
  const form = await request.formData().catch(() => null);
  const p = {}; if (form) for (const [k, v] of form.entries()) p[k] = v;

  if (!(await twilioVerify(env, request, p))) return new Response("forbidden", { status: 403 });

  // Highest-priority available reps, in order (re-queried each step; ordering is stable).
  const now = Date.now();
  const reps = ((await env.DB.prepare(
    `SELECT rp.id, rp.phone, rp.name FROM stl_reps rp JOIN stl_rep_availability a ON a.rep_id = rp.id
      WHERE rp.active=1 AND a.state='available' AND a.starts_at<=? AND a.ends_at>=? AND rp.phone IS NOT NULL AND rp.phone<>''
      ORDER BY COALESCE(rp.priority,100) ASC, rp.id`
  ).bind(now, now).all()).results) || [];

  // A rep answered → record the transfer outcome against the most recent B1 call, then end.
  const status = p.DialCallStatus;
  if (status === "completed" || status === "answered") {
    await recordTransferAccepted(env, reps[Math.max(0, step - 1)] || null, Math.max(0, step - 1), p);
    return twiml("<Hangup/>");
  }
  if (step > 0) {
    await logEvent(env, null, "cascade_no_answer", { step: step - 1, status: status || "n/a" });
  }

  if (step >= reps.length) {
    // Everyone tried, nobody answered.
    await logEvent(env, null, "cascade_exhausted", { tried: reps.length });
    return twiml(`<Say voice="alice">Sorry, everyone's tied up at the moment. We'll call you right back. Goodbye.</Say><Hangup/>`);
  }

  const rep = reps[step];
  const origin = env.STL_PUBLIC_ORIGIN || url.origin;
  const action = `${origin}/api/stl/twilio/voice-cascade?step=${step + 1}`;
  const callerId = env.STL_TRANSFER_NUMBER || "";
  // Ring this rep; if they don't pick up, Twilio calls `action` and we advance to the next.
  return twiml(
    `<Dial timeout="${RING_SECONDS}" action="${xesc(action)}" method="POST"${callerId ? ` callerId="${xesc(callerId)}"` : ""}>` +
    `<Number>${xesc(rep.phone)}</Number></Dial>`
  );
}

// Twilio may GET the Voice URL on the very first hit depending on config.
export async function onRequestGet(ctx) { return onRequestPost(ctx); }
