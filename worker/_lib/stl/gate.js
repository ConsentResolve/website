// Speed-to-Lead — THE CONSENT GATE (spec §4).
// Every outbound touch calls gate(). No exceptions, no bypass flag.
// Cookie-banner acceptance grants identification rights only — never TCPA consent.
import { ensureStlSchema } from "./schema.js";

const ORAL_OK_STATES = ["TX", "LA", "MS"]; // 5th Cir. Bradford v. Sovereign Pest Control, Feb 2026

// SMS and AI voice to a mobile require written-grade consent. Oral consent is
// accepted only in TX/LA/MS, and only where the lead voluntarily gave the number.
function gradeOk(consents) {
  const c = consents[0];
  if (!c) return false;
  if (c.consent_grade === "written") return true;
  if (c.consent_grade === "oral" && ORAL_OK_STATES.includes(c.state)) return true;
  return false;
}

// A manual human dial to a *published business line* is permitted (still blocked on DNC).
// We treat a landline/voip phone_type on the lead as a business-line signal; a mobile is not.
async function isBusinessLine(env, leadId) {
  try {
    const r = await env.DB.prepare("SELECT phone_type FROM stl_leads WHERE id=?").bind(leadId).first();
    return !!r && (r.phone_type === "landline" || r.phone_type === "voip");
  } catch (_) { return false; }
}

// Records a denial and flags it for on-call paging (spec §4, §8.5 — target: zero).
async function deny(env, leadId, channel, reason, caller) {
  try {
    await env.DB.prepare(
      `INSERT INTO stl_gate_violations (id, lead_id, attempted_at, channel, reason, caller, alerted)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).bind(crypto.randomUUID(), leadId, Date.now(), channel, reason, caller || null).run();
  } catch (_) {}
  return { ok: false, reason };
}

/**
 * @param {Channel} channel  'email' | 'sms' | 'call_ai' | 'call_human'
 * @returns {{ok:true}|{ok:false,reason:string}}
 */
export async function gate(env, leadId, channel, caller) {
  await ensureStlSchema(env);
  const consents = ((await env.DB.prepare(
    `SELECT * FROM stl_consent_events
      WHERE lead_id = ? AND revoked_at IS NULL
      ORDER BY created_at DESC`
  ).bind(leadId).all()).results) || [];

  if (!consents.length) return deny(env, leadId, channel, "no_consent_record", caller);
  const has = (col) => consents.some((c) => c[col] === 1);

  switch (channel) {
    case "email":
      return { ok: true }; // CAN-SPAM: permitted with a functioning opt-out
    case "call_human":
      return (has("channel_phone_hum") || (await isBusinessLine(env, leadId)))
        ? { ok: true } : deny(env, leadId, channel, "no_phone_consent", caller);
    case "sms":
      return (has("channel_sms") && gradeOk(consents))
        ? { ok: true } : deny(env, leadId, channel, "no_sms_consent", caller);
    case "call_ai":
      return (has("channel_phone_ai") && gradeOk(consents))
        ? { ok: true } : deny(env, leadId, channel, "no_ai_voice_consent", caller);
    default:
      return deny(env, leadId, channel, "unknown_channel", caller);
  }
}
