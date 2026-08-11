// worker/api/prospecting.js
//   Bulk prospecting pipeline — the autonomous sibling of the single-lead Intel
//   lookup. Route: POST/GET /api/crm/prospecting (gated by crmAuthed).
//   Spec: docs/crm/PROSPECTING-SPEC.md
//
//   Flow:
//     POST {action:"sweep", trade, city, region, limit, max_cost_cents}
//        → Stage 0 (Business Listings) runs synchronously, inserts `new`
//          prospects + a prospect_runs row at stage='tech'. Returns TAM count.
//     cron (processProspectRuns) → drips the waterfall stage-by-stage in bounded
//          batches: tech → traffic → backlinks → score → done. Enforces the
//          per-run cost ceiling.
//     GET  ?tier=&trade=&city=&run= → paged prospect list + run summaries.
//     POST {action:"promote", id}   → create contact+company, cache signals, drop
//          into the pipeline. {action:"suppress", id} → hide forever.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { ensureCrmV2Schema, currentUser, adminUserId, addActivityV2, findOrCreateCompany } from "../_lib/crm-v2.js";
import {
  normDomain, dfsConfigured, dfsBusinessListings, dfsTech, dataforseoLookup, dfsBacklinks, dfsGmb, TRADE_CATEGORIES,
} from "../_lib/dataforseo.js";
import { scoreProspect } from "../_lib/prospect-score.js";
import { fetchSite, parseSite } from "./crm-lookup.js";
import { peopleAtDomain, enrichPerson, usableEmail, DEFAULT_TITLES } from "./apollo-prospect.js";
import { enrollContact } from "../_lib/workflow-engine.js";
import { enrollRepermission, optInContacts } from "../_lib/newsletter.js";
import { pushLeadToInstantly } from "../_lib/instantly.js";

// The paused "Problem-Unaware (2026)" campaign. Override with env.INSTANTLY_CAMPAIGN_ID.
const DEFAULT_INSTANTLY_CAMPAIGN = "44bd0040-5a28-4d38-a469-a73e2eb5ffca";

const DISPOSITIONS = ["open", "sequence", "newsletter", "instantly", "whale", "skip"];

// Human-readable version of a prospecting SCORE TIER for the Open-inbox preview line. The raw
// tier ("dead") is scoring-pipeline jargon meaning "our automated web-scan found none of the
// buying signals it checks for (marketplace listings, ad spend, call tracking, a field CRM, a
// lead form, ad pixels, reputation, traffic)" — it says nothing about whether the business is
// real, open, or worth contacting. Left as the literal tier name it reads as a verdict on the
// LEAD, which is wrong and misleads whoever works Open next.
function prospectTierLabel(tier) {
  const LABELS = { hot: "hot prospect", warm: "warm prospect", cold: "cold prospect", no_site: "no-site prospect", dead: "unscored prospect (no signals found)" };
  return LABELS[tier] || "prospect";
}

// Build the company `enrichment` JSON in the EXACT shape crm-lookup.js's Intel dossier reads and
// writes — top-level enrich fields + _directory + _intel + _signals + _looked_up_at — from a
// prospect's waterfall data. Shared by every place a prospect's signals get cached onto a company
// (promote to Open, queue as whale) so a lookup done ANYWHERE shows up in Intel everywhere,
// instead of each caller inventing its own bespoke shape the Intel tab can't actually read.
// MERGES onto whatever enrichment already exists — never overwrites a real Intel synthesis.
function buildProspectEnrichment(prevRaw, p, sig) {
  let prev = {}; try { prev = prevRaw ? JSON.parse(prevRaw) : {}; } catch (_) {}
  const { _directory: pDir, _intel: pInt, _signals: pSig, _looked_up_at: pLu, _last_cost: pLc, ...pEnr } = prev;
  const reasons = safeJson(p.reasons, []);
  const signals = {
    ...pSig,
    pays_per_lead: (sig.marketplaces || []).length > 0,
    marketplaces: (sig.marketplaces && sig.marketplaces.length) ? sig.marketplaces : (pSig && pSig.marketplaces) || [],
    running_ads: sig.running_ads != null ? sig.running_ads : ((pSig && pSig.running_ads) ?? null),
    call_tracking: sig.call_tracking || (pSig && pSig.call_tracking) || null,
    field_crm: sig.field_crm || (pSig && pSig.field_crm) || null,
    competitor_id: sig.competitor_id || (pSig && pSig.competitor_id) || null,
    trade: p.trade || (pSig && pSig.trade) || null,
    has_form: sig.has_form != null ? sig.has_form : ((pSig && pSig.has_form) ?? null),
    traffic_month: sig.traffic_month != null ? sig.traffic_month : ((pSig && pSig.traffic_month) ?? null),
    // Prospecting only ever has ONE ad-spend estimate (no low/high split) — Intel's chip reads
    // ad_spend_low/high, so surface the single figure as both rather than fabricating a range.
    ad_spend_low: sig.ad_spend != null ? sig.ad_spend : ((pSig && pSig.ad_spend_low) ?? null),
    ad_spend_high: sig.ad_spend != null ? sig.ad_spend : ((pSig && pSig.ad_spend_high) ?? null),
    rating: p.rating != null ? p.rating : ((pSig && pSig.rating) ?? null),
    reviews: p.reviews != null ? p.reviews : ((pSig && pSig.reviews) ?? null),
    phone: p.phone || (pSig && pSig.phone) || null,
    icp: { score: p.score, tier: p.tier, reasons },
  };
  return {
    ...pEnr,
    website: { ...((pEnr && pEnr.website) || {}), domain: p.domain || ((pEnr && pEnr.website && pEnr.website.domain) || null), capture: sig.has_form === true ? true : ((pEnr && pEnr.website && pEnr.website.capture) ?? null) },
    gmb: p.rating != null ? { rating: p.rating, reviews: p.reviews || 0, verified: false, ...((pEnr && pEnr.gmb) || {}) } : ((pEnr && pEnr.gmb) || null),
    _directory: pDir || {},
    _intel: { ...(pInt || {}), trade: p.trade || (pInt && pInt.trade) || null },   // NO synthesis — a real Intel lookup still runs to deepen this
    _signals: signals,
    _looked_up_at: pLu || p.updated_at || new Date().toISOString(),
    _last_cost: pLc || 0,
    _source: (pEnr && pEnr._source) || "prospecting",
  };
}

