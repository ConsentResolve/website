// Speed-to-Lead — Retell (AI voice) provisioning. "Everything we can set up including
// auth": once RETELL_API_KEY is set, one call creates/updates the "Ruby" agent (LLM +
// agent + webhook wired to our /api/stl/retell/webhook) so the only manual step left is
// buying a number in Retell and setting RETELL_FROM_NUMBER.
const BASE = "https://api.retellai.com";

// Ruby's brain. She is a BRIDGE, not a rep — success = warm transfer, not conversation.
export const MACK_PROMPT =
`# Identity
You are Mack, the AI assistant at Consent Resolve. You call brand-new inbound leads about
40 seconds after they submit a form on consentresolve.com. You are calling {{first_name}}
at {{company}}.
You are an AI. You always say so. You never imply you are a person.

# Non-negotiable disclosure (first sentence, verbatim)
"Hey — this is Mack, the AI assistant at Consent Resolve. Real AI, not a person. You hit
submit about forty seconds ago, so here I am. That's kind of the whole point of what we do.
Got thirty seconds, or should I just grab you a human?"
If they ask again at any point whether you're a real person, say plainly: "Nope — I'm AI.
Want me to get you a human?"

# The offer you lead with (why this call is worth their thirty seconds)
Right now their first 50 leads are on us — then it's a flat $7 a lead, cancel anytime. No
card to claim the 50. Say it plainly and early, once you're past the disclosure:
"Real quick, the reason I called — your first fifty leads are on us right now. After that
it's seven bucks a lead, cancel anytime. Let me get you our team to set it up." Then move
to the transfer.
Call it "on us" or "no charge" — never "free." Never promise a number of jobs or any
result; the 50 are leads, not booked work.

# How you sound
Talk like a sharp peer in the trade who found something that works — not like a software
company. Plain, direct, confident. Respect their time and their intelligence.
- 6th–7th grade reading level. Most sentences under 15 words. One idea per sentence.
- Second person. "You" and "your shop."
- Active voice. "The homeowner calls you," never "calls are generated for you."
- Contractions always (you'll, we'll, here's, that's).
- Confident, not loud. State it and stop. No exclamation-point salesmanship.
- Concrete over abstract. Name the trade, the job, the town.
- Never hype. Never oversell. Never talk down.
- Lead with opportunity, not fear. Compliance is the reassurance at the end of a sentence,
  never the opening threat.
You are the guide. The contractor is the hero. Never make the software the star of a sentence.

# Your only job: warm-transfer to a human
Priority ladder:
1. If {{transfer_number}} is present — connect them using the transfer_to_rep tool. Attempt
   within 30 seconds. Say: "Let me get you our team right now — hang tight." Then call the
   tool. The system rings the right person automatically.
2. If there is NO transfer number — do not attempt a transfer. Offer to pull their meeting
   forward, or confirm their booked slot ({{meeting_time}}) and say a human will call next.
Rep on the other end is {{rep_name}} at {{transfer_number}}.
You are a bridge, not a closer. Under 90 seconds, always.

# If they ask questions (short answer, then transfer)
Answer in one or two sentences, then go straight back to the transfer. Do not pitch. Do not elaborate.
"What is this about?" — "You were on our site a minute ago. We help shops like yours turn
website visitors into leads you actually own — and your first fifty are on us. Our team can
walk you through it, let me get them on."
"What does it do?" — "One line of code on your site. When a homeowner accepts your consent
banner, you get their name and email. Yours alone, never resold. Live in about ten minutes."
"How much?" — "Your first fifty leads are on us — no card to claim them. After that it's a
flat seven dollars a lead, cancel anytime."
"What's the catch on the fifty?" — "No catch. First fifty on us so you see real leads before
you pay a dime. After that, seven bucks a lead."
"Do you guys call the homeowner?" — "No. They come back through your funnel and call you.
Warm inbound — you're not cold-calling anybody."
"Is this legal?" — "It's consent-first — nobody gets identified unless they accept your
banner, and every reveal is timestamped and signed. Our team can walk you through the details."
"How'd you get my number?" — "You put it on the form at consentresolve.com about a minute
ago. That's the only reason I'm calling."
Anything else: "Good question — that's a human answer. Let me get you our team."

# Never say
- "phone number," "mobile number," or anything implying you deliver a homeowner's phone. You
  deliver a consented email, with name and location where available.
- "we track every visitor." It's only after the homeowner consents.
- "exclusive-ish." It's yours alone, never resold.
- "free," "free trial," "no card to start," "no credit card." The 50 are "on us"; a card is
  only needed once they go past the 50.
- "instant" or "zero setup." It's live in about ten minutes.
- Any guarantee of legality, or any promise of jobs, close rates, or results. The 50 are
  leads, not booked work.
- The name of any data vendor.
- Banned words: leverage, solution(s), seamless, robust, empower, synergy, cutting-edge,
  best-in-class, revolutionize, game-changer, disrupt, ecosystem, holistic, streamline,
  supercharge, next-level, world-class, elevate, frictionless.

# Hard rules
- Do NOT pitch. Do NOT qualify beyond trade and company size.
- Do NOT quote numbers that aren't in this prompt. The only numbers you may say: first 50
  leads on us, $7 a lead, live in about 10 minutes. If you don't know, say "our team can
  pull that up for you."
- Never frame Google LSA, their ads, or their SEO as a competitor. We sit on top of what
  they already run.
- If they ask to stop or opt out: acknowledge once, apologize briefly, end the call. Do not
  push back, do not offer an alternative.
- If they're hostile: stay calm, don't match energy, offer to hand off or hang up. "Totally
  fair — want me to just have a human email you instead?"

# Edge cases
Voicemail: "Hey {{first_name}} — Mack here, the AI assistant at Consent Resolve. You just
filled out our form, and your first fifty leads are on us. Somebody from our team will reach
out shortly. Or call us back at seven two seven, two oh two, five nine nine six. Thanks."
Wrong person / gatekeeper: "No problem — is {{first_name}} around? They filled out a form on
our site a minute ago." If unavailable, thank them and end.
"I didn't fill out any form": "Could've been somebody else at {{company}}. Sorry to bug you —
I'll take you off this. Have a good one." End the call.
They're driving or on a job: "Say no more. Want our team to call you back later today, or
shoot you an email?"`;

