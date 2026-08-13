// Apollo enrichment — shared by the on-demand button (crm-enrich.js) and the
// credit-gated auto-enrich cron sweep. People Match (person) + Organization Enrich
// (company by domain, as a fallback when the match has no org). Results cache on
// contacts.enrichment / companies.enrichment so we never pay for the same record twice.
import { FREE_EMAIL_DOMAINS, emailDomain, addActivityV2 } from "./crm-v2.js";

// Trailing newline in the secret (common with `security ... -w | wrangler secret put`)
// makes a valid Apollo key 401 — always trim before use.
const apolloKey = (env) => String(env.APOLLO_API_KEY || "").trim();

export async function apolloMatch(env, email) {
  const res = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-cache", "X-Api-Key": apolloKey(env) },
    body: JSON.stringify({ email, reveal_personal_emails: false }),
  });
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, person: j.person || null, raw: j };
}

export async function apolloOrgEnrich(env, domain) {
  const res = await fetch("https://api.apollo.io/api/v1/organizations/enrich?domain=" + encodeURIComponent(domain), {
    headers: { Accept: "application/json", "Cache-Control": "no-cache", "X-Api-Key": apolloKey(env) },
  });
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, organization: j.organization || null };
}

// Enrich one contact (person + org). Caches results; marks no-match so the sweep won't
// re-spend credits on it. Returns { ok, matched, person, org, status, error }.
export async function enrichContactById(env, contactId, opts = {}) {
  if (!env.APOLLO_API_KEY) return { ok: false, error: "no_api_key" };
  const contact = await env.DB.prepare("SELECT * FROM contacts WHERE id=?").bind(contactId).first();
  if (!contact) return { ok: false, error: "not_found" };
  if (!contact.primary_email) return { ok: false, error: "no_email" };

  const m = await apolloMatch(env, contact.primary_email);
  if (!m.ok) return { ok: false, error: "apollo_error", status: m.status, raw: m.raw };

  const p = m.person;
  let org = p && p.organization ? p.organization : null;
  const dom = emailDomain(contact.primary_email);
  // #3 — always get company intel: if the match carried no org but it's a business
  // domain, enrich the organization by domain.
  if (!org && dom && !FREE_EMAIL_DOMAINS.has(dom)) {
    const oe = await apolloOrgEnrich(env, dom);
    if (oe.ok && oe.organization) org = oe.organization;
  }

  if (!p && !org) {
    await env.DB.prepare("UPDATE contacts SET enrichment=?, updated_at=datetime('now') WHERE id=?")
      .bind(JSON.stringify({ _nomatch: true, at: new Date().toISOString() }), contact.id).run();
    return { ok: true, matched: false };
  }

  if (p) {
    const phone = (p.phone_numbers && p.phone_numbers[0] && (p.phone_numbers[0].sanitized_number || p.phone_numbers[0].raw_number)) || null;
    await env.DB.prepare(
      "UPDATE contacts SET enrichment=?, title=COALESCE(?, title), phone=COALESCE(phone, ?), apollo_person_id=?, full_name=COALESCE(full_name, ?), updated_at=datetime('now') WHERE id=?"
    ).bind(JSON.stringify(p), p.title || null, phone, p.id || null, p.name || null, contact.id).run();
  } else {
    // org-only result — mark the contact so the sweep doesn't re-spend on the person match.
    await env.DB.prepare("UPDATE contacts SET enrichment=?, updated_at=datetime('now') WHERE id=?")
      .bind(JSON.stringify({ _orgonly: true, at: new Date().toISOString() }), contact.id).run();
  }
  if (org && contact.company_id) {
    await env.DB.prepare(
      "UPDATE companies SET enrichment=?, apollo_org_id=COALESCE(?, apollo_org_id), domain=COALESCE(domain, ?), name=COALESCE(name, ?), updated_at=datetime('now') WHERE id=?"
    ).bind(JSON.stringify(org), org.id || null, org.primary_domain || null, org.name || null, contact.company_id).run();
  }
  try { await addActivityV2(env, { actorId: opts.actorId || null, entityType: "contact", entityId: contact.id, action: "enriched", meta: { source: "apollo", auto: !!opts.auto } }); } catch (_) {}
  return { ok: true, matched: !!p, person: p || null, org: org || null };
}

// #2 + #5 — credit-gated auto-enrich: newest un-enriched BUSINESS-email contacts only
// (free-email is skipped — low match value, wasted credits), capped per run.
export async function autoEnrichSweep(env, { limit = 8 } = {}) {
  if (!env.DB || !env.APOLLO_API_KEY) return { enriched: 0, scanned: 0 };
  const rows = (await env.DB.prepare(
    "SELECT id, primary_email FROM contacts WHERE enrichment IS NULL AND primary_email IS NOT NULL ORDER BY created_at DESC LIMIT 80"
  ).all()).results || [];
  let enriched = 0, scanned = 0;
  for (const c of rows) {
    const dom = emailDomain(c.primary_email);
    if (!dom || FREE_EMAIL_DOMAINS.has(dom)) continue; // business email only
    const r = await enrichContactById(env, c.id, { auto: true });
    scanned++;
    if (r.ok && (r.matched || r.org)) enriched++;
    if (scanned >= limit) break; // bound Apollo credits per run
  }
  return { enriched, scanned };
}
