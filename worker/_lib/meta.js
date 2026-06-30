// Meta (Facebook) Ads — read ad spend via the Marketing API (Graph v21.0) and sync it
// into crm_spend so the paid-lead cost/lead + ROAS tab use real numbers. Reuses the same
// System-User token (ads_management scope → includes read) + ad account as
// scripts/meta_campaign.py. Inert until META_ACCESS_TOKEN + META_AD_ACCOUNT_ID are set.
const GRAPH = "https://graph.facebook.com/v21.0";

export function metaConfigured(env) {
  return !!(env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID);
}

function acct(env) {
  const a = String(env.META_AD_ACCOUNT_ID || "").trim();
  return a.startsWith("act_") ? a : "act_" + a;
}

async function metaGet(env, path, params) {
  const q = new URLSearchParams(Object.assign({ access_token: env.META_ACCESS_TOKEN }, params || {}));
  const res = await fetch(GRAPH + "/" + path + "?" + q.toString());
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, body: j, error: j && j.error ? j.error : null };
}

// Per-campaign spend for a window. datePreset: today|yesterday|last_7d|last_30d|this_month|maximum.
export async function fetchMetaSpend(env, { datePreset = "this_month" } = {}) {
  if (!metaConfigured(env)) return { ok: false, configured: false };
  const r = await metaGet(env, acct(env) + "/insights", {
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,impressions,clicks",
    date_preset: datePreset,
    limit: "200",
  });
  if (!r.ok) return { ok: false, configured: true, status: r.status, error: r.error ? (r.error.message || ("graph " + r.status)) : ("graph " + r.status) };
  const rows = (((r.body && r.body.data) || [])).map((d) => ({
    campaignId: d.campaign_id || null,
    campaign: d.campaign_name || "(campaign)",
    spend: Number(d.spend || 0),
    impressions: Number(d.impressions || 0),
    clicks: Number(d.clicks || 0),
  }));
  const total = rows.reduce((s, x) => s + x.spend, 0);
  return { ok: true, configured: true, datePreset, total: Math.round(total * 100) / 100, rows };
}

// Idempotent: replace this calendar month's Meta-sourced rows in crm_spend with the live
// figures (channel="facebook", note="meta:<campaign_id>:<name>"). Safe to run on a cron.
export async function syncMetaSpend(env) {
  if (!metaConfigured(env) || !env.DB) return { ok: false, configured: metaConfigured(env), synced: 0 };
  const sp = await fetchMetaSpend(env, { datePreset: "this_month" });
  if (!sp.ok) return { ok: false, configured: true, error: sp.error || "fetch_failed", synced: 0 };
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS crm_spend (id TEXT PRIMARY KEY, industry TEXT, channel TEXT, amount_usd REAL, period TEXT, note TEXT, created_at TEXT)").run();
  await env.DB.prepare("DELETE FROM crm_spend WHERE channel='facebook' AND period=? AND note LIKE 'meta:%'").bind(period).run();
  let synced = 0, i = 0;
  for (const row of sp.rows) {
    i++;
    if (!(row.spend > 0)) continue;
    const id = "ms_" + period + "_" + (row.campaignId || String(i));
    await env.DB.prepare("INSERT INTO crm_spend (id, industry, channel, amount_usd, period, note, created_at) VALUES (?,?,?,?,?,?,datetime('now'))")
      .bind(id, null, "facebook", row.spend, period, "meta:" + (row.campaignId || "") + ":" + row.campaign).run();
    synced++;
  }
  return { ok: true, configured: true, period, total: sp.total, synced };
}
