// Consent Resolve — "our own" visitor-ID -> CRM ingest.
//
// Pulls identity-resolved contacts from OUR OWN Consent Resolve public API
// (the same api.consentresolve.com/api/v1/public that outreach.js reads) and
// writes them into the CRM as leads (source "consentresolve", identified).
//
// Endpoints (gated by the CRM session/key):
//   GET /api/crm/cr/sync?test=1  -> verify CR_API_KEY + show the contact shape
//   GET /api/crm/cr/sync?run=1   -> import new identified visitors as leads
//
// Also runs on the */5 cron via runScheduledSync(). No-op until CR_API_KEY is set.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, upsertLead, addActivity, ensureCrmSchema } from "../_lib/crm.js";

const API_BASE = "https://api.consentresolve.com/api/v1/public";
// Site id the public API expects for consentresolve.com (verified 200 w/ live contacts
// in outreach.js). Override per-site with CR_SITE_ID.
const SITE_ID_DEFAULT = "d037027c-3647-43ed-b069-5126df08faec";

async function fetchContacts(env, want) {
  const key = String(env.CR_API_KEY || "").trim();
  if (!key) return { error: "CR_API_KEY not set on the worker" };
  const siteId = env.CR_SITE_ID || SITE_ID_DEFAULT;
  const rows = [];
  let cursor = null;
  // Page until we have enough (dedupe happens after), capped to stay well inside
  // the 60 req/min public-API limit.
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({ limit: String(Math.min(200, Math.max(want, 50))) });
    if (cursor) qs.set("cursor", cursor);
    const r = await fetch(`${API_BASE}/sites/${siteId}/contacts?${qs}`, {
      headers: { "X-API-Key": key, Accept: "application/json" },
    });
    const body = await r.text();
    if (!r.ok) return { error: `API ${r.status}: ${body.slice(0, 200)}`, status: r.status };
    let d; try { d = JSON.parse(body); } catch { return { error: "non-JSON from API" }; }
    const batch = d.contacts || d.data || d.results || (Array.isArray(d) ? d : []);
    rows.push(...batch);
    cursor = d.cursor || d.next_cursor || (d.meta && d.meta.cursor) || null;
    if (!cursor || !batch.length || rows.length >= want) break;
  }
  return { rows };
}

function norm(v) {
  const email = String(v.email || v.contact_email || v.primary_email || "").toLowerCase().trim();
  const name =
    v.name || v.full_name ||
    [v.first_name, v.last_name].filter(Boolean).join(" ") || "";
  const company = v.company_name || (v.company && v.company.name) || v.company || "";
  const domain = v.domain || v.company_domain || v.website || "";
  return { email, name, company: typeof company === "string" ? company : "", domain };
}

// Incremental: insert ONLY new emails, so a frequent cron adds no activity churn
// and doesn't re-float known leads.
export async function runScheduledSync(env) {
  if (!env.DB) return { skipped: "no_db" };
  if (!env.CR_API_KEY) return { skipped: "no_cr_api_key" };
  await ensureCrmSchema(env);
  const got = await fetchContacts(env, 200);
  if (got.error) return { error: got.error };
  const rows = got.rows || [];
  let synced = 0, skipped = 0;
  for (const v of rows) {
    const c = norm(v);
    if (!c.email || !c.email.includes("@")) { skipped++; continue; }
    const existing = await env.DB.prepare("SELECT id FROM crm_leads WHERE email=?").bind(c.email).first();
    if (existing) { skipped++; continue; }
    const id = await upsertLead(env, {
      source: "consentresolve", email: c.email, name: c.name || null,
      company: c.company || null, domain: c.domain || null, consent_status: "identified",
      notes: c.domain ? "Identified visitor · " + c.domain : null,
    });
    await addActivity(env, id, "identified", "Identified via Consent Resolve" + (c.company ? " · " + c.company : ""), "consentresolve");
    synced++;
  }
  return { synced, skipped, scanned: rows.length };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!env.CR_API_KEY) {
    return json({ ok: false, error: "no_api_key", message: "Set CR_API_KEY as a Cloudflare secret (your Consent Resolve public API key)." }, { status: 400 }, cors);
  }
  const u = new URL(request.url);
  if (u.searchParams.get("test")) {
    const got = await fetchContacts(env, 3);
    if (got.error) return json({ ok: false, error: got.error }, {}, cors);
    const rows = got.rows || [];
    return json({ ok: true, sample: rows.length, shape: rows[0] ? Object.keys(rows[0]) : [], message: "Consent Resolve API key works." }, {}, cors);
  }
  if (u.searchParams.get("run")) {
    const out = await runScheduledSync(env);
    return json({ ok: !out.error, ...out }, out.error ? { status: 502 } : {}, cors);
  }
  return json({ ok: true, usage: "?test=1 to verify the key, ?run=1 to import new identified visitors" }, {}, cors);
}