// Queue a prospect as a WHALE — NOTHING else happens (no conversation, no assignment, no
// Apollo reveal). Creates/updates the company, caches signals so Intel pre-fills, flags it,
// and marks the prospect done so it leaves the active prospecting list and shows in Whales.
async function queueWhale(env, prospectId, actorId) {
  const p = await env.DB.prepare("SELECT * FROM prospects WHERE id=?").bind(prospectId).first().catch(() => null);
  if (!p) return { kind: "failed", error: "not_found", meta: null, conversation_id: null };
  const sig = safeJson(p.signals, {});
  const companyId = await findOrCreateCompany(env, { name: p.name || p.domain, domain: p.domain || null, allowNameOnly: true }).catch(() => null);
  if (companyId) {
    const cur = await env.DB.prepare("SELECT enrichment FROM companies WHERE id=?").bind(companyId).first().catch(() => null);
    const e = buildProspectEnrichment(cur && cur.enrichment, p, sig);
    try { const org = p.domain ? await apolloOrgSummary(env, p.domain, p.name) : null; if (org) e.apollo = org; } catch (_) {}
    let actorName = "CRM"; if (actorId) { const u = await env.DB.prepare("SELECT name FROM users WHERE id=?").bind(actorId).first().catch(() => null); if (u && u.name) actorName = u.name; }
    e._whale = { flagged: true, reason: "queued from Prospecting for review", by: actorName, at: new Date().toISOString() };
    await env.DB.prepare("UPDATE companies SET enrichment=?, domain=COALESCE(domain,?), updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(e), p.domain || null, companyId).run().catch(() => {});
  }
  await env.DB.prepare("UPDATE prospects SET status='promoted', disposition='whale', disposition_by=?, disposition_at=datetime('now'), updated_at=datetime('now') WHERE id=?").bind(actorId, prospectId).run().catch(() => {});
  await addActivityV2(env, { actorId, entityType: "company", entityId: companyId || prospectId, action: "whale_queued", meta: { domain: p.domain } }).catch(() => {});
  return { kind: "whale", meta: { whale: true, company_id: companyId, queued: true }, conversation_id: null };
}

// Flag an ALREADY-promoted company as a whale (used by the Apollo path if it ever routes here).
async function flagWhaleCompany(env, companyId, actorId, reason) {
  if (!companyId) return;
  let actorName = "CRM";
  if (actorId) { const u = await env.DB.prepare("SELECT name FROM users WHERE id=?").bind(actorId).first().catch(() => null); if (u && u.name) actorName = u.name; }
  const co = await env.DB.prepare("SELECT enrichment FROM companies WHERE id=?").bind(companyId).first().catch(() => null);
  let e = {}; try { e = co && co.enrichment ? JSON.parse(co.enrichment) : {}; } catch (_) {}
  e._whale = { flagged: true, reason: reason || "needs special attention", by: actorName, at: new Date().toISOString() };
  await env.DB.prepare("UPDATE companies SET enrichment=?, updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(e), companyId).run().catch(() => {});
}

const rid = (p) => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const cents = (usd) => Math.round(Number(usd || 0) * 100);

export async function ensureProspectingSchema(env) {
  const S = (sql) => env.DB.prepare(sql).run().catch(() => {});
  await S(`CREATE TABLE IF NOT EXISTS prospects (
    id TEXT PRIMARY KEY, domain TEXT UNIQUE, name TEXT, phone TEXT, city TEXT, region TEXT, trade TEXT,
    rating REAL, reviews INTEGER, score INTEGER DEFAULT 0, tier TEXT DEFAULT 'unscored',
    signals TEXT, reasons TEXT, stages_run TEXT, cost_cents INTEGER DEFAULT 0,
    status TEXT DEFAULT 'new', run_id TEXT, promoted_contact_id TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
  await S(`CREATE INDEX IF NOT EXISTS idx_prospects_tier ON prospects(tier, trade)`);
  await S(`CREATE INDEX IF NOT EXISTS idx_prospects_city ON prospects(city, trade)`);
  await S(`CREATE INDEX IF NOT EXISTS idx_prospects_run ON prospects(run_id)`);
  await S(`CREATE TABLE IF NOT EXISTS prospect_runs (
    id TEXT PRIMARY KEY, query TEXT, stage TEXT DEFAULT 'tech', counts TEXT,
    cost_cents INTEGER DEFAULT 0, max_cost_cents INTEGER DEFAULT 500, status TEXT DEFAULT 'running',
    actor TEXT, note TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
  await S(`CREATE INDEX IF NOT EXISTS idx_prospect_runs_status ON prospect_runs(status)`);
  // Batch Triage: per-row disposition (Open / Sequence / Newsletter / Instantly / Skip) and the
  // meta that records the side-effect result (conversation_id, sequence run, etc.) for idempotency.
  await S(`ALTER TABLE prospects ADD COLUMN disposition TEXT`);
  await S(`ALTER TABLE prospects ADD COLUMN disposition_meta TEXT`);
  await S(`ALTER TABLE prospects ADD COLUMN disposition_by TEXT`);
  await S(`ALTER TABLE prospects ADD COLUMN disposition_at TEXT`);
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

// ── GET: prospect list + run summaries ──────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  await ensureProspectingSchema(env);
  const u = new URL(request.url);
  const tier = u.searchParams.get("tier");
  const trade = u.searchParams.get("trade");
  const city = u.searchParams.get("city");
  const run = u.searchParams.get("run");
  const limit = Math.min(Number(u.searchParams.get("limit") || 200), 500);

  const where = ["status != 'suppressed'"];
  const binds = [];
  if (tier && tier !== "all") { where.push("tier = ?"); binds.push(tier); }
  if (trade) { where.push("trade = ?"); binds.push(trade); }
  if (city) { where.push("city LIKE ?"); binds.push("%" + city + "%"); }
  if (run) { where.push("run_id = ?"); binds.push(run); }

  const rows = await env.DB.prepare(
    `SELECT id, domain, name, phone, city, region, trade, rating, reviews, score, tier, signals, reasons,
            cost_cents, status, promoted_contact_id, disposition, disposition_meta, run_id, stages_run, created_at
     FROM prospects WHERE ${where.join(" AND ")}
     ORDER BY score DESC, reviews DESC LIMIT ?`
  ).bind(...binds, limit).all().catch(() => ({ results: [] }));
  const prospects = (rows.results || []).map((r) => ({
    ...r,
    signals: safeJson(r.signals, {}),
    reasons: safeJson(r.reasons, []),
    disposition_meta: safeJson(r.disposition_meta, null),
    cost: (r.cost_cents || 0) / 100,
  }));
  // Disposition tally for the triage footer counters.
  const dispRes = await env.DB.prepare(
    `SELECT disposition d, COUNT(*) n FROM prospects WHERE status != 'suppressed' AND disposition IS NOT NULL GROUP BY disposition`
  ).all().catch(() => ({ results: [] }));
  const dispositionCounts = {}; for (const t of (dispRes.results || [])) dispositionCounts[t.d] = t.n;

  const runsRes = await env.DB.prepare(
    `SELECT id, query, stage, counts, cost_cents, max_cost_cents, status, created_at, updated_at, note
     FROM prospect_runs ORDER BY created_at DESC LIMIT 20`
  ).all().catch(() => ({ results: [] }));
  const runs = (runsRes.results || []).map((r) => ({
    ...r, query: safeJson(r.query, {}), counts: safeJson(r.counts, {}), cost: (r.cost_cents || 0) / 100,
  }));
  // Real progress for active runs — domains that have finished the whole waterfall (reached the
  // backlinks stage) vs the total domains in the run. Drives the progress bar (no more polling-blind).
  for (const r of runs) {
    if (r.status === "running" || r.status === "paused") {
      const pr = await env.DB.prepare(
        "SELECT COUNT(*) total, SUM(CASE WHEN stages_run LIKE '%backlinks%' THEN 1 ELSE 0 END) done FROM prospects WHERE run_id=? AND domain IS NOT NULL"
      ).bind(r.id).first().catch(() => null);
      const total = pr ? Number(pr.total || 0) : 0;
      const done = pr ? Number(pr.done || 0) : 0;
      r.progress = { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
    }
  }

  const tierRes = await env.DB.prepare(
    `SELECT tier, COUNT(*) n FROM prospects WHERE status != 'suppressed' GROUP BY tier`
  ).all().catch(() => ({ results: [] }));
  const tierCounts = {}; for (const t of (tierRes.results || [])) tierCounts[t.tier] = t.n;

  return json({ ok: true, prospects, runs, tierCounts, dispositionCounts, dfs: dfsConfigured(env), trades: Object.keys(TRADE_CATEGORIES) }, {}, cors);
}

// ── POST: sweep / promote / suppress ────────────────────────────────────────
export async function onRequestPost({ request, env, ctx }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  await ensureCrmV2Schema(env);
  await ensureProspectingSchema(env);
  const b = await request.json().catch(() => ({}));
  const action = b.action || "sweep";
  const user = await currentUser(request, env).catch(() => null);
  const actorId = (user && user.id) || (await adminUserId(env).catch(() => null));

  if (action === "promote") return promote(env, b, actorId, cors);
  if (action === "suppress") return suppress(env, b, cors);
  if (action === "process") { // manual kick of the waterfall (also runs on cron)
    const out = await processProspectRuns(env, { maxDomains: Number(b.max || 25) });
    return json({ ok: true, processed: out }, {}, cors);
  }
  // ── Batch Triage ──
  if (action === "import_csv") return importCsv(env, b, actorId, ctx, cors);
  if (action === "disposition") return setDisposition(env, b, actorId, cors);
  if (action === "bulk_disposition") return bulkDisposition(env, b, actorId, cors);
  if (action === "push_dispositions") return pushDispositions(env, b, actorId, ctx, cors);
  if (action === "keep") return keepProspect(env, b, actorId, cors);
  if (action === "apollo_search") return apolloSearch(env, b, cors);
  if (action === "apollo_keep") return apolloKeep(env, b, actorId, cors);

  // action === "sweep" — Stage 0 TAM import.
  if (!dfsConfigured(env)) return json({ ok: false, error: "dfs_not_configured", message: "DataForSEO credentials are not set." }, { status: 400 }, cors);
  const trade = String(b.trade || "").toLowerCase().trim();
  const city = String(b.city || "").trim();
  const region = String(b.region || "").trim();
  const limit = Math.min(Number(b.limit || 100), 300);
  const maxCostCents = Math.max(50, Math.min(Number(b.max_cost_cents || 500), 5000));
  if (!trade || !city) return json({ ok: false, error: "need_trade_city", message: "Both trade and city are required." }, { status: 400 }, cors);

  const listing = await dfsBusinessListings(env, { trade, city, region, limit });
  if (!listing.used) return json({ ok: false, error: "dfs_error", message: listing.error || "Business Listings lookup failed." }, { status: 502 }, cors);

  const runId = rid("pr_run_");
  let inserted = 0, noSite = 0, skipped = 0;
  for (const biz of listing.businesses) {
    const domain = normDomain(biz.domain);
    if (!domain) {
      noSite++;
      // Park no-site businesses too, so they aren't silently dropped (separate play).
      const id = rid("pr_");
      await env.DB.prepare(
        `INSERT OR IGNORE INTO prospects (id, domain, name, phone, city, region, trade, rating, reviews, tier, status, run_id, signals)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'no_site', 'new', ?, ?)`
      ).bind(id, biz.name, biz.phone, biz.city, biz.region, trade, biz.rating, biz.reviews, runId,
        JSON.stringify({ has_site: false, rating: biz.rating, reviews: biz.reviews })).run().catch(() => {});
      continue;
    }
    // De-dupe by domain — a contractor already in the table isn't re-swept.
    const exists = await env.DB.prepare("SELECT id FROM prospects WHERE domain=?").bind(domain).first().catch(() => null);
    if (exists) { skipped++; continue; }
    const id = rid("pr_");
    const seed = { has_site: true, rating: biz.rating, reviews: biz.reviews };
    const ok = await env.DB.prepare(
      `INSERT OR IGNORE INTO prospects (id, domain, name, phone, city, region, trade, rating, reviews, tier, status, run_id, signals, stages_run)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unscored', 'new', ?, ?, ?)`
    ).bind(id, domain, biz.name, biz.phone, biz.city, biz.region, trade, biz.rating, biz.reviews, runId,
      JSON.stringify(seed), JSON.stringify(["tam"])).run().catch(() => null);
    if (ok) inserted++;
  }

  const counts = { found: listing.businesses.length, sites: inserted, no_site: noSite, dupes: skipped, tech: 0, traffic: 0, backlinks: 0, hot: 0, warm: 0, cold: 0, dead: 0 };
  await env.DB.prepare(
    `INSERT INTO prospect_runs (id, query, stage, counts, cost_cents, max_cost_cents, status, actor)
     VALUES (?, ?, 'tech', ?, ?, ?, ?, ?)`
  ).bind(runId, JSON.stringify({ trade, city, region, limit }), JSON.stringify(counts),
    cents(listing.cost), maxCostCents, inserted > 0 ? "running" : "done", actorId).run().catch(() => {});

  await addActivityV2(env, { actorId, entityType: "prospect_run", entityId: runId, action: "sweep_started",
    meta: { trade, city, found: counts.found, sites: inserted, cost: listing.cost } }).catch(() => {});

  // Kick the first waterfall batch immediately so the user sees movement without waiting for cron.
  if (inserted > 0 && ctx && ctx.waitUntil) ctx.waitUntil(processProspectRuns(env, { maxDomains: 20 }).catch(() => {}));

  return json({ ok: true, run_id: runId, counts, cost: listing.cost,
    message: `Found ${counts.found} businesses — ${inserted} with sites queued for scoring (${noSite} no-site, ${skipped} already known).` }, {}, cors);
}

// ── The waterfall: called by cron AND by the sweep's waitUntil kick ──────────
// Processes one bounded batch across all `running` runs. Each domain advances
// through tech → traffic → backlinks; when a run has no more domains to enrich,
// it scores everything and marks itself done.
export async function processProspectRuns(env, { maxDomains = 25 } = {}) {
  await ensureProspectingSchema(env);
  if (!dfsConfigured(env)) return { skipped: "dfs_not_configured" };
  const runs = await env.DB.prepare("SELECT * FROM prospect_runs WHERE status='running' ORDER BY updated_at LIMIT 5").all().catch(() => ({ results: [] }));
  let touched = 0;
  const summary = [];

  for (const run of (runs.results || [])) {
    let runCost = run.cost_cents || 0;
    const maxCost = run.max_cost_cents || 500;
    const counts = safeJson(run.counts, {});
    let budgetHit = false;

    // Domains in this run that still need enrichment (haven't reached backlinks yet),
    // that HAVE a site. We process them one full step per pass to keep costs visible.
    const pending = await env.DB.prepare(
      `SELECT id, domain, signals, stages_run, cost_cents FROM prospects
       WHERE run_id=? AND domain IS NOT NULL AND status='new'
         AND (stages_run IS NULL OR stages_run NOT LIKE '%backlinks%')
       ORDER BY reviews DESC LIMIT ?`
    ).bind(run.id, maxDomains).all().catch(() => ({ results: [] }));

    const list = pending.results || [];
    if (!list.length) {
      // Nothing left to enrich → finalize the run.
      const finalCounts = await tallyRun(env, run.id, counts);
      await env.DB.prepare("UPDATE prospect_runs SET status='done', counts=?, updated_at=datetime('now') WHERE id=?")
        .bind(JSON.stringify(finalCounts), run.id).run().catch(() => {});
      summary.push({ run: run.id, done: true, counts: finalCounts });
      continue;
    }

    for (const p of list) {
      if (runCost >= maxCost) { budgetHit = true; break; }
      const sig = safeJson(p.signals, {});
      const stages = safeJson(p.stages_run, ["tam"]);
      let addCost = 0;

      // Stage 0.5: FREE site scan — socials, GMB (schema rating), form / chat / pixels / tech /
      // trade guess. No API cost (one fetch). This is why batch/CSV records now get a digital
      // footprint, not just DataForSEO signals.
      if (!stages.includes("site")) {
        const home = await fetchSite(p.domain).catch(() => null);
        if (home && home.ok && home.html) {
          const ps = parseSite(p.domain, home.html);
          if (ps.enrich.website) sig.has_form = ps.enrich.website.capture;
          if (ps.enrich.gmb) { sig.gmb = ps.enrich.gmb; sig.rating = ps.enrich.gmb.rating; sig.reviews = ps.enrich.gmb.reviews; }
          if (ps.enrich.facebook) sig.facebook = ps.enrich.facebook.handle;
          if (ps.directory) { if (ps.directory.instagram) sig.instagram = ps.directory.instagram; if (ps.directory.linkedin) sig.linkedin = ps.directory.linkedin; if (ps.directory.tiktok) sig.tiktok = ps.directory.tiktok; if (ps.directory.phone && !p.phone) sig.phone = ps.directory.phone; }
          if (ps.enrich.pixels && ps.enrich.pixels.length) sig.ad_pixels = sig.ad_pixels || ps.enrich.pixels.join(", ");
          if (ps.intel.tech && ps.intel.tech.length) sig.tech = [...new Set([...(sig.tech || []), ...ps.intel.tech])].slice(0, 20);
          if (ps.intel.chat != null) sig.chat = ps.intel.chat;
          if (ps.intel.trade && !p.trade) sig.trade_guess = ps.intel.trade;
          if (ps.enrich.gmb && ps.enrich.gmb.rating != null) {
            await env.DB.prepare("UPDATE prospects SET rating=COALESCE(rating,?), reviews=COALESCE(NULLIF(reviews,0),?) WHERE id=?")
              .bind(ps.enrich.gmb.rating, ps.enrich.gmb.reviews || 0, p.id).run().catch(() => {});
          }
        }
        stages.push("site"); counts.site = (counts.site || 0) + 1;
      }
      // Stage 1: tech fingerprint
      else if (!stages.includes("tech")) {
        const t = await dfsTech(env, p.domain);
        addCost += cents(t.cost);
        if (t.used) {
          const h = t.hits || {};
          sig.call_tracking = h.call_tracking || null;
          sig.field_crm = h.field_crm || null;
          sig.ad_pixels = h.ad_pixels || null;
          sig.competitor_id = h.competitor_id || null;
          sig.review_tools = h.review_tools || null;
          sig.tech = (t.all || []).slice(0, 20);
        }
        stages.push("tech"); counts.tech = (counts.tech || 0) + 1;
      }
      // Stage 2: traffic + ads
      else if (!stages.includes("traffic")) {
        const d = await dataforseoLookup(env, p.domain);
        addCost += cents(d.cost);
        if (d.used) {
          sig.traffic_month = d.data.traffic_month;
          sig.ad_spend = d.data.ad_spend;
          sig.running_ads = (d.data.paid_keywords || 0) > 0 || (d.data.ad_spend || 0) > 0;
          sig.paid_keywords = d.data.paid_keywords;
        }
        stages.push("traffic"); counts.traffic = (counts.traffic || 0) + 1;
      }
      // Stage 3: backlinks (paying-per-lead) — gated: only if a maturity/budget signal already showed.
      else if (!stages.includes("backlinks")) {
        const worthIt = sig.competitor_id || sig.call_tracking || sig.field_crm || sig.running_ads || (sig.ad_pixels && (sig.traffic_month || 0) > 50);
        if (worthIt) {
          const bl = await dfsBacklinks(env, p.domain);
          addCost += cents(bl.cost);
          if (bl.used) sig.marketplaces = bl.marketplaces || [];
          counts.backlinks = (counts.backlinks || 0) + 1;
        } else {
          sig.marketplaces = sig.marketplaces || []; // skipped — not worth the priciest call
        }
        stages.push("backlinks");
      }

      // Re-score after every step so the tier is always current.
      const scored = scoreProspect(sig);
      const newCost = (p.cost_cents || 0) + addCost;
      await env.DB.prepare(
        `UPDATE prospects SET signals=?, reasons=?, stages_run=?, score=?, tier=?, cost_cents=?, updated_at=datetime('now') WHERE id=?`
      ).bind(JSON.stringify(sig), JSON.stringify(scored.reasons), JSON.stringify(stages),
        scored.score, scored.tier, newCost, p.id).run().catch(() => {});
      runCost += addCost;
      touched++;
    }

    const finalCounts = await tallyRun(env, run.id, counts);
    const status = budgetHit ? "paused" : "running";
    const note = budgetHit ? `Paused at cost ceiling ($${(maxCost / 100).toFixed(2)}). ${await pendingCount(env, run.id)} domains not yet scored.` : run.note;
    await env.DB.prepare("UPDATE prospect_runs SET cost_cents=?, counts=?, status=?, note=?, updated_at=datetime('now') WHERE id=?")
      .bind(runCost, JSON.stringify(finalCounts), status, note, run.id).run().catch(() => {});
    summary.push({ run: run.id, touched, cost: runCost / 100, status, counts: finalCounts });
  }
  return { touched, runs: summary };
}

async function tallyRun(env, runId, base) {
  const res = await env.DB.prepare("SELECT tier, COUNT(*) n FROM prospects WHERE run_id=? GROUP BY tier").bind(runId).all().catch(() => ({ results: [] }));
  const c = { ...base, hot: 0, warm: 0, cold: 0, dead: 0, no_site: base.no_site || 0 };
  for (const r of (res.results || [])) if (r.tier in c || ["hot", "warm", "cold", "dead", "no_site"].includes(r.tier)) c[r.tier] = r.n;
  return c;
}
async function pendingCount(env, runId) {
  const r = await env.DB.prepare("SELECT COUNT(*) n FROM prospects WHERE run_id=? AND domain IS NOT NULL AND status='new' AND (stages_run IS NULL OR stages_run NOT LIKE '%backlinks%')").bind(runId).first().catch(() => null);
  return r ? r.n : 0;
}

// ── Promote a prospect into a real lead ─────────────────────────────────────
async function promote(env, b, actorId, cors) {
  const r = await promoteCore(env, b.id, actorId);
  if (!r.ok) return json(r, { status: r.status || 400 }, cors);
  return json(r, {}, cors);
}

// Core promotion — shared by the promote action AND Batch Triage dispositions. Creates a
// company + provisional contact + an open conversation (so it surfaces in the pipeline), caches
// the prospect's signals in the Intel shape, and returns the ids. Idempotent per prospect.
async function promoteCore(env, prospectId, actorId) {
  const p = await env.DB.prepare("SELECT * FROM prospects WHERE id=?").bind(prospectId).first().catch(() => null);
  if (!p) return { ok: false, status: 404, error: "not_found" };
  if (p.promoted_contact_id) {
    const cv = await env.DB.prepare("SELECT id FROM conversations WHERE contact_id=? ORDER BY created_at LIMIT 1").bind(p.promoted_contact_id).first().catch(() => null);
    return { ok: true, already: true, contact_id: p.promoted_contact_id, conversation_id: cv ? cv.id : null };
  }

  const sig = safeJson(p.signals, {});
  const companyId = await findOrCreateCompany(env, { name: p.name || p.domain, domain: p.domain || null, allowNameOnly: true }).catch(() => null);
  // Cache the enrichment on the company in the EXACT shape crm-lookup.js's Intel dossier reads
  // and writes (buildProspectEnrichment, shared with queueWhale) — a previous version wrote a
  // bespoke shape (raw `sig` under `_signals`, `{trade}` under `_intel`, no field-name mapping)
  // that LOOKED right but didn't match what the Intel tab actually destructures (e.g. it reads
  // `_signals.ad_spend_low/high`, prospecting only ever had a single `ad_spend`), so a promoted
  // prospect's signal chips + ICP score silently failed to render and Intel looked never-enriched.
  if (companyId) {
    const existing = await env.DB.prepare("SELECT enrichment FROM companies WHERE id=?").bind(companyId).first().catch(() => null);
    const enrichment = buildProspectEnrichment(existing && existing.enrichment, p, sig);
    await env.DB.prepare("UPDATE companies SET enrichment=?, domain=COALESCE(domain,?), updated_at=datetime('now') WHERE id=?")
      .bind(JSON.stringify(enrichment), p.domain || null, companyId).run().catch(() => {});
  }
  const contactId = rid("ct_");
  await env.DB.prepare(
    `INSERT INTO contacts (id, company_id, full_name, phone, source, is_provisional, enrichment)
     VALUES (?, ?, ?, ?, 'prospecting', 1, ?)`
  ).bind(contactId, companyId, p.name || p.domain, p.phone || null, JSON.stringify({ _signals: sig, trade: p.trade })).run().catch(() => {});

  // Create a conversation so it surfaces in the pipeline/inbox as a workable lead.
  const convId = rid("cv_");
  // Auto-assign the lead to whoever processed it (the actor), so it lands in Open already owned.
  await env.DB.prepare(
    `INSERT INTO conversations (id, contact_id, company_id, channel, source_detail, status, unread, subject, last_message_at, last_message_preview, assignee_id)
     VALUES (?, ?, ?, 'prospecting', ?, 'open', 0, ?, datetime('now'), ?, ?)`
  ).bind(convId, contactId, companyId, `Prospecting · ${p.city || ""} ${p.trade || ""}`.trim(),
    `${p.name || p.domain} — ${prospectTierLabel(p.tier)}`, (safeJson(p.reasons, [])[0] || "Prospected lead"), actorId || null).run().catch(() => {});

  await env.DB.prepare("UPDATE prospects SET status='promoted', promoted_contact_id=?, updated_at=datetime('now') WHERE id=?").bind(contactId, p.id).run().catch(() => {});
  await addActivityV2(env, { actorId, entityType: "contact", entityId: contactId, action: "promoted_from_prospect",
    meta: { prospect_id: p.id, domain: p.domain, tier: p.tier, score: p.score } }).catch(() => {});

  // AUDIT TRAIL — a prospect must never reach the Open pipeline without an intentional action, so
  // record WHO did it, WHEN (the note's created_at), and from WHERE as a note in the conversation's
  // Communication/Activity. Makes any promotion visible + attributable.
  let actorName = "system";
  if (actorId) { const u = await env.DB.prepare("SELECT name FROM users WHERE id=?").bind(actorId).first().catch(() => null); if (u && u.name) actorName = u.name; }
  let src = "prospecting";
  if (p.run_id) {
    const rr = await env.DB.prepare("SELECT query FROM prospect_runs WHERE id=?").bind(p.run_id).first().catch(() => null);
    const q = rr ? safeJson(rr.query, {}) : {};
    src = q.kind === "csv" ? ("CSV import" + (q.filename ? ` (${q.filename})` : "")) : (q.trade || q.city ? ("sweep " + [q.trade, q.city].filter(Boolean).join(" · ")) : "a prospecting run");
  }
  const noteBody = `🎯 Added to the Open pipeline by ${actorName} — from ${src}. Prospect tier: ${p.tier}${p.score != null ? ` (score ${p.score})` : ""}.${actorId ? ` Auto-assigned to ${actorName}.` : ""}`;
  await env.DB.prepare("INSERT INTO notes (id, author_id, conversation_id, contact_id, body) VALUES (?,?,?,?,?)")
    .bind(rid("nt_"), actorId || null, convId, contactId, noteBody).run().catch(() => {});

  return { ok: true, contact_id: contactId, conversation_id: convId };
}

async function suppress(env, b, cors) {
  await env.DB.prepare("UPDATE prospects SET status='suppressed', updated_at=datetime('now') WHERE id=?").bind(b.id).run().catch(() => {});
  return json({ ok: true }, {}, cors);
}

// ── Batch Triage: CSV import ─────────────────────────────────────────────────
// Minimal CSV parser (quoted fields + commas). Returns array of {header:value} objects.
function parseCsv(text) {
  const rows = [];
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return rows;
  const split = (line) => {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/^﻿/, ""));
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]); const o = {};
    headers.forEach((h, j) => { o[h] = cells[j] != null ? cells[j] : ""; });
    rows.push(o);
  }
  return rows;
}
const pick = (o, keys) => { for (const k of keys) if (o[k]) return o[k]; return ""; };

// Import a CSV (or a pre-parsed rows array) of ICP domains as prospects, then kick the same
// enrichment waterfall the trade/city sweep uses. Dedupes on domain (an already-known prospect
// is reused, never re-paid). One column named "domain" is required; name/trade/city optional.
async function importCsv(env, b, actorId, ctx, cors) {
  const raw = typeof b.csv === "string" ? parseCsv(b.csv) : (Array.isArray(b.rows) ? b.rows : []);
  if (!raw.length) return json({ ok: false, error: "empty", message: "No rows found — expected a CSV with a 'domain' column." }, { status: 400 }, cors);
  const filename = String(b.filename || "upload.csv").slice(0, 120);
  const maxCostCents = Math.max(50, Math.min(Number(b.max_cost_cents || 2000), 20000));
  const runId = rid("pr_run_");
  let inserted = 0, dupes = 0, invalid = 0;
  const seen = new Set();
  for (const r of raw) {
    const domain = normDomain(pick(r, ["domain", "website", "url", "site"]));
    if (!domain) { invalid++; continue; }
    if (seen.has(domain)) { dupes++; continue; }
    seen.add(domain);
    const exists = await env.DB.prepare("SELECT id FROM prospects WHERE domain=?").bind(domain).first().catch(() => null);
    if (exists) {
      // Reuse the existing prospect but attach it to THIS run so it shows in the batch list.
      await env.DB.prepare("UPDATE prospects SET run_id=?, updated_at=datetime('now') WHERE id=?").bind(runId, exists.id).run().catch(() => {});
      dupes++; continue;
    }
    const id = rid("pr_");
    const name = pick(r, ["business_name", "name", "company", "business"]) || domain;
    const trade = pick(r, ["trade", "category", "industry"]).toLowerCase() || null;
    const city = pick(r, ["city", "town"]) || null;
    const region = pick(r, ["state", "region", "province"]) || null;
    const ok = await env.DB.prepare(
      `INSERT OR IGNORE INTO prospects (id, domain, name, city, region, trade, tier, status, run_id, signals, stages_run)
       VALUES (?, ?, ?, ?, ?, ?, 'unscored', 'new', ?, ?, ?)`
    ).bind(id, domain, name, city, region, trade, runId, JSON.stringify({ has_site: true }), JSON.stringify(["tam"])).run().catch(() => null);
    if (ok) inserted++;
  }
  const counts = { found: raw.length, sites: inserted, dupes, invalid, tech: 0, traffic: 0, backlinks: 0, hot: 0, warm: 0, cold: 0, dead: 0 };
  await env.DB.prepare(
    `INSERT INTO prospect_runs (id, query, stage, counts, cost_cents, max_cost_cents, status, actor, note)
     VALUES (?, ?, 'tech', ?, 0, ?, ?, ?, ?)`
  ).bind(runId, JSON.stringify({ kind: "csv", filename, total: raw.length }), JSON.stringify(counts),
    maxCostCents, inserted > 0 ? "running" : "done", actorId, `CSV import: ${filename}`).run().catch(() => {});
  await addActivityV2(env, { actorId, entityType: "prospect_run", entityId: runId, action: "csv_import", meta: { filename, found: raw.length, sites: inserted } }).catch(() => {});
  if (inserted > 0 && ctx && ctx.waitUntil) ctx.waitUntil(processProspectRuns(env, { maxDomains: 20 }).catch(() => {}));
  return json({ ok: true, run_id: runId, counts,
    message: `Imported ${inserted} new domain(s) — enriching now. ${dupes} already known, ${invalid} without a valid domain.` }, {}, cors);
}

// ── Batch Triage: dispositions ───────────────────────────────────────────────
async function setDisposition(env, b, actorId, cors) {
  const disp = DISPOSITIONS.includes(b.disposition) ? b.disposition : null;
  await env.DB.prepare("UPDATE prospects SET disposition=?, disposition_meta=NULL, disposition_by=?, disposition_at=datetime('now'), updated_at=datetime('now') WHERE id=?")
    .bind(disp, actorId, b.id).run().catch(() => {});
  return json({ ok: true, id: b.id, disposition: disp }, {}, cors);
}
async function bulkDisposition(env, b, actorId, cors) {
  const disp = DISPOSITIONS.includes(b.disposition) ? b.disposition : null;
  const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 1000);
  if (!ids.length) return json({ ok: false, error: "no_ids" }, { status: 400 }, cors);
  const ph = ids.map(() => "?").join(",");
  await env.DB.prepare(`UPDATE prospects SET disposition=?, disposition_meta=NULL, disposition_by=?, disposition_at=datetime('now'), updated_at=datetime('now') WHERE id IN (${ph})`)
    .bind(disp, actorId, ...ids).run().catch(() => {});
  return json({ ok: true, updated: ids.length, disposition: disp }, {}, cors);
}

