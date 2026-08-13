// Speed-to-Lead — message templates (spec §6, §7).
//
// Two kinds of template live here:
//   1. EDITABLE copy (emails + SMS) — stored as {{token}} strings in STL_EDITABLE and
//      overridable from the CRM (#sequences → "Speed-to-Lead copy"). Operators edit the
//      body/subject; merge fields fill at send time. Overrides live in D1
//      (stl_template_overrides) and are passed to renderTemplate via ctx.overrides.
//   2. CODE-OWNED scripts (AI call, human dial) — kept as functions in TEMPLATES because
//      they carry flags the runner reads (disclosure_required, textback_ask) and, in the
//      AI case, drive the live Retell agent. Not editable from the CRM by design.
//
// ctx = { lead, rep, meeting, revokeUrl, bookingLink, fromName, repPhone, overrides }
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

function seasonWord() {
  const m = new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "America/Chicago" }).format(new Date());
  const mo = parseInt(m, 10);
  return mo >= 3 && mo <= 5 ? "spring" : mo >= 6 && mo <= 8 ? "the summer rush" : mo >= 9 && mo <= 11 ? "fall" : "the winter slow-down";
}
function pagePart(l) { try { return (l.landing_page || "/").replace(/^https?:\/\/[^/]+/, "") || "/"; } catch (_) { return "/"; } }

// The merge-field values available to editable templates. Keep the keys stable — they're
// documented in the CRM editor's token palette (see worker/api/stl-templates.js TOKENS).
function stlTokens(ctx) {
  const l = ctx.lead || {};
  const tz = l.timezone || "America/Chicago";
  let timestamp = "";
  try { timestamp = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(new Date(l.created_at)); } catch (_) {}
  return {
    first: first(l),
    Trade: tradeLbl(l),
    trade: l.trade || "trades",
    company: l.company || "your shop",
    companyOrShop: l.company || "your shop",
    companyOrTrade: l.company || tradeLbl(l),
    when: when(ctx),
    link: link(ctx),
    rep: repName(ctx),
    repPhone: ctx.repPhone || "",
    fromName: ctx.fromName || "",
    fromNameOrWe: ctx.fromName || "we",
    revokeUrl: ctx.revokeUrl || "",
    season: seasonWord(),
    timestamp,
    consentChecks: "✅ Email  ✅ SMS  ✅ Phone (human)  ✅ Phone (AI)",
    page: pagePart(l),
    adSource: l.ad_source || "direct",
  };
}
function fill(str, tk) { return String(str || "").replace(/\{\{(\w+)\}\}/g, (_, k) => (tk[k] != null ? tk[k] : "")); }

// ---- Editable copy (CRM-overridable) --------------------------------------
// Copy is verbatim from the spec; the dynamic bits are {{tokens}}. seq/order drive the
// grouping + ordering in the CRM editor. sensitive=true flags the consent-receipt email,
// whose structure (the ✅ receipt + one-click revoke link) is the compliance payload.
export const STL_EDITABLE = {
  /* Sequence A — identified, not consented: email + human dial */
  A1_email: {
    seq: "A", order: 1, channel: "email", label: "A1 · Intro email",
    subject: "quick q re: {{companyOrTrade}}",
    body:
`{{first}} — {{fromNameOrWe}} here, we build lead-consent infrastructure for {{Trade}} companies.

Most {{Trade}} shops I talk to are sitting on a list they can't legally text. Is that you, or have you already sorted it?

Happy to just call if easier — what's a good morning?

{{fromName}} · {{repPhone}}`,
  },
  A3_email: {
    seq: "A", order: 3, channel: "email", label: "A3 · One number",
    subject: "one number",
    body:
`{{first}} — quick one: shops that switch to submitted-checkout-only consent cut their "can't legally contact this lead" pile to near zero.

Worth two minutes to see if it fits {{companyOrShop}}?`,
  },
  A5_email: {
    seq: "A", order: 5, channel: "email", label: "A5 · Before the season",
    subject: "before {{season}}",
    body:
`{{first}} — heading into {{season}}, the shops that win are the ones who can actually work the leads they paid for.

If your list is half-untouchable, that's the leak. Want me to show you where it is?`,
  },
  A7_email: {
    seq: "A", order: 7, channel: "email", label: "A7 · Closing this out",
    subject: "closing this out?",
    body:
`{{first}} — haven't heard back, which I read as "not now." Should I close this out or check in after {{season}}?`,
  },

  /* Sequence B — fully consented: 24-hour cadence */
  B2_sms: {
    seq: "B", order: 2, channel: "sms", label: "B2 · SMS (no answer)",
    body:
`Hey {{first}} — Mack from Consent Resolve. That was me calling forty seconds after you hit submit. Screening unknown numbers is correct behavior and I respect it. Quick reason I called: we turn the visitors already on your site into leads you own — a flat $7 a lead, pay-as-you-go. You're on the books for {{when}}. Reply if you'd rather move it up. Text STOP to opt out.`,
  },
  B2_sms_answered: {
    seq: "B", order: 2, channel: "sms", label: "B2 · SMS (answered the call)",
    body:
`Mack here — good talking to you. You're set for {{when}}: {{link}}. Flat $7 a lead, pay-as-you-go. Reply here anytime, a human reads these. Text STOP to opt out.`,
  },
  B3_email: {
    seq: "B", order: 3, channel: "email", label: "B3 · Consent-receipt email", sensitive: true,
    subject: "your consent receipt from Consent Resolve",
    body:
`{{first}} —

First, the straight answer on cost: a flat $7 a lead, pay-as-you-go — no setup fee, no contract. That's real, consented leads you own outright.

Now the fun part. At {{timestamp}} today you told us we could reach you by:

{{consentChecks}}

You did that on the {{page}} page, from a {{adSource}} ad. We logged all of it — timestamp, IP, session, and the exact wording you saw when you agreed.

Want any of that back? Revoke instantly, one click: {{revokeUrl}}
No email to support, no retention specialist, no dark pattern.

We're showing off, obviously. This is the product. Your customers get the same receipt, and it's why your outreach survives a demand letter.

{{when}}. Talk then.`,
  },
  B5_sms: {
    seq: "B", order: 5, channel: "sms", label: "B5 · Pre-meeting SMS (T-1h)",
    body:
`{{first}} — we're on in an hour: {{link}}. If you'd rather I just call your cell, say the word.`,
  },
  CHAT_sms: {
    seq: "B", order: 9, channel: "sms", label: "Chat → SMS bridge",
    body:
`Hey {{first}} — Mack from Consent Resolve, picking up from our chat. Flat $7 a lead, pay-as-you-go. Reply right here with any questions — a human reads these. Text STOP to opt out.`,
  },
};

