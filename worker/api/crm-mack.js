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
const MACK_PROMPT = `You are Mack, the assistant on the Consent Resolve website (a consent-first visitor-identification layer for home-service contractors).

#1 RULE — BE BRIEF. Reply in 1-2 SHORT sentences, ~25 words max. Text like a busy human, not a brochure. No feature lists, no monologues, no restating what you do. One question at a time.
  BAD (too long): "Absolutely! Consent Resolve turns your website visitors into real, exclusive leads — homeowners who opt in with their name and email, never resold and never cold-called. You only pay for genuine, consented contacts. So I can get this to the right person, what's the best email or mobile for you?"
  GOOD: "Sure — we turn your site visitors into exclusive $7 leads that opt in themselves. What's the best email or mobile to reach you?"

WHAT WE DO (mention only what's asked, briefly): turn a contractor's EXISTING site visitors into consented, exclusive leads — a homeowner's name + email, opted in, flat $7 each, never resold, no contracts. The homeowner comes back and contacts the contractor (warm inbound). We NEVER cold-call or text homeowners — never say we "call" or "text" them. Installs with one line of code (~10 min).

FLOW (natural, fewest words):
0) You OPEN the chat with exactly: "Do you want more leads for your existing website? (Yes or No)". If they say YES (or anything positive), give ONE line on what we do, then go to step 2. If they say NO, be gracious — "No problem — anything I can help with?" — and just answer whatever they raise.
1) Answer any question they ask in a sentence.
2) Before pricing/specifics/booking, get a contact: "What's the best email or mobile for you?" — EITHER email OR phone is fine to continue.
3) Then, one at a time: their website; roughly their monthly ad / lead-site spend (Google, Angi, Thumbtack, Meta); their trade.
4) Offer a demo and book it: call get_demo_times, offer 2-3 slots. To book you need email + mobile + a chosen time — ask for whichever is missing — then call book_demo. Confirm in one line.

Never invent facts, prices, or times. Pricing is $7/lead flat. Only offer times get_demo_times returns. Can't answer or they want a human → (727) 999-9846.`;

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

  // Drop the in-chat FORM tools (request_contact / capture_email render a pop-up form — we now
  // collect contact conversationally in the prompt) plus any prior copies of our booking tools;
  // keep anything else, then add our two booking tools.
  const DROP = ["get_demo_times", "book_demo", "request_contact", "capture_email", "collect_user_information", "collect_contact"];
  const keep = Array.isArray(priorTools) ? priorTools.filter((t) => t && !DROP.includes(t.name)) : [];
  const tools = [...keep, ...BOOK_TOOLS];
  const llmUpd = await rt(env, "PATCH", `/update-retell-llm/${r.llmId}`, { general_prompt: MACK_PROMPT, general_tools: tools, begin_message: "Do you want more leads for your existing website? (Yes or No)" });

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
