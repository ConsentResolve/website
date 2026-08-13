// Consent Resolve — Leadfeeder / Dealfront website-visitor ingest -> CRM.
//
// New Dealfront API (base /v1, header X-Api-Key). Multi-step, because the visitor
// feed is JSON:API and only carries IDs:
//   1. GET  /v1/web-visits/companies      -> visitor company IDs (+ location)
//   2. GET  /v1/companies?ids=...         -> firmographics (name/domain/industry)
//   3. keep ICP (home-services) companies
//   4. POST /v1/contacts/search {company_ids, positions} -> named contacts (Dealfront's
//      own contact data — replaces Apollo enrichment for this source)
//   5. upsert contacts as source "leadfeeder" identified
//
// SAFE BY DEFAULT (contact reveal may cost Dealfront credits):
//   ?test=1   -> auth + account
//   ?debug=1  -> raw response from each step (no writes) — use this to confirm shapes
//   ?raw=1    -> mapped visitor companies + ICP flag (no contacts, no writes)
//   ?preview=1-> ICP split (no writes)
//   ?run=1    -> pull contacts for ICP companies + import (may spend credits)
// Params: &days=<lookback,7> &per=<contacts/company,4>.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, upsertLead, addActivity, ensureCrmSchema } from "../_lib/crm.js";

const BASE = "https://api.leadfeeder.com";
const TOK = (env) => String(env.LEADFEEDER_API_TOKEN || "").trim();

async function lf(env, method, path, body) {
  const init = { method, headers: { "X-Api-Key": TOK(env), Accept: "application/json" } };
  if (body) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
  const r = await fetch(BASE + path, init);
  let b = null; try { b = await r.json(); } catch (_) {}
  return { status: r.status, ok: r.ok, body: b };
}
const lfGet = (env, path) => lf(env, "GET", path);
const lfPost = (env, path, body) => lf(env, "POST", path, body);

const cleanDomain = (s) =>
  String(s || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim().toLowerCase();
const ymd = (d) => d.toISOString().slice(0, 10);

// ICP = home-services trades (our 17 verticals). Tune freely.
const ICP_RE = /\b(hvac|air ?condition|heating|furnace|plumb|roof|electric|garage ?door|landscap|lawn|pest|extermin|pool|spa|clean|janitor|paint|floor|carpet|fenc|concrete|foundation|tree service|arborist|appliance repair|locksmith|restoration|water damage|remodel|contractor|mechanical|solar|drain|sewer|duct|insulation|handyman|pressure wash|window|gutter|deck|patio|irrigation|septic|home service)\b/i;
// Decision-maker positions for Dealfront contacts/search.
const LF_POSITIONS = ["owner", "founder", "president", "ceo", "vice president", "vp", "general manager", "operations manager", "director of operations", "marketing director", "director of marketing", "head of marketing", "cmo"];

async function resolveAccount(env) {
  if (env.LEADFEEDER_ACCOUNT_ID) return String(env.LEADFEEDER_ACCOUNT_ID).trim();
  const r = await lfGet(env, "/v1/accounts");
  const data = (r.body && r.body.data) || [];
  return data[0] ? (data[0].id || (data[0].attributes && data[0].attributes.id)) : null;
}

// Step 1: visitor company IDs (+ location) for a date window.
async function fetchVisitorCompanies(env, account, days) {
  const end = new Date(), start = new Date(Date.now() - (days || 7) * 864e5);
  const qs = `account_id=${encodeURIComponent(account)}&start_date=${ymd(start)}&end_date=${ymd(end)}`;
  const r = await lfGet(env, `/v1/web-visits/companies?${qs}`);
  if (!r.ok) return { error: `web-visits ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}` };
  const rows = (r.body && r.body.data) || [];
  const seen = new Set(), out = [];
  for (const row of rows) {
    const rel = row.relationships || {};
    const cid = rel.company && (rel.company.id || (rel.company.data && rel.company.data.id));
    if (!cid || seen.has(cid)) continue;
    seen.add(cid);
    const la = (rel.location && rel.location.attributes) || {};
    out.push({ companyId: String(cid), loc: [la.city, la.region, la.country].filter(Boolean).join(", ") });
  }
  return { rows: out, raw0: rows[0] || null };
}

// Step 2: firmographics for a batch of company IDs.
async function fetchCompanyDetails(env, account, ids) {
  const map = {};
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const r = await lfGet(env, `/v1/companies?account_id=${encodeURIComponent(account)}&ids=${batch.join(",")}`);
    if (!r.ok) return { error: `companies ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`, raw0: null };
    for (const c of ((r.body && r.body.data) || [])) {
      const a = c.attributes || c;
      map[String(c.id || a.id)] = {
        name: a.name || a.company_name || "",
        domain: cleanDomain(a.root_domain || a.domain || a.website || ""),
        industry: a.industry || a.industry_label || (a.industries && a.industries[0] && (a.industries[0].name || a.industries[0])) || "",
        employees: a.employee_count || a.employees || null,
      };
    }
    if (i === 0) var raw0 = (r.body && r.body.data && r.body.data[0]) || null;
  }
  return { map, raw0: typeof raw0 !== "undefined" ? raw0 : null };
}

const isICP = (c) => ICP_RE.test([c.industry, c.name, c.domain].filter(Boolean).join(" ").toLowerCase());

