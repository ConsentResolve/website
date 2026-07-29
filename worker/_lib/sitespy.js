// worker/_lib/sitespy.js
// First-party visit → crm_events pipeline. Turns identity-resolved pageviews
// (traffic ⋈ visitor_links) into `site_visit` events that power Site Spy + the
// Nurture intent trigger. Source of truth for the "first_party" data source.
// Idempotent: each traffic row maps to a deterministic event id (sv-<traffic.id>),
// so re-running is safe. Only IDENTIFIED visits (vid linked to a contact) become
// events — anonymous traffic stays anonymous (consent-first).
import { ensureRebuildSchema } from "./crm-rebuild.js";

async function syncSiteVisits(env, { sinceHours = 48, limit = 400 } = {}) {
  await ensureRebuildSchema(env);
  let rows = [];
  try {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
    rows = (await env.DB.prepare(
      `SELECT t.id, t.vid, t.path, t.utm_source, t.ref, t.created_at, vl.contact_id, c.company_id
         FROM traffic t
         JOIN visitor_links vl ON vl.vid = t.vid
         LEFT JOIN contacts c ON c.id = vl.contact_id
        WHERE t.created_at > ? AND t.vid IS NOT NULL AND vl.contact_id IS NOT NULL
        ORDER BY t.id ASC LIMIT ?`
    ).bind(since, limit).all()).results || [];
  } catch (_) {
    return { emitted: 0, scanned: 0, note: "traffic/visitor_links not present" };
  }
  let emitted = 0;
  const stmts = rows.map((r) => env.DB.prepare(
    `INSERT OR IGNORE INTO crm_events (id, type, contact_id, company_id, channel, source, meta, occurred_at)
     VALUES (?, 'site_visit', ?, ?, 'site', 'first_party', ?, ?)`
  ).bind(`sv-${r.id}`, r.contact_id, r.company_id || null,
         JSON.stringify({ path: r.path, utm_source: r.utm_source, ref: r.ref }), r.created_at));
  for (let i = 0; i < stmts.length; i += 40) {
    const res = await env.DB.batch(stmts.slice(i, i + 40));
    for (const x of res) emitted += (x.meta && x.meta.changes) || 0;
  }
  return { emitted, scanned: rows.length };
}

