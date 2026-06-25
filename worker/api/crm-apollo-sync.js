// Apollo API sync — pulls contacts Apollo saved from website visitors into the CRM.
// (Apollo has no visitors API; route identified "Visited people" into an Apollo
// Contacts list, then this reads that list via POST /api/v1/contacts/search.)
//   GET /api/crm/apollo/sync?test=1  -> verify APOLLO_API_KEY + plan access
//   GET /api/crm/apollo/sync?run=1   -> import contacts (label-filtered) as apollo/identified leads
// Gated by the CRM session/key. Run requires APOLLO_CONTACTS_LABEL (or ?label=)
// so we never import the entire Apollo contact DB.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, upsertLead, addActivity } from "../_lib/crm.js";

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
  const label = env.APOLLO_CONTACTS_LABEL || url.searchParams.get("label") || "";
  if (!label) return json({ ok: false, error: "no_label", message: "Set APOLLO_CONTACTS_LABEL (the Apollo Contacts list your website visitors are added to), or pass ?label=." }, { status: 400 }, cors);

  let synced = 0, skipped = 0, pages = 0;
  for (let page = 1; page <= 8; page++) {
    const r = await apolloSearch(env, page, 25, { contact_label_names: [label] });
    if (r.status !== 200) return json({ ok: false, status: r.status, synced, error: errOf(r) }, {}, cors);
    const contacts = (r.data && r.data.contacts) || [];
    if (!contacts.length) break;
    pages++;
    for (const c of contacts) {
      const email = (c.email || "").toLowerCase();
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.name || "";
      const company = (c.organization && c.organization.name) || c.account_name || c.organization_name || "";
      if (!email && !name && !company) { skipped++; continue; }
      const id = await upsertLead(env, { source: "apollo", email: email || null, name, company, consent_status: "identified", notes: c.linkedin_url ? "LinkedIn: " + c.linkedin_url : null });
      await addActivity(env, id, "identified", "Synced from Apollo" + (company ? " · " + company : ""), "apollo");
      synced++;
    }
    const totalPages = (r.data && r.data.pagination && r.data.pagination.total_pages) || 1;
    if (page >= totalPages) break;
  }
  return json({ ok: true, synced, skipped, pages, label }, {}, cors);
}
