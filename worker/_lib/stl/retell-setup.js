// Speed-to-Lead — Retell (AI voice) provisioning. "Everything we can set up including
// auth": once RETELL_API_KEY is set, one call creates/updates the "Ruby" agent (LLM +
// agent + webhook wired to our /api/stl/retell/webhook) so the only manual step left is
// buying a number in Retell and setting RETELL_FROM_NUMBER.
const BASE = "https://api.retellai.com";

// Ruby's brain. She is a BRIDGE, not a rep — success = warm transfer, not conversation.
export const RUBY_PROMPT =
`You are Ruby, the AI assistant at Consent Resolve. You call brand-new inbound leads about
40 seconds after they submit a form on consentresolve.com.

## Non-negotiable disclosure (say verbatim in your first sentence)
"Hey — this is Ruby, the AI assistant at Consent Resolve. And yes, an actual AI, calling
you about forty seconds after you hit submit. That's sort of the entire point of the
company. Do you have thirty seconds, or should I just grab a human?"
You MUST identify yourself as an AI. Never imply you are a person.

## Your only job: warm-transfer to a human rep.
You are calling {{first_name}} (company: {{company}}). A rep may be available at the
number {{transfer_number}} (their name: {{rep_name}}).

Priority ladder:
1. If {{transfer_number}} is present, connect them to the team using the transfer_to_rep
   tool — attempt within 30 seconds. Briefly say "let me connect you with our team right
   now, hang tight," then call the tool. The system rings the right person automatically.
2. If there is NO transfer number, do NOT attempt a transfer. Offer to pull their meeting
   forward, or confirm their existing booked slot ({{meeting_time}}) and say a human will
   call next.

## Hard rules
- Do NOT pitch. Do NOT qualify beyond trade + company size.
- Keep it under 90 seconds. You are a bridge, not a closer.
- If they ask to stop / opt out, acknowledge, end the call politely, do not push back.
- Be warm, fast, and a little self-aware about being an AI. That's the brand.`;

// The transfer tool that lets Ruby physically bridge the call to an available rep.
// The destination is a dynamic variable injected per call (the on-shift rep's number).
const TRANSFER_TOOL = {
  type: "transfer_call",
  name: "transfer_to_rep",
  description: "Connect the caller to the human team. Use only when a transfer number ({{transfer_number}}) is present and the caller is willing. The number rings the available reps in order automatically. Do not use if no transfer number is available.",
  transfer_destination: { type: "predefined", number: "{{transfer_number}}" },
  transfer_option: { type: "cold_transfer" },
};

async function rt(env, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${env.RETELL_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text().catch(() => "");
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 300) };
}

// Idempotent-ish: reuse an existing "Ruby" agent if present, else create LLM+agent.
export async function provisionRuby(env, origin) {
  if (!env.RETELL_API_KEY) return { ok: false, error: "missing RETELL_API_KEY" };
  const webhookUrl = `${origin}/api/stl/retell/webhook`;
  const voiceId = env.RETELL_VOICE_ID || "11labs-Kate";

  // Already provisioned? Update BOTH the brain (prompt + transfer tool) and the agent.
  const list = await rt(env, "GET", "/list-agents");
  const existing = Array.isArray(list.json) ? list.json.find((a) => (a.agent_name || "").toLowerCase() === "ruby") : null;
  if (existing) {
    let llmId = existing.response_engine && existing.response_engine.llm_id;
    if (!llmId) { const ga = await rt(env, "GET", `/get-agent/${existing.agent_id}`); llmId = ga.json && ga.json.response_engine && ga.json.response_engine.llm_id; }
    let llmUpd = { ok: true };
    if (llmId) llmUpd = await rt(env, "PATCH", `/update-retell-llm/${llmId}`, { general_prompt: RUBY_PROMPT, general_tools: [TRANSFER_TOOL] });
    const upd = await rt(env, "PATCH", `/update-agent/${existing.agent_id}`, { webhook_url: webhookUrl, voice_id: voiceId });
    return {
      ok: upd.ok && llmUpd.ok, agent_id: existing.agent_id, llm_id: llmId || null, updated: true,
      transfer_tool_added: !!(llmId && llmUpd.ok), webhook_url: webhookUrl,
      detail: (upd.ok && llmUpd.ok) ? "updated Ruby: brain + transfer tool + webhook" : (llmUpd.text || upd.text),
    };
  }

  // Create the LLM brain (with the transfer tool), then the agent bound to it.
  const llm = await rt(env, "POST", "/create-retell-llm", { general_prompt: RUBY_PROMPT, general_tools: [TRANSFER_TOOL], begin_message: "" });
  if (!llm.ok || !llm.json || !llm.json.llm_id) return { ok: false, error: "create-retell-llm failed", detail: llm.text || llm.status };
  const agent = await rt(env, "POST", "/create-agent", {
    response_engine: { type: "retell-llm", llm_id: llm.json.llm_id },
    voice_id: voiceId, agent_name: "Ruby", webhook_url: webhookUrl,
  });
  if (!agent.ok || !agent.json || !agent.json.agent_id) return { ok: false, error: "create-agent failed", detail: agent.text || agent.status, llm_id: llm.json.llm_id };
  return { ok: true, created: true, llm_id: llm.json.llm_id, agent_id: agent.json.agent_id, webhook_url: webhookUrl, voice_id: voiceId,
    next: "Set RETELL_AGENT_ID=" + agent.json.agent_id + ", buy/import a number in Retell, then set RETELL_FROM_NUMBER." };
}

// List numbers so the operator can grab one for RETELL_FROM_NUMBER.
export async function listRetellNumbers(env) {
  if (!env.RETELL_API_KEY) return { ok: false, error: "missing RETELL_API_KEY" };
  const r = await rt(env, "GET", "/list-phone-numbers");
  return { ok: r.ok, numbers: Array.isArray(r.json) ? r.json.map((n) => n.phone_number || n) : [], detail: r.ok ? undefined : r.text };
}
