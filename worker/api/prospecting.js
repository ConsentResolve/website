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
import { enrollContact } from "../_lib/workflow-engine.js";
import { enrollRepermission } from "../_lib/newsletter.js";

const DISPOSITIONS = ["open", "sequence", "newsletter", "instantly", "skip"];

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
            cost_cents, status, promoted_contact_id, disposition, disposition_meta, created_at
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
    let meta = null;
    try {
      if (p.disposition === "skip") { meta = { skipped: true }; out.skip++; }
      else if (p.disposition === "instantly") { meta = { staged: "instantly", note: "Instantly push staged — not sent" }; out.instantly_staged++; }
      else {
        const pr = await promoteCore(env, p.id, actorId);
        if (!pr.ok) { out.failed++; continue; }
        meta = { conversation_id: pr.conversation_id || null, contact_id: pr.contact_id };
        if (p.disposition === "open") { out.open++; }
        else if (p.disposition === "sequence") {
          const en = await enrollContact(env, { contactId: pr.contact_id, conversationId: pr.conversation_id, source: "batch_triage" }).catch(() => ({}));
          meta.sequence_run_id = en && en.runId ? en.runId : null; out.sequence++;
        } else if (p.disposition === "newsletter") {
          await enrollRepermission(env, { contactIds: [pr.contact_id] }).catch(() => {});
          meta.newsletter = true; out.newsletter++;
        }
      }
    } catch (_) { out.failed++; continue; }
    await env.DB.prepare("UPDATE prospects SET disposition_meta=?, updated_at=datetime('now') WHERE id=?")
      .bind(JSON.stringify(meta || {}), p.id).run().catch(() => {});
  }
  return json({ ok: true, pushed: out,
    message: `Pushed: ${out.open} opened, ${out.sequence} into sequence, ${out.newsletter} to newsletter, ${out.skip} skipped. ${out.instantly_staged} Instantly staged (not sent).` }, {}, cors);
}

function safeJson(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch (_) { return fallback; } }
