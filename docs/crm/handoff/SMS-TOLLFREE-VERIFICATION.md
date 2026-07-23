# SMS — Toll-Free Verification packet + go-live plan

**Decision (2026-07-23):** bridge to live SMS via **toll-free verification** (faster than full
10DLC brand+campaign vetting) while 10DLC is pending. This doc is the submission packet + the
prerequisite work + the engine go-live checklist.

**Provider:** Telnyx (the engine's `sendTelnyxSms` already targets Telnyx v2). A toll-free number
(TFN) + toll-free verification is required before any A2P SMS will deliver on US carriers.

---

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
| Business legal name | **[Aaron to confirm legal entity name]** |
| Business address | 1907 Gulf Way #1, St Pete Beach, FL 33706 |
| Business website | https://consentresolve.com |
| EIN / Tax ID | **[Aaron to provide]** |
| Business contact name | **[Aaron / Andy]** |
| Contact email | hello@consentresolve.com |
| Contact phone | +1 (727) 202-5996 |
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
4. **HELP reply:** `Consent Resolve: email hello@consentresolve.com or call (727) 202-5996. Msg & data rates may apply. Reply STOP to unsubscribe.`

(Messages 1–2 are the live engine templates `stl_sms1`/`stl_sms2` in
`worker/_lib/workflow-engine.js`. STOP/HELP auto-replies are configured Telnyx-side.)

---

## Engine go-live checklist (once the TFN is verified)

The code path is already built and inert — nothing sends until BOTH creds exist AND the engine is
enabled AND the contact has granted SMS consent.

1. **Buy** a toll-free number in Telnyx; **submit** verification with the packet above; wait for
   approval.
2. Set Cloudflare Worker secrets: `TELNYX_API_KEY` and `TELNYX_FROM_NUMBER` (the TFN in E.164,
   e.g. `+18335551234`).
3. Confirm wiring: `GET /api/crm/workflow` → `providers.sms` flips from
   `"HOLD: TELNYX_API_KEY + 10DLC"` to `"configured"`.
4. **Dry test** (no real send): `POST {testEnroll:{email, phone, smsConsent:true}}` then
   `GET /api/crm/workflow?preview=1` — confirm it routes to `speed-to-lead` and previews the SMS.
5. **Live single test:** text your own opted-in mobile — enroll a real consented contact and run
   one live tick (needs the engine enabled). Verify STOP + HELP replies work end to end.
6. Only then turn on the engine for real automation (`WORKFLOW_ENGINE_ENABLED=true`).

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