// Data-source registry + live stats for Site Spy / Nurture. Shows WHERE the intent
// data comes from, how much each source contributes, how well it's performing, and
// which additional sources can be added if coverage is weak.
async function computeSources(env) {
  await ensureRebuildSchema(env);
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const one = async (sql, ...b) => { try { return (await env.DB.prepare(sql).bind(...b).all()).results?.[0] || {}; } catch (_) { return {}; } };
  const num = (o, k) => Number((o && o[k]) || 0);

  const fp = await one("SELECT COUNT(*) n, MAX(occurred_at) last FROM crm_events WHERE type='site_visit' AND source='first_party' AND occurred_at>?", since30);
  const totalVisits = num(await one("SELECT COUNT(*) n FROM traffic WHERE created_at>?", since30), "n");
  const totalVids = num(await one("SELECT COUNT(DISTINCT vid) n FROM traffic WHERE vid IS NOT NULL AND created_at>?", since30), "n");
  const idVids = num(await one("SELECT COUNT(DISTINCT t.vid) n FROM traffic t JOIN visitor_links vl ON vl.vid=t.vid WHERE t.created_at>?", since30), "n");
  const matchRate = totalVids ? Math.round((idVids / totalVids) * 100) : 0;
  const clk = await one("SELECT COUNT(*) n, MAX(occurred_at) last FROM crm_events WHERE type='link_clicked' AND occurred_at>?", since30);
  // Lead-ingest sources write to crm_leads via upsertLead — count each by source so
  // Site Spy shows them LIVE (rows appear the moment real leads land).
  const bySource = (src) => one("SELECT COUNT(*) n, MAX(COALESCE(last_activity, created_at)) last FROM crm_leads WHERE source=?", src);
  const apolloRow = await bySource("apollo");
  const rb2bRow = await bySource("rb2b");
  const crOwnRow = await bySource("consentresolve");
  const gmailConnected = num(await one("SELECT COUNT(*) n FROM social_tokens WHERE provider LIKE 'gmail:%' AND refresh_token IS NOT NULL"), "n") > 0;
  // status: LIVE (leads landed) > READY (configured, none yet) > NEEDS_SETUP.
  const liveStatus = (n, configured) => (n > 0 ? "connected" : configured ? "ready" : "needs_setup");

  const sources = [
    { id: "first_party", name: "First-party site tracking", category: "core",
      provides: "Identity-resolved page visits — who viewed what, live",
      status: (num(fp, "n") > 0 || totalVisits > 0) ? "connected" : "ready",
      events30d: num(fp, "n"), lastSeen: fp.last || null,
      perf: { label: "Identity match rate", value: matchRate + "%", detail: `${idVids} of ${totalVids} visitors matched to a known contact (${totalVisits} pageviews / 30d)` },
      boost: matchRate < 60 ? "Match rate is low — add a de-anonymization source below to identify more visitors." : null },
    { id: "email_clicks", name: "Email link clicks", category: "intent",
      provides: "Intent — a lead clicked a link in one of our emails",
      status: num(clk, "n") > 0 ? "connected" : (env.RESEND_API_KEY ? "ready" : "needs_setup"),
      events30d: num(clk, "n"), lastSeen: clk.last || null,
      howToEnable: "Turn on Resend click tracking, or route the engine's email links through a CR redirect that logs the click → link_clicked events." },
    { id: "apollo", name: "Apollo (API)", category: "deanon",
      provides: "Company + contact de-anonymization via the Apollo API (identified — intel/retargeting only, never cold outreach)",
      status: liveStatus(num(apolloRow, "n"), !!env.APOLLO_API_KEY),
      contribution: `${num(apolloRow, "n")} leads imported`, lastSeen: apolloRow.last || null,
      howToEnable: "Set APOLLO_API_KEY + APOLLO_CONTACTS_LABEL (Cloudflare secrets). Pulls your Apollo visitors list every 5 min." },
    { id: "rb2b", name: "RB2B (daily CSV → Gmail)", category: "deanon",
      provides: "Person-level website-visitor ID. Free tier emails a daily CSV to hello@; we import the attachment automatically.",
      status: liveStatus(num(rb2bRow, "n"), gmailConnected),
      contribution: `${num(rb2bRow, "n")} leads imported`, lastSeen: rb2bRow.last || null,
      howToEnable: "Point RB2B's daily CSV export at hello@consentresolve.com (Gmail-connected). Cron imports it every 5 min; no DNS needed." },
    { id: "cr_own", name: "Consent Resolve (own visitor API)", category: "deanon",
      provides: "Our own consent-first visitor identification, pulled from the Consent Resolve public API.",
      status: liveStatus(num(crOwnRow, "n"), !!env.CR_API_KEY),
      contribution: `${num(crOwnRow, "n")} leads imported`, lastSeen: crOwnRow.last || null,
      howToEnable: "Set CR_API_KEY (Cloudflare secret). Pulls identified visitors from api.consentresolve.com every 5 min." },
    { id: "ga4", name: "Google Analytics 4", category: "aggregate",
      provides: "Aggregate traffic trends — dashboard only, does NOT identify individual visitors",
      status: env.GA4_PROPERTY_ID ? "connected" : "available",
      note: "Supplementary. Powers top-of-funnel Analytics, not per-visitor Site Spy." },
    { id: "gsc", name: "Google Search Console", category: "aggregate",
      provides: "Search queries & clicks (SEO) — not visitor-level",
      status: env.GSC_SITE_URL ? "connected" : "available",
      note: "Powers the SEO dashboard, not Site Spy / Nurture." },
  ];
  return { sources, summary: { site_visit_events_30d: num(fp, "n"), link_click_events_30d: num(clk, "n"), identity_match_rate: matchRate } };
}

export { syncSiteVisits, computeSources };
