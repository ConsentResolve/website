// Apollo API sync — pulls contacts Apollo saved from website visitors into the CRM.
// (Apollo has no visitors API; route identified "Visited people" into an Apollo
// Contacts list, then this reads that list via POST /api/v1/contacts/search.)
//   GET /api/crm/apollo/sync?test=1  -> verify APOLLO_API_KEY + plan access
//   GET /api/crm/apollo/sync?run=1   -> import contacts (label-filtered) as apollo/identified leads
// Gated by the CRM session/key. Run requires APOLLO_CONTACTS_LABEL (or ?label=)
// so we never import the entire Apollo contact DB.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, upsertLead, addActivity, ensureCrmSchema } from "../_lib/crm.js";

async function apolloSearch(env, page, perPage, extra) {
  const body = Object.assign({ api_key: env.APOLLO_API_KEY, page: page || 1, per_page: perPage || 25 }, extra || {});
  const res = await fetch("https://api.apollo.io/api/v1/contacts/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-cache", "X-Api-Key": env.APOLLO_API_KEY },
    body: JSON.stringify(body),
  });
  let data = null; try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}
const errOf = (r) => (r.data && (r.data.error || r.data.message || r.data.error_message)) || ("http_" + r.status);

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!env.APOLLO_API_KEY) return json({ ok: false, error: "no_api_key", message: "Set APOLLO_API_KEY as a Cloudflare secret." }, { status: 400 }, cors);
  const url = new URL(request.url);

  if (url.searchParams.get("test")) {
    const r = await apolloSearch(env, 1, 1);
    if (r.status !== 200) return json({ ok: false, status: r.status, error: errOf(r), detail: JSON.stringify(r.data).slice(0, 300) }, {}, cors);
    const total = (r.data && r.data.pagination && r.data.pagination.total_entries) || 0;
    return json({ ok: true, status: 200, total_contacts: total, message: "Apollo API key works." }, {}, cors);
  }

  // Real sync (label-scoped, so we don't pull the whole DB).
  // Apollo filters by label ID (not name) via contact_label_ids — so this must be the LIST ID.
  const label = env.APOLLO_CONTACTS_LABEL || url.searchParams.get("label") || "";
  if (!label) return json({ ok: false, error: "no_label", message: "Set APOLLO_CONTACTS_LABEL to your Apollo visitors-list ID (from the list URL), or pass ?label=<id>." }, { status: 400 }, cors);
  const out = await doSync(env, label);
  return json(out, out.ok ? {} : { status: out.status || 502 }, cors);
}

// Incremental sync: pull the visitors list, insert ONLY new emails (dedup against
// existing leads). Existing visitors are left untouched — so a frequent cron adds
// no activity-log churn and doesn't re-float known leads. Returns a plain result.
async function doSync(env, label) {
  await ensureCrmSchema(env);
  const existing = new Set();
  try {
    const r0 = await env.DB.prepare("SELECT email FROM crm_leads WHERE email IS NOT NULL").all();
    for (const row of r0.results || []) existing.add(String(row.email).toLowerCase());
  } catch (_) {}

  let synced = 0, skipped = 0, pages = 0;
  for (let page = 1; page <= 8; page++) {
    const r = await apolloSearch(env, page, 25, { contact_label_ids: [label] });
    if (r.status !== 200) return { ok: false, status: r.status, synced, error: errOf(r) };
    const contacts = (r.data && r.data.contacts) || [];
    if (!contacts.length) break;
    pages++;
    for (const c of contacts) {
      const email = (c.email || "").toLowerCase();
      if (!email || existing.has(email)) { skipped++; continue; } // only genuinely new contacts
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.name || "";
      const company = (c.organization && c.organization.name) || c.account_name || c.organization_name || "";
      const id = await upsertLead(env, { source: "apollo", email, name, company, consent_status: "identified", notes: c.linkedin_url ? "LinkedIn: " + c.linkedin_url : null });
      await addActivity(env, id, "identified", "Synced from Apollo" + (company ? " · " + company : ""), "apollo");
      existing.add(email);
      synced++;
    }
    const totalPages = (r.data && r.data.pagination && r.data.pagination.total_pages) || 1;
    if (page >= totalPages) break;
  }
  return { ok: true, synced, skipped, pages, label };
}

// Called from the scheduled() cron in index.js. No-op until both the API key and
// the visitors-list label are configured.
export async function runScheduledSync(env) {
  if (!env.APOLLO_API_KEY || !env.APOLLO_CONTACTS_LABEL) return { ok: false, skipped: "unconfigured" };
  return doSync(env, env.APOLLO_CONTACTS_LABEL);
}
