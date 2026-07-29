// Consent Resolve — Apollo "website visitor" prospecting -> CRM.
//
// Apollo's Websites feature identifies COMPANIES that visited. This turns those
// companies into named CONTACTS in the CRM:
//   1. resolve company domains (from an Apollo accounts list/label, or explicit)
//   2. People Search each domain for target titles (owner/exec/marketing/ops)
//   3. (optional, credit-spending) enrich to reveal emails
//   4. (optional) upsert the ones with a usable email as apollo/identified leads
//
// SAFE BY DEFAULT: GET with no flags = free PREVIEW (search only, emails masked,
// nothing written, no credits). You approve, then add flags:
//   /api/crm/apollo/prospect?label=<id>              -> preview (free)
//   ...&enrich=1                                     -> reveal emails (1 credit each)
//   ...&enrich=1&run=1                               -> reveal + write to CRM
//   ...&domains=a.com,b.com                          -> bypass the label (explicit)
//
// Requires the API key to have People Search + People Enrichment in its scope.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, upsertLead, addActivity, ensureCrmSchema } from "../_lib/crm.js";

const KEY = (env) => String(env.APOLLO_API_KEY || "").trim();

// Owner/exec + marketing + ops decision-makers — a broad net for mixed B2B visitors.
const DEFAULT_TITLES = [
  "owner", "founder", "co-founder", "ceo", "chief executive officer", "president",
  "partner", "principal", "vice president", "vp", "chief marketing officer", "cmo",
  "vp marketing", "director of marketing", "marketing director", "head of marketing",
  "demand generation", "growth", "operations manager", "director of operations",
  "general manager", "gm",
];

const cleanDomain = (s) =>
  String(s || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim().toLowerCase();

async function apolloPost(env, path, body) {
  const res = await fetch("https://api.apollo.io/api/v1/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-cache", "X-Api-Key": KEY(env) },
    body: JSON.stringify(body),
  });
  let d = {}; try { d = await res.json(); } catch (_) {}
  return { status: res.status, data: d, error: d.error || d.error_message };
}

// Companies in a saved Apollo accounts list (label). The list ID is the tail of the
// list's URL in Apollo, same as APOLLO_CONTACTS_LABEL but for accounts.
async function domainsFromLabel(env, labelId, cap) {
  const domains = [];
  for (let page = 1; page <= 5; page++) {
    const r = await apolloPost(env, "accounts/search", { account_label_ids: [labelId], page, per_page: 100 });
    if (r.error) return { error: r.error };
    const accts = r.data.accounts || r.data.organizations || [];
    for (const a of accts) {
      const dom = cleanDomain(a.domain || a.website_url || a.primary_domain);
      if (dom) domains.push({ domain: dom, name: a.name || null });
    }
    const total = (r.data.pagination || {}).total_entries || 0;
    if (!accts.length || domains.length >= total || domains.length >= (cap || 250)) break;
  }
  return { domains };
}

async function peopleAtDomain(env, domain, titles, perPage) {
  const r = await apolloPost(env, "mixed_people/search", {
    q_organization_domains: domain, person_titles: titles, page: 1, per_page: perPage || 5,
  });
  return { error: r.error, total: (r.data.pagination || {}).total_entries || 0, people: r.data.people || [] };
}

const usableEmail = (e) =>
  !!e && e.includes("@") && !/^email_not_unlocked/i.test(e) && !/@domain\.com$/i.test(e);

async function enrichPerson(env, person) {
  // reveal the unlocked email for a person we found via search (costs 1 credit)
  const r = await apolloPost(env, "people/match", { id: person.id, reveal_personal_emails: false });
  return r.data.person || null;
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!KEY(env)) return json({ ok: false, error: "no_api_key", message: "Set APOLLO_API_KEY." }, { status: 400 }, cors);

  const q = new URL(request.url).searchParams;
  const titles = q.get("titles") ? q.get("titles").split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_TITLES;
  const per = Math.min(10, Math.max(1, parseInt(q.get("per") || "5", 10)));
  const enrich = q.get("enrich") === "1";
  const run = q.get("run") === "1";

  // Resolve the target companies: explicit ?domains= wins; else ?label= / env.
  let companies = [];
  if (q.get("domains")) {
    companies = q.get("domains").split(",").map((s) => ({ domain: cleanDomain(s), name: null })).filter((c) => c.domain);
  } else {
    const label = q.get("label") || env.APOLLO_VISITORS_LABEL;
    if (!label) {
      return json({ ok: false, error: "no_companies", message: "Pass ?label=<apollo accounts list id> (or set APOLLO_VISITORS_LABEL), or ?domains=a.com,b.com." }, { status: 400 }, cors);
    }
    const r = await domainsFromLabel(env, label, 250);
    if (r.error) return json({ ok: false, error: "accounts_search_failed", detail: r.error }, { status: 502 }, cors);
    companies = r.domains;
  }
  if (!companies.length) return json({ ok: true, companies: 0, message: "No companies resolved." }, {}, cors);

  if (run) await ensureCrmSchema(env);
  const results = [];
  let found = 0, enriched = 0, imported = 0, credits = 0, searchErr = null;
  for (const c of companies) {
    const s = await peopleAtDomain(env, c.domain, titles, per);
    if (s.error) { searchErr = s.error; results.push({ domain: c.domain, name: c.name, error: s.error }); continue; }
    const people = [];
    for (const p of s.people) {
      let person = p, email = p.email;
      if (enrich && !usableEmail(email)) {
        const e = await enrichPerson(env, p);
        if (e) { person = e; email = e.email; enriched++; credits++; }
      }
      const rec = {
        name: person.name, title: person.title, seniority: person.seniority || null,
        email: usableEmail(email) ? email : null, email_status: person.email_status || null,
        linkedin: person.linkedin_url || null,
      };
      people.push(rec); found++;
      if (run && rec.email) {
        const company = (person.organization && person.organization.name) || c.name || null;
        const id = await upsertLead(env, {
          source: "apollo", email: rec.email, name: rec.name || null, company, domain: c.domain,
          consent_status: "identified",
          notes: [rec.title, rec.linkedin ? "LinkedIn: " + rec.linkedin : ""].filter(Boolean).join(" · ") || null,
        });
        await addActivity(env, id, "identified", "Prospected via Apollo (website visitor) · " + (rec.title || "contact") + " @ " + c.domain, "apollo");
        imported++;
      }
    }
    results.push({ domain: c.domain, name: c.name, total_at_company: s.total, returned: people.length, people });
  }

  const mode = run ? (enrich ? "run+enrich" : "run") : (enrich ? "preview+enrich" : "preview");
  const resp = { ok: true, mode, companies: companies.length, found, enriched, imported, credits_spent: credits, results };
  if (searchErr && /not authorized/i.test(searchErr)) {
    resp.warning = "Apollo key lacks People Search scope — enable mixed_people/search (and people/match) on the key in Apollo settings.";
  }
  return json(resp, {}, cors);
}
