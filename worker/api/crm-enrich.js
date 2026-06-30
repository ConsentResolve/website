// CRM v2 — on-demand Apollo enrichment (BUILD-PLAN P2-5, spec §10).
//   POST /api/crm/enrich { contact_id } -> matches the contact's email via Apollo
//   people/match, caches person on contacts.enrichment + org on companies.enrichment,
//   logs the enrich to activities (provenance). NEVER auto-on-arrival — button only,
//   to conserve Apollo credits and keep the consent-first brand clean.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, currentUser, adminUserId } from "../_lib/crm-v2.js";
import { enrichContactById } from "../_lib/apollo.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!env.APOLLO_API_KEY) return json({ error: "no_api_key", message: "Set APOLLO_API_KEY in Cloudflare." }, { status: 400 }, cors);
  await ensureCrmV2Schema(env);
  let b = {};
  try { b = await request.json(); } catch { return json({ error: "bad_json" }, { status: 400 }, cors); }
  if (!b.contact_id) return json({ error: "contact_id_required" }, { status: 400 }, cors);

  const me = await currentUser(request, env);
  const r = await enrichContactById(env, b.contact_id, { actorId: me ? me.id : await adminUserId(env) });
  if (r.error === "no_email") return json({ error: "no_email" }, { status: 400 }, cors);
  if (r.error === "not_found") return json({ error: "not_found" }, { status: 404 }, cors);
  if (r.error === "apollo_error") {
    const detail = r.status === 403
      ? "Your Apollo plan doesn't include the People Enrichment (match) API. Enable API access / upgrade the plan in Apollo, or use a key that has it."
      : (String((r.raw && (r.raw.error || r.raw.message)) || "").slice(0, 160) || ("Apollo error " + r.status));
    return json({ error: "apollo_error", status: r.status, detail }, { status: 200 }, cors);
  }
  if (!r.matched) return json({ ok: true, matched: false, note: r.org ? "Company enriched (no individual match)." : "No Apollo match for this email." }, {}, cors);
  return json({ ok: true, matched: true, person: r.person }, {}, cors);
}
