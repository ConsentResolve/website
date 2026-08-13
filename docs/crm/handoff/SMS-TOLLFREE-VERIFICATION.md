# SMS — Toll-Free Verification packet + go-live plan

**Decision (2026-07-23):** bridge to live SMS via **toll-free verification** (faster than full
10DLC brand+campaign vetting) while 10DLC is pending. This doc is the submission packet + the
prerequisite work + the engine go-live checklist.

**Provider:** Telnyx (the engine's `sendTelnyxSms` already targets Telnyx v2). A toll-free number
(TFN) + toll-free verification is required before any A2P SMS will deliver on US carriers.

---

## ✅ UPDATE (2026-07-23): the SMS opt-in is now BUILT

The prerequisite below is done in code (commit lands with this doc). The demo form
(`src/components/DemoForm.astro`, used on /demo + get-started) now has an **optional, unchecked,
non-required** SMS-consent checkbox with the full disclosure; on submit-with-phone the server
(`worker/api/register.js`) writes a `recordConsent(channel:'sms', action:'granted', basis:'PEWC')`
row storing the **exact disclosure text** shown (shared via `worker/_lib/sms-consent.js` so the
proof matches verbatim), plus IP, user-agent, and source URL. **Once a few real opt-ins come in,
screenshot the live form + pull one consent record as the opt-in proof for the submission.**
Everything below is the original requirement, now satisfied.

## ⛔ Critical path FIRST: there is no SMS opt-in yet

Toll-free verification reviewers **require proof of a compliant opt-in** — a screenshot/URL of the
exact place a person agrees to receive texts, with the required disclosure language visible. Today:

- The only consent capture on consentresolve.com is an **email** checkbox
  (`src/components/DemoForm.astro:65` — "I agree Consent Resolve may email me about this demo").
- **No form collects a phone number with SMS consent.** The public site is deliberately
  "email, not phone" (see `src/data/glossary.ts` — "keeps phone numbers out of its product").

**So a verification submission would be rejected — there is nothing to show as opt-in.**
Before we submit, we must add an SMS opt-in and have at least one real consented number.

### Positioning note (Aaron to weigh)
CR's *product* keeps phone numbers out and never hands a shop a number to cold-call. CR's *own
marketing* texting its prospects (contractors) is a separate thing and is allowed **with PEWC** —
but the SMS opt-in must live on a CR-owned form the prospect fills in, and shouldn't muddy the
email-first story on the public marketing pages. Recommended: put the phone + SMS opt-in on the
**demo/get-started flow** (a warm, high-intent step) — optional field, unchecked box, not required.

### The opt-in to build (compliant PEWC)
Add an **optional** phone field + an **unchecked, non-required** checkbox on the demo/get-started
form. On submit-with-consent, call `recordConsent(env, {contactId, phone, channel:'sms',
action:'granted', basis:'PEWC', captureMethod:'web_form', sourceUrl, ip})` (already exists in
`worker/_lib/crm-rebuild.js`) so every SMS-consented number carries a signed record — which is
also the proof screenshot for verification.

**Exact checkbox disclosure copy (do not abbreviate — reviewers check for each element):**

> ☐ I agree to receive recurring automated marketing text messages from Consent Resolve at the
> number provided. Consent is not a condition of purchase. Msg & data rates may apply. Msg
> frequency varies. Reply **STOP** to unsubscribe, **HELP** for help. See our
> [Privacy Policy](/privacy-policy/) and [Terms](/terms/).

Required elements present above: business name · "recurring/automated" · "consent not a condition
of purchase" · "Msg & data rates may apply" · "Msg frequency varies" · STOP + HELP · links to
Privacy + Terms. Keep all of them.

---

## Verification submission fields (fill into Telnyx → Messaging → Toll-Free Verification)

| Field | Value |
|---|---|
| Business legal name | **ConsentResolve, LLC** |
| Business address | 1907 Gulf Way #1, St Pete Beach, FL 33706 |
| Business website | https://consentresolve.com |
| EIN / Tax ID | **41-4076608** |
| Business contact name | **[Aaron / Andy]** |
| Contact email | hello@consentresolve.com |
| Contact phone | +1 (727) 999-9846 |
| Use-case category | **Low-Volume Mixed** (lead follow-up + account/service) |
| Toll-free number | **[buy in Telnyx first; paste the TFN]** |
| Estimated volume | Low — texts go only to PEWC-consented leads. **[est. e.g. <500/day, <5k/mo]** |

### Opt-in workflow description (paste verbatim)

> Consumers (home-service business owners) opt in on Consent Resolve's own web form at
> consentresolve.com/get-started (and the demo flow). The form has an optional phone-number field
> and a separate, unchecked, non-required consent checkbox reading: "I agree to receive recurring
> automated marketing text messages from Consent Resolve at the number provided. Consent is not a
> condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to
> unsubscribe, HELP for help." Each opt-in is timestamped and stored with the IP and the exact
> disclosure text shown. No numbers are sourced from lists, purchase, or third parties.

Attach the **screenshot of that form** (with the checkbox + disclosure visible) as opt-in proof.

### Sample messages (must match real traffic + show opt-out)

1. `Hi {name}, Andy at Consent Resolve — we turn your website visitors into exclusive $7 leads. Want the 2-min version? Reply STOP to opt out.`
2. `{name}, still happy to show you how Consent Resolve recovers the 98% of site visitors who leave without filling a form. Reply YES for a quick look. STOP to opt out.`
3. **STOP reply:** `You're unsubscribed from Consent Resolve texts and won't receive more. Reply HELP for help.`
4. **HELP reply:** `Consent Resolve: email hello@consentresolve.com or call (727) 999-9846. Msg & data rates may apply. Reply STOP to unsubscribe.`

(Messages 1–2 are the live engine templates `stl_sms1`/`stl_sms2` in
`worker/_lib/workflow-engine.js`. STOP/HELP auto-replies are configured Telnyx-side.)

---

## Engine go-live checklist (once the TFN is verified)

The code path is already built and inert — nothing sends until BOTH creds exist AND the engine is
enabled AND the contact has granted SMS consent.

1. **Buy** a toll-free number in Telnyx; **submit** verification with the packet above; wait for
   approval. *(Submitted 2026-07-23.)*
2. Set Cloudflare Worker secrets:
   - `TELNYX_API_KEY` and `TELNYX_FROM_NUMBER` (the TFN in E.164, e.g. `+18335551234`).
   - `TELNYX_PUBLIC_KEY` (Ed25519 public key from the Telnyx portal) — enables webhook signature
     verification on `/api/telnyx/inbound`. Optional to send, but set it before going live.
3. In Telnyx: create/confirm a **Messaging Profile**, assign the TFN, and set the profile's
   **inbound webhook URL** to `https://consentresolve.com/api/telnyx/inbound` (already built —
   ingests replies, and on STOP revokes SMS consent + suppresses + exits the sequence).
4. Confirm wiring: `GET /api/crm/workflow` → `providers.sms` flips from
   `"HOLD: TELNYX_API_KEY + 10DLC"` to `"configured"`.
5. **Dry test** (no real send, works today): `POST {testEnroll:{email, phone, smsConsent:true}}`
   then `GET /api/crm/workflow?preview=1` — confirm it routes to `speed-to-lead` and previews the SMS.
6. **Live single test** (after approval, no engine needed): `POST /api/crm/workflow
   {testSms:{to:"+1YOURMOBILE", text:"Consent Resolve test. Reply STOP to opt out, HELP for help."}}`
   → verify you receive it, then reply **STOP** and confirm a suppression + revoked-consent record
   appears (Consent screen), and **HELP** returns the carrier auto-reply.
7. Only then turn on the engine for real automation (`WORKFLOW_ENGINE_ENABLED=true`).

### SMS plumbing already built (inert until creds + approval)
- **Outbound:** `sendTelnyxSms` (engine) + speed-to-lead sequence + consent gate + quiet hours.
- **Single-send test:** `POST /api/crm/workflow {testSms:{to,text}}` (admin-gated; refuses
  suppressed numbers; returns "hold" until Telnyx creds exist).
- **Inbound webhook:** `POST /api/telnyx/inbound` (`worker/api/telnyx-inbound.js`) — Ed25519
  signature-verified when `TELNYX_PUBLIC_KEY` is set; ingests replies into the CRM inbox; STOP →
  revoke + suppress + exit; other replies exit the sequence; delivery failures logged.

## What only Aaron can do
- Confirm legal entity name + EIN.
- Decide + approve adding the phone/SMS opt-in to the demo/get-started form (positioning call).
- Buy the TFN and submit the verification in the Telnyx console.
- Set the two Worker secrets after approval.

## Where the code already is
- `worker/_lib/workflow-engine.js` — `sendTelnyxSms` (Telnyx v2, inert w/o creds), `speed-to-lead`
  sequence (SMS-first, only if `sms==='granted'`), consent gate `canSend`, quiet hours 9a–8p CT.
- `worker/_lib/crm-rebuild.js` — `recordConsent` (the opt-in record + proof).
- `worker/api/crm-workflow.js` — `?preview=1` dry-run, `{testEnroll}` (safe testing, no sends).
