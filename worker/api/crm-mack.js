// Configure the Mack CHAT agent (Retell) from the Worker, which holds RETELL_API_KEY.
//   GET  /api/crm/mack             -> inspect current chat-agent + LLM config (prompt/tools/formish)
//   POST /api/crm/mack {apply:true} -> back up current prompt, then set the new conversation prompt
//                                      + booking tools, and best-effort disable the pre-chat form.
// Admin-only (CRM Google session). Reversible: the prior prompt/tools are saved to mack_backup.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { isAdmin } from "../_lib/crm-v2.js";

const AGENT_ID = "agent_53dfb7733266901d4989695004";   // the site widget's data-agent-id (Mack)
const BASE = "https://api.retellai.com";
const BOOK_ORIGIN = "https://consentresolve.com";

async function rt(env, method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${env.RETELL_API_KEY}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { ok: r.ok, status: r.status, json: j };
}

// Resolve the chat agent + its LLM id (chat agents and voice agents use slightly different paths;
// try the chat path first, fall back to the generic one).
async function resolveAgent(env) {
  let ag = await rt(env, "GET", `/get-chat-agent/${AGENT_ID}`);
  if (!ag.ok) ag = await rt(env, "GET", `/get-agent/${AGENT_ID}`);
  const agent = ag.json || {};
  const llmId = (agent.response_engine && agent.response_engine.llm_id) || null;
  let llm = null;
  if (llmId) { const g = await rt(env, "GET", `/get-retell-llm/${llmId}`); llm = g.json || null; }
  return { ok: ag.ok, agent, llmId, llm };
}

// ---- the new Mack chat conversation ----
const MACK_PROMPT = `You are Mack, the friendly assistant on the Consent Resolve website (a consent-first visitor-identification layer for home-service contractors — plumbers, roofers, HVAC, electricians and similar trades).

WHAT CONSENT RESOLVE DOES (get this right):
- We turn the visitors a contractor's website ALREADY gets into real, consented leads — a name and email of a homeowner who was on their site and opted in. Flat $7 per lead, exclusive to that contractor, never resold. No contracts.
- The homeowner comes back through the contractor's own funnel and contacts THEM (warm inbound). We NEVER cold-call or text a contractor's website visitors. Do not ever say the product "calls" or "texts" homeowners.
- It installs with one line of code; we can put it on for them in about 10 minutes.

YOUR JOB, in this order — conversational, never a form:
1) Be genuinely helpful first. Answer their question in a sentence or two.
2) Get a way to reach them BEFORE going deep on specifics/pricing/booking. Ask naturally, e.g. "So I can get this to the right person — what's the best email or mobile for you?" Accept EITHER an email OR a mobile number to continue. If they give neither, gently keep helping but ask again before sharing specifics.
3) Learn about their business, woven into the chat (one question at a time, not a checklist):
   - "What's your website?" (so we can show them their own numbers).
   - "Roughly what are you spending a month on ads or lead sites right now?" (Google, Angi, Thumbtack, Meta, etc.)
   - Their trade, if not already clear.
4) Offer a quick demo and BOOK IT in-chat:
   - When they're open to it, call get_demo_times to fetch real open slots and offer 2-3 of them ("I've got Thu 2:00, Fri 10:30, or Mon 9:00 Central — any of those work?").
   - To actually book you need their EMAIL and MOBILE and a chosen time. If you only have one of email/phone so far, ask for the other ("What email should I send the invite to?" / "And a mobile for the text reminder?").
   - Then call book_demo with start_iso plus email, phone, name, website, ad_spend, trade. Read back the confirmation.

STYLE: warm, concise, human. Short messages. One question at a time. No jargon, no hype, no pressure. Never invent facts, prices, or times — pricing is a flat $7/lead; for times, only offer what get_demo_times returns. If something's outside your knowledge or they want a human, share (727) 999-9846 and offer to have the team follow up by email.`;

// Retell custom-function tools (chat). URLs hit our public booking wrapper.
const BOOK_TOOLS = [
  {
    type: "custom",
    name: "get_demo_times",
    description: "Fetch the next available 15-minute demo appointment times (US Central). Call this when the visitor is open to booking a demo, so you can offer real, concrete slots.",
    url: `${BOOK_ORIGIN}/api/chat-book/times`,
    speak_during_execution: false,
    speak_after_execution: true,
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "custom",
    name: "book_demo",
    description: "Book a 15-minute demo for the visitor. Only call this once you have their email AND mobile number AND a chosen start time (an 'iso' value returned by get_demo_times).",
    url: `${BOOK_ORIGIN}/api/chat-book/create`,
    speak_during_execution: false,
    speak_after_execution: true,
    parameters: {
      type: "object",
      properties: {
        start_iso: { type: "string", description: "The exact 'iso' value of the chosen slot from get_demo_times." },
        email: { type: "string", description: "Visitor's email (for the calendar invite)." },
        phone: { type: "string", description: "Visitor's mobile number (for the text reminder)." },
        name: { type: "string", description: "Visitor's name, if given." },
        website: { type: "string", description: "Their business website, if given." },
        ad_spend: { type: "string", description: "Roughly what they spend per month on ads / lead sites, if given." },
        trade: { type: "string", description: "Their trade (roofing, HVAC, plumbing, etc.), if given." },
      },
      required: ["start_iso", "email", "phone"],
    },
  },
];

