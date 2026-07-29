// Consent Resolve — Instantly "Website Visitors" -> CRM ingest.
//
// Instantly's Website Visitors product (app.instantly.ai/app/website-visitors) is
// another person-level visitor-ID source, like Apollo Websites / RB2B. This pulls
// those identified visitors via GET /api/v2/website-visitors and upserts them as
// CRM leads (source "instantly", identified) so they land in Site Spy alongside the
// others. Requires the INSTANTLY_API_KEY to have the Website Visitors scope.
//
//   GET /api/crm/instantly/visitors?test=1  -> auth check
//   GET /api/crm/instantly/visitors?raw=1   -> dump the raw response shape (no writes)
//   GET /api/crm/instantly/visitors?run=1   -> import new identified visitors
//
// Also runs on the */5 cron via runScheduledSync(). No-op without the key.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, upsertLead, addActivity, ensureCrmSchema } from "../_lib/crm.js";

const BASE = "https://api.instantly.ai/api/v2";
// Instantly sits behind Cloudflare and 403/1010s non-browser UAs.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function instGet(env, path) {
  const r = await fetch(BASE + path, {
    headers: { Authorization: "Bearer " + String(env.INSTANTLY_API_KEY || "").trim(), Accept: "application/json", "User-Agent": UA },
  });
  let body = null; try { body = await r.json(); } catch (_) {}
  return { status: r.status, ok: r.ok, body };
}

// Best-effort across the shapes Instantly might return (person- or company-level).
function normalize(v) {
  const email = String(v.email || v.work_email || v.contact_email || v.business_email || "").toLowerCase().trim();
  const name =
    v.name || v.full_name ||
    [v.first_name || v.firstName, v.last_name || v.lastName].filter(Boolean).join(" ") || "";
  const org = v.organization || v.company || {};
  const company = v.company_name || v.companyName || (typeof org === "object" ? org.name : org) || (typeof v.company === "string" ? v.company : "");
  const domain = String(v.domain || v.company_domain || v.companyDomain || v.website || v.website_url || (typeof org === "object" ? org.domain : "") || "")
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
  const title = v.title || v.job_title || v.jobTitle || "";
  const linkedin = v.linkedin_url || v.linkedin || v.linkedinUrl || "";
  return { email, name, company: typeof company === "string" ? company : "", domain, title, linkedin };
}

async function fetchVisitors(env, want) {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < 5; page++) {
    const qs = new URLSearchParams({ limit: String(Math.min(100, Math.max(want, 20))) });
    if (cursor) qs.set("starting_after", cursor);
    const r = await instGet(env, "/website-visitors?" + qs.toString());
    if (!r.ok) return { error: `API ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`, status: r.status };
    const batch = (r.body && (r.body.items || r.body.data || r.body.visitors)) || (Array.isArray(r.body) ? r.body : []);
    rows.push(...batch);
    cursor = (r.body && (r.body.next_starting_after || r.body.next_cursor)) || null;
    if (!cursor || !batch.length || rows.length >= want) break;
  }
  return { rows };
}

export async function runScheduledSync(env) {
  if (!env.DB || !env.INSTANTLY_API_KEY) return { skipped: "not_configured" };
  await ensureCrmSchema(env);
  const got = await fetchVisitors(env, 100);
  if (got.error) return { error: got.error };
  let synced = 0, skipped = 0, noEmail = 0;
  for (const v of (got.rows || [])) {
    const c = normalize(v);
    if (!c.email || !c.email.includes("@")) { noEmail++; continue; }
    const existing = await env.DB.prepare("SELECT id FROM crm_leads WHERE email=?").bind(c.email).first();
    if (existing) { skipped++; continue; }
    const id = await upsertLead(env, {
      source: "instantly", email: c.email, name: c.name || null, company: c.company || null,
      domain: c.domain || null, consent_status: "identified",
      notes: [c.title, c.domain ? "Visited · " + c.domain : "", c.linkedin ? "LinkedIn: " + c.linkedin : ""].filter(Boolean).join(" · ") || null,
    });
    await addActivity(env, id, "identified", "Identified via Instantly (website visitor)" + (c.company ? " · " + c.company : ""), "instantly");
    synced++;
  }
  return { synced, skipped, noEmail, scanned: (got.rows || []).length };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!env.INSTANTLY_API_KEY) return json({ ok: false, error: "no_key", message: "INSTANTLY_API_KEY not set." }, { status: 400 }, cors);
  const q = new URL(request.url).searchParams;

  if (q.get("test")) {
    const r = await instGet(env, "/website-visitors?limit=1");
    return json({ ok: r.ok, status: r.status, message: r.ok ? "Website Visitors scope OK." : "Not authorized — " + JSON.stringify(r.body).slice(0, 120) }, {}, cors);
  }
  if (q.get("raw")) {
    const r = await instGet(env, "/website-visitors?limit=3");
    const arr = (r.body && (r.body.items || r.body.data || r.body.visitors)) || (Array.isArray(r.body) ? r.body : []);
    return json({ ok: r.ok, status: r.status, topKeys: r.body ? Object.keys(r.body).slice(0, 12) : null, count: arr.length, firstKeys: arr[0] ? Object.keys(arr[0]) : null, sample: arr.slice(0, 2) }, {}, cors);
  }
  if (q.get("run")) {
    const out = await runScheduledSync(env);
    return json({ ok: !out.error, ...out }, out.error ? { status: 502 } : {}, cors);
  }
  return json({ ok: true, usage: "?test=1 auth check · ?raw=1 inspect shape · ?run=1 import" }, {}, cors);
}
