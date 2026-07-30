// Speed-to-Lead — Twilio webhooks. build step 6.
//   POST /api/stl/twilio/inbound  → inbound SMS: STOP-equivalent = revoke; else log 2-way reply
//   POST /api/stl/twilio/status   → delivery status callbacks
// Honors revocation in any reasonable form (spec §4): stop, quit, unsubscribe,
// remove me, "don't text me," etc.
import { revoke } from "../_lib/stl/runner.js";
import { logEvent } from "../_lib/stl/classifier.js";
import { ensureStlSchema } from "../_lib/stl/schema.js";
import { twilioVerify } from "../_lib/stl/twilio.js";

const STOP_RE = /\b(stop|stopall|unsubscribe|cancel|end|quit|remove me|opt ?out|don'?t (text|call|contact)( me)?)\b/i;
const twiml = (msg) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg}</Message>` : ""}</Response>`,
  { headers: { "Content-Type": "text/xml; charset=utf-8" } }
);

async function leadByPhone(env, phone) {
  if (!phone) return null;
  return await env.DB.prepare("SELECT * FROM stl_leads WHERE phone=? ORDER BY created_at DESC LIMIT 1").bind(phone).first().catch(() => null);
}

export async function onRequestPost({ request, env }) {
  await ensureStlSchema(env);
  const path = new URL(request.url).pathname;
  const form = await request.formData().catch(() => null);
  const p = {};
  if (form) for (const [k, v] of form.entries()) p[k] = v;

  // Verify the request really came from Twilio (opt-in via STL_VERIFY_WEBHOOKS=1).
  if (!(await twilioVerify(env, request, p))) return new Response("forbidden", { status: 403 });

  if (path.endsWith("/status")) {
    // Delivery status callback — attach outcome to the touchpoint by provider_ref.
    const sid = p.MessageSid || p.SmsSid, status = p.MessageStatus || p.SmsStatus;
    if (sid) {
      const map = { delivered: "sms_delivered", failed: "sms_failed", undelivered: "sms_failed" };
      await env.DB.prepare("UPDATE stl_touchpoints SET outcome=COALESCE(?, outcome) WHERE provider_ref=?")
        .bind(map[status] || null, sid).run().catch(() => {});
    }
    return twiml("");
  }

  // Inbound message.
  const from = p.From, bodyTxt = (p.Body || "").trim();
  const lead = await leadByPhone(env, from);
  if (STOP_RE.test(bodyTxt)) {
    if (lead) { await revoke(env, { leadId: lead.id, via: "sms_stop" }); }
    return twiml("You're opted out. You won't get further messages from us.");
  }
  if (lead) {
    await logEvent(env, lead.id, "inbound_sms", { from, body: bodyTxt.slice(0, 300) });
    await env.DB.prepare(
      `INSERT INTO stl_touchpoints (id, lead_id, sequence_step, channel, actor_type, scheduled_for, attempted_at, completed_at, outcome, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(crypto.randomUUID(), lead.id, "inbound", "sms", "system", Date.now(), Date.now(), Date.now(), "sms_replied", "sent", bodyTxt.slice(0, 400)).run().catch(() => {});
  }
  return twiml(""); // a human reads these; no auto-reply
}
