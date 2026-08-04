// worker/_lib/iv-sequence.js
// "Identified Visitor Outreach" — the 3-email sequence sent (from hello@consentresolve.com,
// as Tyler Spurlock) to people who identified themselves on consentresolve.com. Day 0 / 2 / 5,
// then subscribe to the newsletter. Emails are the approved templates, personalized from the
// contact + the cached _visitor (Consent Resolve site data) + _person (Apollo) enrichment.
//
// The workflow engine (worker/_lib/workflow-engine.js) owns scheduling/sending; this module
// supplies the workflow definition + the rendered {subject, html} per step.

const SITE = "https://consentresolve.com";
const AVATAR = SITE + "/team/tyler-spurlock.jpg";
const ADDR = "1907 Gulf Way #1, St Pete Beach, FL 33706";
const PHONE = "(727) 999-9846";
const TEL = "+17279999846"; // sms: target — tapping opens a text to Tyler's line

// A click-to-text call-to-action on its OWN line, so on a phone it opens a fresh SMS.
function smsCta(label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0"><tr><td style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px"><a href="sms:${TEL}" style="color:#0F6E56;font-weight:bold;text-decoration:none">💬 ${label || "Text me"}: ${PHONE}</a></td></tr></table>`;
}

// ---- personalization -------------------------------------------------------
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function initialsOf(name) { const p = String(name || "").trim().split(/\s+/); return ((p[0] || "")[0] || "") + ((p[1] || "")[0] || "") || "•"; }
function fmtDateTime(v) {
  if (!v) return null;
  const d = /^\d+$/.test(String(v)) ? new Date(Number(v) * (String(v).length <= 10 ? 1000 : 1)) : new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
// Turn whatever page/URL field we have into a natural noun phrase ("pricing page",
// "get-started page", "homepage"). Returns "" when we don't actually know the page — the
// caller falls back to a generic "site" so the copy never claims data we don't have.
function pagePhrase(v) {
  const raw = v.last_url || v.landing_url || v.landing_page || v.page_url || v.last_page || v.page || v.path || v.url || "";
  if (!raw) return "";
  let path;
  try { path = new URL(String(raw), SITE).pathname; } catch (_) { path = String(raw); }
  path = path.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  if (!path || path === "") return "homepage";
  const seg = path.split("/").filter(Boolean).pop();
  const map = { pricing: "pricing page", "get-started": "get-started page", demo: "demo page", "how-it-works": "how-it-works page", about: "about page", contact: "contact page", faq: "FAQ page", blog: "blog", "sample-lead": "sample-lead page" };
  return map[seg] || (seg.replace(/[-_]+/g, " ") + " page");
}
// Build the placeholder set from whatever we actually have, with graceful fallbacks so an
// email with thin data still reads naturally.
export function buildVars(env, { contact, visitor, person }) {
  const v = visitor || {}, p = person || {};
  const fullName = p.name || contact.full_name || "";
  const first = (fullName.split(" ")[0]) || "there";
  const cityState = [p.city, p.state].filter(Boolean).join(", ");
  const cid = contact.id || "";
  const q = "?c=" + encodeURIComponent(cid);
  const when = fmtDateTime(v.last_seen);
  return {
    first_name: esc(first),
    full_name: esc(fullName || "Website visitor"),
    initials: esc(initialsOf(fullName)),
    email: esc(contact.primary_email || ""),
    city_state: cityState ? esc(cityState) : "your area",
    source: v.referrer || v.source_url ? esc(v.referrer || v.source_url) : "your website",
    // The specific page they were on, when we know it; else a generic "site".
    landing_page: esc(pagePhrase(v) || "site"),
    // A drop-in clause that reads right with OR without a timestamp: "on Aug 3 at 2:14 PM"
    // when known, plain "recently" otherwise (so we never render "... at recently").
    visit_moment: when ? "on " + esc(when) : "recently",
    visit_time: when || "recently",
    time_on_site: v.page_views ? `${v.page_views} page${v.page_views === 1 ? "" : "s"}` : "a few minutes",
    seconds_elapsed: "45",
    // Trade is rarely known for these visitors — keep the copy natural without it.
    trade_noun: "job",
    trade_adjective: "home-service",
    data_record_url: SITE + "/api/crm/data-record" + q,
    delete_url: SITE + "/api/crm/data-delete" + q,
    unsubscribe_url: SITE + "/api/unsubscribe" + q,
  };
}
export function fill(html, vars) { return String(html || "").replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? vars[k] : "")); }

// Tyler's signature block (name + avatar + contact line) — appended to emails 2 & 3.
function tylerSig() {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 0 0"><tr>
    <td valign="middle" style="padding-right:12px"><img src="${AVATAR}" width="48" height="48" alt="Tyler Spurlock" style="width:48px;height:48px;border-radius:24px;display:block"></td>
    <td valign="middle" style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.4">
      <div style="font-size:15px;font-weight:bold;color:#16181D">Tyler Spurlock</div>
      <div style="font-size:13px;color:#71767F">Consent Resolve · <a href="mailto:hello@consentresolve.com" style="color:#0F6E56">hello@consentresolve.com</a></div>
      <div style="font-size:13px;margin-top:3px"><a href="sms:${TEL}" style="color:#0F6E56;font-weight:bold;text-decoration:none">💬 Text me: ${PHONE}</a></div>
    </td></tr></table>`;
}

