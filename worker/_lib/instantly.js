// Instantly (cold email) — closed-loop attribution helpers. Reply INGEST already lives in
// api/crm-instantly.js (pollInstantly, thread-grouped, two-way). This file only adds the
// wave funnel that joins Instantly's send stats with our first-party data. Inert w/o key.
import { ensureCrmV2Schema, findOrCreateContactByEmail } from "./crm-v2.js";

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

async function instPost(env, path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + env.INSTANTLY_API_KEY, Accept: "application/json", "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify(body),
  });
  let j = {}; try { j = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, body: j };
}

// #5 — deliverability health per sending inbox. Surfaces Instantly's warmup score, setup
// state, and daily cap so an unhealthy mailbox is caught before it tanks a wave.
export async function accountHealth(env) {
  if (!instantlyConfigured(env)) return { configured: false, accounts: [], healthy: 0, total: 0, dailyCapacity: 0 };
  const r = await instGet(env, "/accounts?limit=100");
  const items = (r.body && r.body.items) || [];
  const accounts = items.map((a) => {
    const w = a.warmup || {};
    const score = a.stat_warmup_score == null ? null : Number(a.stat_warmup_score);
    let health = "ok";
    if (a.setup_pending) health = "error";
    else if (a.warmup_status !== 1 || (score != null && score < 90)) health = "warn";
    return {
      email: a.email, score, dailyLimit: Number(a.daily_limit || 0),
      warmupReplyRate: Number(w.reply_rate || 0), setupPending: !!a.setup_pending,
      warmupActive: a.warmup_status === 1, health,
    };
  });
  return {
    configured: true, accounts,
    healthy: accounts.filter((a) => a.health === "ok").length,
    total: accounts.length,
    dailyCapacity: accounts.reduce((s, a) => s + a.dailyLimit, 0),
  };
}

// #3 — lead-status + engagement sync. Cache each campaign lead's status/opens/replies/clicks
// keyed by email so the intel pane can show cold-email engagement per contact, and ensure a
// contact exists for any lead that has replied (pipeline entry). Paginated, idempotent upsert.
export async function syncInstantlyLeads(env, { campaignId, maxPages = 20 } = {}) {
  if (!instantlyConfigured(env) || !env.DB || !campaignId) return { synced: 0, repliers: 0 };
  await ensureCrmV2Schema(env);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS instantly_leads (email TEXT PRIMARY KEY, campaign TEXT, status INTEGER, opens INTEGER, replies INTEGER, clicks INTEGER, summary TEXT, updated_at TEXT)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS crm_suppressions (email TEXT PRIMARY KEY, reason TEXT, source TEXT, created_at TEXT)").run();
  let after = null, synced = 0, repliers = 0, suppressed = 0, pages = 0;
  while (pages < maxPages) {
    const body = { campaign: campaignId, limit: 100 };
    if (after) body.starting_after = after;
    const r = await instPost(env, "/leads/list", body);
    if (!r.ok) break;
    const items = (r.body && r.body.items) || [];
    for (const L of items) {
      const email = String(L.email || "").toLowerCase().trim();
      if (!email) continue;
      const opens = Number(L.email_open_count || 0), replies = Number(L.email_reply_count || 0), clicks = Number(L.email_click_count || 0);
      await env.DB.prepare(
        "INSERT INTO instantly_leads (email, campaign, status, opens, replies, clicks, summary, updated_at) VALUES (?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(email) DO UPDATE SET campaign=excluded.campaign, status=excluded.status, opens=excluded.opens, replies=excluded.replies, clicks=excluded.clicks, summary=excluded.summary, updated_at=excluded.updated_at"
      ).bind(email, campaignId, Number(L.status || 0), opens, replies, clicks, JSON.stringify(L.status_summary || {})).run();
      synced++;
      if (replies > 0) {
        repliers++;
        try { await findOrCreateContactByEmail(env, email, { source: "instantly", name: [L.first_name, L.last_name].filter(Boolean).join(" ") || null }); } catch (_) {}
      }
      // #6 — suppression: unsubscribed (3) or bounced (<0) → cross-channel do-not-contact list.
      const st = Number(L.status || 0);
      if (st === 3 || st < 0) {
        suppressed++;
        try { await env.DB.prepare("INSERT INTO crm_suppressions (email, reason, source, created_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(email) DO UPDATE SET reason=excluded.reason, source=excluded.source").bind(email, st === 3 ? "unsubscribed" : "bounced", "instantly").run(); } catch (_) {}
      }
    }
    after = r.body && r.body.next_starting_after;
    pages++;
    if (!after || !items.length) break;
  }
  return { synced, repliers, suppressed };
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
    const cmp = await instGet(env, "/campaigns/" + campaignId);
    if (cmp.ok && cmp.body) { out.campaignStatus = cmp.body.status != null ? cmp.body.status : null; out.campaignName = cmp.body.name || null; }
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
  // #4 — cost efficiency + stage conversion rates. Instantly spend comes from the same
  // crm_spend log (channel 'instantly'); the user logs the subscription / lead-gen cost there.
  const sp = await q("SELECT COALESCE(SUM(amount_usd),0) v FROM crm_spend WHERE lower(channel) LIKE '%instantly%'");
  out.spendUsd = sp ? Math.round(Number(sp.v)) : 0;
  const repliedN = (out.instantly && out.instantly.replied) || out.repliesInbox || 0;
  const leadsN = (out.instantly && out.instantly.leads) || 0;
  const per = (n) => (out.spendUsd > 0 && n > 0) ? Math.round(out.spendUsd / n) : null;
  out.costPer = { landed: per(out.landed), reply: per(repliedN), demo: per(out.demos), won: per(out.won) };
  const rate = (a, b) => (b > 0) ? Math.round((100 * a) / b) : null;
  out.rates = { reply: rate(repliedN, leadsN), land: rate(out.landed, leadsN), demo: rate(out.demos, out.landed), win: rate(out.won, out.demos) };
  if (out.spendUsd > 0 && out.revenueUsd > 0) out.roas = Math.round((out.revenueUsd / out.spendUsd) * 10) / 10;
  return out;
}