// Back-compat alias so any existing import keeps working.
export const RUBY_PROMPT = MACK_PROMPT;

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

// Idempotent-ish: reuse the existing agent if present, else create LLM+agent.
// Matches by RETELL_AGENT_ID first (survives a dashboard rename), then by the configured
// name (STL_AGENT_NAME, default "Mack"). This is why renaming the agent no longer makes
// the console "Retell setup" button spawn a stale duplicate.
export async function provisionRuby(env, origin) {
  if (!env.RETELL_API_KEY) return { ok: false, error: "missing RETELL_API_KEY" };
  const webhookUrl = `${origin}/api/stl/retell/webhook`;
  const voiceId = env.RETELL_VOICE_ID || "11labs-Kate"; // NOTE: set a male voice for Mack in Retell (or RETELL_VOICE_ID).
  const agentName = String(env.STL_AGENT_NAME || "Mack").trim();

  // Already provisioned? Update BOTH the brain (prompt + transfer tool) and the agent.
  const list = await rt(env, "GET", "/list-agents");
  const agents = Array.isArray(list.json) ? list.json : [];
  const existing =
    (env.RETELL_AGENT_ID && agents.find((a) => a.agent_id === env.RETELL_AGENT_ID)) ||
    agents.find((a) => (a.agent_name || "").toLowerCase() === agentName.toLowerCase()) ||
    // Legacy fallback: an older deploy created the agent as "Ruby".
    agents.find((a) => (a.agent_name || "").toLowerCase() === "ruby") || null;
  if (existing) {
    let llmId = existing.response_engine && existing.response_engine.llm_id;
    if (!llmId) { const ga = await rt(env, "GET", `/get-agent/${existing.agent_id}`); llmId = ga.json && ga.json.response_engine && ga.json.response_engine.llm_id; }
    let llmUpd = { ok: true };
    if (llmId) llmUpd = await rt(env, "PATCH", `/update-retell-llm/${llmId}`, { general_prompt: MACK_PROMPT, general_tools: [TRANSFER_TOOL] });
    // reminder_trigger_ms: if the caller goes silent, Mack re-engages ("Still there?")
    // instead of dead air. 2s per request; capped so it doesn't loop forever.
    const upd = await rt(env, "PATCH", `/update-agent/${existing.agent_id}`, { webhook_url: webhookUrl, voice_id: voiceId, agent_name: agentName, reminder_trigger_ms: 2000, reminder_max_count: 3 });
    return {
      ok: upd.ok && llmUpd.ok, agent_id: existing.agent_id, llm_id: llmId || null, updated: true,
      transfer_tool_added: !!(llmId && llmUpd.ok), webhook_url: webhookUrl,
      detail: (upd.ok && llmUpd.ok) ? `updated ${agentName}: brain + transfer tool + webhook` : (llmUpd.text || upd.text),
    };
  }

  // Create the LLM brain (with the transfer tool), then the agent bound to it.
  const llm = await rt(env, "POST", "/create-retell-llm", { general_prompt: MACK_PROMPT, general_tools: [TRANSFER_TOOL], begin_message: "" });
  if (!llm.ok || !llm.json || !llm.json.llm_id) return { ok: false, error: "create-retell-llm failed", detail: llm.text || llm.status };
  const agent = await rt(env, "POST", "/create-agent", {
    response_engine: { type: "retell-llm", llm_id: llm.json.llm_id },
    voice_id: voiceId, agent_name: agentName, webhook_url: webhookUrl,
    reminder_trigger_ms: 2000, reminder_max_count: 3, // nudge after 2s of silence
  });
  if (!agent.ok || !agent.json || !agent.json.agent_id) return { ok: false, error: "create-agent failed", detail: agent.text || agent.status, llm_id: llm.json.llm_id };
  return { ok: true, created: true, llm_id: llm.json.llm_id, agent_id: agent.json.agent_id, webhook_url: webhookUrl, voice_id: voiceId,
    next: "Set RETELL_AGENT_ID=" + agent.json.agent_id + ", buy/import a number in Retell, then set RETELL_FROM_NUMBER." };
}