// Given a template id + vars, return the rendered {subject, html}. An `override` (edited
// subject/html stored on the workflow step) wins over the code default in IV_RAW.
export function renderIvTemplate(id, vars, override) {
  const base = (override && (override.subject || override.html)) ? { subject: override.subject || (IV_RAW[id] || {}).subject, html: override.html || (IV_RAW[id] || {}).html } : IV_RAW[id];
  if (!base) return null;
  return { subject: fill(base.subject || "", vars), html: fill(base.html || "", vars) };
}
// Back-compat: the preview harness uses IV_TEMPLATES(vars).
export const IV_TEMPLATES = {
  iv_lead_card: (v) => renderIvTemplate("iv_lead_card", v),
  iv_the_98: (v) => renderIvTemplate("iv_the_98", v),
  iv_yard_signs: (v) => renderIvTemplate("iv_yard_signs", v),
};

// ---- workflow definition ---------------------------------------------------
// Day 0 / Day 2 / Day 5, then subscribe to the newsletter. delay_minutes are cumulative-from-enroll
// the same way the engine's other workflows express them (measured per-step wait).
export const IV_WORKFLOW = {
  id: "identified-visitor",
  name: "Identified Visitor Outreach",
  trigger: "identified_visitor",
  goal: JSON.stringify(["replied", "booked", "opted_out"]),
  requires_consent: JSON.stringify([]), // email only; these visitors consented on-site
  definition: JSON.stringify([
    { channel: "email", action: "send_email", delay_minutes: 0, template: "iv_lead_card" },
    { channel: "email", action: "send_email", delay_minutes: 2880, template: "iv_the_98" },     // +2 days
    { channel: "email", action: "send_email", delay_minutes: 4320, template: "iv_yard_signs" },  // +3 days (Day 5)
    { channel: null, action: "subscribe_newsletter", delay_minutes: 60 },                        // after the last email
  ]),
};

// ============================ RAW EMAIL HTML ================================
// The approved templates, with Aaron→Tyler, a signature block, the reward tier updated to the
// 2,000-home mailer, and {{placeholders}} preserved for fill().

