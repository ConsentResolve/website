// Speed-to-Lead — Cal.com webhook. build step 8.
//   POST /api/stl/calcom/webhook
// booking.created → write a meeting record + schedule B5 (T-1h SMS reminder).
// booking.cancelled → mark the meeting, cancel its B5.
import { ensureStlSchema } from "../_lib/stl/schema.js";
import { logEvent } from "../_lib/stl/classifier.js";
import { json } from "../_lib/http.js";

async function leadByEmailOrPhone(env, email, phone) {
  if (email) {
    const r = await env.DB.prepare("SELECT * FROM stl_leads WHERE lower(email)=lower(?) ORDER BY created_at DESC LIMIT 1").bind(email).first().catch(() => null);
    if (r) return r;
  }
  if (phone) return await env.DB.prepare("SELECT * FROM stl_leads WHERE phone=? ORDER BY created_at DESC LIMIT 1").bind(phone).first().catch(() => null);
  return null;
}

export async function onRequestPost({ request, env }) {
  await ensureStlSchema(env);
  let ev = {};
  try { ev = await request.json(); } catch (_) { return json({ ok: false }, { status: 400 }); }
  const trigger = ev.triggerEvent || ev.type;
  const payload = ev.payload || ev;
  const attendee = (payload.attendees && payload.attendees[0]) || {};
  const startTs = payload.startTime ? Date.parse(payload.startTime) : null;
  const bookingId = String(payload.uid || payload.bookingId || payload.id || "");

  const lead = await leadByEmailOrPhone(env, attendee.email || payload.responses?.email?.value, attendee.phoneNumber);

  if (trigger === "BOOKING_CANCELLED" || trigger === "booking.cancelled") {
    if (bookingId) {
      await env.DB.prepare("UPDATE stl_meetings SET outcome='cancelled' WHERE calcom_booking_id=?").bind(bookingId).run().catch(() => {});
      if (lead) await env.DB.prepare("UPDATE stl_touchpoints SET status='canceled', notes='meeting cancelled' WHERE lead_id=? AND sequence_step='B5_sms' AND status='pending'").bind(lead.id).run().catch(() => {});
    }
    return json({ ok: true });
  }

  // booking.created / rescheduled
  if (!lead || !startTs) return json({ ok: true, note: "no lead/time match" });
  const meetingId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO stl_meetings (id, lead_id, calcom_booking_id, created_at, scheduled_for, set_by_actor_type, set_by_actor_id)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(meetingId, lead.id, bookingId, Date.now(), startTs, "self", null).run().catch(() => {});
  await env.DB.prepare("UPDATE stl_leads SET status='booked', updated_at=? WHERE id=?").bind(Date.now(), lead.id).run().catch(() => {});

  // Schedule B5 reminder at T-1h (only if in the future).
  const remindAt = startTs - 3600 * 1000;
  if (remindAt > Date.now()) {
    await env.DB.prepare(
      `INSERT INTO stl_touchpoints (id, lead_id, sequence_step, channel, actor_type, scheduled_for, template_id, status)
       VALUES (?,?,?,?,?,?,?, 'pending')`
    ).bind(crypto.randomUUID(), lead.id, "B5_sms", "sms", "system", remindAt, "B5_sms").run().catch(() => {});
  }
  await logEvent(env, lead.id, "meeting_booked", { scheduled_for: startTs, booking_id: bookingId });
  return json({ ok: true });
}
