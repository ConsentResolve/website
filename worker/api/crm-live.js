// Consent Resolve — real-time Site Spy intel from the first-party traffic beacon.
//
// The /api/hit beacon logs every pageview (anonymous + identified) into `traffic`
// with a vid cookie + path + created_at. This turns that firehose into a live
// pulse + today's activity + an attention feed, polled by the Site Spy view.
//
//   GET /api/crm/live[?min=5]  (CRM-gated)
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";

const isIntent = (p) => /(^\/pricing|^\/demo|^\/get-started|pricing|\/demo)/i.test(p || "");
const hostOf = (u) => { if (!u) return ""; try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return String(u).replace(/^https?:\/\//, "").split("/")[0]; } };

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!env.DB) return json({ ok: false, error: "no_db" }, { status: 500 }, cors);

  const q = new URL(request.url).searchParams;
  const liveMin = Math.min(60, Math.max(1, parseInt(q.get("min") || "5", 10)));
  const now = Date.now();
  const sinceLive = new Date(now - liveMin * 60000).toISOString();
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const tISO = todayStart.toISOString();

  const all = async (sql, ...b) => { try { return (await env.DB.prepare(sql).bind(...b).all()).results || []; } catch (_) { return []; } };
  const one = async (sql, ...b) => { const r = await all(sql, ...b); return r[0] || {}; };

  // --- Live now: prefer the presence heartbeat (who's actually on the site right
  // now). Fall back to pageview recency until the heartbeat is warmed / for tabs
  // that never pinged.
  try { await env.DB.prepare("CREATE TABLE IF NOT EXISTS presence (vid TEXT PRIMARY KEY, path TEXT, last_seen TEXT, ip TEXT, country TEXT, region TEXT, city TEXT)").run(); } catch (_) {}
  const presSince = new Date(now - 90 * 1000).toISOString();
  let liveVals = (await all("SELECT vid, path, last_seen, ip, country, region, city FROM presence WHERE last_seen > ?", presSince))
    .map((r) => ({ vid: r.vid, path: r.path, at: r.last_seen, hits: 1, ip: r.ip, country: r.country, region: r.region, city: r.city }));
  let liveSource = "presence";
  if (!liveVals.length) {
    const liveRows = await all("SELECT vid, path, created_at FROM traffic WHERE created_at > ? ORDER BY created_at DESC LIMIT 500", sinceLive);
    const byVid = new Map(); let anonSeq = 0;
    for (const r of liveRows) {
      const key = r.vid || "anon" + (anonSeq++);
      if (!byVid.has(key)) byVid.set(key, { vid: r.vid, path: r.path, at: r.created_at, hits: 0 });
      byVid.get(key).hits++;
    }
    liveVals = [...byVid.values()];
    liveSource = "pageviews";
  }
  // Map known vids -> contact name/company.
  const vids = liveVals.map((v) => v.vid).filter(Boolean);
  const known = new Map();
  if (vids.length) {
    const ph = "(" + vids.map(() => "?").join(",") + ")";
    for (const r of await all(`SELECT vl.vid, c.full_name, co.name company FROM visitor_links vl JOIN contacts c ON c.id=vl.contact_id LEFT JOIN companies co ON co.id=c.company_id WHERE vl.vid IN ${ph}`, ...vids)) {
      if (!known.has(r.vid)) known.set(r.vid, { name: r.full_name, company: r.company });
    }
  }
  // Session stats per live vid (time on site, pages consumed, entry source) — 3h window.
  const sessMap = new Map();
  if (vids.length) {
    const ph2 = "(" + vids.map(() => "?").join(",") + ")";
    const since3h = new Date(now - 3 * 3600 * 1000).toISOString();
    for (const r of await all(`SELECT vid, utm_source, ref, created_at FROM traffic WHERE vid IN ${ph2} AND created_at > ? ORDER BY created_at ASC`, ...vids, since3h)) {
      let g = sessMap.get(r.vid);
      if (!g) { // first (earliest) hit = session entry → capture the source
        const src = (r.utm_source && String(r.utm_source).trim()) ? String(r.utm_source) : (hostOf(r.ref) || "Direct");
        g = { pages: 0, firstAt: r.created_at, source: src };
        sessMap.set(r.vid, g);
      }
      g.pages++;
    }
  }
  const visitors = liveVals.map((v) => {
    const k = v.vid && known.get(v.vid);
    const s = v.vid && sessMap.get(v.vid);
    return {
      id: v.vid || null,
      path: v.path || "/",
      pages: s ? s.pages : (v.hits || 1),
      onSiteMin: s ? Math.max(0, Math.round((now - Date.parse(s.firstAt)) / 60000)) : 0,
      lastMin: Math.max(0, Math.round((now - Date.parse(v.at)) / 60000)),
      source: s ? s.source : "Direct",
      ip: v.ip || null,
      location: [v.city, v.region, v.country].filter(Boolean).join(", ") || null,
      known: k ? { name: k.name || "", company: k.company || "" } : null,
      intent: isIntent(v.path),
    };
  }).sort((a, b) => (b.known ? 1 : 0) - (a.known ? 1 : 0) || (b.intent - a.intent) || (a.lastMin - b.lastMin));

  // --- Today's pulse.
  const pv = await one("SELECT COUNT(*) pageviews, COUNT(DISTINCT vid) uniques FROM traffic WHERE created_at >= ?", tISO);
  const topPages = await all("SELECT path, COUNT(*) n FROM traffic WHERE created_at >= ? AND path IS NOT NULL AND path<>'' GROUP BY path ORDER BY n DESC LIMIT 6", tISO);
  const topSources = await all("SELECT COALESCE(NULLIF(utm_source,''), CASE WHEN ref IS NULL OR ref='' THEN 'Direct / none' ELSE ref END) src, COUNT(*) n FROM traffic WHERE created_at >= ? GROUP BY src ORDER BY n DESC LIMIT 6", tISO);
  const intent = await one("SELECT SUM(CASE WHEN path LIKE '/pricing%' THEN 1 ELSE 0 END) pricing, SUM(CASE WHEN path LIKE '/demo%' THEN 1 ELSE 0 END) demo, SUM(CASE WHEN path LIKE '/get-started%' THEN 1 ELSE 0 END) getstarted FROM traffic WHERE created_at >= ?", tISO);
  // Yesterday same-window for a trend arrow.
  const y0 = new Date(todayStart.getTime() - 864e5).toISOString();
  const yPv = await one("SELECT COUNT(*) pageviews, COUNT(DISTINCT vid) uniques FROM traffic WHERE created_at >= ? AND created_at < ?", y0, tISO);

  // --- Attention feed.
  const attention = [];
  for (const v of visitors) {
    if (v.known) attention.push({ tone: "good", text: `${v.known.name || v.known.company || "A known contact"} is on the site now — ${v.path}` });
    else if (v.intent) attention.push({ tone: "warn", text: `Someone is on ${v.path} right now (anonymous)` });
  }
  const repeat = await all(`SELECT vid, COUNT(*) n FROM traffic WHERE created_at >= ? AND vid IS NOT NULL AND (path LIKE '/pricing%' OR path LIKE '/demo%' OR path LIKE '/get-started%') AND vid NOT IN (SELECT vid FROM visitor_links) GROUP BY vid HAVING n >= 2 ORDER BY n DESC LIMIT 5`, tISO);
  if (repeat.length) attention.push({ tone: "warn", text: `${repeat.length} anonymous visitor${repeat.length > 1 ? "s" : ""} hit pricing/demo 2+ times today but aren't identified — a de-anon source would name them` });
  const pvUp = (pv.pageviews || 0), pvYest = (yPv.pageviews || 0);
  if (pvYest > 20 && pvUp > pvYest * 1.5) attention.push({ tone: "good", text: `Traffic is up ${Math.round((pvUp / pvYest - 1) * 100)}% vs. yesterday (${pvUp} vs ${pvYest} views)` });

  return json({
    ok: true, generated_at: new Date(now).toISOString(),
    live: { count: liveVals.length, known: visitors.filter((v) => v.known).length, window_min: liveSource === "presence" ? 2 : liveMin, source: liveSource, visitors: visitors.slice(0, 12) },
    today: {
      pageviews: pv.pageviews || 0, uniques: pv.uniques || 0,
      pageviews_yesterday: yPv.pageviews || 0, uniques_yesterday: yPv.uniques || 0,
      topPages, topSources, intent: { pricing: intent.pricing || 0, demo: intent.demo || 0, getStarted: intent.getstarted || 0 },
    },
    attention: attention.slice(0, 8),
  }, {}, cors);
}