const LEAD_CARD_HTML = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F1F2EF;font-size:1px;line-height:1px">We ran it on you — you're the one in the card.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F1F2EF"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#FFFFFE;border:1px solid #E3E5E9;border-radius:12px">
<tr><td style="padding:26px 24px 0 24px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
<p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#22252B">{{first_name}} &mdash;</p>
<p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#22252B">You were on our {{landing_page}} {{visit_moment}}. Our banner asked, you said yes, and this went out {{seconds_elapsed}} seconds later.</p>
<p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#22252B">Same card you'd get. Same minute. Only difference is next time the name in it belongs to a homeowner.</p></td></tr>
<tr><td style="padding:0 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #C9CDD3;border-radius:12px;background-color:#FFFFFE">
<tr><td style="padding:11px 16px;background-color:#E1F5EE;border-bottom:1px solid #D2E8DF;border-radius:11px 11px 0 0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:bold;color:#0F6E56">This is what an Accept gets you &darr;</td></tr>
<tr><td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td width="46" valign="top" style="width:46px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="42" style="width:42px;height:42px;background-color:#E6F1FB;border-radius:21px"><tr><td align="center" valign="middle" style="height:42px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;font-weight:bold;color:#185FA5">{{initials}}</td></tr></table></td>
<td valign="top" style="padding-left:12px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif"><p style="margin:0;font-size:17px;font-weight:bold;color:#16181D;line-height:1.3">{{full_name}}</p><p style="margin:3px 0 0 0;font-size:14px;color:#71767F;line-height:1.4">Browsed your {{landing_page}} &middot; {{time_on_site}}</p></td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px">
<tr><td style="padding:6px 0;color:#71767F">Email</td><td align="right" style="padding:6px 0;color:#0F6E56;font-weight:bold">{{email}}</td></tr>
<tr><td style="padding:6px 0;color:#71767F">Area</td><td align="right" style="padding:6px 0;color:#22252B">{{city_state}}</td></tr>
<tr><td style="padding:6px 0;color:#71767F">Came from</td><td align="right" style="padding:6px 0;color:#22252B">{{source}}</td></tr>
<tr><td style="padding:6px 0;color:#A8ACB3">Phone</td><td align="right" style="padding:6px 0;color:#A8ACB3">not collected</td></tr>
<tr><td style="padding:6px 0;color:#A8ACB3">Home address</td><td align="right" style="padding:6px 0;color:#A8ACB3">not collected</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;border-top:1px solid #E3E5E9"><tr><td style="padding-top:11px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:1.55;color:#8A8F97">The grey rows are what other visitor-ID outfits would've handed you. We don't take them.</td></tr></table>
</td></tr>
<tr><td style="padding:0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F6F4;border-top:1px solid #E3E5E9;border-radius:0 0 11px 11px"><tr><td style="padding:13px 16px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#71767F">Your cost for this lead</td><td align="right" style="padding:13px 16px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;font-weight:bold;color:#16181D">$7.00</td></tr></table></td></tr>
</table></td></tr>
<tr><td style="padding:20px 24px 0 24px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif"><p style="margin:0;font-size:16px;line-height:1.6;color:#22252B">That's the product. Somebody's already on your website &mdash; we ask them, and if they say yes, you get their name and their email. Seven dollars. Nobody else ever gets that lead.</p></td></tr>
<tr><td style="padding:24px 24px 0 24px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="background-color:#0F6E56;border-radius:8px"><a href="${SITE}/get-started/" style="display:block;padding:16px 20px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;font-weight:bold;color:#FFFFFE;text-decoration:none">Put this on my site &mdash; $7 a lead</a></td></tr></table><p style="margin:10px 0 0 0;text-align:center;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;color:#71767F">Live in about 10 minutes. No contract.</p></td></tr>
<tr><td style="padding:22px 24px 8px 24px;border-top:1px solid #E3E5E9;margin-top:8px">${tylerSig()}</td></tr>
<tr><td style="padding:8px 24px 26px 24px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;line-height:1.6;color:#8A8F97"><a href="{{data_record_url}}" style="color:#8A8F97">See everything we have on you</a> &middot; <a href="{{delete_url}}" style="color:#8A8F97">delete it</a> &middot; both work instantly, one click, no form.</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%"><tr><td style="padding:18px 8px 4px 8px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9BA0A8">Consent Resolve &middot; <a href="sms:${TEL}" style="color:#9BA0A8">${PHONE}</a><br>You're getting this because you consented on consentresolve.com {{visit_moment}}. <a href="{{unsubscribe_url}}" style="color:#9BA0A8">Unsubscribe</a></td></tr></table>
</td></tr></table>`;

const THE_98_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FFFFFE"><tr><td align="left" style="padding:22px 18px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="580" style="max-width:580px;width:100%"><tr><td style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.65;color:#22252B">
<p style="margin:0 0 16px 0">{{first_name}} &mdash;</p>
<p style="margin:0 0 16px 0">Tyler with Consent Resolve. We're the ones who emailed you your own name a couple days ago.</p>
<p style="margin:0 0 16px 0">Here's the thing nobody tells contractors about their website. Out of every 100 people who land on it, about 2 call or fill out the form. The other 98 leave without a word.</p>
<p style="margin:0 0 16px 0">You paid for all 100 &mdash; the ad, the LSA click, the sign in the yard, years of your name getting around. You just never got to meet 98% of what you bought.</p>
<p style="margin:0 0 16px 0">And those 98 aren't tire-kickers. A lot of them were on your site at 9pm, got interrupted, and never came back. The {{trade_noun}} still needs doing.</p>
<p style="margin:0 0 16px 0">Roughly 3 out of 100 will say yes to being introduced. So:</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px 0"><tr><td style="border-left:3px solid #0F6E56;padding:2px 0 2px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#22252B">
<tr><td style="padding:5px 0">500 visits a month</td><td align="right" style="padding:5px 0;color:#71767F">15 leads &middot; <strong style="color:#16181D">$105</strong></td></tr>
<tr><td style="padding:5px 0">1,200 visits</td><td align="right" style="padding:5px 0;color:#71767F">36 leads &middot; <strong style="color:#16181D">$252</strong></td></tr>
<tr><td style="padding:5px 0">3,000 visits</td><td align="right" style="padding:5px 0;color:#71767F">90 leads &middot; <strong style="color:#16181D">$630</strong></td></tr></table></td></tr></table>
<p style="margin:0 0 16px 0">Now hold that up against what one {{trade_adjective}} lead runs you on Angi &mdash; shared with three other shops who are all calling the same homeowner before lunch.</p>
<p style="margin:0 0 16px 0"><strong style="color:#16181D">Don't go dig up your traffic number. Just reply with your website address</strong> and I'll look it up and tell you what it's actually worth. If it's not worth it yet, I'll tell you that too &mdash; this only works when there's already traffic to work with.</p>
<p style="margin:0 0 8px 0;font-size:15px;color:#71767F">Reply here, or text me &mdash; it comes straight to my phone:</p>
${smsCta("Text me")}
<div style="height:10px;line-height:10px">&nbsp;</div>
${tylerSig()}
<p style="margin:20px 0 0 0;font-size:15px;line-height:1.6;color:#22252B"><strong style="color:#16181D">P.S.</strong> &mdash; Those free yard signs I mentioned aren't a promo. There's a reason we ship them and it's a selfish one. I'll explain in a few days.</p>
</td></tr>
<tr><td style="padding-top:26px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #E3E5E9"><tr><td style="padding-top:14px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9BA0A8">Consent Resolve<br>You consented to hear from us on consentresolve.com. <a href="{{unsubscribe_url}}" style="color:#9BA0A8">Unsubscribe</a> &middot; <a href="{{delete_url}}" style="color:#9BA0A8">delete my record</a></td></tr></table></td></tr>
</table></td></tr></table>`;