// Execute the side effects for triaged prospects that haven't been pushed yet (disposition_meta
// NULL). Idempotent — a re-run skips rows already actioned. Open/Sequence/Newsletter run live;
// Instantly is STAGED (recorded, not pushed) until the campaign mapping is verified.
async function pushDispositions(env, b, actorId, ctx, cors) {
  const rows = await env.DB.prepare(
    `SELECT id FROM prospects WHERE disposition IS NOT NULL AND disposition_meta IS NULL AND status != 'suppressed' LIMIT 200`
  ).all().catch(() => ({ results: [] }));
  const out = { open: 0, sequence: 0, newsletter: 0, instantly_staged: 0, skip: 0, failed: 0 };
  for (const row of (rows.results || [])) {
    const p = await env.DB.prepare("SELECT id, disposition FROM prospects WHERE id=?").bind(row.id).first().catch(() => null);
    if (!p) continue;
    const r = await executeDisposition(env, p.id, p.disposition, actorId).catch(() => ({ kind: "failed" }));
    if (r.kind === "failed") { out.failed++; continue; }
    out[r.kind] = (out[r.kind] || 0) + 1;
    await env.DB.prepare("UPDATE prospects SET disposition_meta=?, updated_at=datetime('now') WHERE id=?")
      .bind(JSON.stringify(r.meta || {}), p.id).run().catch(() => {});
  }
  return json({ ok: true, pushed: out,
    message: `Pushed: ${out.open} opened, ${out.sequence} into sequence, ${out.newsletter} to newsletter, ${out.skip} skipped. ${out.instantly_staged} Instantly staged (not sent).` }, {}, cors);
}

