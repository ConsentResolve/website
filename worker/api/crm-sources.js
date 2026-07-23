// worker/api/crm-sources.js  ->  GET /api/crm/sources
// Data-source transparency for Site Spy / Nurture: what's feeding the intent data,
// how much each contributes, how it's performing, and how to add more.
//   GET /api/crm/sources          -> registry + live stats
//   GET /api/crm/sources?sync=1   -> run the first-party site_visit pipeline now
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { syncSiteVisits, computeSources } from "../_lib/sitespy.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const url = new URL(request.url);
  if (url.searchParams.get("sync") === "1") {
    return json({ ok: true, sync: await syncSiteVisits(env, {}) }, {}, cors);
  }
  return json({ ok: true, ...(await computeSources(env)) }, {}, cors);
}