const YARD_SIGNS_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FFFFFE"><tr><td align="left" style="padding:22px 18px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="580" style="max-width:580px;width:100%"><tr><td style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.65;color:#22252B">
<p style="margin:0 0 16px 0">{{first_name}} &mdash;</p>
<p style="margin:0 0 16px 0">Tyler with Consent Resolve. I said I'd explain the signs. Here's the honest version.</p>
<p style="margin:0 0 16px 0">We only make money when somebody lands on your website and says yes. No visits, no leads, no seven dollars. Which means our whole business depends on your name being in front of more people &mdash; and yard signs are the cheapest way on earth to put it there.</p>
<p style="margin:0 0 18px 0">So we don't sell them to you. We mail them.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px 0"><tr><td style="border-left:3px solid #0F6E56;padding:2px 0 2px 16px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5;color:#22252B">
<tr><td width="90" style="width:90px;padding:5px 0;color:#71767F">25 leads</td><td style="padding:5px 0">Yard signs and stickers</td></tr>
<tr><td style="padding:5px 0;color:#71767F">100 leads</td><td style="padding:5px 0">Door hangers and review cards</td></tr>
<tr><td style="padding:5px 0;color:#71767F">250 leads</td><td style="padding:5px 0">Truck magnets</td></tr>
<tr><td style="padding:5px 0;color:#71767F">1,000 leads</td><td style="padding:5px 0">A 2,000-home neighborhood mailer</td></tr></table></td></tr></table>
<p style="margin:0 0 16px 0">Your logo, your number, and a tracking code on every piece &mdash; so for once you can see which neighborhoods actually send you work instead of guessing.</p>
<p style="margin:0 0 16px 0">You never get billed for any of it. The only line on your invoice is $7 per lead. <a href="${SITE}/better-together/" style="color:#0F6E56;font-weight:bold">See how the loop works &rarr;</a></p>
<p style="margin:0 0 16px 0;padding-top:6px"><strong style="color:#16181D">Now the part where I talk you out of it.</strong></p>
<p style="margin:0 0 16px 0">If your website gets under about 300 visits a month, don't sign up. You'd be paying us to find you a handful of leads, and you'd be better off spending that money getting traffic in the first place. Reply and tell me what you're working with &mdash; if that's you, I'll say so and leave you alone.</p>
<p style="margin:0 0 22px 0">But if you've got real traffic and you're only hearing from 2% of it, this is the cheapest lead you'll buy this year.</p>
</td></tr>
<tr><td style="padding-bottom:14px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color:#0F6E56;border-radius:8px"><a href="${SITE}/get-started/" style="display:block;padding:15px 28px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:17px;font-weight:bold;color:#FFFFFE;text-decoration:none">Start now &mdash; $7 a lead</a></td></tr></table></td></tr>
<tr><td style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.65;color:#22252B">
<p style="margin:0 0 8px 0;color:#71767F">Live in about 10 minutes. Or if you'd rather talk it through first, just hit reply &mdash; or text me:</p>
${smsCta("Text me")}
<div style="height:10px;line-height:10px">&nbsp;</div>
${tylerSig()}
<p style="margin:20px 0 0 0;font-size:15px;line-height:1.6"><strong style="color:#16181D">P.S.</strong> &mdash; No contract, no setup fee, no monthly. Slow month, small bill. That's the whole pricing page.</p></td></tr>
<tr><td style="padding-top:26px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #E3E5E9"><tr><td style="padding-top:14px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#9BA0A8">Consent Resolve<br>You consented to hear from us on consentresolve.com. <a href="{{unsubscribe_url}}" style="color:#9BA0A8">Unsubscribe</a> &middot; <a href="{{delete_url}}" style="color:#9BA0A8">delete my record</a></td></tr></table></td></tr>
</table></td></tr></table>`;

// Raw (unfilled) subject + html per template — the editable source of truth. The engine
// fills {{placeholders}} at send time; the CRM editor edits these strings (or a per-step
// override stored on the workflow definition).
export const IV_RAW = {
  iv_lead_card: { subject: "{{first_name}}, we ran it on you — you're the card", html: LEAD_CARD_HTML },
  iv_the_98:    { subject: "The 98% of your site visitors you paid for and never met", html: THE_98_HTML },
  iv_yard_signs:{ subject: "Why we mail contractors free yard signs", html: YARD_SIGNS_HTML },
};
