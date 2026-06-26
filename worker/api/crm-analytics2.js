// CRM v2 — analytics dashboard (BUILD-PLAN P4-3, spec §9). Marketing-led metrics:
// weighted forecast, source/vertical attribution, funnel, per-owner, and speed-to-lead
// (inbound → first reply). All computed from the v2 deals/conversations/messages tables.
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
  const all = async (sql) => { try { return (await env.DB.prepare(sql).all()).results || []; } catch { return []; } };
  const one = async (sql) => { try { return await env.DB.prepare(sql).first(); } catch { return null; } };

  const forecast = await all(
    `SELECT strftime('%Y-%m', expected_close_date) AS month,
            ROUND(SUM(value_cents * close_probability / 100.0) / 100.0) AS weighted_usd, COUNT(*) AS deals
       FROM deals WHERE lead_status='active' AND expected_close_date IS NOT NULL
      GROUP BY month ORDER BY month`
  );
  const attribution = await all(
    `SELECT cv.channel, COALESCE(NULLIF(cv.source_detail,''),'(none)') AS source,
            COUNT(DISTINCT cv.id) AS conversations, COUNT(DISTINCT d.id) AS leads,
            SUM(CASE WHEN d.lead_status='won' THEN 1 ELSE 0 END) AS won
       FROM conversations cv LEFT JOIN deals d ON d.origin_conversation_id=cv.id
      GROUP BY cv.channel, source ORDER BY conversations DESC`
  );
  const byOwner = await all(
    `SELECT u.name,
            SUM(CASE WHEN d.lead_status='active' THEN 1 ELSE 0 END) AS active_deals,
            ROUND(SUM(CASE WHEN d.lead_status='active' THEN d.value_cents*d.close_probability/100.0 ELSE 0 END)/100.0) AS weighted_usd,
            SUM(CASE WHEN d.lead_status='won' THEN 1 ELSE 0 END) AS won,
            SUM(CASE WHEN d.lead_status='lost' THEN 1 ELSE 0 END) AS lost
       FROM users u LEFT JOIN deals d ON d.owner_id=u.id
      WHERE u.active=1 GROUP BY u.id ORDER BY weighted_usd DESC`
  );
  const funnel = await one(
    `SELECT (SELECT COUNT(*) FROM conversations) AS conversations,
            (SELECT COUNT(*) FROM deals) AS leads,
            (SELECT COUNT(*) FROM deals WHERE lead_status='won') AS won`
  );
  // Speed-to-lead: avg hours from first inbound message to first outbound reply.
  const stl = await one(
    `WITH f AS (
       SELECT conversation_id,
              MIN(CASE WHEN direction='in' THEN sent_at END) AS first_in,
              MIN(CASE WHEN direction='out' THEN sent_at END) AS first_out
         FROM messages GROUP BY conversation_id)
     SELECT ROUND(AVG((julianday(first_out)-julianday(first_in))*24.0), 1) AS avg_hours, COUNT(*) AS n
       FROM f WHERE first_in IS NOT NULL AND first_out IS NOT NULL AND first_out > first_in`
  );
  const totals = await one(
    `SELECT (SELECT ROUND(SUM(value_cents*close_probability/100.0)/100.0) FROM deals WHERE lead_status='active') AS weighted_pipeline_usd,
            (SELECT ROUND(SUM(value_cents)/100.0) FROM deals WHERE lead_status='won') AS won_usd`
  );

  return json({ forecast, attribution, byOwner, funnel, speedToLead: stl, totals, generatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC" }, {}, cors);
}
