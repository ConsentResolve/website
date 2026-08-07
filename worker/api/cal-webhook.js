// POST /api/cal/webhook — Cal.com booking webhook → CRM.
// When a prospect books (BOOKING_CREATED), we attach the meeting to their contact,
// stamp lifecycle_stage = 'meeting_booked', drop a message into the inbox, and fire the
// "booked" workflow goal so they EXIT the email nurture (no more "come book" emails after
// they already booked). CANCELLED/RESCHEDULED are logged too.
//
// Security: Cal signs the raw body with HMAC-SHA256 (hex) in the `X-Cal-Signature-256`
// header, keyed by the secret you set on the webhook. Set the same secret as the worker
// secret CAL_WEBHOOK_SECRET. If the secret is configured, an invalid signature is rejected.
import { corsHeaders, json } from "../_lib/http.js";
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce, findOrCreateCompany, emailDomain } from "../_lib/crm-v2.js";
import { ensureRebuildSchema, logEvent } from "../_lib/crm-rebuild.js";
import { handleGoalEvent } from "../_lib/workflow-engine.js";
import { recordStlMeeting } from "./stl-calcom.js";
import { sendCapi } from "./meta-capi.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

// HMAC-SHA256(rawBody, secret) as lowercase hex, constant-time compared to the header.
async function verifyCalSignature(secret, rawBody, headerSig) {
  if (!secret) return { ok: true, skipped: true }; // no secret configured yet → don't block
  if (!headerSig) return { ok: false };
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const got = String(headerSig).trim().toLowerCase();
  if (hex.length !== got.length) return { ok: false };
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ got.charCodeAt(i);
  return { ok: diff === 0 };
}

