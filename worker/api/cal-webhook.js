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
import { ensureCrmV2Schema, findOrCreateContactByEmail, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";
import { ensureRebuildSchema, logEvent } from "../_lib/crm-rebuild.js";
import { handleGoalEvent } from "../_lib/workflow-engine.js";

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

    if (isCreated || isRescheduled) {
      // Booked → advance the lifecycle stage and EXIT the nurture (goal "booked").
      await env.DB.prepare("UPDATE contacts SET lifecycle_stage='meeting_booked', updated_at=datetime('now') WHERE id=?").bind(contactId).run().catch(() => {});
      await handleGoalEvent(env, { contactId, goal: "booked" }).catch(() => {});
    }
    await logEvent(env, {
      type: isCancelled ? "meeting_cancelled" : isRescheduled ? "meeting_rescheduled" : "meeting_booked",
      contactId, conversationId: convId, source: "cal",
      meta: { uid: uid || null, startTime: startTime || null, meetingType: meetingType || null },
    }).catch(() => {});
  })().catch(() => {});
  if (typeof waitUntil === "function") waitUntil(work); else await work;

  // Ack fast so Cal doesn't retry.
  return json({ ok: true }, {}, cors);
}
