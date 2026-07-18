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
import { aeoSummary } from "../_lib/aeo.js";

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
      // With 2 dateRanges and no dimensions, GA4 auto-appends a `dateRange`
      // dimension column ("date_range_0" = current, "date_range_1" = prior).
      const rep = await ga4Report(env, {
        dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }, { startDate: "56daysAgo", endDate: "29daysAgo" }],
        metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }],
      });
      const g = {}; (rep.rows || []).forEach((r) => {
        const which = (r.dimensionValues && r.dimensionValues[0] && r.dimensionValues[0].value) || "date_range_0";
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
  // Read static files via the ASSETS binding — a plain fetch() of our own zone
  // loops back through the Worker and comes back empty (Cloudflare same-zone).
  const getText = async (u) => {
    const path = u.startsWith("http") ? new URL(u).pathname : u;
    try {
      const req = new Request(origin + path);
      const r = env.ASSETS ? await env.ASSETS.fetch(req) : await fetch(req);
      return r.ok ? await r.text() : "";
    } catch { return ""; }
  };
  let urls = only && only.length ? only : [];
  if (!urls.length) {
    const idx = await getText("/sitemap-index.xml");
    const children = [...idx.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    const sitemaps = children.filter((u) => u.endsWith(".xml"));
    if (!sitemaps.length) urls = children.filter((u) => u.startsWith("http"));
    for (const sm of sitemaps) {
      const body = await getText(sm);
      urls.push(...[...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith("http") && !u.endsWith(".xml")));
    }
    urls = [...new Set(urls)];
    if (!urls.length) return { ok: false, error: "no URLs (sitemap-index empty via ASSETS)" };
  }
  if (!urls.length) return { ok: false, error: "no URLs" };

  // Only submit URLs we haven't sent before (IndexNow wants new/changed URLs, not
  // the whole sitemap every time — resubmitting the same list gets throttled 429).
  // `force` (or an explicit `only` list) bypasses the dedupe.
  let toSubmit = urls;
  if (env.DB && !force && !(only && only.length)) {
    try {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS indexnow_log (url TEXT PRIMARY KEY, submitted_at TEXT)").run();
      const seen = new Set(((await env.DB.prepare("SELECT url FROM indexnow_log").all()).results || []).map((r) => r.url));
      toSubmit = urls.filter((u) => !seen.has(u));
    } catch {}
  }
  if (!toSubmit.length) return { ok: true, submitted: 0, note: "all URLs already submitted — nothing new" };

  const batch = toSubmit.slice(0, 10000);
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation: `${origin}/${key}.txt`, urlList: batch }),
  });
  const accepted = r.status === 200 || r.status === 202;
  // Record on accept OR 429 (429 means Bing already has them) so we don't retry.
  if ((accepted || r.status === 429) && env.DB) {
    try {
      const now = new Date().toISOString();
      await env.DB.batch(batch.map((u) => env.DB.prepare("INSERT OR REPLACE INTO indexnow_log (url, submitted_at) VALUES (?, ?)").bind(u, now)));
    } catch {}
  }
  return { ok: accepted || r.status === 429, status: r.status, submitted: batch.length, throttled: r.status === 429 };
}

// ---- cron-callable: daily IndexNow submit ----
export async function runIndexNow(env) {
  const origin = (env.SITE_URL || "https://consentresolve.com").replace(/\/$/, "");
  return indexnowSubmit(env, origin, null);
}

// ---- Monday email digest (GSC 28d + top queries + movers + GA4) ----
const fmt = (n) => (n || 0).toLocaleString();
function arrow(cur, prev, inv) {
  const d = (cur || 0) - (prev || 0), up = inv ? d < 0 : d > 0;
  const c = up ? "#16a34a" : (d ? "#dc2626" : "#64748b");
  return `<span style="color:${c};font-weight:600">${d > 0 ? "+" : ""}${Math.round(d * 100) / 100}</span>`;
}
const strip = (u) => ((u || "").replace("https://consentresolve.com", "") || "/");

