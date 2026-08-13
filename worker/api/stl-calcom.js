// Speed-to-Lead — Cal.com booking → STL engine. build step 8.
// Primary path: the site's existing /api/cal/webhook (cal-webhook.js) calls
// recordStlMeeting() so one Cal.com webhook serves both the CRM and the STL engine —
// no separate Cal.com webhook config needed. A standalone /api/stl/calcom/webhook is
// also exposed for direct use.
import { ensureStlSchema } from "../_lib/stl/schema.js";
import { logEvent } from "../_lib/stl/classifier.js";
import { verifyHmac } from "../_lib/stl/verify.js";
import { json } from "../_lib/http.js";

async function leadByEmailOrPhone(env, email, phone) {
  if (email) {
    const r = await env.DB.prepare("SELECT * FROM stl_leads WHERE lower(email)=lower(?) ORDER BY created_at DESC LIMIT 1").bind(email).first().catch(() => null);
    if (r) return r;
  }
  if (phone) return await env.DB.prepare("SELECT * FROM stl_leads WHERE phone=? ORDER BY created_at DESC LIMIT 1").bind(phone).first().catch(() => null);
  return null;
}

// Reusable: attach a Cal.com booking to the matching STL lead + schedule the B5 reminder.
// { trigger, email, phone, name, calUid, startTime }  (trigger: BOOKING_CREATED|_CANCELLED|_RESCHEDULED)
export async function recordStlMeeting(env, b) {
  try {
    await ensureStlSchema(env);
    const trigger = String(b.trigger || "").toUpperCase();
    const startTs = b.startTime ? Date.parse(b.startTime) : null;
    const bookingId = String(b.calUid || "");
    const lead = await leadByEmailOrPhone(env, (b.email || "").trim(), (b.phone || "").trim());
    if (!lead) return { ok: true, note: "no matching STL lead" };

    if (trigger === "BOOKING_CANCELLED") {
      if (bookingId) await env.DB.prepare("UPDATE stl_meetings SET outcome='cancelled' WHERE calcom_booking_id=?").bind(bookingId).run().catch(() => {});
      await env.DB.prepare("UPDATE stl_touchpoints SET status='canceled', notes='meeting cancelled' WHERE lead_id=? AND sequence_step='B5_sms' AND status='pending'").bind(lead.id).run().catch(() => {});
      await logEvent(env, lead.id, "meeting_cancelled", { booking_id: bookingId });
      return { ok: true, cancelled: true };
    }

    if (!startTs) return { ok: true, note: "no start time" };
    // Upsert the meeting for this booking id (reschedule updates the same row).
    const ex = bookingId ? await env.DB.prepare("SELECT id FROM stl_meetings WHERE calcom_booking_id=? LIMIT 1").bind(bookingId).first().catch(() => null) : null;
    if (ex) {
      await env.DB.prepare("UPDATE stl_meetings SET scheduled_for=?, outcome=NULL WHERE id=?").bind(startTs, ex.id).run().catch(() => {});
    } else {
      await env.DB.prepare(
        `INSERT INTO stl_meetings (id, lead_id, calcom_booking_id, created_at, scheduled_for, set_by_actor_type, set_by_actor_id)
         VALUES (?,?,?,?,?,?,?)`
      ).bind(crypto.randomUUID(), lead.id, bookingId, Date.now(), startTs, "self", null).run().catch(() => {});
    }
    await env.DB.prepare("UPDATE stl_leads SET status='booked', updated_at=? WHERE id=?").bind(Date.now(), lead.id).run().catch(() => {});

    // Schedule / reschedule the B5 reminder at T-1h (replace any existing pending one).
    await env.DB.prepare("UPDATE stl_touchpoints SET status='canceled' WHERE lead_id=? AND sequence_step='B5_sms' AND status='pending'").bind(lead.id).run().catch(() => {});
    const remindAt = startTs - 3600 * 1000;
    if (remindAt > Date.now()) {
      await env.DB.prepare(
        `INSERT INTO stl_touchpoints (id, lead_id, sequence_step, channel, actor_type, scheduled_for, template_id, status)
         VALUES (?,?,?,?,?,?,?, 'pending')`
      ).bind(crypto.randomUUID(), lead.id, "B5_sms", "sms", "system", remindAt, "B5_sms").run().catch(() => {});
    }
    await logEvent(env, lead.id, "meeting_booked", { scheduled_for: startTs, booking_id: bookingId });
    return { ok: true, lead_id: lead.id, scheduled_for: startTs };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}

// Standalone webhook (optional). The main path is the site's /api/cal/webhook.
export async function onRequestPost({ request, env }) {
  const raw = await request.text().catch(() => "");
  if (!(await verifyHmac(env, raw, request.headers.get("x-cal-signature-256"), env.CAL_WEBHOOK_SECRET || env.CALCOM_WEBHOOK_SECRET))) {
    return json({ ok: false, error: "bad_signature" }, { status: 401 });
  }
  let ev = {};
  try { ev = raw ? JSON.parse(raw) : {}; } catch (_) { return json({ ok: false }, { status: 400 }); }
  const p = ev.payload || ev;
  const attendee = (p.attendees && p.attendees[0]) || {};
  return json(await recordStlMeeting(env, {
    trigger: ev.triggerEvent || ev.trigger,
    email: attendee.email || p.responses?.email?.value,
    phone: attendee.phoneNumber,
    name: attendee.name,
    calUid: p.uid || p.bookingId || ev.id,
    startTime: p.startTime || p.start,
  }));
}
