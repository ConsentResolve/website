// CRM v2 — deals / pipeline API (BUILD-PLAN P3-1).
//   GET  /api/crm/deals[?include=all]  -> { deals:[...], users:[...] }  (active+won by default)
//   POST /api/crm/deals { create:true, ... }            -> { ok, id }
//   POST /api/crm/deals { id, close_probability|expected_close_date|value_cents|lead_status|title|owner_id } -> { ok }
// No stages — a deal carries a manual close_probability (0-100) + close date + lead_status
// (active|won|lost). The board's bands are computed client-side from close_probability.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, ulid, addActivityV2, currentUser, adminUserId } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  await env.DB.prepare("ALTER TABLE deals ADD COLUMN disqualify_reason TEXT").run().catch(() => {}); // idempotent
  const includeAll = new URL(request.url).searchParams.get("include") === "all";
  const deals = (await env.DB.prepare(
    `SELECT d.id, d.title, d.value_cents, d.close_probability, d.expected_close_date, d.lead_status, d.disqualify_reason,
            d.owner_id, d.company_id, d.primary_contact_id, d.origin_conversation_id,
            co.name AS company_name, ct.full_name AS contact_name, ct.primary_email AS contact_email, u.name AS owner_name
       FROM deals d
       LEFT JOIN companies co ON co.id=d.company_id
       LEFT JOIN contacts ct ON ct.id=d.primary_contact_id
       LEFT JOIN users u ON u.id=d.owner_id` +
    (includeAll ? "" : " WHERE d.lead_status IN ('active','won')") +
    " ORDER BY d.updated_at DESC LIMIT 500"
  ).all()).results || [];
  const users = (await env.DB.prepare("SELECT id, name, role FROM users WHERE active=1 ORDER BY name").all()).results || [];
  return json({ deals, users }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  const me = await currentUser(request, env);
  const actor = me ? me.id : await adminUserId(env);

  if (b.create) {
    if (!b.company_id) return json({ error: "company_id_required" }, { status: 400 }, cors);
    const id = ulid();
    await env.DB.prepare(
      `INSERT INTO deals (id, company_id, primary_contact_id, origin_conversation_id, owner_id, title, value_cents, close_probability, expected_close_date, lead_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, b.company_id, b.primary_contact_id || null, b.origin_conversation_id || null, b.owner_id || actor,
           b.title || null, b.value_cents != null ? b.value_cents : null, b.close_probability != null ? b.close_probability : null,
           b.expected_close_date || null, b.lead_status || "active").run();
    await addActivityV2(env, { actorId: actor, entityType: "deal", entityId: id, action: "created" });
    return json({ ok: true, id }, {}, cors);
  }

  if (b.delete) {
    await env.DB.prepare("DELETE FROM deals WHERE id=?").bind(b.delete).run();
    await addActivityV2(env, { actorId: actor, entityType: "deal", entityId: b.delete, action: "deleted" });
    return json({ ok: true }, {}, cors);
  }

  if (!b.id) return json({ error: "id_required" }, { status: 400 }, cors);
  await env.DB.prepare("ALTER TABLE deals ADD COLUMN disqualify_reason TEXT").run().catch(() => {}); // idempotent
  const allowed = ["close_probability", "expected_close_date", "value_cents", "lead_status", "title", "owner_id", "disqualify_reason"];
  const sets = [], vals = [];
  for (const k of allowed) if (b[k] !== undefined) { sets.push(k + "=?"); vals.push(b[k]); }
  if (["won", "lost", "disqualified"].includes(b.lead_status)) { sets.push("won_lost_at=?"); vals.push(new Date().toISOString()); }
  if (!sets.length) return json({ error: "no_fields" }, { status: 400 }, cors);
  sets.push("updated_at=datetime('now')");
  vals.push(b.id);
  await env.DB.prepare("UPDATE deals SET " + sets.join(", ") + " WHERE id=?").bind(...vals).run();

  // Disqualify cascade: archive the linked conversation + suppress the contact (do-not-contact).
  if (b.lead_status === "disqualified") {
    try {
      const d = await env.DB.prepare("SELECT origin_conversation_id, primary_contact_id FROM deals WHERE id=?").bind(b.id).first();
      if (d && d.origin_conversation_id) {
        await env.DB.prepare("UPDATE conversations SET status='archived', updated_at=datetime('now') WHERE id=?").bind(d.origin_conversation_id).run().catch(() => {});
      }
      if (d && d.primary_contact_id) {
        const ct = await env.DB.prepare("SELECT primary_email, phone FROM contacts WHERE id=?").bind(d.primary_contact_id).first().catch(() => null);
        await env.DB.prepare("UPDATE contacts SET lifecycle_stage='disqualified', updated_at=datetime('now') WHERE id=?").bind(d.primary_contact_id).run().catch(() => {});
        await env.DB.prepare(
          `INSERT OR IGNORE INTO suppressions (id, contact_id, email, phone, channel, reason, source)
           VALUES (?,?,?,?,?,?,?)`
        ).bind(ulid(), d.primary_contact_id, ct ? ct.primary_email : null, ct ? ct.phone : null, "all", (b.disqualify_reason || "disqualified").slice(0, 200), "disqualified").run().catch(() => {});
      }
    } catch (_) { /* cascade is best-effort; the deal update already succeeded */ }
  }

  const action = b.lead_status === "won" ? "won" : b.lead_status === "lost" ? "lost" : b.lead_status === "disqualified" ? "disqualified" : b.close_probability !== undefined ? "prob_changed" : "updated";
  await addActivityV2(env, { actorId: actor, entityType: "deal", entityId: b.id, action, meta: b.lead_status === "disqualified" ? { reason: b.disqualify_reason || "" } : undefined });
  return json({ ok: true }, {}, cors);
}