// Execute ONE disposition's side effect. Shared by push (batch) and keep (per-card, immediate).
// Open/Sequence/Newsletter run live; Instantly is STAGED (recorded, not sent). Returns
// { kind, meta, conversation_id } — `kind` is an `out`-counter key (open|sequence|newsletter|
// instantly_staged|skip|failed).
async function executeDisposition(env, prospectId, disposition, actorId) {
  if (disposition === "skip") return { kind: "skip", meta: { skipped: true } };
  if (disposition === "instantly") return { kind: "instantly_staged", meta: { staged: "instantly", note: "Instantly push staged — not sent" } };
  if (disposition === "whale") return await queueWhale(env, prospectId, actorId); // queue only — no conversation
  const pr = await promoteCore(env, prospectId, actorId);
  if (!pr.ok) return { kind: "failed", error: pr.error, meta: null };
  const meta = { conversation_id: pr.conversation_id || null, contact_id: pr.contact_id };
  if (disposition === "sequence") {
    const en = await enrollContact(env, { contactId: pr.contact_id, conversationId: pr.conversation_id, source: "batch_triage", workflowId: "cold-to-demo" }).catch(() => ({}));
    meta.sequence_run_id = en && en.runId ? en.runId : null;
    return { kind: "sequence", meta, conversation_id: pr.conversation_id };
  }
  if (disposition === "newsletter") {
    await optInContacts(env, { contactIds: [pr.contact_id], captureMethod: "moved_to_newsletter", source: "prospecting" }).catch(() => {});
    meta.newsletter = true;
    return { kind: "newsletter", meta, conversation_id: pr.conversation_id };
  }
  return { kind: "open", meta, conversation_id: pr.conversation_id }; // human conversation
}

