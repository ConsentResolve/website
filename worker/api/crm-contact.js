// CRM v2 — contact edits (BUILD-PLAN P2-4): manual company assignment for the free-email
// ICP, where domain grouping misses and contacts land ungrouped. Also basic field edits.
//   POST /api/crm/contact { id, company_name?, full_name?, title?, phone? }
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, findOrCreateCompany, addActivityV2, currentUser, adminUserId } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

// Contact 360 — everything tied to one contact (email): all conversations across channels,
// a merged chronological timeline (messages + notes + activities), deals, and rollup stats.
//   GET /api/crm/contact?id=<contactId>
export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureCrmV2Schema(env);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "id_required" }, { status: 400 }, cors);
  const contact = await env.DB.prepare("SELECT * FROM contacts WHERE id=?").bind(id).first();
  if (!contact) return json({ error: "not_found" }, { status: 404 }, cors);
  const company = contact.company_id ? await env.DB.prepare("SELECT * FROM companies WHERE id=?").bind(contact.company_id).first() : null;
  const all = async (sql, ...p) => { try { return (await env.DB.prepare(sql).bind(...p).all()).results || []; } catch { return []; } };

  const conversations = await all("SELECT id, channel, subject, status, unread, last_message_at, last_message_preview FROM conversations WHERE contact_id=? ORDER BY COALESCE(last_message_at, updated_at) DESC", id);
  const convIds = conversations.map((c) => c.id);
  const deals = await all("SELECT id, title, value_cents, close_probability, expected_close_date, lead_status FROM deals WHERE primary_contact_id=? ORDER BY updated_at DESC", id);
  const placeholders = convIds.map(() => "?").join(",");
  const msgs = convIds.length
    ? await all("SELECT direction, channel, body_text, sent_at, created_at FROM messages WHERE conversation_id IN (" + placeholders + ") ORDER BY COALESCE(sent_at, created_at) DESC", ...convIds)
    : [];
  const notes = await all("SELECT n.body, n.created_at, u.name AS author FROM notes n LEFT JOIN users u ON u.id=n.author_id WHERE n.contact_id=? ORDER BY n.created_at DESC", id);

  // ---- Communication status: newsletter, per-channel consent, do-not-contact ----
  const email = contact.primary_email || "";
  const consentRows = await all(
    "SELECT channel, action FROM consent_records WHERE contact_id=? OR (email IS NOT NULL AND email!='' AND email=?) ORDER BY COALESCE(occurred_at, created_at) ASC",
    id, email
  );
  const consent = {};
  for (const c of consentRows) if (c.channel) consent[c.channel] = c.action; // ordered asc → latest wins
  const suppressions = await all(
    "SELECT channel, reason, source, created_at FROM suppressions WHERE contact_id=? OR (email IS NOT NULL AND email!='' AND email=?)",
    id, email
  );
  const comms = {
    newsletter_status: contact.newsletter_status || "pending",
    repermission_step: contact.repermission_step != null ? contact.repermission_step : null,
    lifecycle_stage: contact.lifecycle_stage || null,
    consent,                                   // { email:'granted', sms:'revoked', ... }
    suppressed: suppressions.length > 0,
    suppressions,
  };
  const acts = await all("SELECT a.action, a.created_at, u.name AS actor FROM activities a LEFT JOIN users u ON u.id=a.actor_id WHERE a.entity_type='contact' AND a.entity_id=? ORDER BY a.created_at DESC LIMIT 50", id);

  // Session-stitched pageviews: the visitor's pre-identification browsing (via cr_vid).
  let pageviews = [];
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS visitor_links (vid TEXT, contact_id TEXT, email TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(vid, contact_id))").run();
    const vids = (await all("SELECT vid FROM visitor_links WHERE contact_id=?", id)).map((v) => v.vid).filter(Boolean);
    if (vids.length) {
      const ph = vids.map(() => "?").join(",");
      pageviews = await all("SELECT path, utm_source, created_at FROM traffic WHERE vid IN (" + ph + ") ORDER BY created_at DESC LIMIT 100", ...vids);
    }
  } catch (_) {}

  const timeline = [];
  for (const p of pageviews) timeline.push({ kind: "pageview", at: p.created_at, path: p.path, source: p.utm_source });
  for (const m of msgs) timeline.push({ kind: "message", at: m.sent_at || m.created_at, channel: m.channel, direction: m.direction, text: m.body_text || "" });
  for (const n of notes) timeline.push({ kind: "note", at: n.created_at, text: n.body, author: n.author });
  for (const a of acts) timeline.push({ kind: "activity", at: a.created_at, action: a.action, actor: a.actor });
  timeline.sort((x, y) => String(y.at || "").localeCompare(String(x.at || "")));

  // Rollup stats: first-seen, touches, channels, speed-to-lead (first inbound -> first reply).
  let firstIn = null, firstOut = null;
  for (const m of msgs) {
    const t = m.sent_at || m.created_at;
    if (m.direction === "in" && (!firstIn || t < firstIn)) firstIn = t;
    if (m.direction === "out" && (!firstOut || t < firstOut)) firstOut = t;
  }
  let stl = null;
  if (firstIn && firstOut && firstOut > firstIn) stl = Math.round(((Date.parse(firstOut) - Date.parse(firstIn)) / 3600000) * 10) / 10;
  const firstSeen = conversations.length ? conversations.map((c) => c.last_message_at).filter(Boolean).sort()[0] || contact.created_at : contact.created_at;
  const stats = {
    first_seen: firstSeen, conversations: conversations.length,
    channels: [...new Set(conversations.map((c) => c.channel))],
    deals: deals.length, messages: msgs.length, speed_to_lead_hours: stl, pageviews: pageviews.length,
  };

  return json({ contact, company, conversations, deals, timeline, stats, comms }, {}, cors);
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