// ---- Code-owned scripts (NOT CRM-editable) --------------------------------
export const TEMPLATES = {
  A_dial: (ctx) => ({
    script:
`Gatekeeper: "Is ${ctx.lead.first_name || "the owner"} the right person for how you handle web leads? When's he usually around?"  (collect window, hang up, call back inside it)

Voicemail (18s): "${first(ctx.lead)}, ${repName(ctx)} with Consent Resolve. We handle the consent side of web leads for ${tradeLbl(ctx.lead)} companies — the part that decides whether you can legally text a lead or not. Text me back at this number, I'll keep it short. ${ctx.repPhone || ""}."`,
    textback_ask: true,
  }),
  B1_retell: (ctx) => ({
    script:
`"Hey — this is Mack, the AI assistant at Consent Resolve. Real AI, not a person. You hit submit about forty seconds ago, so here I am. That's kind of the whole point of what we do. Got thirty seconds, or should I just grab you a human?"

Pricing, only if it comes up: a flat $7 a lead, pay-as-you-go — no setup fee, no contract. Priority: (1) warm-transfer to any available rep within 30s; (2) pull the meeting forward — "I've got ${repName(ctx)} free in ten minutes — want it now instead of ${when(ctx)}?"; (3) confirm the existing slot. Do NOT pitch or qualify beyond trade + company size.`,
    disclosure_required: true,
  }),
  B4_dial: (ctx) => ({
    script:
`"Hey ${first(ctx.lead)} — ${repName(ctx)} with Consent Resolve, the human. Mack said you two talked. Two minutes before I hop on a call myself — ${when(ctx)} still good? And one thing: what made you click?"`,
  }),
};

// ---- Override persistence --------------------------------------------------
export async function ensureStlTemplateSchema(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS stl_template_overrides (
       template_id TEXT PRIMARY KEY,
       subject     TEXT,
       body        TEXT,
       updated_at  TEXT,
       updated_by  TEXT
     )`
  ).run();
}
// Map of template_id -> { subject, body } for every template the operator has customized.
// Absence of a key means "use the code default". Never throws — a missing table just
// means no overrides yet, so the defaults ship.
export async function loadStlOverrides(env) {
  try {
    const rows = (await env.DB.prepare("SELECT template_id, subject, body FROM stl_template_overrides").all()).results || [];
    const m = {};
    for (const r of rows) m[r.template_id] = { subject: r.subject, body: r.body };
    return m;
  } catch (_) { return {}; }
}

// Render a template to { subject?, text?, script?, ...flags }. Editable templates resolve
// their copy from ctx.overrides first, then the code default; code-owned scripts keep
// their function form (and flags).
export function renderTemplate(id, ctx) {
  const meta = STL_EDITABLE[id];
  if (meta) {
    const tk = stlTokens(ctx);
    const ov = (ctx.overrides && ctx.overrides[id]) || null;
    const subjTpl = ov && ov.subject != null ? ov.subject : (meta.subject || "");
    const bodyTpl = ov && ov.body != null ? ov.body : (meta.body || "");
    const out = { text: fill(bodyTpl, tk) };
    if (meta.channel === "email") out.subject = fill(subjTpl, tk);
    return out;
  }
  const fn = TEMPLATES[id];
  if (!fn) return { text: `[missing template ${id}]` };
  try { return fn(ctx); } catch (e) { return { text: `[template ${id} error: ${String(e).slice(0, 80)}]` }; }
}
