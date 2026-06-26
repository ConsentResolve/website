// CRM v2 — on-demand Apollo enrichment (BUILD-PLAN P2-5, spec §10).
//   POST /api/crm/enrich { contact_id } -> matches the contact's email via Apollo
//   people/match, caches person on contacts.enrichment + org on companies.enrichment,
//   logs the enrich to activities (provenance). NEVER auto-on-arrival — button only,
//   to conserve Apollo credits and keep the consent-first brand clean.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, addActivityV2, currentUser, adminUserId } from "../_lib/crm-v2.js";

async function apolloMatch(env, email) {
  const res = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-cache", "X-Api-Key": env.APOLLO_API_KEY },
    body: JSON.stringify({ api_key: env.APOLLO_API_KEY, email, reveal_personal_emails: false }),
  });
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, person: j.person || null, raw: j };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!env.APOLLO_API_KEY) return json({ error: "no_api_key", message: "Set APOLLO_API_KEY in Cloudflare." }, { status: 400 }, cors);
  await ensureCrmV2Schema(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (!b.contact_id) return json({ error: "contact_id_required" }, { status: 400 }, cors);
  const contact = await env.DB.prepare("SELECT * FROM contacts WHERE id=?").bind(b.contact_id).first();
  if (!contact) return json({ error: "not_found" }, { status: 404 }, cors);
  if (!contact.primary_email) return json({ error: "no_email" }, { status: 400 }, cors);

  const m = await apolloMatch(env, contact.primary_email);
  if (!m.ok) return json({ error: "apollo_error", status: m.status, detail: String((m.raw && (m.raw.error || m.raw.message)) || "").slice(0, 160) }, { status: 200 }, cors);
  if (!m.person) return json({ ok: true, matched: false, note: "No Apollo match for this email." }, {}, cors);

  const p = m.person;
  const phone = (p.phone_numbers && p.phone_numbers[0] && (p.phone_numbers[0].sanitized_number || p.phone_numbers[0].raw_number)) || null;
  await env.DB.prepare(
    "UPDATE contacts SET enrichment=?, title=COALESCE(?, title), phone=COALESCE(phone, ?), apollo_person_id=?, full_name=COALESCE(full_name, ?), updated_at=datetime('now') WHERE id=?"
  ).bind(JSON.stringify(p), p.title || null, phone, p.id || null, p.name || null, contact.id).run();

  const org = p.organization;
  if (org && contact.company_id) {
    await env.DB.prepare(
      "UPDATE companies SET enrichment=?, apollo_org_id=COALESCE(?, apollo_org_id), domain=COALESCE(domain, ?), name=COALESCE(name, ?), updated_at=datetime('now') WHERE id=?"
    ).bind(JSON.stringify(org), org.id || null, org.primary_domain || null, org.name || null, contact.company_id).run();
  }

  const me = await currentUser(request, env);
  await addActivityV2(env, { actorId: me ? me.id : await adminUserId(env), entityType: "contact", entityId: contact.id, action: "enriched", meta: { source: "apollo", email: contact.primary_email } });
  return json({ ok: true, matched: true, person: p }, {}, cors);
}