// Step 4: Dealfront contacts for ICP company IDs.
async function fetchContacts(env, account, companyIds, per) {
  const r = await lfPost(env, "/v1/contacts/search", {
    account_id: account, company_ids: companyIds, positions: LF_POSITIONS, page: { size: Math.min(100, companyIds.length * (per || 4)) },
  });
  if (!r.ok) return { error: `contacts/search ${r.status}: ${JSON.stringify(r.body).slice(0, 220)}`, raw0: null };
  const data = (r.body && r.body.data) || [];
  const map = (c) => {
    const a = c.attributes || c;
    const rel = c.relationships || {};
    return {
      name: a.full_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || "",
      title: a.position || a.job_title || a.title || "",
      email: a.professional_email || a.email || (a.emails && a.emails[0] && (a.emails[0].email || a.emails[0])) || "",
      companyId: String((rel.company && (rel.company.id || (rel.company.data && rel.company.data.id))) || a.company_id || ""),
      linkedin: a.linkedin_url || a.linkedin || "",
    };
  };
  return { contacts: data.map(map), raw0: data[0] || null };
}
const usableEmail = (e) => !!e && String(e).includes("@");

export async function runScheduledSync(env, opts = {}) {
  if (!env.DB || !TOK(env)) return { skipped: "not_configured" };
  const account = await resolveAccount(env);
  if (!account) return { skipped: "no_account" };
  await ensureCrmSchema(env);
  const v = await fetchVisitorCompanies(env, account, opts.days || 7);
  if (v.error) return { error: v.error };
  if (!v.rows.length) return { mode: "empty", account, visitors: 0 };
  const det = await fetchCompanyDetails(env, account, v.rows.map((r) => r.companyId));
  if (det.error) return { error: det.error };
  const companies = v.rows.map((r) => ({ companyId: r.companyId, loc: r.loc, ...(det.map[r.companyId] || {}) }));
  const icp = companies.filter(isICP);

  if (!opts.run) {
    return { mode: "preview", account, visitors: companies.length, icp: icp.length,
      icp_sample: icp.slice(0, 20).map((c) => ({ name: c.name, domain: c.domain, industry: c.industry, loc: c.loc })),
      skipped_sample: companies.filter((c) => !isICP(c)).slice(0, 10).map((c) => ({ name: c.name, industry: c.industry })) };
  }

  const byId = {}; icp.forEach((c) => (byId[c.companyId] = c));
  const ct = await fetchContacts(env, account, icp.map((c) => c.companyId), opts.per || 4);
  if (ct.error) return { error: ct.error, icp: icp.length };
  let imported = 0, noEmail = 0;
  for (const p of ct.contacts) {
    if (!usableEmail(p.email)) { noEmail++; continue; }
    const co = byId[p.companyId] || {};
    const id = await upsertLead(env, {
      source: "leadfeeder", email: String(p.email).toLowerCase(), name: p.name || null,
      company: co.name || null, domain: co.domain || null, consent_status: "identified",
      notes: [p.title, co.loc, p.linkedin ? "LinkedIn: " + p.linkedin : ""].filter(Boolean).join(" · ") || null,
    });
    await addActivity(env, id, "identified", "Identified via Leadfeeder (ICP visitor) · " + (p.title || "contact") + " @ " + (co.name || co.domain || ""), "leadfeeder");
    imported++;
  }
  return { mode: "run", account, icp: icp.length, contacts: ct.contacts.length, imported, noEmail };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!TOK(env)) return json({ ok: false, error: "no_token", message: "LEADFEEDER_API_TOKEN not set." }, { status: 400 }, cors);
  const q = new URL(request.url).searchParams;
  const days = Math.min(90, Math.max(1, parseInt(q.get("days") || "7", 10)));
  const account = await resolveAccount(env);

  if (q.get("test")) {
    if (!account) { const a = await lfGet(env, "/v1/accounts"); return json({ ok: false, error: "no_account", status: a.status, detail: JSON.stringify(a.body).slice(0, 200) }, {}, cors); }
    const v = await fetchVisitorCompanies(env, account, days);
    return json({ ok: !v.error, account, window_days: days, visitor_companies: v.rows ? v.rows.length : 0, error: v.error }, {}, cors);
  }
  if (q.get("debug")) {
    // Dump the raw response at each step so we can confirm/tune the mapping.
    const v = await fetchVisitorCompanies(env, account, days);
    const firstIds = (v.rows || []).slice(0, 3).map((r) => r.companyId);
    const det = firstIds.length ? await fetchCompanyDetails(env, account, firstIds) : { raw0: null };
    const ct = firstIds.length ? await fetchContacts(env, account, firstIds, 3) : { raw0: null, error: "no_ids" };
    return json({ ok: true, account,
      step1_webvisits_raw: v.raw0, step1_count: (v.rows || []).length, step1_err: v.error,
      step2_companies_raw: det.raw0, step2_err: det.error,
      step4_contacts_raw: ct.raw0, step4_err: ct.error }, {}, cors);
  }
  if (q.get("raw")) {
    const v = await fetchVisitorCompanies(env, account, days);
    if (v.error) return json({ ok: false, error: v.error }, {}, cors);
    const det = await fetchCompanyDetails(env, account, v.rows.slice(0, 10).map((r) => r.companyId));
    const sample = v.rows.slice(0, 10).map((r) => { const c = { companyId: r.companyId, loc: r.loc, ...(det.map[r.companyId] || {}) }; return { ...c, icp: isICP(c) }; });
    return json({ ok: true, account, sample }, {}, cors);
  }
  const out = await runScheduledSync(env, { run: q.get("run") === "1", days, per: parseInt(q.get("per") || "4", 10) });
  return json({ ok: !out.error, ...out }, out.error ? { status: 502 } : {}, cors);
}