export async function onRequestPost({ request, env, waitUntil }) {
  const cors = corsHeaders(request, env);
  const raw = await request.text();
  const sig = request.headers.get("X-Cal-Signature-256") || request.headers.get("x-cal-signature-256");
  const v = await verifyCalSignature(env.CAL_WEBHOOK_SECRET, raw, sig);
  if (!v.ok) return json({ error: "bad_signature" }, { status: 401 }, cors);

  let evt = {};
  try { evt = JSON.parse(raw); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }

  const trigger = String(evt.triggerEvent || evt.trigger || "").toUpperCase();
  const p = evt.payload || {};
  const attendee = Array.isArray(p.attendees) && p.attendees.length ? p.attendees[0] : {};
  const email = String(attendee.email || p.responses?.email?.value || "").trim().toLowerCase();
  const name = String(attendee.name || p.responses?.name?.value || "").trim();
  const uid = String(p.uid || p.bookingId || evt.id || "").trim();
  const startTime = p.startTime || p.start || null;
  const title = String(p.title || p.eventTitle || "Meeting").trim();
  const meetingType = String(p.type || p.eventType?.slug || "").trim();

  // We only act on real bookings with an attendee email.
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: true, ignored: "no_email" }, {}, cors);

  const work = (async () => {
    if (!env.DB) return;
    await ensureCrmV2Schema(env);
    await ensureRebuildSchema(env);
    const contactId = await findOrCreateContactByEmail(env, email, { name, source: "cal" });
    if (!contactId) return;

    const receivedIso = new Date().toISOString();                                   // when we got the booking (drives inbox sort + timer)
    const when = startTime ? new Date(startTime).toISOString() : receivedIso;        // the meeting time itself (display only)
    const isCreated = trigger === "BOOKING_CREATED";
    const isCancelled = trigger === "BOOKING_CANCELLED";
    const isRescheduled = trigger === "BOOKING_RESCHEDULED";

    const emoji = isCancelled ? "❌" : isRescheduled ? "🔁" : "📅";
    const verb = isCancelled ? "Meeting CANCELLED" : isRescheduled ? "Meeting RESCHEDULED" : "Meeting BOOKED";
    const lines = [
      `${verb} via Cal.com`,
      "Name: " + (name || "—"), "Email: " + email,
      startTime ? "When: " + when : "",
      title ? "Title: " + title : "", meetingType ? "Type: " + meetingType : "",
      uid ? "Cal UID: " + uid : "",
    ].filter(Boolean).join("\n");

    const convId = await upsertConversationByThread(env, {
      channel: "cal", externalThreadId: "cal:" + (uid || email), contactId,
      subject: "Cal.com — " + (name || email), sourceDetail: meetingType ? "type:" + meetingType : null,
      incoming: true, lastAt: receivedIso,
      preview: [emoji, verb, name || email, startTime ? when.slice(0, 16).replace("T", " ") : ""].filter(Boolean).join(" · ").slice(0, 160),
    });
    await insertMessageOnce(env, {
      conversationId: convId, direction: "in", channel: "cal",
      externalMessageId: "cal:" + trigger + ":" + (uid || email) + ":" + (startTime || Date.now()),
      bodyText: lines, sentAt: receivedIso,
    });

    // Reminder: stamp the meeting time on the conversation so it shows in Open (⏰ chip) AND
    // in the Reminders view — without moving it out of Open (status stays 'open'). Cancel clears it.
    const noteWhen = startTime ? when.slice(0, 16).replace("T", " ") : "";
    if (isCancelled) {
      await env.DB.prepare("UPDATE conversations SET status='open', snooze_until=NULL, snooze_note=NULL, updated_at=datetime('now') WHERE id=?").bind(convId).run().catch(() => {});
    } else {
      await env.DB.prepare("UPDATE conversations SET status='open', snooze_until=?, snooze_note=?, updated_at=datetime('now') WHERE id=?")
        .bind(startTime ? when : receivedIso, "📅 Meeting with " + (name || email) + (noteWhen ? " — " + noteWhen : ""), convId).run().catch(() => {});
    }

    if (isCreated || isRescheduled) {
      // Booked → advance the lifecycle stage and EXIT the nurture (goal "booked").
      await env.DB.prepare("UPDATE contacts SET lifecycle_stage='meeting_booked', updated_at=datetime('now') WHERE id=?").bind(contactId).run().catch(() => {});
      await handleGoalEvent(env, { contactId, goal: "booked" }).catch(() => {});
    }
    if (isCreated) {
      // ALWAYS put the booking on the Pipeline — ensure a company first so the deal renders.
      try {
        const existing = await env.DB.prepare("SELECT id FROM deals WHERE primary_contact_id=? AND lead_status IN ('active','won') LIMIT 1").bind(contactId).first();
        if (!existing) {
          const ct2 = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(contactId).first();
          let companyId = ct2 && ct2.company_id;
          if (!companyId) {
            companyId = await findOrCreateCompany(env, { name: name || email, domain: emailDomain(email) || null }).catch(() => null);
            if (companyId) await env.DB.prepare("UPDATE contacts SET company_id=?, updated_at=datetime('now') WHERE id=?").bind(companyId, contactId).run().catch(() => {});
          }
          if (companyId) {
            const dealId = "deal_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            await env.DB.prepare(
              "INSERT INTO deals (id, company_id, primary_contact_id, origin_conversation_id, owner_id, title, lead_status, close_probability) VALUES (?, ?, ?, ?, ?, ?, 'active', 60)"
            ).bind(dealId, companyId, contactId, convId, null, "Meeting booked — " + (name || email)).run();
          }
        }
      } catch (_) {}
    }
    await logEvent(env, {
      type: isCancelled ? "meeting_cancelled" : isRescheduled ? "meeting_rescheduled" : "meeting_booked",
      contactId, conversationId: convId, source: "cal",
      meta: { uid: uid || null, startTime: startTime || null, meetingType: meetingType || null },
    }).catch(() => {});

    // Meta CAPI — a booked meeting is a stronger optimization signal than a form submit. Fire a
    // server-side `Schedule` conversion (first-party: they booked with their own email). event_id
    // is stable per booking so it dedupes if a browser Schedule pixel ever fires the same one.
    if (isCreated) {
      await sendCapi(env, {
        eventName: "Schedule",
        eventId: "cal-sched:" + (uid || email),
        email,
        phone: String(attendee.phoneNumber || p.responses?.phone?.value || "").trim(),
        eventSourceUrl: "https://consentresolve.com/demo/",
        actionSource: "website",
      }).catch(() => {});
    }

    // Also feed the Speed-to-Lead engine: attach the booking to the STL lead (if any),
    // mark it booked, and schedule/cancel the B5 T-1h reminder. No-op if not an STL lead.
    await recordStlMeeting(env, {
      trigger, email, phone: String(attendee.phoneNumber || p.responses?.phone?.value || "").trim(),
      name, calUid: uid, startTime,
    }).catch(() => {});
  })().catch(() => {});
  if (typeof waitUntil === "function") waitUntil(work); else await work;

  // Ack fast so Cal doesn't retry.
  return json({ ok: true }, {}, cors);
}
