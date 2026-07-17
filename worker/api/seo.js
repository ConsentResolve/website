// SEO performance API — Search Console + GA4 (read-only) + IndexNow submit.
// Gated like the CRM: admin session OR CRM Google session OR ?key=<CRM_KEY>.
//   GET  /api/seo/overview  -> KPIs (28d vs prior 28d) + daily trend + GA4 sessions/conv
//   GET  /api/seo/queries   -> top search queries (clicks/impr/ctr/position)
//   GET  /api/seo/pages     -> top pages + biggest movers (28d vs prior)
//   POST /api/seo/indexnow  -> submit sitemap URLs to IndexNow (Bing/Yandex)
import { json } from "../_lib/http.js";
import { isAuthed, crmSessionEmail } from "../_lib/auth.js";
import { crmKey } from "./crm-leads.js";
import { gscConfigured, ga4Configured, gscQuery, ga4Report, ymd } from "../_lib/google-sa.js";

async function gate(request, env) {
  const url = new URL(request.url);
  if (env && url.searchParams.get("key") && url.searchParams.get("key") === crmKey(env)) return true;
  return (await isAuthed(request, env)) || (await crmSessionEmail(request, env));
}

const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
const ctr = (c, i) => (i ? c / i : 0);

async function overview(env) {
  const out = { gscConfigured: gscConfigured(env), ga4Configured: ga4Configured(env) };
  if (gscConfigured(env)) {
    try {
      // GSC data lags ~2-3 days; use 3..31 days ago as "last 28d", 31..59 as prior.
      const cur = await gscQuery(env, { startDate: ymd(31), endDate: ymd(3), rowLimit: 1 });
      const prev = await gscQuery(env, { startDate: ymd(59), endDate: ymd(32), rowLimit: 1 });
      const trend = await gscQuery(env, { startDate: ymd(31), endDate: ymd(3), dimensions: ["date"], rowLimit: 60 });
      const c = (cur.rows && cur.rows[0]) || {}; const p = (prev.rows && prev.rows[0]) || {};
      out.gsc = {
        clicks: c.clicks || 0, impressions: c.impressions || 0, ctr: c.ctr || 0, position: c.position || 0,
        prev: { clicks: p.clicks || 0, impressions: p.impressions || 0, ctr: p.ctr || 0, position: p.position || 0 },
        trend: (trend.rows || []).map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
      };
    } catch (e) { out.gscError = String(e.message || e); }
  }
  if (ga4Configured(env)) {
    try {
      const rep = await ga4Report(env, {
        dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }, { startDate: "56daysAgo", endDate: "29daysAgo" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }],
        dimensions: [{ name: "dateRange" }],
      });
      const g = {}; (rep.rows || []).forEach((r) => {
        const which = r.dimensionValues[0].value; // date_range_0 (current) / date_range_1 (prev)
        const o = { sessions: +r.metricValues[0].value, users: +r.metricValues[1].value, keyEvents: +r.metricValues[2].value };
        if (which.endsWith("_0")) g.cur = o; else g.prev = o;
      });
      out.ga4 = { cur: g.cur || {}, prev: g.prev || {} };
    } catch (e) { out.ga4Error = String(e.message || e); }
  }
  return out;
}

async function queries(env) {
  if (!gscConfigured(env)) return { gscConfigured: false };
  const r = await gscQuery(env, { startDate: ymd(31), endDate: ymd(3), dimensions: ["query"], rowLimit: 100 });
  return { gscConfigured: true, rows: (r.rows || []).map((x) => ({ q: x.keys[0], clicks: x.clicks, impressions: x.impressions, ctr: x.ctr, position: x.position })) };
}

async function pages(env) {
  if (!gscConfigured(env)) return { gscConfigured: false };
  const cur = await gscQuery(env, { startDate: ymd(31), endDate: ymd(3), dimensions: ["page"], rowLimit: 200 });
  const prev = await gscQuery(env, { startDate: ymd(59), endDate: ymd(32), dimensions: ["page"], rowLimit: 200 });
  const pmap = {}; (prev.rows || []).forEach((r) => (pmap[r.keys[0]] = r.clicks));
  const rows = (cur.rows || []).map((x) => ({ page: x.keys[0], clicks: x.clicks, impressions: x.impressions, ctr: x.ctr, position: x.position, delta: (x.clicks - (pmap[x.keys[0]] || 0)) }));
  const movers = [...rows].sort((a, b) => b.delta - a.delta);
  return { gscConfigured: true, rows: rows.sort((a, b) => b.clicks - a.clicks).slice(0, 100), gainers: movers.slice(0, 8), losers: movers.slice(-8).reverse() };
}

// IndexNow: fetch our sitemap-index -> all page URLs -> submit to IndexNow.
async function indexnowSubmit(env, origin, only) {
  const key = env.INDEXNOW_KEY;
  if (!key) return { ok: false, error: "INDEXNOW_KEY not set" };
  const host = new URL(origin).host;
  let urls = only && only.length ? only : [];
  if (!urls.length) {
    try {
      const idx = await (await fetch(`${origin}/sitemap-index.xml`)).text();
      const children = [...idx.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
      const sitemaps = children.filter((u) => u.endsWith(".xml"));
      if (!sitemaps.length) urls = children.filter((u) => u.startsWith("http"));
      for (const sm of sitemaps) {
        const body = await (await fetch(sm)).text();
        urls.push(...[...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith("http") && !u.endsWith(".xml")));
      }
      urls = [...new Set(urls)];
    } catch (e) { return { ok: false, error: "sitemap fetch: " + String(e.message || e) }; }
  }
  if (!urls.length) return { ok: false, error: "no URLs" };
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: urls.slice(0, 10000) }),
  });
  return { ok: r.status === 200 || r.status === 202, status: r.status, submitted: Math.min(urls.length, 10000) };
}

export async function onRequestGet({ request, env }) {
  if (!(await gate(request, env))) return json({ error: "unauthorized" }, { status: 401 });
  const path = new URL(request.url).pathname;
  try {
    if (path.endsWith("/overview")) return json(await overview(env));
    if (path.endsWith("/queries")) return json(await queries(env));
    if (path.endsWith("/pages")) return json(await pages(env));
    return json({ error: "not_found" }, { status: 404 });
  } catch (e) {
    return json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await gate(request, env))) return json({ error: "unauthorized" }, { status: 401 });
  const origin = env.SITE_URL || new URL(request.url).origin;
  let body = {};
  try { body = await request.json(); } catch {}
  const res = await indexnowSubmit(env, origin.replace(/\/$/, ""), body.urls);
  return json(res);
}