export async function sendWeeklyDigest(env) {
  if (!gscConfigured(env)) return { ok: false, error: "gsc_not_configured" };
  if (!env.RESEND_API_KEY) return { ok: false, error: "no_resend_key" };
  const ov = await overview(env), qs = await queries(env), pg = await pages(env);
  const g = ov.gsc || {}, p = g.prev || {};
  const q = (qs.rows || []).slice(0, 10);
  const gain = (pg.gainers || []).filter((x) => x.delta > 0).slice(0, 5);
  const lose = (pg.losers || []).filter((x) => x.delta < 0).slice(0, 5);
  const ga = (ov.ga4 && ov.ga4.cur) || null, gap = (ov.ga4 && ov.ga4.prev) || {};
  const tile = (k, v, d) => `<td style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px"><div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em">${k}</div><div style="font-size:22px;font-weight:800;margin-top:3px">${v}</div><div style="font-size:12px;margin-top:2px">${d || ""}</div></td>`;
  const qrows = q.map((r) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eef2f7">${r.q}</td><td style="padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:right">${fmt(r.clicks)}</td><td style="padding:6px 8px;border-bottom:1px solid #eef2f7;text-align:right;color:#64748b">${(r.position || 0).toFixed(1)}</td></tr>`).join("");
  const mv = (list, col) => list.map((r) => `<tr><td style="padding:5px 8px;border-bottom:1px solid #eef2f7">${strip(r.page)}</td><td style="padding:5px 8px;border-bottom:1px solid #eef2f7;text-align:right;color:${col};font-weight:600">${r.delta > 0 ? "+" : ""}${fmt(r.delta)}</td></tr>`).join("") || `<tr><td style="padding:5px 8px;color:#94a3b8">—</td></tr>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <h2 style="margin:0 0 4px">Consent Resolve — SEO weekly</h2>
    <p style="color:#64748b;margin:0 0 16px;font-size:13px">Search Console, last 28 days (ending ~3 days ago) vs the prior 28.</p>
    <table style="border-collapse:separate;border-spacing:8px;width:100%"><tr>
      ${tile("Clicks", fmt(g.clicks), arrow(g.clicks, p.clicks))}
      ${tile("Impressions", fmt(g.impressions), arrow(g.impressions, p.impressions))}
      ${tile("CTR", ((g.ctr || 0) * 100).toFixed(1) + "%", arrow((g.ctr || 0) * 100, (p.ctr || 0) * 100) + "pt")}
      ${tile("Avg pos", (g.position || 0).toFixed(1), arrow(g.position, p.position, true))}
    </tr></table>
    ${ga ? `<table style="border-collapse:separate;border-spacing:8px;width:100%;margin-top:2px"><tr>${tile("Sessions (GA4)", fmt(ga.sessions), arrow(ga.sessions, gap.sessions))}${tile("Users", fmt(ga.users), arrow(ga.users, gap.users))}${tile("Key events", fmt(ga.keyEvents), arrow(ga.keyEvents, gap.keyEvents))}</tr></table>` : ""}
    <h3 style="margin:20px 0 6px;font-size:15px">Top queries</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:6px 8px;color:#64748b;border-bottom:2px solid #e2e8f0">Query</th><th style="text-align:right;padding:6px 8px;color:#64748b;border-bottom:2px solid #e2e8f0">Clicks</th><th style="text-align:right;padding:6px 8px;color:#64748b;border-bottom:2px solid #e2e8f0">Pos</th></tr></thead><tbody>${qrows || '<tr><td colspan=3 style="padding:8px;color:#94a3b8">No data yet.</td></tr>'}</tbody></table>
    <table style="width:100%;margin-top:18px"><tr valign="top">
      <td width="50%" style="padding-right:8px"><h3 style="font-size:14px;margin:0 0 6px">📈 Gainers</h3><table style="width:100%;border-collapse:collapse;font-size:12px">${mv(gain, "#16a34a")}</table></td>
      <td width="50%" style="padding-left:8px"><h3 style="font-size:14px;margin:0 0 6px">📉 Drops</h3><table style="width:100%;border-collapse:collapse;font-size:12px">${mv(lose, "#dc2626")}</table></td>
    </tr></table>
    <p style="margin:22px 0 0"><a href="https://consentresolve.com/seo" style="background:#00e5a0;color:#04342c;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">Open the dashboard →</a></p>
  </div>`;
  const to = env.SEO_DIGEST_TO || env.QUOTE_TO || "hello@consentresolve.com";
  const from = env.FROM_EMAIL || "Consent Resolve <sales@tryconsentresolve.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `SEO weekly — ${fmt(g.clicks)} clicks (${arrow(g.clicks, p.clicks).replace(/<[^>]+>/g, "")}) · ${fmt(g.impressions)} impressions`, html }),
  });
  return { ok: res.ok, status: res.status, to };
}

export async function onRequestGet({ request, env }) {
  if (!(await gate(request, env))) return json({ error: "unauthorized" }, { status: 401 });
  const path = new URL(request.url).pathname;
  try {
    if (path.endsWith("/overview")) return json(await overview(env));
    if (path.endsWith("/queries")) return json(await queries(env));
    if (path.endsWith("/pages")) return json(await pages(env));
    if (path.endsWith("/digest")) return json(await sendWeeklyDigest(env)); // manual test-fire
    if (path.endsWith("/aeo")) {
      const days = Math.max(1, Math.min(parseInt(new URL(request.url).searchParams.get("days") || "28", 10) || 28, 90));
      return json(await aeoSummary(env, days));
    }
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
  const res = await indexnowSubmit(env, origin.replace(/\/$/, ""), body.urls, body.force || body.all);
  return json(res);
}
