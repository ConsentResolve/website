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

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  await ensure(env);
  const b = await request.json().catch(() => ({}));
  if (b.action !== "verify" || !b.vkey) return json({ ok: false, error: "bad_request" }, { status: 400 }, cors);

  const me = await currentUser(request, env).catch(() => null);
  const who = me ? me.name : "CRM user";

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
