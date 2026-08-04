// worker/api/signup-site-check.js
//   GET/POST /api/crm/signup/site-check?domain=<domain>
// Powers the Step-1 "Check My Site" button on /signup/. Runs the shared DataForSEO
// traffic estimate (worker/_lib/dataforseo.js -> dataforseoLookup, Domain Rank
// Overview) and reports whether the domain clears ~500 estimated monthly organic
// visits. Returns qualified:null (not a hard fail) whenever we genuinely can't tell
// — bad domain, DataForSEO unconfigured, or an API error — so the front end shows
// the self-affirm panel instead of blocking a real contractor.
import { json, corsHeaders } from "../_lib/http.js";
import { normDomain, dataforseoLookup, dfsConfigured, dfsAuth } from "../_lib/dataforseo.js";

// Raw one-shot probe (debug=2) — returns DataForSEO's own status so an empty result
// (no Labs subscription / zero balance / bad creds) is diagnosable without guessing.
async function dfsProbe(env, domain) {
  try {
    const r = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live", {
      method: "POST", headers: { Authorization: dfsAuth(env), "Content-Type": "application/json" },
      body: JSON.stringify([{ target: domain, location_code: 2840, language_code: "en" }]),
    });
    const j = await r.json().catch(() => ({}));
    const t = (j.tasks && j.tasks[0]) || {};
    return { http: r.status, api_status_code: j.status_code, api_status_message: j.status_message, task_status_code: t.status_code, task_status_message: t.status_message, cost: j.cost, result_count: (t.result && t.result.length) || 0 };
  } catch (e) { return { error: String(e).slice(0, 160) }; }
}

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
  if (url.searchParams.get("debug") === "2") return json({ ok: true, domain, probe: await dfsProbe(env, domain) }, {}, cors);

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