// KEEP a single prospect — set the chosen disposition AND execute it immediately (per-card flow).
async function keepProspect(env, b, actorId, cors) {
  const disp = DISPOSITIONS.includes(b.disposition) ? b.disposition : null;
  if (!disp || disp === "skip") return json({ ok: false, error: "bad_disposition" }, { status: 400 }, cors);
  await env.DB.prepare("UPDATE prospects SET disposition=?, disposition_by=?, disposition_at=datetime('now'), updated_at=datetime('now') WHERE id=?")
    .bind(disp, actorId, b.id).run().catch(() => {});
  const r = await executeDisposition(env, b.id, disp, actorId).catch(() => ({ kind: "failed" }));
  if (r.kind === "failed") return json({ ok: false, error: r.error || "execute_failed" }, { status: 400 }, cors);
  await env.DB.prepare("UPDATE prospects SET disposition_meta=? WHERE id=?").bind(JSON.stringify(r.meta || {}), b.id).run().catch(() => {});
  const label = { open: "Opened a human conversation in your Inbox", sequence: "Enrolled in the outreach sequence", newsletter: "Added to the newsletter list", instantly_staged: "Staged for Instantly (recorded — not sent yet)", whale: "Queued to Whales for review" }[r.kind] || "Kept";
  return json({ ok: true, disposition: disp, kind: r.kind, conversation_id: r.conversation_id || null, message: label }, {}, cors);
}

