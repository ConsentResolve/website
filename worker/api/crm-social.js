// GET /api/crm/social -> { posts:[{platform,status,resource_slug,post_url,at}] }
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, socialCalendar } from "../_lib/crm.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  return json({ posts: await socialCalendar(env) }, {}, cors);
}
