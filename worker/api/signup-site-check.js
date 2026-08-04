// worker/api/signup-site-check.js
//   GET/POST /api/crm/signup/site-check?domain=<domain>
// Powers the Step-1 "Check My Site" button on /signup/. Runs the shared DataForSEO
// traffic estimate (worker/_lib/dataforseo.js -> dataforseoLookup, Domain Rank
// Overview) and reports whether the domain clears ~500 estimated monthly organic
// visits. Returns qualified:null (not a hard fail) whenever we genuinely can't tell
// — bad domain, DataForSEO unconfigured, or an API error — so the front end shows
// the self-affirm panel instead of blocking a real contractor.
import { json, corsHeaders } from "../_lib/http.js";
import { normDomain, dataforseoLookup, dfsConfigured } from "../_lib/dataforseo.js";

const THRESHOLD = 500; // estimated monthly visitors to qualify

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

async function check({ request, env }) {
  const cors = corsHeaders(request, env);
  const url = new URL(request.url);
  let raw = url.searchParams.get("domain") || "";
  if (!raw && request.method === "POST") {
    const b = await request.json().catch(() => ({}));
    raw = b.domain || b.website || "";
  }
  const domain = normDomain(raw);
  if (!domain) return json({ ok: true, qualified: null, reason: "bad_domain" }, {}, cors);
  if (!dfsConfigured(env)) return json({ ok: true, qualified: null, reason: "unconfigured", domain }, {}, cors);

  const r = await dataforseoLookup(env, domain);
  const traffic = r && r.data ? r.data.traffic_month : null;
  // traffic===null -> couldn't estimate (treat as unknown, not a fail).
  const qualified = traffic == null ? null : traffic >= THRESHOLD;
  const out = { ok: true, domain, traffic, threshold: THRESHOLD, qualified, cost: r.cost || 0 };
  // ?debug=1 surfaces why a lookup came back empty (creds present? API error?).
  if (url.searchParams.get("debug") === "1") out._debug = { configured: dfsConfigured(env), used: r.used === true, error: r.error || null };
  return json(out, {}, cors);
}

export async function onRequestGet(ctx) { return check(ctx); }
export async function onRequestPost(ctx) { return check(ctx); }
