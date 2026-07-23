// Single source of truth for the SMS (PEWC) opt-in disclosure.
// The exact text shown on the form MUST equal the text stored as consent proof —
// toll-free/10DLC reviewers and TCPA regulators compare the shown copy to the record.
// Imported by both the form (src/components/DemoForm.astro) and the server (worker/api/register.js).
export const SMS_CONSENT_DISCLOSURE =
  "I agree to receive recurring automated marketing text messages from Consent Resolve at the number provided. Consent is not a condition of purchase. Msg & data rates may apply. Msg frequency varies. Reply STOP to unsubscribe, HELP for help.";
