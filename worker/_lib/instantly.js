// Instantly (cold email) — closed-loop attribution helpers. Reply INGEST already lives in
// api/crm-instantly.js (pollInstantly, thread-grouped, two-way). This file only adds the
// wave funnel that joins Instantly's send stats with our first-party data. Inert w/o key.
const BASE = "https://api.instantly.ai/api/v2";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function instantlyConfigured(env) { return !!env.INSTANTLY_API_KEY; }

async function instGet(env, path) {
  const res = await fetch(BASE + path, {
    headers: { Authorization: "Bearer " + env.INSTANTLY_API_KEY, Accept: "application/json", "User-Agent": UA },
  });
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, body: j };
}

// #2 — closed-loop attribution for a cold-email wave. Joins Instantly's send funnel with
// our first-party data: landings (utm), demos (by trade), won pipeline (instantly-sourced
// contacts). campaignId = Instantly campaign; utmCampaign = e.g. "hvac_2026"; trade = "hvac".
export async function waveFunnel(env, { campaignId, utmCampaign, trade } = {}) {
  const out = { instantly: null, landed: 0, demos: 0, demosCompleted: 0, repliesInbox: 0, won: 0, revenueUsd: 0 };
  if (instantlyConfigured(env) && campaignId) {
    const a = await instGet(env, "/campaigns/analytics?id=" + encodeURIComponent(campaignId));
    const r = Array.isArray(a.body) ? a.body[0] : (a.body && a.body.items ? a.body.items[0] : null);
    if (r) out.instantly = {
      leads: Number(r.leads_count || 0) || null,
      contacted: Number(r.contacted_count || 0) || null,
      opened: Number(r.open_count || 0) || null,
      clicked: Number(r.link_click_count || 0) || null,
      replied: Number(r.reply_count || 0) || null,
      opportunities: Number(r.total_opportunities || 0) || null,
    };
  }
  if (!env.DB) return out;
  const q = async (sql, ...b) => { try { return await env.DB.prepare(sql).bind(...b).first(); } catch (_) { return null; } };
  if (utmCampaign) {
    const l = await q("SELECT COUNT(DISTINCT vid) n FROM traffic WHERE utm_source='instantly' AND utm_campaign=?", utmCampaign);
    out.landed = l ? Number(l.n) : 0;
  }
  if (trade) {
    const d = await q("SELECT COUNT(*) n FROM participants WHERE trade=?", trade);
    out.demos = d ? Number(d.n) : 0;
    const dc = await q("SELECT COUNT(*) n FROM participants WHERE trade=? AND status IN ('consented','emailed','enrolled')", trade);
    out.demosCompleted = dc ? Number(dc.n) : 0;
  }
  const ri = await q("SELECT COUNT(*) n FROM conversations WHERE channel='instantly'");
  out.repliesInbox = ri ? Number(ri.n) : 0;
  const w = await q("SELECT COUNT(*) n, COALESCE(SUM(d.value_cents),0) v FROM deals d JOIN contacts c ON c.id=d.primary_contact_id WHERE c.source='instantly' AND d.lead_status='won'");
  if (w) { out.won = Number(w.n); out.revenueUsd = Math.round(Number(w.v) / 100); }
  return out;
}
