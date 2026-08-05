// worker/api/crm-agency.js
//   Track which contractors are managed by a marketing/web agency — so we know we're
//   really selling THROUGH the agency (or that the site owner can't change their own
//   stack). Two sources feed it:
//     • auto-detected during a Claude lookup (companies.enrichment._intel.agency)
//     • manually flagged by a rep from the Intel panel or the Agency tab
//   Storage is companies.enrichment._agency = {managed, name, note, by, at}. No new table.
//
//   GET  /api/crm/agency            → { agencies:[...], roster:[...] }
//   POST /api/crm/agency {action:"set", company_id?|contact_id?, managed, name?, note?}
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser, addActivityV2 } from "../_lib/crm-v2.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function safe(s, f) { try { return s ? JSON.parse(s) : f; } catch (_) { return f; } }

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);

  // WHALES = accounts that need special attention: agency-managed, franchise / multi-location,
  // big companies, or manually flagged. All live in companies.enrichment.
  const rows = await env.DB.prepare(
    `SELECT id, name, domain, enrichment FROM companies
      WHERE enrichment LIKE '%_agency%' OR enrichment LIKE '%"agency"%'
         OR enrichment LIKE '%_whale%' OR enrichment LIKE '%"is_franchise":true%'
         OR enrichment LIKE '%"apollo"%'
      ORDER BY updated_at DESC LIMIT 500`
  ).all().catch(() => ({ results: [] }));

  const agencies = [];              // (kept as the response key so the client keeps working)
  const rosterMap = new Map();      // agency name → count of managed clients
  for (const r of (rows.results || [])) {
    const en = safe(r.enrichment, {});
    const manualAg = en._agency || null;
    const detectedAg = (en._intel && en._intel.agency) || null;
    const managed = manualAg ? !!manualAg.managed : (detectedAg ? !!detectedAg.managed : false);
    const agencyName = (manualAg && manualAg.name) || (detectedAg && detectedAg.name) || null;
    const whale = en._whale || null;
    const ap = en.apollo || {};
    const employees = ap.employees || null, locations = ap.locations || null;
    const isFranchise = !!ap.is_franchise;
    const isBig = (employees && employees >= 250) || (locations && locations >= 5);
    // Which whale reasons apply?
    const kinds = [];
    if (whale) kinds.push("flagged");
    if (managed || agencyName) kinds.push("agency");
    if (isFranchise) kinds.push("franchise");
    if (isBig && !isFranchise) kinds.push("big");
    if (!kinds.length) continue;    // an Apollo-enriched company that isn't actually a whale
    const ct = await env.DB.prepare("SELECT id, full_name FROM contacts WHERE company_id=? ORDER BY created_at LIMIT 1").bind(r.id).first().catch(() => null);
    agencies.push({
      company_id: r.id, company: r.name, domain: r.domain,
      contact_id: ct ? ct.id : null, contact_name: ct ? ct.full_name : null,
      kinds, kind: kinds[0], agency_name: agencyName, managed,
      employees, locations, is_franchise: isFranchise,
      note: (whale && whale.reason) || (manualAg && manualAg.note) || null,
      source: whale ? "flagged" : (manualAg ? "manual" : "detected"),
      by: (whale && whale.by) || (manualAg && manualAg.by) || null,
      at: (whale && whale.at) || (manualAg && manualAg.at) || (detectedAg && detectedAg.detected_at) || null,
    });
    if (managed && agencyName) rosterMap.set(agencyName, (rosterMap.get(agencyName) || 0) + 1);
  }
  const roster = [...rosterMap.entries()].map(([name, clients]) => ({ name, clients })).sort((a, b) => b.clients - a.clients);
  return json({ ok: true, agencies, roster }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  const b = await request.json().catch(() => ({}));
  if (b.action !== "set") return json({ ok: false, error: "bad_request" }, { status: 400 }, cors);

  // Resolve the company from company_id or the contact's company.
  let companyId = b.company_id || null;
  if (!companyId && b.contact_id) {
    const ct = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(b.contact_id).first().catch(() => null);
    companyId = ct && ct.company_id;
  }
  if (!companyId) return json({ ok: false, error: "no_company" }, { status: 400 }, cors);

  const co = await env.DB.prepare("SELECT id, enrichment FROM companies WHERE id=?").bind(companyId).first().catch(() => null);
  if (!co) return json({ ok: false, error: "not_found" }, { status: 404 }, cors);
  const me = await currentUser(request, env).catch(() => null);
  const en = safe(co.enrichment, {});
  en._agency = {
    managed: !!b.managed,
    name: (b.name || (en._agency && en._agency.name) || "").trim() || null,
    note: b.note != null ? String(b.note).slice(0, 500) : (en._agency && en._agency.note) || null,
    by: me ? me.name : "CRM",
    at: new Date().toISOString(),
  };
  await env.DB.prepare("UPDATE companies SET enrichment=?, updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(en), companyId).run().catch(() => {});
  if (b.contact_id) await addActivityV2(env, { actorId: me ? me.id : null, entityType: "contact", entityId: b.contact_id, action: "agency_flagged", meta: { managed: !!b.managed, name: en._agency.name } }).catch(() => {});
  return json({ ok: true, agency: en._agency }, {}, cors);
}
