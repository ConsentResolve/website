// worker/api/crm-consent.js
//   POST /api/crm/consent {action:"verify", vkey, verified, contact_id?, email?, name?}
// Logs a MANUAL consent verification (a human confirmed the consent record is good) into a
// separate consent_verifications table — the consent_records ledger itself stays immutable.
// Also drops a contact-activity entry so the verification shows on the timeline.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser, addActivityV2 } from "../_lib/crm-v2.js";

async function ensure(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS consent_verifications (vkey TEXT PRIMARY KEY, verified_by TEXT, verified_by_name TEXT, verified_at TEXT)`).run().catch(() => {});
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

const rid = () => "cn_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  await ensure(env);
  const b = await request.json().catch(() => ({}));

  const me = await currentUser(request, env).catch(() => null);
  const who = me ? me.name : "CRM user";

  // ── set_channel: a human toggles Email/SMS/Voice consent from the Intel panel. ──
  // Writes an immutable consent_records row (granted|revoked) auto-stamped with WHO
  // clicked it and WHEN, so even a "simple toggle" leaves an auditable trail. Shows
  // up in the Consent ledger + the contact's Activity timeline.
  if (b.action === "set_channel") {
    const channel = String(b.channel || "").toLowerCase();
    if (!b.contact_id || !["email", "sms", "voice"].includes(channel)) return json({ ok: false, error: "bad_request" }, { status: 400 }, cors);
    const action = b.granted ? "granted" : "revoked";
    const ct = await env.DB.prepare("SELECT id, primary_email, phone FROM contacts WHERE id=?").bind(b.contact_id).first().catch(() => null);
    const ph = await env.DB.prepare("SELECT value FROM contact_identifiers WHERE contact_id=? AND type='phone' LIMIT 1").bind(b.contact_id).first().catch(() => null);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO consent_records (id, contact_id, email, phone, channel, action, basis, capture_method, proof_ref, occurred_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(rid(), b.contact_id, ct ? ct.primary_email : null, (ct && ct.phone) || (ph && ph.value) || null,
      channel, action, "manual_attestation", "manual_crm", (me ? me.name : "CRM") + " @ " + now, now).run().catch(() => {});
    await addActivityV2(env, { actorId: me ? me.id : null, entityType: "contact", entityId: b.contact_id,
      action: action === "granted" ? "consent_granted" : "consent_revoked", meta: { channel, method: "manual_crm", by: who } }).catch(() => {});
    return json({ ok: true, channel, action, by: who, at: now }, {}, cors);
  }

  if (b.action !== "verify" || !b.vkey) return json({ ok: false, error: "bad_request" }, { status: 400 }, cors);

  if (b.verified) {
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT OR REPLACE INTO consent_verifications (vkey, verified_by, verified_by_name, verified_at) VALUES (?,?,?,?)`)
      .bind(b.vkey, me ? me.id : null, who, now).run();
    if (b.contact_id) {
      await addActivityV2(env, { actorId: me ? me.id : null, entityType: "contact", entityId: b.contact_id, action: "consent_verified", meta: { vkey: b.vkey } }).catch(() => {});
    }
    return json({ ok: true, verified: true, verified_by_name: who, verified_at: now }, {}, cors);
  }

  await env.DB.prepare(`DELETE FROM consent_verifications WHERE vkey=?`).bind(b.vkey).run();
  if (b.contact_id) {
    await addActivityV2(env, { actorId: me ? me.id : null, entityType: "contact", entityId: b.contact_id, action: "consent_verification_removed", meta: { vkey: b.vkey } }).catch(() => {});
  }
  return json({ ok: true, verified: false }, {}, cors);
}
