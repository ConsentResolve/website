// worker/api/telnyx-inbound.js
// Inbound SMS webhook for the toll-free number (Telnyx Messaging v2).
//   POST /api/telnyx/inbound
// - message.received: ingest the reply into the CRM conversation. On STOP-type keywords,
//   revoke SMS consent + suppress + exit any active sequence — mirroring the carrier-level
//   STOP so our consent-first ledger matches what actually happened. Other replies exit the
//   sequence (a human takes over). HELP is answered by the carrier; we just log it.
// - message.finalized / message.failed: delivery receipts (failures logged for observability).
//
// SECURITY: verifies Telnyx's Ed25519 webhook signature when TELNYX_PUBLIC_KEY is set.
// Inert end-to-end until the toll-free number is live — safe to deploy now.
import { corsHeaders } from "../_lib/http.js";
import { ensureRebuildSchema, recordConsent, logEvent, nowIso } from "../_lib/crm-rebuild.js";
import { handleGoalEvent } from "../_lib/workflow-engine.js";
import { ensureCrmV2Schema, findOrCreateContactByIdentifier, normPhone, upsertConversationByThread, insertMessageOnce } from "../_lib/crm-v2.js";

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT", "OPT-OUT"]);
const HELP_WORDS = new Set(["HELP", "INFO"]);

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Telnyx signs `${timestamp}|${rawBody}` with Ed25519. Verify against the portal public key.
async function verifyTelnyxSignature(env, rawBody, sig, ts) {
  if (!env.TELNYX_PUBLIC_KEY) return true; // not configured yet → accept; set the key to enforce
  if (!sig || !ts) return false;
  try {
    const key = await crypto.subtle.importKey("raw", b64ToBytes(env.TELNYX_PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
    const data = new TextEncoder().encode(`${ts}|${rawBody}`);
    return await crypto.subtle.verify("Ed25519", key, b64ToBytes(sig), data);
  } catch (_) { return false; }
}

export async function onRequestPost({ request, env }) {
  const raw = await request.text();
  const sig = request.headers.get("telnyx-signature-ed25519");
  const ts = request.headers.get("telnyx-timestamp");
  if (!(await verifyTelnyxSignature(env, raw, sig, ts))) {
    return new Response("bad signature", { status: 403 });
  }
  // Past this point we always return 200 so Telnyx doesn't retry on our internal errors.
  try {
    await ensureRebuildSchema(env);
    await ensureCrmV2Schema(env);
    const evt = JSON.parse(raw)?.data || {};
    const type = evt.event_type;
    const p = evt.payload || {};

    if (type === "message.received") {
      const from = p.from?.phone_number || "";
      const text = (p.text || "").trim();
      const msgId = p.id || "in-" + nowIso();
      const np = normPhone(from);
      if (np) {
        const contactId = await findOrCreateContactByIdentifier(env, "phone", np, { source: "sms" });
        const convId = await upsertConversationByThread(env, {
          channel: "sms", externalThreadId: "sms:" + np, contactId,
          subject: "SMS", incoming: true, lastAt: nowIso(), preview: text.slice(0, 160) || "SMS",
        });
        await insertMessageOnce(env, {
          conversationId: convId, direction: "in", channel: "sms",
          externalMessageId: "telnyx:" + msgId, bodyText: text, sentAt: nowIso(),
        });
        await logEvent(env, { type: "sms_received", contactId, conversationId: convId, channel: "sms", meta: { from: np } });

        const kw = text.toUpperCase().replace(/[^A-Z-]/g, "");
        if (STOP_WORDS.has(kw)) {
          await recordConsent(env, { contactId, phone: np, channel: "sms", action: "revoked", basis: "SMS STOP", captureMethod: "sms_reply", source: "telnyx" });
          await handleGoalEvent(env, { contactId, goal: "opted_out" }); // exits sequences + suppresses
          await logEvent(env, { type: "sms_opt_out", contactId, channel: "sms", meta: { keyword: kw } });
        } else if (!HELP_WORDS.has(kw)) {
          await handleGoalEvent(env, { contactId, goal: "replied" }); // a real reply → stop auto-messaging
        }
      }
    } else if (type === "message.finalized" || type === "message.failed") {
      const status = p.to?.[0]?.status || type;
      if (status && status !== "delivered") {
        await logEvent(env, { type: "sms_delivery", channel: "sms", meta: { status, id: p.id } });
      }
    }
  } catch (_) {
    // non-fatal → still 200 so Telnyx doesn't hammer retries
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}
