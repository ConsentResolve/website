// Consent Resolve CRM — windowed Analytics builder (single source of truth).
//
// Everything is windowed by `days` so the dashboard's date selector re-computes
// the whole page for any range. Used by /api/crm/app (default 30d) and the
// /api/crm/analytics/range endpoint.
const SRC_MAP = { meta: "meta", instantly: "instantly", crisp: "chat", chatwoot: "chat", chat: "chat", mack: "chat", site: "site", demo: "demo", claim50: "demo", cal: "demo", apollo: "apollo", manual: "manual" };
const SOCIAL_METRICS = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/metrics.json";

export async function buildAnalytics(env, days) {
  days = Math.min(365, Math.max(1, parseInt(days, 10) || 30));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const all = async (sql, ...b) => { try { return (await env.DB.prepare(sql).bind(...b).all()).results || []; } catch (_) { return []; } };
  const one = async (sql, ...b) => { const r = await all(sql, ...b); return r[0] || {}; };
  const n = (o, k) => Number((o && o[k]) || 0);

  // Funnel — distinct contacts per event type, windowed.
  const funnel = {};
  for (const t of ["lead_created", "contacted", "replied", "booked", "signed_up", "activated"]) {
    funnel[t] = n(await one("SELECT COUNT(DISTINCT contact_id) x FROM crm_events WHERE type=? AND occurred_at >= ?", t, since), "x");
  }

  // Spend by channel (windowed; rows without a created_at still count).
  const spendRows = await all("SELECT COALESCE(channel,'(unknown)') channel, SUM(amount_usd) amt FROM crm_spend WHERE created_at >= ? OR created_at IS NULL GROUP BY channel", since);
  const spendTotal = spendRows.reduce((a, r) => a + (r.amt || 0), 0);
  const spendByChannel = spendRows.map((r) => ({ k: r.channel, v: Math.round(r.amt || 0) })).sort((a, b) => b.v - a.v);
  const chanToSrc = (c) => { const k = (c || "").toLowerCase(); if (k.includes("meta") || k.includes("facebook")) return "meta"; if (k.includes("instant")) return "instantly"; if (k.includes("google") || k.includes("lsa") || k.includes("search")) return "site"; return "manual"; };
  const spendBySrc = {};
  for (const r of spendRows) spendBySrc[chanToSrc(r.channel)] = (spendBySrc[chanToSrc(r.channel)] || 0) + (r.amt || 0);

  // Per-source funnel, windowed.
  const srcAgg = await all(
    `SELECT c.source src,
       COUNT(DISTINCT CASE WHEN e.type='lead_created' THEN e.contact_id END) leads,
       COUNT(DISTINCT CASE WHEN e.type='replied'      THEN e.contact_id END) replied,
       COUNT(DISTINCT CASE WHEN e.type='booked'       THEN e.contact_id END) demos,
       COUNT(DISTINCT CASE WHEN e.type='activated'    THEN e.contact_id END) act
     FROM crm_events e JOIN contacts c ON c.id = e.contact_id
     WHERE e.occurred_at >= ? GROUP BY c.source`, since);
  const sources = srcAgg.map((r) => {
    const key = SRC_MAP[r.src] || "manual";
    return { src: key, leads: r.leads || 0, reply: r.leads ? (r.replied || 0) / r.leads : 0, demos: r.demos || 0, act: r.act || 0, spend: Math.round(spendBySrc[key] || 0) };
  }).filter((s) => s.leads > 0 || s.spend > 0).sort((a, b) => b.leads - a.leads);

  // Leads/day sparkline — array length = window.
  const byDay = await all("SELECT CAST(julianday('now') - julianday(occurred_at) AS INTEGER) d, COUNT(*) x FROM crm_events WHERE type='lead_created' AND occurred_at >= ? GROUP BY d", since);
  const leadsByDay = Array(days).fill(0);
  for (const r of byDay) { const idx = days - 1 - (r.d || 0); if (idx >= 0 && idx < days) leadsByDay[idx] = r.x || 0; }

  // Pipeline snapshot (active deals) + avg deal value.
  const openPipe = Math.round(n(await one("SELECT COALESCE(SUM(value_cents),0) v FROM deals WHERE lead_status='active'"), "v") / 100);
  const avgDeal = n(await one("SELECT AVG(value_cents) a FROM deals WHERE value_cents > 0"), "a");
  const avgDealYr = avgDeal ? Math.round(avgDeal / 100) : 6000;

  // Identified visitors by source (crm_leads), windowed.
  const idRows = await all("SELECT COALESCE(source,'other') src, COUNT(*) x FROM crm_leads WHERE consent_status='identified' AND created_at >= ? GROUP BY source ORDER BY x DESC", since);
  const idTotal = idRows.reduce((a, r) => a + (r.x || 0), 0);
  const identified = idTotal > 0 ? { total: idTotal, bySource: idRows.map((r) => ({ src: r.src, n: r.x || 0 })) } : null;

  // Site traffic (first-party beacon), windowed.
  const tr = await one("SELECT COUNT(*) pv, COUNT(DISTINCT vid) uv FROM traffic WHERE created_at >= ?", since);
  const traffic = { pageviews: n(tr, "pv"), uniques: n(tr, "uv") };

  // Social views — all-time total (metrics.json has no per-post date to window by).
  let socialViews = null;
  try {
    const res = await fetch(SOCIAL_METRICS);
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) socialViews = rows.reduce((a, r) => a + Number(r.views ?? r.reach ?? r.impressionCount ?? r.impressions ?? 0), 0);
    }
  } catch (_) {}

  const F = { leads: funnel.lead_created || 0, replies: funnel.replied || 0, demos: funnel.booked || 0, activations: funnel.activated || 0 };
  const kpis = {
    leads: F.leads, replies: F.replies, demos: F.demos, activations: F.activations,
    spend: Math.round(spendTotal), cpl: F.leads ? spendTotal / F.leads : 0,
    cpd: F.demos ? Math.round(spendTotal / F.demos) : 0, pipeline: openPipe,
  };
  const FLBL = { lead_created: "Leads", contacted: "Contacted", replied: "Replied", booked: "Demo booked", signed_up: "Signed up", activated: "Activated" };
  const funnelArr = Object.keys(FLBL).map((t) => ({ k: FLBL[t], n: funnel[t] || 0 }));

  return { days, kpis, funnel: funnelArr, sources, spendByChannel, leadsByDay, avgDealYr, identified, traffic30: traffic, socialViews };
}
