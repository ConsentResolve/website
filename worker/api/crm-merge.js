// CRM v2 — merge suggestions + apply (BUILD-PLAN P2-6, spec §4 "suggest-merge, never
// auto-merge on fuzzy"). Surfaces provisional (anonymous chat/social) contacts that
// share a name with an email-bearing contact, and applies a merge on confirmation.
//   GET  /api/crm/merge                         -> { suggestions:[{provisional, target}] }
//   POST /api/crm/merge { from_id, into_id }    -> repoint identifiers/conversations/deals
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, addActivityV2, currentUser, adminUserId, normPhone } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  // Provisional contact + a non-provisional contact with the same (non-empty) full_name.
  const rows = (await env.DB.prepare(
    `SELECT p.id AS from_id, p.full_name AS name, p.source AS from_source,
            t.id AS into_id, t.primary_email AS into_email
       FROM contacts p
       JOIN contacts t ON lower(t.full_name)=lower(p.full_name) AND t.id<>p.id
            AND t.is_provisional=0 AND t.primary_email IS NOT NULL
      WHERE p.is_provisional=1 AND p.full_name IS NOT NULL AND p.full_name<>''
      LIMIT 50`
  ).all()).results || [];

  // Phone-match: two distinct contacts sharing a normalized phone (the secondary key for
  // "same person, two emails"). Grouped in JS so the formatting differences don't matter.
  const phoneRows = (await env.DB.prepare("SELECT id, full_name, primary_email, phone FROM contacts WHERE phone IS NOT NULL AND phone<>''").all()).results || [];
  const byPhone = {};
  for (const r of phoneRows) { const np = normPhone(r.phone); if (np.length >= 10) (byPhone[np] = byPhone[np] || []).push(r); }
  for (const np of Object.keys(byPhone)) {
    const grp = byPhone[np];
    for (let i = 1; i < grp.length; i++) {
      rows.push({ from_id: grp[i].id, name: grp[i].full_name, from_source: "phone " + np, into_id: grp[0].id, into_email: grp[0].primary_email });
    }
  }
  return json({ suggestions: rows }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  // Manual merge can target by into_id OR into_email (resolve the email -> contact).
  if (!b.into_id && b.into_email) {
    const t = await env.DB.prepare("SELECT id FROM contacts WHERE lower(primary_email)=lower(?)").bind(String(b.into_email).trim()).first();
    if (!t) return json({ error: "into_email_not_found" }, { status: 404 }, cors);
    b.into_id = t.id;
  }
  if (!b.from_id || !b.into_id || b.from_id === b.into_id) return json({ error: "bad_ids" }, { status: 400 }, cors);
  // Repoint everything from the provisional contact onto the target, then drop it.
  await env.DB.prepare("UPDATE contact_identifiers SET contact_id=? WHERE contact_id=?").bind(b.into_id, b.from_id).run().catch(() => {});
  await env.DB.prepare("UPDATE conversations SET contact_id=? WHERE contact_id=?").bind(b.into_id, b.from_id).run();
  await env.DB.prepare("UPDATE deals SET primary_contact_id=? WHERE primary_contact_id=?").bind(b.into_id, b.from_id).run();
  await env.DB.prepare("DELETE FROM contacts WHERE id=?").bind(b.from_id).run();
  const me = await currentUser(request, env);
  await addActivityV2(env, { actorId: me ? me.id : await adminUserId(env), entityType: "contact", entityId: b.into_id, action: "merged", meta: { from: b.from_id } });
  return json({ ok: true, into_id: b.into_id }, {}, cors);
}