const DISP_LABEL = { open: "Human conversation", sequence: "Sequence", newsletter: "Newsletter", instantly: "Instantly (staged)", whale: "Whales", skip: "Skip" };

// APOLLO CONTACT SEARCH — free, masked preview of decision-makers at the prospect's domain.
// Returns first-name + title + has_email only (no credits spent). The caller ticks who they
// want; apolloKeep then reveals just those (≈1 credit each).
async function apolloSearch(env, b, cors) {
  if (!env.APOLLO_API_KEY) return json({ ok: false, error: "no_api_key", message: "Apollo API key isn't set on this worker." }, { status: 400 }, cors);
  const p = await env.DB.prepare("SELECT id, name, domain, trade FROM prospects WHERE id=?").bind(b.id).first().catch(() => null);
  if (!p) return json({ ok: false, error: "not_found" }, { status: 404 }, cors);
  if (!p.domain) return json({ ok: false, error: "no_domain", message: "This prospect has no website domain — nothing to search Apollo with." }, { status: 400 }, cors);
  // ALL people at the company (no title filter → matches Apollo's web count), paginated.
  const s = await peopleAtDomain(env, p.domain, null, 25, 3).catch((e) => ({ error: String(e) }));
  if (s.error) {
    const scope = /not authorized/i.test(s.error || "");
    return json({ ok: false, error: scope ? "no_scope" : "apollo_error",
      message: scope ? "Your Apollo key doesn't have People Search enabled — turn on People Search + People Enrichment for the key in Apollo settings." : ("Apollo: " + s.error) }, { status: 502 }, cors);
  }
  const isDm = (t) => { const x = String(t || "").toLowerCase(); return ["owner", "founder", "co-founder", "ceo", "chief executive", "president", "partner", "principal", "vice president", "vp", "cmo", "chief marketing", "marketing", "general manager", " gm", "operations", "director"].some((k) => x.includes(k)); };
  const candidates = (s.people || []).map((pp) => ({
    apollo_id: pp.id || null,
    name: pp.first_name || pp.name || "(name hidden)",
    title: pp.title || "",
    company: (pp.organization && pp.organization.name) || p.name || "",
    has_email: !!pp.has_email,
    dm: isDm(pp.title),
  })).filter((c) => c.apollo_id);
  candidates.sort((a, b2) => (b2.dm ? 1 : 0) - (a.dm ? 1 : 0)); // decision-makers first
  const org = await apolloOrgSummary(env, p.domain, p.name);
  return json({ ok: true, domain: p.domain, total: s.total || candidates.length, candidates, org }, {}, cors);
}

