// CRM v2 — contact edits (BUILD-PLAN P2-4): manual company assignment for the free-email
// ICP, where domain grouping misses and contacts land ungrouped. Also basic field edits.
//   POST /api/crm/contact { id, company_name?, full_name?, title?, phone? }
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, findOrCreateCompany, addActivityV2, currentUser, adminUserId } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (!b.id) return json({ error: "id_required" }, { status: 400 }, cors);
  const contact = await env.DB.prepare("SELECT * FROM contacts WHERE id=?").bind(b.id).first();
  if (!contact) return json({ error: "not_found" }, { status: 404 }, cors);

  const sets = [], vals = [];
  if (b.company_name !== undefined) {
    const companyId = await findOrCreateCompany(env, { name: String(b.company_name || "").trim() });
    sets.push("company_id=?"); vals.push(companyId);
    // keep any conversations' denormalized company_id in sync
    await env.DB.prepare("UPDATE conversations SET company_id=? WHERE contact_id=?").bind(companyId, b.id).run();
  }
  for (const k of ["full_name", "title", "phone"]) if (b[k] !== undefined) { sets.push(k + "=?"); vals.push(b[k]); }
  if (!sets.length) return json({ error: "no_fields" }, { status: 400 }, cors);
  sets.push("updated_at=datetime('now')");
  vals.push(b.id);
  await env.DB.prepare("UPDATE contacts SET " + sets.join(", ") + " WHERE id=?").bind(...vals).run();
  const me = await currentUser(request, env);
  await addActivityV2(env, { actorId: me ? me.id : await adminUserId(env), entityType: "contact", entityId: b.id, action: "edited", meta: b });
  return json({ ok: true }, {}, cors);
}
