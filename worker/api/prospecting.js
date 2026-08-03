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
  normDomain, dfsConfigured, dfsBusinessListings, dfsTech, dataforseoLookup, dfsBacklinks, TRADE_CATEGORIES,
} from "../_lib/dataforseo.js";
import { scoreProspect } from "../_lib/prospect-score.js";

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
            cost_cents, status, promoted_contact_id, created_at
     FROM prospects WHERE ${where.join(" AND ")}
     ORDER BY score DESC, reviews DESC LIMIT ?`
  ).bind(...binds, limit).all().catch(() => ({ results: [] }));
  const prospects = (rows.results || []).map((r) => ({
    ...r,
    signals: safeJson(r.signals, {}),
    reasons: safeJson(r.reasons, []),
    cost: (r.cost_cents || 0) / 100,
  }));

  const runsRes = await env.DB.prepare(
    `SELECT id, query, stage, counts, cost_cents, max_cost_cents, status, created_at, updated_at, note
     FROM prospect_runs ORDER BY created_at DESC LIMIT 20`
  ).all().catch(() => ({ results: [] }));
  const runs = (runsRes.results || []).map((r) => ({
    ...r, query: safeJson(r.query, {}), counts: safeJson(r.counts, {}), cost: (r.cost_cents || 0) / 100,
  }));

  const tierRes = await env.DB.prepare(
    `SELECT tier, COUNT(*) n FROM prospects WHERE status != 'suppressed' GROUP BY tier`
  ).all().catch(() => ({ results: [] }));
  const tierCounts = {}; for (const t of (tierRes.results || [])) tierCounts[t.tier] = t.n;

  return json({ ok: true, prospects, runs, tierCounts, dfs: dfsConfigured(env), trades: Object.keys(TRADE_CATEGORIES) }, {}, cors);
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

      // Stage 1: tech fingerprint
      if (!stages.includes("tech")) {
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
  const p = await env.DB.prepare("SELECT * FROM prospects WHERE id=?").bind(b.id).first().catch(() => null);
  if (!p) return json({ ok: false, error: "not_found" }, { status: 404 }, cors);
  if (p.promoted_contact_id) return json({ ok: true, already: true, contact_id: p.promoted_contact_id }, {}, cors);

  const sig = safeJson(p.signals, {});
  const companyId = await findOrCreateCompany(env, { name: p.name || p.domain, domain: p.domain || null }).catch(() => null);
  // Cache the enrichment on the company in the SAME shape the Intel panel reads,
  // so promoting a prospect pre-fills the lookup screen (no re-spend needed).
  if (companyId) {
    const enrichment = {
      website: p.domain ? { domain: p.domain, capture: sig.has_form === true } : null,
      gmb: p.rating != null ? { rating: p.rating, reviews: p.reviews || 0, verified: false } : null,
      _signals: sig,
      _intel: { trade: p.trade },
      _source: "prospecting",
    };
    await env.DB.prepare("UPDATE companies SET enrichment=?, domain=COALESCE(domain,?), updated_at=datetime('now') WHERE id=?")
      .bind(JSON.stringify(enrichment), p.domain || null, companyId).run().catch(() => {});
  }
  const contactId = rid("ct_");
  await env.DB.prepare(
    `INSERT INTO contacts (id, company_id, full_name, phone, source, is_provisional, enrichment)
     VALUES (?, ?, ?, ?, 'prospecting', 1, ?)`
  ).bind(contactId, companyId, p.name || p.domain, p.phone || null, JSON.stringify({ _signals: sig, trade: p.trade })).run().catch(() => {});
  await env.DB.prepare("UPDATE contacts SET lifecycle_stage='prospect' WHERE id=?").bind(contactId).run().catch(() => {});

  // Create a conversation so it surfaces in the pipeline/inbox as a workable lead.
  const convId = rid("cv_");
  await env.DB.prepare(
    `INSERT INTO conversations (id, contact_id, company_id, channel, source_detail, status, unread, subject, last_message_at, last_message_preview)
     VALUES (?, ?, ?, 'prospecting', ?, 'open', 0, ?, datetime('now'), ?)`
  ).bind(convId, contactId, companyId, `Prospecting · ${p.city || ""} ${p.trade || ""}`.trim(),
    `${p.name || p.domain} — ${p.tier} prospect`, (safeJson(p.reasons, [])[0] || "Prospected lead")).run().catch(() => {});

  await env.DB.prepare("UPDATE prospects SET status='promoted', promoted_contact_id=?, updated_at=datetime('now') WHERE id=?").bind(contactId, p.id).run().catch(() => {});
  await addActivityV2(env, { actorId, entityType: "contact", entityId: contactId, action: "promoted_from_prospect",
    meta: { prospect_id: p.id, domain: p.domain, tier: p.tier, score: p.score } }).catch(() => {});

  return json({ ok: true, contact_id: contactId, conversation_id: convId }, {}, cors);
}

async function suppress(env, b, cors) {
  await env.DB.prepare("UPDATE prospects SET status='suppressed', updated_at=datetime('now') WHERE id=?").bind(b.id).run().catch(() => {});
  return json({ ok: true }, {}, cors);
}

function safeJson(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch (_) { return fallback; } }
