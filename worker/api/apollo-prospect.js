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
export const DEFAULT_TITLES = [
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

export async function peopleAtDomain(env, domain, titles, perPage, maxPages) {
  // mixed_people/search was deprecated for API callers -> use api_search. It returns
  // a MASKED preview (first_name, title, org.name, id, has_email) and no email/last
  // name until you enrich by id. Paginates so we surface the whole company (matching
  // Apollo's web UI count), not just the first page. person_titles omitted = ALL people.
  const per = Math.min(100, Math.max(1, perPage || 25));
  const pages = Math.max(1, maxPages || 1);
  const base = { q_organization_domains: domain, per_page: per };
  if (Array.isArray(titles) && titles.length) base.person_titles = titles;
  let people = [], total = 0, error = null;
  for (let page = 1; page <= pages; page++) {
    const r = await apolloPost(env, "mixed_people/api_search", { ...base, page });
    if (r.error) { error = r.error; break; }
    total = (r.data.pagination || {}).total_entries || total;
    const got = r.data.people || [];
    people = people.concat(got);
    if (got.length < per || people.length >= total) break;
  }
  return { error, total, people };
}

export const usableEmail = (e) =>
  !!e && e.includes("@") && !/^email_not_unlocked/i.test(e) && !/@domain\.com$/i.test(e);

// ── Claude web-search fallback ──────────────────────────────────────────────
// Apollo's People Search draws a blank for a lot of smaller contractors. When it does, ask
// Claude — with the live web_search tool — to find the owner/decision-maker's name + email the
// same way a human would: check the site's About/Contact/Team page, Google, LinkedIn, public
// registries. No Apollo credit involved; the email is already in hand, not "revealed" later.
const SONNET5_MODEL = "claude-sonnet-5";
// Approximate token cost for the lookup_log entry — post-intro Sonnet 5 rates ($3/$15 per 1M).
// Does NOT include the web_search tool's own per-call fee (not published in our pricing cache).
const SONNET5_IN = 3 / 1e6, SONNET5_OUT = 15 / 1e6;

export async function claudeFindOwner(env, domain, companyName) {
  if (!domain) return { used: false, reason: "no_domain" };
  if (!env.ANTHROPIC_API_KEY) return { used: false, reason: "no_api_key" };
  const prompt = `Find the owner or a real decision-maker's name and email for the business at ${domain}${companyName ? ` ("${companyName}")` : ""}. Search their website (About/Contact/Team pages), Google, LinkedIn, and any public business registry. Prefer a named person over a generic info@ address. Never invent or guess an email — only report one you actually found on a real page, and cite where via source_url. If you can't verify a name or email, use null for that field rather than guessing.

Do the research silently. Your final reply must be ONLY one line of strict JSON — no preamble, no explanation, no markdown fences, nothing before or after it:
{"name": <string|null>, "title": <string|null>, "email": <string|null>, "source_url": <string|null>}`;
  const timeout = AbortSignal.timeout(25000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: SONNET5_MODEL,
        max_tokens: 3072,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: prompt }],
      }),
      signal: timeout,
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) return { used: false, error: (d && d.error && d.error.message) || `HTTP ${r.status}` };
    const text = (d.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("\n");
    // Fast path: the model followed instructions and the JSON is the literal last line. Fallback:
    // it added trailing prose anyway (common even with explicit "nothing else on that line"
    // instructions) — scan every {...} blob in the response from the end, accept the first one
    // that parses AND has an "email" key, so a stray brace elsewhere in the search commentary
    // can't be mistaken for the answer.
    const isAnswerShape = (o) => o && typeof o === "object" && !Array.isArray(o) && "email" in o;
    let parsed = null;
    try { const p = JSON.parse((text.trim().split("\n").pop() || "")); if (isAnswerShape(p)) parsed = p; } catch (_) {}
    if (!parsed) {
      const blobs = text.match(/\{[^{}]*\}/g) || [];
      for (let i = blobs.length - 1; i >= 0 && !parsed; i--) {
        try { const p = JSON.parse(blobs[i]); if (isAnswerShape(p)) parsed = p; } catch (_) {}
      }
    }
    const usage = d.usage || {};
    const cost_usd = Math.round((((usage.input_tokens || 0) * SONNET5_IN) + ((usage.output_tokens || 0) * SONNET5_OUT)) * 10000) / 10000;
    if (!parsed || !parsed.email || !usableEmail(parsed.email)) return { used: true, cost_usd, found: false };
    return { used: true, cost_usd, found: true, name: parsed.name || null, title: parsed.title || null, email: parsed.email, source_url: parsed.source_url || null };
  } catch (e) {
    return { used: false, error: String(e) };
  }
}

export async function enrichPerson(env, person) {
  // reveal full name + email for a person we found via api_search (costs 1 credit)
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
      // api_search gives a masked preview: first_name + title + org, and has_email.
      const company = (p.organization && p.organization.name) || c.name || null;
      const rec = {
        name: p.first_name || null, title: p.title || null,
        company, email: null, email_available: !!p.has_email, apollo_id: p.id || null,
        linkedin: null,
      };
      // Reveal full name + email only when explicitly enriching (and one exists).
      if (enrich && p.has_email) {
        const e = await enrichPerson(env, p);
        if (e) {
          enriched++; credits++;
          rec.name = e.name || rec.name;
          rec.linkedin = e.linkedin_url || null;
          if (usableEmail(e.email)) rec.email = e.email;
        }
      }
      people.push(rec); found++;
      if (run && rec.email) {
        const id = await upsertLead(env, {
          source: "apollo", email: rec.email, name: rec.name || null, company: rec.company, domain: c.domain,
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