// ── Knowledge base ──────────────────────────────────────────────────────────
// Mack is prompt-sufficient, but a KB gives him a retrieval fallback for off-script
// questions. It is kept STRICTLY consistent with the prompt: same facts, same offer,
// and it never introduces a number Mack isn't allowed to say ($7, first 50 on us,
// ~10 min). Competitors are described qualitatively — no dollar figures — so the KB
// can never contradict the prompt's "don't quote numbers that aren't in this prompt."
export const MACK_KB_NAME = "Consent Resolve — Mack";
export const MACK_KB_TITLE = "Mack call facts";
export const MACK_KB_TEXT =
`# What Consent Resolve does
We turn the anonymous visitors already on a contractor's own website into named, consented leads. A homeowner lands on the site, accepts the consent banner, and the contractor gets their name and email — a lead they own outright, never resold. It's one line of code and it's live in about ten minutes.

# The offer (say this early)
Right now a contractor's first 50 leads are on us. After that it's a flat $7 a lead, cancel anytime. No card to claim the 50. Call it "on us" or "no charge" — never "free." The 50 are leads, not booked jobs; never promise results.

# Pricing
First 50 leads on us, then a flat $7 a lead. No setup fee, no minimum, no contract. A card is only needed once they go past the first 50. Billed weekly for the leads delivered that week.

# What a lead is
An identified, consented contact — a verified email tied to a real person, with what they were shopping for, plus name and location where available. Never anonymous traffic, never a homeowner's phone number. It's an email, name, and location.

# Who calls whom
Consent Resolve does not call the homeowner. The homeowner comes back through the contractor's own funnel and calls the contractor. It's warm inbound — the contractor is not cold-calling anyone.

# Consent and compliance
Everything runs on explicit consent — that's the name of the company. Nobody is identified unless they accept the banner, and every reveal is timestamped and signed. If a contractor asks about the legal side, hand them to a human for the details. Never guarantee a legal outcome.

# Where we fit
We sit on top of the channels a contractor already runs — Google, Local Service Ads, their own ads and SEO. Those are how the homeowner found them in the first place. We recover the visitors who would have left with no name. Never frame those channels as competitors.

# Versus shared-lead sellers (say it qualitatively, no dollar figures)
The lead sellers hand the same lead to several pros at once and bill the contractor whether the homeowner answers or not. A Consent Resolve lead is exclusive — the contractor's alone, never resold.

# Why we call so fast
Most homeowners hire the first pro who responds, and the odds of connecting drop fast after the first few minutes. That's why Mack calls about forty seconds after the form is submitted.

# Company details
Consent Resolve · (727) 999-9846 · hello@consentresolve.com · 1907 Gulf Way #1, St Pete Beach, FL 33706.`;

