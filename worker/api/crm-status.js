// CRM Status page data — GET /api/crm/status (CRM-gated).
// API-connection health per integration + the last published post + the next
// queued post. Channel "connected" is inferred from social/metrics.json (the
// fetcher pulling for that platform); worker-native integrations are checked in D1/env.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";

const R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev";
const CHLABEL = { yt: "YouTube", ig: "Instagram", fb: "Facebook", tk: "TikTok", li: "LinkedIn", x: "X" };
const PLABEL = { x: "X", google_business_profile: "GBP", linkedin_company: "LinkedIn", linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
const ts = (s) => (s ? String(s).replace("T", " ").slice(0, 16) : "");

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  const first = async (sql) => { try { return await env.DB.prepare(sql).first(); } catch { return null; } };
  const all = async (sql) => { try { const r = await env.DB.prepare(sql).all(); return r.results || []; } catch { return []; } };

  // Social channels — connected = the fetcher is pulling posts for them.
  let metrics = [];
  try { const r = await fetch(`${R2}/social/metrics.json`); if (r.ok) metrics = await r.json(); } catch (_) {}
  const counts = {};
  for (const m of metrics) counts[m.platform] = (counts[m.platform] || 0) + 1;
  const integrations = [];
  for (const code of ["yt", "ig", "fb", "tk", "li", "x"]) {
    const n = counts[code] || 0;
    integrations.push({ key: code, label: CHLABEL[code], connected: n > 0, detail: n ? `${n} posts pulled` : "no data — check token" });
  }
  // Worker-native integrations (D1 / env).
  const xtok = await first("SELECT 1 c FROM social_tokens WHERE provider='x' LIMIT 1");
  integrations.push({ key: "x_post", label: "X (posting)", connected: !!xtok, detail: xtok ? "OAuth token in D1" : "not connected" });
  const gmail = await all("SELECT provider FROM social_tokens WHERE provider LIKE 'gmail:%'");
  integrations.push({ key: "gmail", label: "Gmail", connected: gmail.length > 0, detail: gmail.length ? `${gmail.length} account(s)` : "not connected" });
  integrations.push({ key: "apollo", label: "Apollo", connected: !!env.APOLLO_API_KEY, detail: env.APOLLO_API_KEY ? "API key set" : "no APOLLO_API_KEY" });
  const gbp = await first("SELECT 1 c FROM social_tokens WHERE provider='google_business_profile' LIMIT 1");
  integrations.push({ key: "gbp", label: "Google Business Profile", connected: gbp ? true : null, detail: gbp ? "connected" : "pending API approval" });

  // Last published + next queued post.
  const lp = await first("SELECT platform, resource_slug, post_url, published_at FROM social_queue WHERE status='published' AND published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1");
  const np = await first("SELECT platform, resource_slug, scheduled_at, status FROM social_queue WHERE status IN ('scheduled','ready_to_publish') ORDER BY COALESCE(scheduled_at, created_at) ASC LIMIT 1");

  return json({
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    integrations,
    lastPost: lp ? { platform: PLABEL[lp.platform] || lp.platform, name: lp.resource_slug, url: lp.post_url || "", at: ts(lp.published_at) } : null,
    nextPost: np ? { platform: PLABEL[np.platform] || np.platform, name: np.resource_slug, at: ts(np.scheduled_at) || np.status, url: "" } : null,
  }, {}, cors);
}
