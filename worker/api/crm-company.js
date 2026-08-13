// CRM v2 — Company 360. Mirror of crm-contact.js but grouped by company_id: every contact at
// the company, all their conversations, all deals (with a pipeline roll-up), a merged timeline,
// and business intel from companies.enrichment.
//   GET  /api/crm/company?id=<companyId>
//   POST /api/crm/company { id, name?, domain? }
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, addActivityV2, currentUser, adminUserId, stageKey, stageLabel } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "id_required" }, { status: 400 }, cors);
  const company = await env.DB.prepare("SELECT * FROM companies WHERE id=?").bind(id).first();
  if (!company) return json({ error: "not_found" }, { status: 404 }, cors);
  const all = async (sql, ...p) => { try { return (await env.DB.prepare(sql).bind(...p).all()).results || []; } catch { return []; } };

  // Business intel cached on the company enrichment blob.
  let intel = null;
  try { intel = company.enrichment ? JSON.parse(company.enrichment) : null; } catch (_) {}

  const contacts = (await all(
    `SELECT ct.id, ct.full_name, ct.primary_email, ct.phone, ct.title, ct.tier, ct.lead_score, ct.source, ct.created_at,
            (SELECT d.lead_status FROM deals d WHERE d.primary_contact_id=ct.id ORDER BY d.updated_at DESC LIMIT 1) AS deal_status
       FROM contacts ct WHERE ct.company_id=? ORDER BY COALESCE(ct.lead_score,0) DESC, ct.updated_at DESC`,
    id
  )).map((c) => ({ ...c, stage: stageKey(c.deal_status), stage_label: stageLabel(c.deal_status) }));
  const contactIds = contacts.map((c) => c.id);

  const deals = await all(
    `SELECT d.id, d.title, d.value_cents, d.close_probability, d.lead_status, d.expected_close_date,
            d.primary_contact_id, ct.full_name AS contact_name, u.name AS owner_name
       FROM deals d LEFT JOIN contacts ct ON ct.id=d.primary_contact_id LEFT JOIN users u ON u.id=d.owner_id
      WHERE d.company_id=? ORDER BY d.updated_at DESC`,
    id
  );

  // Conversations for the company: direct (denormalized company_id) OR any member contact's.
  const cph = contactIds.map(() => "?").join(",");
  const conversations = await all(
    "SELECT cv.id, cv.contact_id, ct.full_name AS contact_name, cv.channel, cv.subject, cv.status, cv.unread, cv.last_message_at, cv.last_message_preview " +
      "FROM conversations cv LEFT JOIN contacts ct ON ct.id=cv.contact_id " +
      "WHERE cv.company_id=?" + (contactIds.length ? " OR cv.contact_id IN (" + cph + ")" : "") +
      " ORDER BY COALESCE(cv.last_message_at, cv.updated_at) DESC LIMIT 100",
    ...(contactIds.length ? [id, ...contactIds] : [id])
  );
  const convIds = conversations.map((c) => c.id);

  // Merged timeline (bounded): recent messages across those conversations + company activities.
  const mph = convIds.map(() => "?").join(",");
  const msgs = convIds.length
    ? await all("SELECT direction, channel, body_text, sent_at, created_at FROM messages WHERE conversation_id IN (" + mph + ") ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 80", ...convIds)
    : [];
  const acts = await all("SELECT a.action, a.created_at, u.name AS actor FROM activities a LEFT JOIN users u ON u.id=a.actor_id WHERE a.entity_type='company' AND a.entity_id=? ORDER BY a.created_at DESC LIMIT 40", id);

  const timeline = [];
  for (const m of msgs) timeline.push({ kind: "message", at: m.sent_at || m.created_at, channel: m.channel, direction: m.direction, text: m.body_text || "" });
  for (const a of acts) timeline.push({ kind: "activity", at: a.created_at, action: a.action, actor: a.actor });
  timeline.sort((x, y) => String(y.at || "").localeCompare(String(x.at || "")));

  // Pipeline roll-up for the account.
  const openCents = deals.filter((d) => ["active", "trial"].includes((d.lead_status || "").toLowerCase()))
    .reduce((s, d) => s + (d.value_cents || 0), 0);
  const weightedCents = deals.filter((d) => ["active", "trial"].includes((d.lead_status || "").toLowerCase()))
    .reduce((s, d) => s + (d.value_cents || 0) * ((d.close_probability != null ? d.close_probability : 0) / 100), 0);
  const wonCents = deals.filter((d) => ["won", "customer"].includes((d.lead_status || "").toLowerCase()))
    .reduce((s, d) => s + (d.value_cents || 0), 0);
  const stats = {
    contacts: contacts.length,
    deals: deals.length,
    open_value_usd: Math.round(openCents / 100),
    weighted_value_usd: Math.round(weightedCents / 100),
    won_value_usd: Math.round(wonCents / 100),
    conversations: conversations.length,
    channels: [...new Set(conversations.map((c) => c.channel).filter(Boolean))],
    first_seen: (conversations.map((c) => c.last_message_at).filter(Boolean).sort()[0]) || company.created_at,
  };

  return json({ company, intel, contacts, deals, conversations, timeline, stats }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (!b.id) return json({ error: "id_required" }, { status: 400 }, cors);
  const company = await env.DB.prepare("SELECT id FROM companies WHERE id=?").bind(b.id).first();
  if (!company) return json({ error: "not_found" }, { status: 404 }, cors);
  const sets = [], vals = [];
  for (const k of ["name", "domain"]) if (b[k] !== undefined) { sets.push(k + "=?"); vals.push(String(b[k] || "").trim() || null); }
  if (!sets.length) return json({ error: "no_fields" }, { status: 400 }, cors);
  sets.push("updated_at=datetime('now')");
  vals.push(b.id);
  await env.DB.prepare("UPDATE companies SET " + sets.join(", ") + " WHERE id=?").bind(...vals).run();
  const me = await currentUser(request, env);
  await addActivityV2(env, { actorId: me ? me.id : await adminUserId(env), entityType: "company", entityId: b.id, action: "edited", meta: b });
  return json({ ok: true }, {}, cors);
}
