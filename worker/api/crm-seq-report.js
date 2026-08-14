// worker/api/crm-seq-report.js
//   Sequence performance + the "our engine vs Instantly" AI comparison.
//   GET  /api/crm/seq-report                          → first-party engine metrics
//   POST /api/crm/seq-report {action:"ai_compare"}    → Claude compares engine vs Instantly
//   POST /api/crm/seq-report {action:"meeting_held", contact_id, held}  → log held/no-show
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { currentUser, addActivityV2 } from "../_lib/crm-v2.js";
import { waveFunnel } from "../_lib/instantly.js";
import { reportAiOutcome } from "../_lib/ai-credits.js";

const MODEL = "claude-haiku-4-5-20251001";
const ENGINE_WF = "('cold-to-demo','reengage')";

const n = (r) => (r && r.n) || 0;
async function q1(env, sql, ...b) { try { return await env.DB.prepare(sql).bind(...b).first(); } catch (_) { return null; } }
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

// First-party numbers for our own sequence engine (Cold-to-Demo + re-engagement).
export async function engineReport(env) {
  const sub = `SELECT DISTINCT contact_id FROM workflow_runs WHERE workflow_id IN ${ENGINE_WF}`;
  const enrolled = n(await q1(env, `SELECT COUNT(DISTINCT contact_id) n FROM workflow_runs WHERE workflow_id IN ${ENGINE_WF}`));
  const completed = n(await q1(env, `SELECT COUNT(*) n FROM workflow_runs WHERE workflow_id IN ${ENGINE_WF} AND status='completed'`));
  const sent = n(await q1(env, `SELECT COUNT(*) n FROM crm_events e JOIN workflow_runs r ON r.id=e.workflow_run_id WHERE r.workflow_id IN ${ENGINE_WF} AND e.type='email_sent'`));
  const bounced = n(await q1(env, `SELECT COUNT(DISTINCT contact_id) n FROM crm_events WHERE type='email_bounced' AND contact_id IN (${sub})`));
  const replied = n(await q1(env, `SELECT COUNT(DISTINCT contact_id) n FROM crm_events WHERE type='reply_classified' AND contact_id IN (${sub})`));
  const positive = n(await q1(env, `SELECT COUNT(*) n FROM crm_events WHERE type='reply_classified' AND meta LIKE '%"sentiment":"positive"%' AND contact_id IN (${sub})`));
  const booked = n(await q1(env, `SELECT COUNT(DISTINCT contact_id) n FROM crm_events WHERE type IN ('demo_requested','meeting_booked') AND contact_id IN (${sub})`));
  const held = n(await q1(env, `SELECT COUNT(*) n FROM crm_events WHERE type='meeting_held' AND contact_id IN (${sub})`));
  const delivered = Math.max(0, sent - bounced);
  return {
    enrolled, completed, sent, delivered, bounced, replied, positive, booked, held,
    delivered_rate: pct(delivered, sent), reply_rate: pct(replied, delivered || sent),
    positive_rate: pct(positive, delivered || sent), meetings_per_100_completed: pct(booked, completed) ,
  };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  return json({ ok: true, engine: await engineReport(env) }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
  const b = await request.json().catch(() => ({}));
  const me = await currentUser(request, env).catch(() => null);

  if (b.action === "meeting_held") {
    if (!b.contact_id) return json({ ok: false, error: "no_contact" }, { status: 400 }, cors);
    const type = b.held === false ? "meeting_noshow" : "meeting_held";
    const { logEvent } = await import("../_lib/crm-rebuild.js");
    await logEvent(env, { type, contactId: b.contact_id, actorId: me ? me.id : null, meta: {} }).catch(() => {});
    await addActivityV2(env, { actorId: me ? me.id : null, entityType: "contact", entityId: b.contact_id, action: type, meta: {} }).catch(() => {});
    return json({ ok: true, type }, {}, cors);
  }

  if (b.action === "ai_compare") {
    const engine = await engineReport(env);
    let instantly = null;
    try { const wf = await waveFunnel(env, { campaignId: env.INSTANTLY_CAMPAIGN_ID }); instantly = wf.instantly; } catch (_) {}
    const analysis = await aiCompare(env, engine, instantly);
    return json({ ok: true, engine, instantly, analysis }, {}, cors);
  }

  return json({ ok: false, error: "bad_action" }, { status: 400 }, cors);
}

async function aiCompare(env, engine, instantly) {
  if (!env.ANTHROPIC_API_KEY) return "Set ANTHROPIC_API_KEY to enable the AI comparison.";
  const prompt = `You are a blunt cold-outreach analyst for Consent Resolve (a consent-first website-visitor-ID product for home-service contractors; goal = booked demos). Compare TWO outbound channels and tell the owner, fast, which is winning and what to do.

CHANNEL A — Our own CRM sequence engine (first-party, "Cold-to-Demo"):
${JSON.stringify(engine)}

CHANNEL B — Instantly cold-email campaign:
${JSON.stringify(instantly || { note: "no Instantly data yet" })}

Notes: "positive"/positive_rate = replies our AI classified as interested (the KPI that predicts revenue). Instantly's "opportunities" ≈ interested. "booked" = demo requested / meeting booked. Sample sizes may be tiny — if so, say the data is too thin to call a winner and say what to watch.

Return GitHub-flavored markdown, tight and skimmable, in exactly this shape:
**Verdict:** <1-2 sentences: which is performing better right now and why, or "too early to call" with the reason>
**Our engine — 2-3 fixes:**
- <specific, actionable>
**Instantly — 2-3 fixes:**
- <specific, actionable>
Keep it under 180 words. No preamble, no restating the numbers back.`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) {
      const errMsg = (j && j.error && j.error.message) || `HTTP ${r.status}`;
      await reportAiOutcome(env, { ok: false, error: errMsg, source: "crm-seq-report.aiCompare" });
      return "Analysis failed: " + errMsg;
    }
    await reportAiOutcome(env, { ok: true, source: "crm-seq-report.aiCompare" });
    return (j.content && j.content[0] && j.content[0].text) || "No analysis returned.";
  } catch (e) { return "Analysis failed: " + String(e).slice(0, 100); }
}
