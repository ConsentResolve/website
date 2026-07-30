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

  // --- Live now: group recent hits by vid, keep the latest path per visitor.
  const liveRows = await all("SELECT vid, path, created_at FROM traffic WHERE created_at > ? ORDER BY created_at DESC LIMIT 500", sinceLive);
  const byVid = new Map();
  let anonSeq = 0;
  for (const r of liveRows) {
    const key = r.vid || "anon" + (anonSeq++);
    if (!byVid.has(key)) byVid.set(key, { vid: r.vid, path: r.path, at: r.created_at, hits: 0 });
    byVid.get(key).hits++;
  }
  const liveVals = [...byVid.values()];
  // Map known vids -> contact name/company.
  const vids = liveVals.map((v) => v.vid).filter(Boolean);
  const known = new Map();
  if (vids.length) {
    const ph = "(" + vids.map(() => "?").join(",") + ")";
    for (const r of await all(`SELECT vl.vid, c.full_name, co.name company FROM visitor_links vl JOIN contacts c ON c.id=vl.contact_id LEFT JOIN companies co ON co.id=c.company_id WHERE vl.vid IN ${ph}`, ...vids)) {
      if (!known.has(r.vid)) known.set(r.vid, { name: r.full_name, company: r.company });
    }
  }
  const visitors = liveVals.map((v) => {
    const k = v.vid && known.get(v.vid);
    return { path: v.path || "/", pages: v.hits, mins: Math.max(0, Math.round((now - Date.parse(v.at)) / 60000)),
      known: k ? { name: k.name || "", company: k.company || "" } : null, intent: isIntent(v.path) };
  }).sort((a, b) => (b.known ? 1 : 0) - (a.known ? 1 : 0) || (b.intent - a.intent) || (a.mins - b.mins));

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
    live: { count: liveVals.length, known: visitors.filter((v) => v.known).length, window_min: liveMin, visitors: visitors.slice(0, 12) },
    today: {
      pageviews: pv.pageviews || 0, uniques: pv.uniques || 0,
      pageviews_yesterday: yPv.pageviews || 0, uniques_yesterday: yPv.uniques || 0,
      topPages, topSources, intent: { pricing: intent.pricing || 0, demo: intent.demo || 0, getStarted: intent.getstarted || 0 },
    },
    attention: attention.slice(0, 8),
  }, {}, cors);
}
