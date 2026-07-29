// Consent Resolve — Leadfeeder / Dealfront website-visitor ingest -> CRM.
//
// Leadfeeder identifies the visiting COMPANY (not a named person). Flow:
//   1. pull identified companies via the Leadfeeder API (recent window)
//   2. keep only ICP companies (home-services trades) — the rest are skipped
//   3. for each ICP company, enrich to named contacts via Apollo (owner/exec/
//      marketing/ops) and upsert them as source "leadfeeder" identified leads
//
// SAFE BY DEFAULT (Apollo enrichment costs credits):
//   ?test=1     -> auth + resolve account + count (free)
//   ?raw=1      -> a few companies mapped + ICP flag (free)
//   ?preview=1  -> classify the window ICP vs non-ICP (free, no enrich)
//   ?run=1      -> enrich ICP companies + import (spends Apollo credits)
// Params: &days=<lookback> (default 7), &per=<contacts per company> (default 4).
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, upsertLead, addActivity, ensureCrmSchema } from "../_lib/crm.js";
import { peopleAtDomain, enrichPerson, usableEmail, DEFAULT_TITLES } from "./apollo-prospect.js";

const BASE = "https://api.leadfeeder.com";
const TOK = (env) => String(env.LEADFEEDER_API_TOKEN || "").trim();

async function lfGet(env, path) {
  // Leadfeeder API v2 uses "Authorization: Token token=<TOKEN>".
  const r = await fetch(BASE + path, { headers: { Authorization: "Token token=" + TOK(env), Accept: "application/json" } });
  let body = null; try { body = await r.json(); } catch (_) {}
  return { status: r.status, ok: r.ok, body };
}

async function resolveAccount(env) {
  if (env.LEADFEEDER_ACCOUNT_ID) return String(env.LEADFEEDER_ACCOUNT_ID).trim();
  const r = await lfGet(env, "/accounts");
  const data = (r.body && (r.body.data || r.body.accounts)) || [];
  return data[0] ? (data[0].id || (data[0].attributes && data[0].attributes.id)) : null;
}