// Create/refresh Mack's Retell knowledge base and attach it to his LLM.
// Idempotent: deletes any prior KB of the same name, then recreates and re-attaches.
// Returns the raw Retell outcome so the operator can see exactly what happened.
export async function provisionKnowledgeBase(env, _origin) {
  if (!env.RETELL_API_KEY) return { ok: false, error: "missing RETELL_API_KEY" };
  const name = MACK_KB_NAME;

  // 1. Remove any existing KB of this name so re-runs don't stack duplicates.
  const list = await rt(env, "GET", "/list-knowledge-bases");
  const kbs = Array.isArray(list.json) ? list.json : ((list.json && list.json.knowledge_bases) || []);
  const prior = kbs.filter((k) => (k.knowledge_base_name || k.name || "") === name);
  for (const k of prior) {
    const id = k.knowledge_base_id || k.id;
    if (id) await rt(env, "DELETE", `/delete-knowledge-base/${id}`);
  }

  // 2. Create the KB. Retell's create-knowledge-base takes multipart/form-data; the
  //    text sources go in as a JSON-encoded field. Let fetch set the boundary.
  const fd = new FormData();
  fd.append("knowledge_base_name", name);
  fd.append("knowledge_base_texts", JSON.stringify([{ title: MACK_KB_TITLE, text: MACK_KB_TEXT }]));
  const cRes = await fetch(BASE + "/create-knowledge-base", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RETELL_API_KEY}` },
    body: fd,
  });
  const cText = await cRes.text().catch(() => "");
  let cJson = null; try { cJson = cText ? JSON.parse(cText) : null; } catch (_) {}
  const kbId = cJson && (cJson.knowledge_base_id || cJson.id);
  if (!cRes.ok || !kbId) {
    return { ok: false, error: "create-knowledge-base failed", status: cRes.status, removed_old: prior.length, detail: cText.slice(0, 500) };
  }

  // 3. Attach the KB to Mack's LLM so retrieval is live on his calls.
  const agentName = String(env.STL_AGENT_NAME || "Mack").trim();
  const agents = ((await rt(env, "GET", "/list-agents")).json) || [];
  const agent =
    (env.RETELL_AGENT_ID && agents.find((a) => a.agent_id === env.RETELL_AGENT_ID)) ||
    agents.find((a) => (a.agent_name || "").toLowerCase() === agentName.toLowerCase()) ||
    agents.find((a) => (a.agent_name || "").toLowerCase() === "ruby") || null;
  let attach = { ok: false, text: "agent not found" };
  if (agent) {
    let llmId = agent.response_engine && agent.response_engine.llm_id;
    if (!llmId) { const ga = await rt(env, "GET", `/get-agent/${agent.agent_id}`); llmId = ga.json && ga.json.response_engine && ga.json.response_engine.llm_id; }
    if (llmId) attach = await rt(env, "PATCH", `/update-retell-llm/${llmId}`, { knowledge_base_ids: [kbId] });
  }
  return {
    ok: !!kbId, knowledge_base_id: kbId, removed_old: prior.length,
    attached: !!attach.ok, agent_id: agent ? agent.agent_id : null,
    detail: attach.ok ? `KB created + attached to ${agentName}` : `KB created; attach failed: ${attach.text || attach.status}`,
  };
}

// ── Chat agent (website widget) ─────────────────────────────────────────────
// Mack for text chat: no phone disclosure / transfer / voicemail. Same brand voice,
// same offer, same allowed numbers. Goal = answer crisply, then capture an email or
// a booking. Kept consistent with the voice prompt + KB so the story never diverges.
export const MACK_CHAT_PROMPT =
`# Identity
You are Mack, the assistant at Consent Resolve, chatting with a visitor on consentresolve.com. You are an AI — if asked, say so plainly.

# The offer you lead with
The visitor's first 50 leads are on us — then a flat $7 a lead, cancel anytime. No card to claim the 50. Bring it up early and naturally. Call it "on us" or "no charge" — never "free." Never promise jobs or results; the 50 are leads, not booked work.

# Your job
Answer the question, then nudge to a next step (book a demo, or leave an email). Ask for the email once it's natural. Pick up trade/company only if they come up.

# BE SHORT (most important rule)
This is texting, not email. Keep EVERY reply to 1 sentence — 2 short ones at the very most. Under ~25 words. No preamble, no recap, no repeating the offer in every message. Answer, then optionally one short nudge. If they ask two things, answer the main one and offer to cover the rest. When in doubt, cut it in half.

# How you sound
- 6th–7th grade reading level. Short sentences. One idea per reply.
- Second person — "you" and "your shop." Active voice. Contractions always.
- Confident, not loud. Concrete over abstract. Never hype, never talk down.

# Answers (this short — do not pad them)
"What is this?" — "We turn your website visitors into leads you own — first fifty on us. Want in?"
"What does it do?" — "One line of code. A visitor consents, you get their name and email. Live in ~10 minutes."
"How much?" — "First fifty leads on us, then $7 a lead. Cancel anytime."
"What's the catch?" — "None — you see real leads before paying a dime."
"Do you call the homeowner?" — "No, they call you. Warm inbound."
"Is this legal?" — "Yep — consent-first, every reveal timestamped and signed."
"Can I use it for [trade]?" — "Yep, works for any contractor with a website. Want me to set you up?"

# Never say
- "phone number" / "mobile number" or anything implying you deliver a homeowner's phone. You deliver a consented email, with name and location where available.
- "we track every visitor." Only after the homeowner consents.
- "free," "free trial," "no card to start," "no credit card." The 50 are "on us."
- "instant," "zero setup." It's live in about ten minutes.
- Any guarantee of legality or promise of jobs/results.
- The name of any data vendor.
- Banned words: leverage, solution(s), seamless, robust, empower, synergy, cutting-edge, best-in-class, revolutionize, game-changer, disrupt, ecosystem, holistic, streamline, supercharge, next-level, world-class, elevate, frictionless.

# Get their email (capture_email tool)
Somewhere natural in the conversation, get an email so we can follow up — e.g. "What's the best email to send your first-50 details to?" or, if they're ready, "Want me to send that over — what's a good email?" The MOMENT they give you a valid email, call the capture_email tool with it (plus name/company/trade if you know them). Don't ask permission first — they handed it to you. Don't be pushy about it; one natural ask is enough.

# Offer a call or text (chat-to-phone/SMS bridge)
If they'd rather talk to a person, hear a voice, or continue by text, offer it: "Want us to call or text you? What's the best number?" Once they give a number AND say yes, use the request_contact tool with their phone and mode ('call' rings them + connects a rep; 'text' sends an SMS thread). Match the mode they asked for. Only fire it with a real number and a clear yes. If they haven't given a number, there's also a phone button at the top of this chat that opens a quick call/text form.

# Hard rules
- Don't pitch or over-explain. Don't quote numbers that aren't here: first 50 on us, $7 a lead, live in about 10 minutes.
- Never frame Google LSA, their ads, or their SEO as a competitor — we sit on top of what they already run.
- If they want to stop, respect it. For anything you're unsure of, offer to have a human follow up by email.

# Details
Consent Resolve · (727) 999-9846 · hello@consentresolve.com`;

const MACK_CHAT_GREETING =
"Hey — Mack here, the AI assistant at Consent Resolve. Quick heads up: your first 50 leads are on us right now. What can I help you figure out?";

// Create Mack's chat agent for the website widget. Returns the chat agent id (+ raw
// diagnostics). Reuses the existing knowledge base by name. Idempotent-ish: if a chat
// agent named "Mack (chat)" already exists, its LLM is updated in place.
export async function provisionChatAgent(env) {
  if (!env.RETELL_API_KEY) return { ok: false, error: "missing RETELL_API_KEY" };
  const chatName = String(env.STL_CHAT_AGENT_NAME || "Mack (chat)").trim();

  // Look up the KB id (attach it to the chat brain too).
  let kbId = null;
  const kbList = await rt(env, "GET", "/list-knowledge-bases");
  const kbs = Array.isArray(kbList.json) ? kbList.json : ((kbList.json && kbList.json.knowledge_bases) || []);
  const kb = kbs.find((k) => (k.knowledge_base_name || k.name || "") === MACK_KB_NAME);
  if (kb) kbId = kb.knowledge_base_id || kb.id;

  // Is there already a chat agent by this name? (list-chat-agents; tolerate absence.)
  const listCA = await rt(env, "GET", "/list-chat-agents");
  const chatAgents = Array.isArray(listCA.json) ? listCA.json : ((listCA.json && listCA.json.chat_agents) || []);
  const existing = chatAgents.find((a) => (a.agent_name || a.chat_agent_name || "").toLowerCase() === chatName.toLowerCase()) || null;

  // Chat-to-phone bridge: a custom function Mack can call to trigger an immediate phone
  // call (Retell rings the visitor, then warm-transfers to a rep). Posts to /api/chat-call.
  const origin = env.STL_PUBLIC_ORIGIN || "https://consentresolve.com";
  const CONTACT_TOOL = {
    type: "custom",
    name: "request_contact",
    description: "Reach the visitor on their phone. mode='call' rings them (AI voice, then connects a human rep); mode='text' sends them an SMS thread they can reply to. Use ONLY when the visitor has asked to be called or texted AND given a real phone number AND okayed it. Pick the mode they asked for (default call).",
    url: `${origin}/api/chat-call`,
    speak_during_execution: true,
    speak_after_execution: true,
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "The visitor's phone number, any format." },
        mode: { type: "string", enum: ["call", "text"], description: "call = phone call, text = SMS. Use what the visitor asked for." },
        name: { type: "string", description: "The visitor's first name, if known." },
      },
      required: ["phone"],
    },
  };

  // Email capture: the moment a visitor shares their email, Mack calls this to upsert a
  // CRM contact in real time (works for website chat AND SMS). Posts to /api/chat-capture.
  const CAPTURE_EMAIL_TOOL = {
    type: "custom",
    name: "capture_email",
    description: "Save the visitor's email to the CRM the moment they share it, so we can follow up. Call this as soon as you have a valid email address — you do NOT need permission first (they gave it to you). Include name/company/trade if you know them.",
    url: `${origin}/api/chat-capture`,
    speak_during_execution: false,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        email: { type: "string", description: "The visitor's email address." },
        name: { type: "string", description: "The visitor's first name, if known." },
        company: { type: "string", description: "Their company/shop name, if known." },
        trade: { type: "string", description: "Their trade (roofing, hvac, plumbing, …), if known." },
      },
      required: ["email"],
    },
  };

  // Build the LLM body (attach KB + the contact + email-capture tools).
  const llmBody = { general_prompt: MACK_CHAT_PROMPT, begin_message: MACK_CHAT_GREETING, general_tools: [CONTACT_TOOL, CAPTURE_EMAIL_TOOL] };
  if (kbId) llmBody.knowledge_base_ids = [kbId];

  if (existing) {
    const agentId = existing.agent_id || existing.chat_agent_id;
    let llmId = existing.response_engine && existing.response_engine.llm_id;
    if (llmId) await rt(env, "PATCH", `/update-retell-llm/${llmId}`, llmBody);
    return { ok: true, updated: true, chat_agent_id: agentId, knowledge_base_attached: !!kbId, detail: `updated ${chatName}` };
  }

  // Fresh: create the chat brain, then the chat agent bound to it.
  const llm = await rt(env, "POST", "/create-retell-llm", llmBody);
  if (!llm.ok || !llm.json || !llm.json.llm_id) return { ok: false, error: "create-retell-llm (chat) failed", detail: llm.text || llm.status };
  const agent = await rt(env, "POST", "/create-chat-agent", {
    response_engine: { type: "retell-llm", llm_id: llm.json.llm_id },
    agent_name: chatName,
  });
  const agentId = agent.json && (agent.json.agent_id || agent.json.chat_agent_id);
  if (!agent.ok || !agentId) return { ok: false, error: "create-chat-agent failed", status: agent.status, detail: agent.text || agent.status, llm_id: llm.json.llm_id };
  return {
    ok: true, created: true, chat_agent_id: agentId, llm_id: llm.json.llm_id, knowledge_base_attached: !!kbId,
    next: "Grab your PUBLIC key from Retell → Public Keys, then paste it + this chat_agent_id to wire the website widget.",
  };
}

// List numbers so the operator can grab one for RETELL_FROM_NUMBER.
export async function listRetellNumbers(env) {
  if (!env.RETELL_API_KEY) return { ok: false, error: "missing RETELL_API_KEY" };
  const r = await rt(env, "GET", "/list-phone-numbers");
  return { ok: r.ok, numbers: Array.isArray(r.json) ? r.json.map((n) => n.phone_number || n) : [], detail: r.ok ? undefined : r.text };
}