// Company-level Apollo intel: headcount, LOCATIONS (franchise signal), socials, relevant tech.
const TECH_BUCKETS_LC = {
  "call tracking": ["callrail", "calltrackingmetrics", "whatconverts", "marchex", "dialpad"],
  "running ads": ["google ads", "adwords", "doubleclick", "facebook pixel", "meta pixel", "bing ads", "gtag"],
  "field CRM": ["servicetitan", "jobber", "housecall", "service fusion", "workiz", "fieldedge"],
  "reviews": ["podium", "birdeye", "nicejob", "grade.us"],
  "live chat": ["intercom", "drift", "tawk", "hubspot chat"],
  "visitor ID (competitor)": ["rb2b", "retention.com", "customers.ai", "warmly", "opensend", "leadpost", "vector"],
};
function relevantTech(names) {
  const low = (names || []).map((x) => String(x).toLowerCase());
  const hits = [];
  for (const [label, arr] of Object.entries(TECH_BUCKETS_LC)) if (arr.some((a) => low.some((t) => t.includes(a)))) hits.push(label);
  return hits;
}
async function apolloOrgSummary(env, domain, fallbackName) {
  try {
    const { apolloOrgEnrich } = await import("../_lib/apollo.js");
    const oe = await apolloOrgEnrich(env, domain);
    const o = (oe && oe.organization) || null;
    if (!o) return null;
    const locations = o.retail_location_count || o.num_locations || o.num_suborganizations || 0;
    const employees = o.estimated_num_employees || null;
    const tech = (o.technology_names || (o.current_technologies || []).map((t) => t && t.name).filter(Boolean) || []).slice(0, 16);
    const is_franchise = (locations && locations >= 5) || (o.num_suborganizations || 0) >= 3 || /franchis/i.test(o.short_description || "") || (employees && employees >= 250);
    return {
      name: o.name || fallbackName || domain,
      employees, locations, is_franchise: !!is_franchise,
      industry: o.industry || null, founded: o.founded_year || null,
      socials: { linkedin: o.linkedin_url || null, facebook: o.facebook_url || null, twitter: o.twitter_url || null, blog: o.blog_url || null },
      tech, tech_relevant: relevantTech(tech),
      description: o.short_description ? String(o.short_description).slice(0, 220) : null,
    };
  } catch (_) { return null; }
}