const cleanDomain = (s) =>
  String(s || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim().toLowerCase();

// ICP = home-services trades (matches our 17 trade verticals). Tune freely.
const ICP_RE = /\b(hvac|air ?condition|heating|furnace|plumb|roof|electric|garage ?door|landscap|lawn|pest|extermin|pool|spa|clean|janitor|paint|floor|carpet|fenc|concrete|foundation|tree service|arborist|appliance repair|locksmith|restoration|water damage|remodel|contractor|mechanical|solar|drain|sewer|duct|insulation|handyman|pressure wash|window|gutter|deck|patio|irrigation|septic|home service)\b/i;

function normalize(L) {
  const a = L.attributes || L; // tolerate JSON:API {id,attributes} or flat
  return {
    lf_id: L.id || a.id || null,
    name: a.name || a.company_name || "",
    domain: cleanDomain(a.website || a.domain || a.company_domain || ""),
    industry: a.industry || a.industry_label || a.industry_name || "",
    loc: [a.city, a.region || a.state, a.country].filter(Boolean).join(", "),
    employees: a.employee_count || a.employees_range || a.size || null,
    visits: a.visits || a.total_visits || a.page_views || null,
  };
}
function isICP(c) {
  return ICP_RE.test([c.industry, c.name, c.domain].filter(Boolean).join(" ").toLowerCase());
}

function ymd(d) { return d.toISOString().slice(0, 10); }

async function fetchCompanies(env, accountId, days) {
  const end = new Date();
  const start = new Date(Date.now() - (days || 7) * 864e5);
  const qs = `start_date=${ymd(start)}&end_date=${ymd(end)}&page[size]=100`;
  const r = await lfGet(env, `/accounts/${accountId}/leads?${qs}`);
  if (!r.ok) return { error: `API ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`, status: r.status };
  const rows = (r.body && (r.body.data || r.body.leads)) || (Array.isArray(r.body) ? r.body : []);
  return { rows: rows.map(normalize) };
}

export async function runScheduledSync(env, opts = {}) {
  if (!env.DB || !TOK(env)) return { skipped: "not_configured" };
  const accountId = await resolveAccount(env);
  if (!accountId) return { skipped: "no_account" };
  await ensureCrmSchema(env);
  const got = await fetchCompanies(env, accountId, opts.days || 7);
  if (got.error) return { error: got.error };
  const companies = (got.rows || []).filter((c) => c.domain);
  const icp = companies.filter(isICP);
  const per = Math.min(8, Math.max(1, opts.per || 4));

  if (!opts.run) {
    // preview: classify only, no enrichment, no writes, no credits.
    return { mode: "preview", account: accountId, companies: companies.length, icp: icp.length,
      icp_sample: icp.slice(0, 20).map((c) => ({ name: c.name, domain: c.domain, industry: c.industry, loc: c.loc })),
      skipped_sample: companies.filter((c) => !isICP(c)).slice(0, 10).map((c) => ({ name: c.name, industry: c.industry })) };
  }

  let imported = 0, enriched = 0, credits = 0, companiesEnriched = 0, searchErr = null;
  for (const c of icp) {
    // dedup: already prospected this domain via leadfeeder?
    const seen = await env.DB.prepare("SELECT id FROM crm_leads WHERE domain=? AND source='leadfeeder' LIMIT 1").bind(c.domain).first();
    if (seen) continue;
    const s = await peopleAtDomain(env, c.domain, DEFAULT_TITLES, per);
    if (s.error) { searchErr = s.error; continue; }
    let any = false;
    for (const p of s.people) {
      if (!p.has_email) continue;
      const e = await enrichPerson(env, p); credits++; enriched++;
      if (!e || !usableEmail(e.email)) continue;
      const id = await upsertLead(env, {
        source: "leadfeeder", email: e.email, name: e.name || p.first_name || null,
        company: c.name || (e.organization && e.organization.name) || null, domain: c.domain,
        consent_status: "identified",
        notes: [p.title, c.loc, e.linkedin_url ? "LinkedIn: " + e.linkedin_url : ""].filter(Boolean).join(" · ") || null,
      });
      await addActivity(env, id, "identified", "Identified via Leadfeeder (ICP visitor) · " + (p.title || "contact") + " @ " + (c.name || c.domain), "leadfeeder");
      imported++; any = true;
    }
    if (any) companiesEnriched++;
  }
  return { mode: "run", account: accountId, icp: icp.length, companiesEnriched, enriched, imported, credits_spent: credits, ...(searchErr ? { note: "some Apollo searches errored: " + searchErr } : {}) };
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

  if (q.get("test")) {
    const account = await resolveAccount(env);
    if (!account) { const a = await lfGet(env, "/accounts"); return json({ ok: false, error: "no_account", status: a.status, detail: JSON.stringify(a.body).slice(0, 200) }, {}, cors); }
    const got = await fetchCompanies(env, account, days);
    return json({ ok: !got.error, account, window_days: days, companies: got.rows ? got.rows.length : 0, error: got.error }, {}, cors);
  }
  if (q.get("raw")) {
    const account = await resolveAccount(env);
    const got = await fetchCompanies(env, account, days);
    if (got.error) return json({ ok: false, account, error: got.error }, {}, cors);
    return json({ ok: true, account, sample: got.rows.slice(0, 5).map((c) => ({ ...c, icp: isICP(c) })) }, {}, cors);
  }
  if (q.get("run")) {
    const out = await runScheduledSync(env, { run: true, days, per: parseInt(q.get("per") || "4", 10) });
    return json({ ok: !out.error, ...out }, out.error ? { status: 502 } : {}, cors);
  }
  // default = free preview (classify ICP vs not)
  const out = await runScheduledSync(env, { run: false, days });
  return json({ ok: !out.error, ...out }, out.error ? { status: 502 } : {}, cors);
}
