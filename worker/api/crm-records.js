// CRM v2 — browse/search rosters for the Records section.
//   GET /api/crm/contacts?q=<term>&limit=50   -> { contacts:[...] }
//   GET /api/crm/companies?q=<term>&limit=50  -> { companies:[...] }
// Server-side search (name / email / phone / company / domain) so lookups aren't limited to the
// ~500 conversations the app payload loads. Both gate on the CRM Google session.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, stageKey, stageLabel } from "../_lib/crm-v2.js";

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
    // Pick the page of companies FIRST (cheap: filter + updated_at, then LIMIT), and only then
    // compute the per-company roll-ups. Computing the 4 correlated subqueries for every company
    // in the table (and sorting by one of them) is what made this hang once the prospecting import
    // grew the companies table into the thousands.
    const rows = await all(
      `WITH base AS (
          SELECT id, name, domain, updated_at FROM companies
           WHERE (?1='' OR name LIKE ?2 OR domain LIKE ?2)
           ORDER BY updated_at DESC
           LIMIT ?3)
       SELECT b.id, b.name, b.domain, b.updated_at,
              (SELECT COUNT(*) FROM contacts c WHERE c.company_id=b.id) AS contacts,
              (SELECT COUNT(*) FROM deals d WHERE d.company_id=b.id) AS deals,
              (SELECT COALESCE(SUM(value_cents),0) FROM deals d WHERE d.company_id=b.id AND d.lead_status IN ('active','trial','won')) AS open_value_cents,
              (SELECT MAX(cv.last_message_at) FROM conversations cv WHERE cv.company_id=b.id) AS last_activity
         FROM base b
        ORDER BY (last_activity IS NULL), last_activity DESC, b.updated_at DESC`,
      q, like, limit
    );
    return json({ companies: rows.map((r) => ({ ...r, open_value_usd: Math.round((r.open_value_cents || 0) / 100) })) }, {}, cors);
  }

  // default: /api/crm/contacts — same shape: page the contacts first, then roll up per-contact.
  const rows = await all(
    `WITH base AS (
        SELECT ct.id, ct.full_name, ct.primary_email, ct.phone, ct.tier, ct.lead_score, ct.updated_at, ct.company_id
          FROM contacts ct LEFT JOIN companies co ON co.id=ct.company_id
         WHERE (?1='' OR ct.full_name LIKE ?2 OR ct.primary_email LIKE ?2 OR ct.phone LIKE ?2 OR co.name LIKE ?2)
         ORDER BY ct.updated_at DESC
         LIMIT ?3)
     SELECT b.id, b.full_name, b.primary_email, b.phone, b.tier, b.lead_score, b.updated_at,
            (SELECT d.lead_status FROM deals d WHERE d.primary_contact_id=b.id ORDER BY d.updated_at DESC LIMIT 1) AS deal_status,
            co.id AS company_id, co.name AS company,
            (SELECT MAX(cv.last_message_at) FROM conversations cv WHERE cv.contact_id=b.id) AS last_activity,
            (SELECT COUNT(*) FROM deals d WHERE d.primary_contact_id=b.id) AS deals
       FROM base b LEFT JOIN companies co ON co.id=b.company_id
      ORDER BY (last_activity IS NULL), last_activity DESC, b.updated_at DESC`,
    q, like, limit
  );
  const contacts = rows.map((r) => ({ ...r, stage: stageKey(r.deal_status), stage_label: stageLabel(r.deal_status) }));
  return json({ contacts }, {}, cors);
}
