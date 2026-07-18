// AEO telemetry — the "are AI answer engines crawling and citing us?" layer.
//
// SEO (search) is measurable via Google Search Console + GA4. AEO (AI answer
// engines) is not yet exposed by any console, so we measure it from our own
// edge traffic in two ways, both zero-PII:
//   1. Bot crawls  — GPTBot / ClaudeBot / PerplexityBot etc. hitting our pages
//                    (are the engines even indexing us for their answers?).
//   2. AI referrals — humans arriving FROM chatgpt.com / perplexity.ai etc.
//                    (were we cited AND clicked?).
//
// Only these two signals are written to D1 (both are rare), so this adds
// negligible write load — a normal human pageview does zero DB work. Total
// traffic/pageviews stay in GA4 where they already live.

export const AI_BOTS = [
  ["GPTBot", "OpenAI · GPTBot"],
  ["OAI-SearchBot", "OpenAI · SearchBot"],
  ["ChatGPT-User", "OpenAI · ChatGPT-User"],
  ["ClaudeBot", "Anthropic · ClaudeBot"],
  ["Claude-Web", "Anthropic · Claude-Web"],
  ["Claude-User", "Anthropic · Claude-User"],
  ["PerplexityBot", "Perplexity · Bot"],
  ["Perplexity-User", "Perplexity · User"],
  ["Google-Extended", "Google · Extended (Gemini)"],
  ["Applebot-Extended", "Apple · Intelligence"],
  ["Amazonbot", "Amazon"],
  ["Bytespider", "ByteDance · Bytespider"],
  ["CCBot", "Common Crawl (CCBot)"],
  ["cohere-ai", "Cohere"],
  ["DuckAssistBot", "DuckDuckGo · DuckAssist"],
  ["meta-externalagent", "Meta · AI"],
  ["FacebookBot", "Meta · FacebookBot"],
  ["YandexAdditional", "Yandex · AI"],
];

export const AI_REFERRERS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "bard.google.com",
  "copilot.microsoft.com",
  "you.com",
  "phind.com",
  "duckduckgo.com",
  "poe.com",
];

// Buyer-intent queries we WANT AI answer engines to cite consentresolve.com for.
// The aspiration side of AEO — shown on the dashboard next to the crawl/referral
// evidence so the two read together. Keep these to real prospect questions.
export const AEO_TARGETS = [
  "how to identify anonymous website visitors with consent",
  "consent-first visitor identification for contractors",
  "exclusive leads vs shared leads for home services",
  "is website visitor identification legal (TCPA / CIPA)",
  "cheapest exclusive leads for HVAC and plumbing contractors",
  "Thumbtack / Angi alternative for contractor leads",
  "how to recover website visitors who don't fill out the form",
  "how much do home-service leads cost per lead",
];

export function detectAiBot(ua) {
  if (!ua) return null;
  for (const [pat, name] of AI_BOTS) if (ua.indexOf(pat) !== -1) return name;
  return null;
}

export function detectAiReferrer(ref) {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.toLowerCase();
    for (const d of AI_REFERRERS) if (h === d || h.endsWith("." + d)) return d;
  } catch (_) {}
  return null;
}

const DDL =
  "CREATE TABLE IF NOT EXISTS aeo_telemetry (day TEXT, kind TEXT, name TEXT, " +
  "hits INTEGER DEFAULT 0, last_ts INTEGER, last_path TEXT, PRIMARY KEY (day, kind, name))";

// Ensure the table exists once per isolate rather than on every bot/referral
// hit (which would double the D1 writes). Reset to false only when a create
// actually fails, so a transient error retries next time.
let tableReady = false;
async function ensureTable(env) {
  if (tableReady) return;
  await env.DB.prepare(DDL).run();
  tableReady = true;
}

/**
 * Fire-and-forget from the fetch handler via ctx.waitUntil. No-ops for the
 * overwhelming majority of requests (no AI bot UA, no AI referrer) — so it
 * never touches D1 on a normal human pageview.
 */
export async function logAeoTelemetry(env, request) {
  if (!env || !env.DB) return;
  const bot = detectAiBot(request.headers.get("user-agent") || "");
  const aiRef = detectAiReferrer(request.headers.get("referer") || "");
  if (!bot && !aiRef) return;

  const day = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  let path = "/";
  try { path = new URL(request.url).pathname.slice(0, 200); } catch (_) {}

  const rows = [];
  if (bot) rows.push(["bot", bot]);
  if (aiRef) rows.push(["ref", aiRef]);

  try {
    await ensureTable(env);
  } catch (_) { tableReady = false; throw _; }
  await env.DB.batch(
    rows.map(([kind, name]) =>
      env.DB
        .prepare(
          "INSERT INTO aeo_telemetry (day, kind, name, hits, last_ts, last_path) VALUES (?, ?, ?, 1, ?, ?) " +
            "ON CONFLICT(day, kind, name) DO UPDATE SET hits = hits + 1, last_ts = excluded.last_ts, last_path = excluded.last_path"
        )
        .bind(day, kind, name, now, path)
    )
  );
}

/** Aggregate the last `days` of telemetry for the dashboard / API. */
export async function aeoSummary(env, days = 28) {
  const out = {
    configured: false,
    days,
    bots: [],
    refs: [],
    botTotal: 0,
    refTotal: 0,
    targets: AEO_TARGETS,
  };
  if (!env || !env.DB) return out;
  try {
    await ensureTable(env);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const res =
      (await env.DB.prepare(
        "SELECT day, kind, name, hits, last_ts, last_path FROM aeo_telemetry WHERE day >= ? ORDER BY last_ts ASC"
      )
        .bind(since)
        .all()).results || [];
    out.configured = true;
    const agg = { bot: new Map(), ref: new Map() };
    for (const r of res) {
      const m = agg[r.kind];
      if (!m) continue;
      const prev = m.get(r.name) || { name: r.name, hits: 0, lastTs: 0, lastPath: "" };
      prev.hits += r.hits || 0;
      if ((r.last_ts || 0) >= prev.lastTs) { prev.lastTs = r.last_ts || 0; prev.lastPath = r.last_path || ""; }
      m.set(r.name, prev);
    }
    out.bots = [...agg.bot.values()].sort((a, b) => b.hits - a.hits);
    out.refs = [...agg.ref.values()].sort((a, b) => b.hits - a.hits);
    out.botTotal = out.bots.reduce((s, b) => s + b.hits, 0);
    out.refTotal = out.refs.reduce((s, r) => s + r.hits, 0);
  } catch (_) {}
  return out;
}
