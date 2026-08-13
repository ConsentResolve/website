// worker/api/signup-site-check.js
//   GET/POST /api/crm/signup/site-check?domain=<domain>
// Powers the Step-1 "Check My Site" button on /signup/. Runs the shared DataForSEO
// traffic estimate (worker/_lib/dataforseo.js -> dataforseoLookup, Domain Rank
// Overview) and reports whether the domain clears ~500 estimated monthly organic
// visits. Returns qualified:null (not a hard fail) whenever we genuinely can't tell
// — bad domain, DataForSEO unconfigured, or an API error — so the front end shows
// the self-affirm panel instead of blocking a real contractor.
//
// This endpoint is public and each live lookup costs ~$0.012. Two guards keep that
// in check: an in-memory result cache (same domain within CACHE_TTL is free) and a
// single retry only on a TRANSIENT empty (null result WITH cost 0 — a real "no data"
// answer bills and is not retried). It does NOT write to the CRM/D1.
import { json, corsHeaders } from "../_lib/http.js";
import { normDomain, dataforseoLookup, dfsConfigured } from "../_lib/dataforseo.js";

const THRESHOLD = 500;             // estimated monthly visitors to qualify
const CACHE_TTL = 6 * 3600 * 1000; // 6h — traffic estimates barely move day to day
const cache = new Map();           // domain -> { at, payload }  (per-isolate, best-effort)

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

async function estimate(env, domain) {
  let r = await dataforseoLookup(env, domain);
  let traffic = r && r.data ? r.data.traffic_month : null;
  // Retry ONCE only on a transient empty (null + no charge). A genuine "no data"
  // response is billed (cost > 0) and left as unknown rather than re-billed.
  if (traffic == null && (r.cost || 0) === 0 && r.used !== false) {
    r = await dataforseoLookup(env, domain);
    traffic = r && r.data ? r.data.traffic_month : null;
  }
  return { traffic, cost: r.cost || 0, used: r.used === true, error: r.error || null };
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

  // Serve a fresh cached verdict without re-billing DataForSEO.
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < CACHE_TTL) return json({ ...hit.payload, cached: true }, {}, cors);

  const e = await estimate(env, domain);
  const qualified = e.traffic == null ? null : e.traffic >= THRESHOLD;
  const payload = { ok: true, domain, traffic: e.traffic, threshold: THRESHOLD, qualified };
  // Only cache a definitive verdict — never a transient/unknown, so a flaky empty
  // isn't pinned for 6h.
  if (qualified !== null) cache.set(domain, { at: Date.now(), payload });

  const out = { ...payload, cost: e.cost };
  if (url.searchParams.get("debug") === "1") out._debug = { configured: dfsConfigured(env), used: e.used, error: e.error };
  return json(out, {}, cors);
}

export async function onRequestGet(ctx) { return check(ctx); }
export async function onRequestPost(ctx) { return check(ctx); }