// APOLLO KEEP — reveal the ticked people, save them as contacts under the prospect's company,
// record consent (EMAIL under B2B legitimate interest; SMS/voice stay off), then run the
// chosen destination. Reuses the provisional contact promoteCore made for the first person.
async function apolloKeep(env, b, actorId, cors) {
  const disp = DISPOSITIONS.includes(b.disposition) ? b.disposition : null;
  if (!disp || disp === "skip") return json({ ok: false, error: "bad_disposition" }, { status: 400 }, cors);
  const selected = Array.isArray(b.selected) ? b.selected.filter((s) => s && s.apollo_id) : [];

  let actorName = "system";
  if (actorId) { const u = await env.DB.prepare("SELECT name FROM users WHERE id=?").bind(actorId).first().catch(() => null); if (u && u.name) actorName = u.name; }

  await env.DB.prepare("UPDATE prospects SET disposition=?, disposition_by=?, disposition_at=datetime('now'), updated_at=datetime('now') WHERE id=?").bind(disp, actorId, b.id).run().catch(() => {});
  const pr = await promoteCore(env, b.id, actorId);
  if (!pr.ok) return json({ ok: false, error: pr.error || "promote_failed" }, { status: 400 }, cors);
  const baseContactId = pr.contact_id, convId = pr.conversation_id;
  const crow = await env.DB.prepare("SELECT company_id FROM contacts WHERE id=?").bind(baseContactId).first().catch(() => null);
  const companyId = crow ? crow.company_id : null;

  // Sync Prospecting → Intel: persist the Apollo company intel (locations/franchise/socials/
  // tech) onto the company enrichment so the Intel dossier reflects it without re-fetching.
  if (companyId) {
    try {
      const prow = await env.DB.prepare("SELECT domain, name FROM prospects WHERE id=?").bind(b.id).first().catch(() => null);
      const org = prow && prow.domain ? await apolloOrgSummary(env, prow.domain, prow.name) : null;
      if (org) {
        const cur = await env.DB.prepare("SELECT enrichment FROM companies WHERE id=?").bind(companyId).first().catch(() => null);
        let e = {}; try { e = cur && cur.enrichment ? JSON.parse(cur.enrichment) : {}; } catch (_) {}
        e.apollo = org;
        await env.DB.prepare("UPDATE companies SET enrichment=?, updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(e), companyId).run().catch(() => {});
      }
    } catch (_) {}
  }

  const now = new Date().toISOString();
  const savedContactIds = [], savedPeople = [];
  let credits = 0, revealErr = null, primaryUsed = false;

  for (const sel of selected) {
    let person = null;
    try { person = await enrichPerson(env, { id: sel.apollo_id }); credits++; } catch (e) { revealErr = String(e); }
    const fullName = (person && person.name) || sel.name || null;
    const title = (person && person.title) || sel.title || null;
    const email = person && usableEmail(person.email) ? person.email : null;
    const phone = person && Array.isArray(person.phone_numbers) && person.phone_numbers[0]
      ? (person.phone_numbers[0].sanitized_number || person.phone_numbers[0].raw_number) : null;
    const linkedin = (person && person.linkedin_url) || null;
    const enr = JSON.stringify({ _source: "apollo_prospect", apollo_id: sel.apollo_id, linkedin, title, revealed_at: now });

    let contactId;
    if (!primaryUsed) {
      contactId = baseContactId;
      await env.DB.prepare("UPDATE contacts SET full_name=COALESCE(?,full_name), title=COALESCE(?,title), primary_email=COALESCE(?,primary_email), phone=COALESCE(?,phone), apollo_person_id=?, source='apollo_prospect', is_provisional=0, enrichment=?, updated_at=datetime('now') WHERE id=?")
        .bind(fullName, title, email, phone, sel.apollo_id, enr, contactId).run().catch(() => {});
      primaryUsed = true;
    } else {
      contactId = rid("ct_");
      await env.DB.prepare("INSERT INTO contacts (id, company_id, full_name, primary_email, phone, title, apollo_person_id, enrichment, source, is_provisional) VALUES (?,?,?,?,?,?,?,?,'apollo_prospect',0)")
        .bind(contactId, companyId, fullName, email, phone, title, sel.apollo_id, enr).run().catch(() => {});
    }
    if (email) {
      await env.DB.prepare("INSERT OR IGNORE INTO contact_identifiers (id, contact_id, type, value, verified) VALUES (?,?,?,?,0)").bind(rid("id_"), contactId, "email", String(email).toLowerCase()).run().catch(() => {});
      // Consent ledger: EMAIL permitted under B2B legitimate interest — NOT an opt-in. SMS/voice omitted → stay off.
      await env.DB.prepare("INSERT INTO consent_records (id, contact_id, email, phone, channel, action, basis, capture_method, proof_ref, occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(rid("cn_"), contactId, email, phone, "email", "granted", "legitimate_interest", "apollo_prospect", "B2B legitimate interest · authorized by " + actorName + " @ " + now, now).run().catch(() => {});
      await addActivityV2(env, { actorId, entityType: "contact", entityId: contactId, action: "consent_granted", meta: { channel: "email", basis: "legitimate_interest", method: "apollo_prospect", by: actorName } }).catch(() => {});
    }
    savedContactIds.push(contactId);
    savedPeople.push({ contact_id: contactId, name: fullName, title, email, has_email: !!email });
  }

  // Run the destination.
  let kind = "open", pushed = 0, pushErr = null;
  if (disp === "instantly") {
    // Push each revealed contact straight into the paused Instantly campaign, carrying
    // the prospect's intel as custom variables ({{website}}, {{city}}, {{trade}}). Paused
    // campaign = staged; it only sends when you launch it in Instantly.
    kind = "instantly_pushed";
    const campaignId = env.INSTANTLY_CAMPAIGN_ID || DEFAULT_INSTANTLY_CAMPAIGN;
    const pRow = await env.DB.prepare("SELECT name, domain, trade, city FROM prospects WHERE id=?").bind(b.id).first().catch(() => null);
    for (const sp of savedPeople) {
      if (!sp.email) continue;
      const nm = String(sp.name || "").trim().split(/\s+/);
      const r = await pushLeadToInstantly(env, {
        campaignId, email: sp.email, firstName: nm[0] || "", lastName: nm.slice(1).join(" "),
        company: (pRow && pRow.name) || "",
        customVars: { website: (pRow && pRow.domain) || "", city: (pRow && pRow.city) || "", trade: (pRow && pRow.trade) || "" },
      }).catch((e) => ({ ok: false, error: String(e) }));
      if (r && r.ok) pushed++; else pushErr = (r && r.error) || "push_failed";
    }
  }
  else if (disp === "sequence") { for (const cid of savedContactIds) await enrollContact(env, { contactId: cid, conversationId: cid === baseContactId ? convId : null, source: "prospect_keep_apollo", workflowId: "cold-to-demo" }).catch(() => {}); kind = "sequence"; }
  else if (disp === "newsletter") { await optInContacts(env, { contactIds: savedContactIds, captureMethod: "moved_to_newsletter", source: "prospecting" }).catch(() => {}); kind = "newsletter"; }
  else if (disp === "whale") { await flagWhaleCompany(env, companyId, actorId, "flagged from Prospecting"); kind = "whale"; }

  const emails = savedPeople.filter((p) => p.email).length;
  const who = savedPeople.map((p) => (p.name || "?") + (p.title ? ` (${p.title})` : "")).join(", ") || "no contact selected";
  const destTxt = disp === "instantly" ? `Instantly (pushed ${pushed}/${emails} to the campaign${pushErr ? " · error: " + pushErr : ""})` : DISP_LABEL[disp];
  const noteBody = `👤 Apollo resolve by ${actorName} → ${destTxt}. Saved ${savedPeople.length} contact(s): ${who}. ${emails} email(s) revealed · consent: email permitted (B2B legitimate interest, authorized by ${actorName}); SMS/voice off. ${credits} Apollo credit(s) used.`;
  if (convId) await env.DB.prepare("INSERT INTO notes (id, author_id, conversation_id, contact_id, body) VALUES (?,?,?,?,?)").bind(rid("nt_"), actorId || null, convId, baseContactId, noteBody).run().catch(() => {});
  await env.DB.prepare("UPDATE prospects SET disposition_meta=?, updated_at=datetime('now') WHERE id=?").bind(JSON.stringify({ apollo: true, contacts: savedContactIds, credits, kind, instantly_pushed: pushed }), b.id).run().catch(() => {});

  const msg = { open: "Opened a conversation", sequence: "Enrolled in the sequence", newsletter: "Added to the newsletter", instantly_pushed: `Pushed ${pushed} to the Instantly campaign`, whale: "Flagged as a Whale" }[kind] || "Saved";
  const resp = { ok: true, disposition: disp, kind, saved: savedPeople, credits, pushed, conversation_id: convId || null, message: `${msg} · ${savedPeople.length} contact(s), ${emails} email(s)` };
  if (disp === "instantly" && emails && !pushed) resp.warning = "Saved, but couldn't push to Instantly" + (pushErr ? " (" + pushErr + ")" : "") + ".";
  if (revealErr && /not authorized/i.test(revealErr)) resp.warning = "Apollo key lacks People Enrichment scope — emails couldn't be revealed.";
  return json(resp, {}, cors);
}

function safeJson(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch (_) { return fallback; } }
