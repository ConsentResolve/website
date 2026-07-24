# Retell AI voice — setup + internal test

Goal: place a real **outbound** AI call so you can HEAR it, driven by our engine's `placeRetellCall`.
The call code is built; you provide a Retell account + agent + number + 3 secrets.

## Number (do this first)
Use a **new, dedicated LOCAL number** — NOT your main Twilio line (protects its reputation) and NOT
the Telnyx 1-800 (toll-free = low outbound answer rates). Buy a cheap local number in **Telnyx**
(area code matching your leads), and connect it to Retell as the `from` number.
→ This becomes `RETELL_FROM_NUMBER` (E.164, e.g. `+17275550123`). **Voice needs no SMS/10DLC approval.**

## Retell account + agent
1. Create a Retell account (retellai.com).
2. Build an **Agent**: pick a voice, and paste the **Agent Prompt** below.
3. **CRITICAL:** our code passes the opening line as a dynamic variable, so the agent prompt must
   reference **`{{opening}}`** (it's in the prompt below). Without it, our script is ignored.
4. Connect your Telnyx local number to the agent (Retell → Phone Numbers → import/BYO carrier).
5. Copy the **Agent ID** and an **API key**.

## Set 3 Cloudflare Worker secrets
- `RETELL_API_KEY`
- `RETELL_AGENT_ID`
- `RETELL_FROM_NUMBER`  (the Telnyx local number, E.164)

Confirm: `GET /api/crm/workflow` → `providers.voice` flips from `HOLD` to configured.

## Hear a test call (internal — to your own phone)
Admin-gated; bypasses the sequence + consent (it's a test to your own number). While logged into `/crm`:
```js
await fetch('/api/crm/workflow',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({testCall:{to:'+1YOURMOBILE', name:'Aaron'}})}).then(r=>r.json())
```
Your phone rings; the agent opens with our script and runs the conversation. Returns `hold` until the
3 secrets exist.

## Agent Prompt (paste into Retell → Agent → General Prompt)
```
## Identity
You are a friendly AI voice assistant calling on behalf of Consent Resolve (ConsentResolve, LLC),
a consent-first lead-generation service for home-service businesses (HVAC, plumbing, roofing,
electrical, and similar trades). You are an AI, and you say so in your opening line and any time
you're asked.

## Opening
Begin the call by saying exactly: "{{opening}}"
Then stop and let the person respond.

## Goal
Book a quick 10-minute walkthrough, OR get permission to email/text the details. You are not
hard-selling — you're offering to show how Consent Resolve turns the ~98% of a contractor's website
visitors who leave without filling out a form into exclusive, consented leads at a flat $7 each.

## Facts (use only if asked or clearly relevant)
- Identifies website visitors who leave without filling out a form — WITH their consent — and
  delivers them as EXCLUSIVE leads (never shared or resold).
- Flat $7 per lead. No long contract, cancel anytime.
- Consent-first: every lead carries a signed audit trail; we never hand you a number to cold-call.

## Rules
- Keep replies short and natural — this is a phone call, not an email.
- If they're busy: offer to call back later or email the details, then end politely.
- If they say not interested / stop / remove me: acknowledge, confirm you won't call again, end. Never push.
- Never guarantee income, lead volume, or results. Never invent numbers beyond the facts above.
- If asked whether you're a real person: "I'm an AI assistant for Consent Resolve, yes."
- To book: get their preferred time, confirm their email, and say a human will send a calendar invite.
- Never ask for payment, card, or any sensitive information on the call.

## Ending
Thank them (by name if known), confirm the next step (email or meeting), and end warmly.
```

## ⚠️ Before calling REAL leads (production — separate from internal testing)
The engine's consent gate blocks the call step unless a contact has `voice = granted`, which nothing
captures today. To go live to real leads you must first: (1) add a **voice-consent opt-in** (its own
checkbox + disclosure → `recordConsent(voice, granted)`), and (2) accept the TCPA/AI-voice rules +
the "we never hand you a number to cold-call" brand tension. Internal test calls to your own phone
don't need any of that.
