// CRM v2 — browse/search rosters for the Records section.
//   GET /api/crm/contacts?q=<term>&limit=50   -> { contacts:[...] }
//   GET /api/crm/companies?q=<term>&limit=50  -> { companies:[...] }
// Server-side search (name / email / phone / company / domain) so lookups aren't limited to the
// ~500 conversations the app payload loads. Both gate on the CRM Google session.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const q = (url.searchParams.get("q") || "").trim();
  const like = "%" + q.replace(/[%_]/g, "") + "%";
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "60", 10) || 60));
  const all = async (sql, ...p) => { try { return (await env.DB.prepare(sql).bind(...p).all()).results || []; } catch { return []; } };

  if (path === "/api/crm/companies") {
    const rows = await all(
      `SELECT co.id, co.name, co.domain, co.updated_at,
              (SELECT COUNT(*) FROM contacts c WHERE c.company_id=co.id) AS contacts,
              (SELECT COUNT(*) FROM deals d WHERE d.company_id=co.id) AS deals,
              (SELECT COALESCE(SUM(value_cents),0) FROM deals d WHERE d.company_id=co.id AND d.lead_status IN ('active','trial','won')) AS open_value_cents,
              (SELECT MAX(cv.last_message_at) FROM conversations cv WHERE cv.company_id=co.id) AS last_activity
         FROM companies co
        WHERE (?1='' OR co.name LIKE ?2 OR co.domain LIKE ?2)
        ORDER BY (last_activity IS NULL), last_activity DESC, co.updated_at DESC
        LIMIT ?3`,
      q, like, limit
    );
    return json({ companies: rows.map((r) => ({ ...r, open_value_usd: Math.round((r.open_value_cents || 0) / 100) })) }, {}, cors);
  }

  // default: /api/crm/contacts
  const rows = await all(
    `SELECT ct.id, ct.full_name, ct.primary_email, ct.phone, ct.tier, ct.lead_score, ct.lifecycle_stage,
            co.id AS company_id, co.name AS company,
            (SELECT MAX(cv.last_message_at) FROM conversations cv WHERE cv.contact_id=ct.id) AS last_activity,
            (SELECT COUNT(*) FROM deals d WHERE d.primary_contact_id=ct.id) AS deals
       FROM contacts ct LEFT JOIN companies co ON co.id=ct.company_id
      WHERE (?1='' OR ct.full_name LIKE ?2 OR ct.primary_email LIKE ?2 OR ct.phone LIKE ?2 OR co.name LIKE ?2)
      ORDER BY (last_activity IS NULL), last_activity DESC, ct.updated_at DESC
      LIMIT ?3`,
    q, like, limit
  );
  return json({ contacts: rows }, {}, cors);
}
