// Speed-to-Lead — message templates (spec §6, §7). Copy is verbatim from the spec
// where given. Each returns { subject?, text, script? } from a ctx.
//
// ctx = { lead, rep, meeting, revokeUrl, bookingLink, fromName, repPhone }
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const first = (l) => l.first_name || "there";
const tradeLbl = (l) => cap(l.trade || "trades");
const when = (ctx) => {
  const m = ctx.meeting;
  if (!m || !m.scheduled_for) return "your booked time";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", minute: "2-digit",
    timeZone: ctx.lead.timezone || "America/Chicago" }).format(new Date(m.scheduled_for));
};
const link = (ctx) => ctx.bookingLink || "https://consentresolve.com/book";
const repName = (ctx) => (ctx.rep && ctx.rep.name) || "your rep";

export const TEMPLATES = {
  /* ---------- Sequence A (identified, not consented): email + human dial ---------- */
  A1_email: (ctx) => ({
    subject: `quick q re: ${ctx.lead.company || tradeLbl(ctx.lead)}`,
    text:
`${first(ctx.lead)} — ${ctx.fromName || "we"} here, we build lead-consent infrastructure for ${tradeLbl(ctx.lead)} companies.

Most ${tradeLbl(ctx.lead)} shops I talk to are sitting on a list they can't legally text. Is that you, or have you already sorted it?

Happy to just call if easier — what's a good morning?

${ctx.fromName || ""} · ${ctx.repPhone || ""}`,
  }),
  A3_email: (ctx) => ({
    subject: `one number`,
    text:
`${first(ctx.lead)} — quick one: shops that switch to submitted-checkout-only consent cut their "can't legally contact this lead" pile to near zero.

Worth two minutes to see if it fits ${ctx.lead.company || "your shop"}?`,
  }),
  A5_email: (ctx) => ({
    subject: `before ${seasonWord()}`,
    text:
`${first(ctx.lead)} — heading into ${seasonWord()}, the shops that win are the ones who can actually work the leads they paid for.

If your list is half-untouchable, that's the leak. Want me to show you where it is?`,
  }),
  A7_email: (ctx) => ({
    subject: `closing this out?`,
    text:
`${first(ctx.lead)} — haven't heard back, which I read as "not now." Should I close this out or check in after ${seasonWord()}?`,
  }),
  A_dial: (ctx) => ({
    script:
`Gatekeeper: "Is ${ctx.lead.first_name || "the owner"} the right person for how you handle web leads? When's he usually around?"  (collect window, hang up, call back inside it)

Voicemail (18s): "${first(ctx.lead)}, ${repName(ctx)} with Consent Resolve. We handle the consent side of web leads for ${tradeLbl(ctx.lead)} companies — the part that decides whether you can legally text a lead or not. Text me back at this number, I'll keep it short. ${ctx.repPhone || ""}."`,
    textback_ask: true,
  }),

  /* ---------- Sequence B (fully consented): 24-hour cadence ---------- */
  B1_retell: (ctx) => ({
    script:
`"Hey — this is Mack, the AI assistant at Consent Resolve. Real AI, not a person. You hit submit about forty seconds ago, so here I am. That's kind of the whole point of what we do. Got thirty seconds, or should I just grab you a human?"

Pricing, only if it comes up: a flat $7 a lead, cancel anytime — no setup fee, no contract. Priority: (1) warm-transfer to any available rep within 30s; (2) pull the meeting forward — "I've got ${repName(ctx)} free in ten minutes — want it now instead of ${when(ctx)}?"; (3) confirm the existing slot. Do NOT pitch or qualify beyond trade + company size.`,
    disclosure_required: true,
  }),
  B2_sms_answered: (ctx) => ({
    text:
`Mack here — good talking to you. You're set for ${when(ctx)}: ${link(ctx)}. Flat $7 a lead, cancel anytime. Reply here anytime, a human reads these. Text STOP to opt out.`,
  }),
  B2_sms: (ctx) => ({
    text:
`Hey ${first(ctx.lead)} — Mack from Consent Resolve. That was me calling forty seconds after you hit submit. Screening unknown numbers is correct behavior and I respect it. Quick reason I called: we turn the visitors already on your site into leads you own — a flat $7 a lead, cancel anytime. You're on the books for ${when(ctx)}. Reply if you'd rather move it up. Text STOP to opt out.`,
  }),
  B3_email: (ctx) => ({
    subject: `your consent receipt from Consent Resolve`,
    text:
`${first(ctx.lead)} —

First, the straight answer on cost: a flat $7 a lead, cancel anytime — no setup fee, no contract. That's real, consented leads you own outright.

Now the fun part. At ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: ctx.lead.timezone || "America/Chicago" }).format(new Date(ctx.lead.created_at))} today you told us we could reach you by:

✅ Email  ✅ SMS  ✅ Phone (human)  ✅ Phone (AI)

You did that on the ${pagePart(ctx.lead)} page, from a ${ctx.lead.ad_source || "direct"} ad. We logged all of it — timestamp, IP, session, and the exact wording you saw when you agreed.

Want any of that back? Revoke instantly, one click: ${ctx.revokeUrl || ""}
No email to support, no retention specialist, no dark pattern.

We're showing off, obviously. This is the product. Your customers get the same receipt, and it's why your outreach survives a demand letter.

${when(ctx)}. Talk then.`,
  }),
  B4_dial: (ctx) => ({
    script:
`"Hey ${first(ctx.lead)} — ${repName(ctx)} with Consent Resolve, the human. Mack said you two talked. Two minutes before I hop on a call myself — ${when(ctx)} still good? And one thing: what made you click?"`,
  }),
  B5_sms: (ctx) => ({
    text:
`${first(ctx.lead)} — we're on in an hour: ${link(ctx)}. If you'd rather I just call your cell, say the word.`,
  }),
  // Chat-to-SMS bridge: visitor asked (in the web chat) for a text instead of a call.
  CHAT_sms: (ctx) => ({
    text:
`Hey ${first(ctx.lead)} — Mack from Consent Resolve, picking up from our chat. Flat $7 a lead, cancel anytime. Reply right here with any questions — a human reads these. Text STOP to opt out.`,
  }),
};

function seasonWord() {
  const m = new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "America/Chicago" }).format(new Date());
  const mo = parseInt(m, 10);
  return mo >= 3 && mo <= 5 ? "spring" : mo >= 6 && mo <= 8 ? "the summer rush" : mo >= 9 && mo <= 11 ? "fall" : "the winter slow-down";
}
function pagePart(l) { try { return (l.landing_page || "/").replace(/^https?:\/\/[^/]+/, "") || "/"; } catch (_) { return "/"; } }

export function renderTemplate(id, ctx) {
  const fn = TEMPLATES[id];
  if (!fn) return { text: `[missing template ${id}]` };
  try { return fn(ctx); } catch (e) { return { text: `[template ${id} error: ${String(e).slice(0, 80)}]` }; }
}
