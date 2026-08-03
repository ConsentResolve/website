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

// First non-empty scalar among the given key variants (the CR API uses several spellings —
// mirrors CR_Visitor_Record::from_contact in the WordPress plugin, the canonical field map).
function pick(v, ...keys) {
  for (const k of keys) { const x = v[k]; if (x !== undefined && x !== null && x !== "" && typeof x !== "object") return x; }
  return null;
}
function norm(v) {
  const email = String(pick(v, "email", "contact_email", "primary_email", "work_email") || "").toLowerCase().trim();
  const name = v.name || v.full_name || [v.first_name, v.last_name].filter(Boolean).join(" ") || "";
  const companyRaw = pick(v, "company_name", "organization") || (v.company && v.company.name) || v.company;
  const company = typeof companyRaw === "string" ? companyRaw : "";
  const source_url = pick(v, "source_url", "landing_page", "url") || "";
  const referrer = pick(v, "referrer", "referrer_url", "referring_url", "referring_domain", "ref") || "";
  let domain = pick(v, "domain", "company_domain", "website") || "";
  if (!domain && source_url) { try { domain = new URL(source_url).hostname.replace(/^www\./, ""); } catch (_) {} }
  return {
    email, name, company, domain,
    phone: pick(v, "phone", "phone_number") || null,
    city: pick(v, "city") || "", region: pick(v, "region", "state") || "", country: pick(v, "country", "country_code", "ip_country") || "",
    visits: pick(v, "total_visits", "visits", "visit_count", "sessions_count"),
    page_views: pick(v, "page_views", "pageviews", "page_view_count", "page_views_count"),
    first_seen: pick(v, "first_seen_at", "first_seen", "created_at") || "",
    last_seen: pick(v, "last_seen_at", "last_seen", "updated_at") || "",
    source_url, referrer,
    consent_method: pick(v, "method", "consent_method") || "",
    consent_status: pick(v, "status", "consent_status") || "",
  };
}
// Human-readable engagement summary stored on the lead (Last Seen · Referrer · Visits · Page Views · …).
function crNote(c) {
  const bits = [];
  if (c.company) bits.push(c.company);
  const loc = [c.city, c.region, c.country].filter(Boolean).join(", "); if (loc) bits.push(loc);
  if (c.visits != null) bits.push(c.visits + " visit" + (c.visits === 1 ? "" : "s"));
  if (c.page_views != null) bits.push(c.page_views + " page view" + (c.page_views === 1 ? "" : "s"));
  if (c.last_seen) bits.push("last seen " + c.last_seen);
  if (c.referrer || c.source_url) bits.push("via " + (c.referrer || c.source_url));
  return "Identified via Consent Resolve — " + (bits.join(" · ") || c.domain || "");
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
      company: c.company || null, domain: c.domain || null, phone: c.phone || null,
      consent_status: "identified", notes: crNote(c),
    });
    // Persist last-seen as the lead's activity time so the CRM sorts by real recency.
    if (c.last_seen) {
      const ls = /^\d+$/.test(String(c.last_seen)) ? new Date(Number(c.last_seen) * (String(c.last_seen).length <= 10 ? 1000 : 1)).toISOString() : c.last_seen;
      await env.DB.prepare("UPDATE crm_leads SET last_activity=? WHERE id=?").bind(ls, id).run().catch(() => {});
    }
    await addActivity(env, id, "identified", crNote(c), "consentresolve");
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
    return json({
      ok: true, sample: rows.length,
      available_fields: rows[0] ? Object.keys(rows[0]) : [],   // EVERY field the live API returns
      raw_contact: rows[0] || null,                             // the full first contact, verbatim
      mapped: rows[0] ? norm(rows[0]) : null,                   // how we normalize it into the CRM
      message: "Consent Resolve API key works.",
    }, {}, cors);
  }
  if (u.searchParams.get("run")) {
    const out = await runScheduledSync(env);
    return json({ ok: !out.error, ...out }, out.error ? { status: 502 } : {}, cors);
  }
  return json({ ok: true, usage: "?test=1 to verify the key, ?run=1 to import new identified visitors" }, {}, cors);
}