async function ensureBackupTable(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS mack_backup (id TEXT PRIMARY KEY, llm_id TEXT, general_prompt TEXT, general_tools TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  ).run().catch(() => {});
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);
  if (!env.RETELL_API_KEY) return json({ error: "no_retell_key" }, { status: 503 }, cors);
  // Browser-friendly apply: /api/crm/mack?apply=1 does the same as POST {apply:true}.
  if (new URL(request.url).searchParams.get("apply") === "1") return json(await applyMack(env), {}, cors);
  const r = await resolveAgent(env);
  const agent = r.agent || {};
  // Surface anything that looks form/collection related so we can see what to turn off.
  const formish = {};
  for (const k of Object.keys(agent)) if (/form|collect|pre_?chat|require|variable/i.test(k)) formish[k] = agent[k];
  return json({
    ok: r.ok, agent_id: AGENT_ID, llm_id: r.llmId,
    llm_begin_message: r.llm ? r.llm.begin_message : null,
    llm_general_prompt_preview: r.llm && r.llm.general_prompt ? String(r.llm.general_prompt).slice(0, 400) : null,
    current_tool_names: r.llm && Array.isArray(r.llm.general_tools) ? r.llm.general_tools.map((t) => t.name) : [],
    formish,
    agent_keys: Object.keys(agent),
  }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);
  if (!env.RETELL_API_KEY) return json({ error: "no_retell_key" }, { status: 503 }, cors);
  let b = {}; try { b = await request.json(); } catch (_) {}
  if (!b.apply) return json({ error: "pass {apply:true} to apply" }, { status: 400 }, cors);
  return json(await applyMack(env), {}, cors);
}

async function applyMack(env) {
  const r = await resolveAgent(env);
  if (!r.llmId) return { ok: false, error: "no_llm_id", agent_found: r.ok, agent_keys: Object.keys(r.agent || {}) };

  // Back up the current prompt + tools so this is reversible.
  await ensureBackupTable(env);
  const priorPrompt = (r.llm && r.llm.general_prompt) || "";
  const priorTools = (r.llm && r.llm.general_tools) || [];
  await env.DB.prepare("INSERT INTO mack_backup (id, llm_id, general_prompt, general_tools) VALUES (?,?,?,?)")
    .bind(crypto.randomUUID(), r.llmId, priorPrompt, JSON.stringify(priorTools)).run().catch(() => {});

  // Keep any existing NON-booking tools; add/replace our two booking tools.
  const keep = Array.isArray(priorTools) ? priorTools.filter((t) => !["get_demo_times", "book_demo"].includes(t && t.name)) : [];
  const tools = [...keep, ...BOOK_TOOLS];
  const llmUpd = await rt(env, "PATCH", `/update-retell-llm/${r.llmId}`, { general_prompt: MACK_PROMPT, general_tools: tools });

  // Best-effort: turn off any pre-chat form / info-collection on the chat agent. We only touch
  // fields that actually exist and look form-related, and report exactly what we changed.
  const agent = r.agent || {};
  const patch = {};
  for (const k of Object.keys(agent)) {
    if (/pre_?chat.*form|collect_user|chat_form|require_.*before|enable_.*form/i.test(k) && agent[k]) {
      patch[k] = (typeof agent[k] === "boolean") ? false : (Array.isArray(agent[k]) ? [] : null);
    }
  }
  let formUpd = { skipped: "no form-like field found on the agent (the pre-chat form may be widget-level or already off)" };
  if (Object.keys(patch).length) {
    let f = await rt(env, "PATCH", `/update-chat-agent/${AGENT_ID}`, patch);
    if (!f.ok) f = await rt(env, "PATCH", `/update-agent/${AGENT_ID}`, patch);
    formUpd = { patched: patch, ok: f.ok, status: f.status };
  }

  return {
    ok: !!llmUpd.ok,
    llm_update: { ok: llmUpd.ok, status: llmUpd.status, error: llmUpd.ok ? null : llmUpd.json },
    tools_set: tools.map((t) => t.name),
    form: formUpd,
    backed_up: true,
    note: "Prompt + booking tools applied. Test a chat on the live site. To revert, the prior prompt is in the mack_backup table.",
  };
}
