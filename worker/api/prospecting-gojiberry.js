// Gojiberry -> Prospecting inbound webhook — /api/crm/prospecting/gojiberry
//
// Gojiberry doesn't send cold email itself; it detects buying-intent signals on
// LinkedIn and pushes qualified leads OUT via API to whatever tool you point it at
// (same mechanism it uses for its SmartReach integration: you paste the target
// system's API key into Gojiberry's own integration settings). This endpoint is
// that target — Gojiberry pushes one lead per call, we land it in the SAME
// `prospects` table as a DataForSEO sweep or CSV import, tagged to a single
// standing "Gojiberry" run so it shows up in the Prospecting tab unchanged.
// Existing dispositions (Open/Sequence/Newsletter/Instantly/Whales/Skip) work on
// these leads exactly like any other prospect — nothing about that flow changes.
//
// Auth: X-CR-Automation-Key header (or ?key= query param, since some webhook
// senders can't set custom headers) must equal env CR_AUTOMATION_KEY — the SAME
// key already used for /api/social-queue. Reusing it means no new secret to
// provision; paste that value into Gojiberry's "API Key" field.
//
// Payload shape is intentionally tolerant — Gojiberry's exact field names aren't
// publicly documented (their docs are behind bot-protection), so this accepts
// common variants and logs the first 50 raw payloads to gojiberry_webhook_log for
// inspection. Tighten the field mapping once real payloads are seen.
import { json, corsHeaders } from "../_lib/http.js";
import { normDomain } from "../_lib/dataforseo.js";
import { ensureProspectingSchema, processProspectRuns } from "./prospecting.js";

const GOJIBERRY_RUN_ID = "pr_run_gojiberry_inbound";

function authed(request, env) {
  const key = env.CR_AUTOMATION_KEY;
  if (!key) return { ok: false, code: 503, error: "queue_unconfigured" };
  const given = request.headers.get("X-CR-Automation-Key") || new URL(request.url).searchParams.get("key") || "";
  if (given.length !== key.length || given !== key) return { ok: false, code: 401, error: "unauthorized" };
  return { ok: true };
}

const pick = (o, keys) => { for (const k of keys) if (o && o[k]) return String(o[k]).trim(); return ""; };
const rid = (p) => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function domainFromEmail(email) {
  const m = /@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(String(email || "").trim());
  return m ? m[1].toLowerCase() : "";
}

async function ensureRunRow(env) {
  const exists = await env.DB.prepare("SELECT id FROM prospect_runs WHERE id=?").bind(GOJIBERRY_RUN_ID).first().catch(() => null);
  if (exists) return;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO prospect_runs (id, query, stage, counts, cost_cents, max_cost_cents, status, actor, note)
     VALUES (?, ?, 'tech', ?, 0, 999999, 'running', 'gojiberry', 'Gojiberry — inbound LinkedIn signal leads')`
  ).bind(GOJIBERRY_RUN_ID, JSON.stringify({ kind: "gojiberry_webhook" }), JSON.stringify({ found: 0 })).run().catch(() => {});
}

async function logRawPayload(env, body) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS gojiberry_webhook_log (id INTEGER PRIMARY KEY AUTOINCREMENT, received_at TEXT DEFAULT (datetime('now')), payload TEXT)"
  ).run().catch(() => {});
  const countRow = await env.DB.prepare("SELECT COUNT(*) n FROM gojiberry_webhook_log").first().catch(() => ({ n: 0 }));
  if ((countRow?.n || 0) >= 50) return; // cap — this is a debug aid, not permanent storage
  await env.DB.prepare("INSERT INTO gojiberry_webhook_log (payload) VALUES (?)").bind(JSON.stringify(body).slice(0, 4000)).run().catch(() => {});
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, env),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-CR-Automation-Key",
    },
  });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  const a = authed(request, env);
  if (!a.ok) return json({ error: a.error }, { status: a.code }, cors);
  return json({ ok: true, usage: "POST a Gojiberry lead payload here (JSON). See file header for auth + field mapping." }, {}, cors);
}

export async function onRequestPost({ request, env, ctx }) {
  const cors = corsHeaders(request, env);
  const a = authed(request, env);
  if (!a.ok) return json({ error: a.error }, { status: a.code }, cors);

  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, { status: 400 }, cors); }

  await ensureProspectingSchema(env);
  await ensureRunRow(env);
  ctx.waitUntil(logRawPayload(env, b));

  const email = pick(b, ["email", "contact_email", "person_email", "work_email"]).toLowerCase();
  const explicitDomain = pick(b, ["domain", "company_domain", "website", "company_website", "url"]);
  const domain = normDomain(explicitDomain) || domainFromEmail(email);
  if (!domain) {
    return json({ ok: false, error: "no_domain", message: "Payload had no usable domain or email to derive one from." }, { status: 400 }, cors);
  }

  const company = pick(b, ["company", "company_name", "organization", "account_name"]) || domain;
  const contactName = pick(b, ["name", "full_name", "contact_name", "person_name"]);
  const title = pick(b, ["title", "job_title", "person_title"]);
  const linkedin = pick(b, ["linkedin_url", "linkedin", "profile_url", "person_linkedin_url"]);
  const intentReason = pick(b, ["intent_reason", "reason", "signal", "signal_reason", "trigger"]);
  const city = pick(b, ["city"]);
  const region = pick(b, ["state", "region"]);
  const trade = pick(b, ["trade", "industry", "category"]).toLowerCase() || null;

  const gojiberrySignal = {
    source: "gojiberry",
    contact_email: email || null,
    contact_name: contactName || null,
    contact_title: title || null,
    linkedin_url: linkedin || null,
    intent_reason: intentReason || null,
  };

  const existing = await env.DB.prepare("SELECT id, signals FROM prospects WHERE domain=?").bind(domain).first().catch(() => null);
  let prospectId;
  if (existing) {
    prospectId = existing.id;
    const sig = { ...(JSON.parse(existing.signals || "{}")), gojiberry: gojiberrySignal };
    await env.DB.prepare("UPDATE prospects SET run_id=?, signals=?, updated_at=datetime('now') WHERE id=?")
      .bind(GOJIBERRY_RUN_ID, JSON.stringify(sig), prospectId).run().catch(() => {});
  } else {
    prospectId = rid("pr_");
    await env.DB.prepare(
      `INSERT OR IGNORE INTO prospects (id, domain, name, city, region, trade, tier, status, run_id, signals, stages_run)
       VALUES (?, ?, ?, ?, ?, ?, 'unscored', 'new', ?, ?, ?)`
    ).bind(prospectId, domain, company, city || null, region || null, trade, GOJIBERRY_RUN_ID,
      JSON.stringify({ has_site: true, gojiberry: gojiberrySignal }), JSON.stringify(["tam"])).run().catch(() => {});
  }

  // Drain the waterfall immediately (same pattern as CSV import) so this lead is
  // scored right away instead of sitting unenriched until the next 5-min cron tick.
  ctx.waitUntil((async () => {
    for (let i = 0; i < 4; i++) {
      const out = await processProspectRuns(env, { maxDomains: 5 }).catch(() => null);
      if (!out || !out.touched) break;
    }
  })());

  return json({ ok: true, prospect_id: prospectId, domain, existing: !!existing,
    message: existing ? "Matched an existing prospect — Gojiberry signal attached." : "New prospect created — enriching now." }, {}, cors);
}
