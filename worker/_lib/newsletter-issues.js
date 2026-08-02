// worker/_lib/newsletter-issues.js
// The 12-month editorial calendar (playbook Part 2). Each issue owns one Category Entry Point,
// one idea, one measurable ask, and (mostly) one two-tap segmentation poll. Issue 01 is the
// fully-written calibration piece; 02–12 are solid first drafts to refine in Aaron's voice.
//
// Copy is intentionally plain — light formatting, one button (playbook rule #5). Render adds
// tracked links (clicks score) + signed poll links (taps capture a segmentation field + score).
import { trackedUrl } from "./click-track.js";
import { optinToken } from "./newsletter.js";

// poll.field must be one of the contacts segmentation columns: seg_ticket|seg_channel|seg_trucks|seg_crm
export const ISSUES = [
  {
    id: "01", month: "2026-09", cep: "It got quiet and I don't know why.",
    subjects: ["Where did August go?", "98 homeowners you already paid for", "Pull one number off your site before Friday"],
    one_thing: `Summer's winding down. If your phone got quiet these last two weeks, you're not the only one — September does that to most shops.\n\nHere's the part that stings: your website didn't get quiet. It got ignored. About 98 of every 100 people who land on a contractor's site leave without giving a name. You paid for those clicks. They looked at your work, checked your service area, read a review or two — then they were gone.\n\nThat's not a traffic problem. That's a name problem.`,
    run: { heading: "Run this before Friday", body: `Open Google Analytics. Pull two numbers from last month: sessions, and form-fills plus tracked calls. Subtract. That's your ghost count. Multiply it by your close rate and your average ticket — that's what walked out the door in August.`, dest: "/lead-math/", label: "Do the math for me" },
    poll: { q: "What's your average ticket?", field: "seg_ticket", options: [{ l: "Under $500", v: "u500" }, { l: "$500–$2,500", v: "500-2500" }, { l: "$2,500–$10,000", v: "2500-10000" }, { l: "$10,000+", v: "10000+" }], note: "One tap. It changes what I send you next month." },
    ps: `When a homeowner says yes to your consent banner, you get their email, their name, and what they were shopping for. Yours alone, never resold. Flat $7 a lead. Live in about 10 minutes. That's the whole pitch — now go run your numbers.`,
  },
  {
    id: "02", month: "2026-10", cep: "I'm setting next year's marketing budget.",
    subjects: ["What a booked job actually costs you", "Budget season — the number nobody shows you", "Cost per booked job, not cost per lead"],
    one_thing: `Budget season. Everyone quotes you a cost per lead. Nobody quotes you the number that actually matters: cost per booked job. A $30 lead you share with four other contractors and lose isn't a $30 lead. It's a $0 job at a $30 cost.\n\nRun the real math on every channel you use — LSA, Angi, Thumbtack, your own ads — with the booked-job denominator, not the lead one. The ranking changes fast.`,
    run: { heading: "The booked-job worksheet", body: `Spend ÷ jobs you actually won = what each booked job cost you. Do it per channel. The one that looks cheapest per lead is usually the most expensive per job.`, dest: "/compare/", label: "Compare the channels" },
    poll: { q: "Which channel are you spending the most on right now?", field: "seg_channel", options: [{ l: "Google LSA", v: "lsa" }, { l: "Angi / Thumbtack", v: "reseller" }, { l: "Meta / Google Ads", v: "ads" }, { l: "Just referrals", v: "referral" }], note: "" },
    ps: `We don't replace your ads or your LSA — we catch the visitors they send who leave without a form. Exclusive, consent-first, $7 flat.`,
  },
  {
    id: "03", month: "2026-11", cep: "I just added up what I paid the lead resellers this year.",
    subjects: ["The 20-minute shared-lead audit", "Add up what Angi cost you this year", "What did you actually book off those leads?"],
    one_thing: `End of the year is when the number finally lands: what you paid the shared-lead platforms, all in. Most contractors have never put it on one line. Do it. Then put the second number next to it — how many of those jobs you actually won.\n\nThat gap is the whole reason this newsletter exists.`,
    run: { heading: "The 20-minute audit", body: `Pull your reseller invoices for 2026. Total them. Now count the jobs you booked from them. Divide. That's your real cost per booked job on shared leads.`, dest: "/compare/", label: "See the comparison" },
    poll: null,
    reply_ask: `Reply with your 2026 total and I'll tell you what that buys at $7 a lead. I read every one.`,
    ps: `Every Consent Resolve lead is yours alone. One consent, one contractor. Never resold.`,
  },
  {
    id: "04", month: "2026-12", cep: "Slow month. Time to fix the things I've been putting off.",
    subjects: ["5 fixes for the slow week", "The slow week is the opportunity", "Fix these before March"],
    one_thing: `December's slow week is the one stretch all year you have time to fix the things that quietly cost you jobs. Here are five worth an hour each. One of them is adding visitor recovery to your site. Four have nothing to do with us — page speed, your Google Business hours, a real call-tracking number, and killing the contact form no one fills out.`,
    run: { heading: "The slow-week checklist", body: `One page, printable. Take it to the shop and knock them out between calls.`, dest: "/how-it-works/", label: "Get the checklist" },
    poll: null,
    ps: `The recovery snippet goes live in about 10 minutes and works on WordPress, Wix, Squarespace, or a ServiceTitan site. If you only do one thing this week, that's a good one.`,
  },
  {
    id: "05", month: "2027-01", cep: "New year. I'm changing how I get leads.",
    subjects: ["Where your leads come from in 2027", "A one-page lead plan for the year", "Keep what works. Add the layer that catches the rest."],
    one_thing: `January is when you actually decide. So here's a one-page plan: keep the channels that already work — your ads, your SEO, your LSA. Add one layer underneath them that catches the 98% those channels send to your site who leave without a form. That's it. Not a rip-and-replace. A net under the ones you're already paying to attract.`,
    run: { heading: "Book a 15-minute walkthrough", body: `I'll show you exactly what recovered visitors look like on a site like yours, and what they'd cost you. No slides.`, dest: "/get-started/", label: "Book a walkthrough" },
    poll: null,
    ps: `Flat $7 a lead, exclusive, consent-first. January's the month it's worth 15 minutes.`,
  },
  {
    id: "06", month: "2027-02", cep: "I hired a tech and I need to keep him busy.",
    subjects: ["How much work does one more truck need?", "Break-even for the new hire", "Keep the new truck busy"],
    one_thing: `You added a truck. Now the quiet math: how many booked jobs a month does that tech need to cover his loaded cost and turn a profit? Once you have that number, every lead source gets judged against it — including the ones you're overpaying for.`,
    run: { heading: "Crew capacity calculator", body: `Techs × loaded cost × your close rate → jobs you need to book per month. Then see what that costs at $7 a lead vs a shared-lead platform.`, dest: "/lead-math/", label: "Run the capacity math" },
    poll: { q: "How many trucks do you run?", field: "seg_trucks", options: [{ l: "1", v: "1" }, { l: "2–4", v: "2-4" }, { l: "5–10", v: "5-10" }, { l: "10+", v: "10+" }], note: "" },
    ps: `More trucks means more jobs to feed. Recovered visitors are the cheapest way to feed them.`,
  },
  {
    id: "07", month: "2027-03", cep: "Spring is here and I need the phone ringing.",
    subjects: ["The spring surge playbook", "Get set up before the surge, not during it", "Your traffic is about to double"],
    one_thing: `March through May, your traffic doubles. So does the number of people who visit your site and leave without a name. The leak costs the most exactly when volume peaks — which means now is when to plug it, before the surge, not during it when you're slammed.`,
    run: { heading: "Get set up before the surge", body: `Ten minutes now, so every extra spring visitor who leaves without a form still becomes a lead you can call.`, dest: "/get-started/", label: "Set it up now" },
    poll: null,
    ps: `Exclusive, consent-first, $7 flat. Do it before the phone starts ringing, not after.`,
  },
  {
    id: "08", month: "2027-04", cep: "My ad costs went up and my bookings didn't.",
    subjects: ["Why your cost per lead climbs every spring", "The one lever that isn't 'spend more'", "Same spend, more names"],
    one_thing: `Every spring the auction gets more crowded and your cost per click climbs — but your bookings don't move with it. The usual answer is "spend more." There's a cheaper lever: convert more of the traffic you already paid for. Same ad spend, more names off it.`,
    run: { heading: "ROAS-with-recovery calculator", body: `Put in your current spend and ROAS. See what recovering even a slice of your anonymous visitors does to the number.`, dest: "/lead-math/", label: "Run the ROAS math" },
    poll: null,
    ps: `You already paid for the click. Recovery is how you stop paying for it twice.`,
  },
  {
    id: "09", month: "2027-05", cep: "I got a letter about my website / I heard about a lawsuit.",
    subjects: ["Plain-English privacy for contractor sites", "What that website letter actually means", "A consent banner, explained without the fear"],
    one_thing: `If you've gotten a letter about your website, or heard a competitor did — here's the plain-English version, no scare tactics. A consent banner asks visitors what they're okay with before anything tracks them. Most state privacy laws just want a shop with a website to give people that choice and keep the policy current. That's it. Handled once, it stops being a worry.`,
    run: { heading: "Site privacy check", body: `A quick look at what your site does and doesn't ask visitors. No cost, no pressure.`, dest: "/how-it-works/", label: "Run a privacy check" },
    poll: null,
    ps: `Consent Resolve is consent-first by design — every reveal is timestamped and signed, and policies stay current. That's not a bolt-on; it's the whole point.`,
  },
  {
    id: "10", month: "2027-06", cep: "I'm booked solid but the tickets are small.",
    subjects: ["The $9,000 homeowner is already on your site", "Booked solid, small tickets", "What page views tell you about job size"],
    one_thing: `Booked solid but the jobs are small? The bigger tickets are already visiting your site — they just leave without a form, same as everyone else. The difference is what they looked at. The page someone reads tells you a lot about the job they've got.`,
    run: { heading: "See what they were shopping for", body: `When a visitor consents, you get their name, email, and the pages they viewed — so you can tell a drain cleaning from a repipe before you call.`, dest: "/sample-lead/", label: "See a sample lead" },
    poll: null,
    reply_ask: `Which page do your biggest jobs come from? Reply and tell me — I'm building a list.`,
    ps: `Recovered visitors aren't just more leads. They're the big-ticket ones your form never caught.`,
  },
  {
    id: "11", month: "2027-07", cep: "The other guy is beating me to the call.",
    subjects: ["Speed to lead — the 20 minutes that decide it", "Who's beating you to the call?", "What happens between your site and your competitor's"],
    one_thing: `A homeowner rarely stops at one site. In the 20 minutes between your site and the next guy's, the job usually goes to whoever calls first. If your leads sit in an inbox until you check it, you're losing to speed, not to marketing.`,
    run: { heading: "Speed-to-lead self-test", body: `How fast did you answer your last 10 web leads? Be honest. The gap between "seconds" and "next morning" is jobs.`, dest: "/how-it-works/", label: "Take the self-test" },
    poll: { q: "What CRM do you run?", field: "seg_crm", options: [{ l: "Jobber", v: "jobber" }, { l: "Housecall Pro", v: "housecall" }, { l: "ServiceTitan", v: "servicetitan" }, { l: "Spreadsheet", v: "spreadsheet" }], note: "" },
    ps: `Recovered leads hit your phone in seconds — SMS, email, and straight into your CRM. Speed is the whole game.`,
  },
  {
    id: "12", month: "2027-08", cep: "Storm season. I need capacity now.",
    subjects: ["One year of recovered visitors", "What shops actually did with them", "Storm season — capacity now"],
    one_thing: `A year in, here's what shops actually did with recovered visitors — real numbers, no illustrative fluff. The pattern's consistent: the leads were already there, on the site, leaving without a name. Catching them cost a fraction of a shared lead, and they closed better because they were exclusive and fast.`,
    run: { heading: "The whole offer, plainly", body: `Exclusive leads from your own site visitors, with consent. $7 flat. Live in about 10 minutes. Walkthrough, register, or just call.`, dest: "/get-started/", label: "Get started" },
    poll: null,
    ps: `If you've read this far all year, you already know it works. Storm season's here — this is the time.`,
  },
];

export function issueById(id) { return ISSUES.find((i) => i.id === String(id).padStart(2, "0")); }
export function currentIssue(ym) { return ISSUES.find((i) => i.month === ym) || null; }

// Render an issue for a contact → { subject, html, text }. Tracked links score clicks; poll
// links capture a segmentation field + score a poll_response.
export async function renderIssue(env, c, issue, { unsubUrl }) {
  const first = (c.full_name || "there").split(" ")[0];
  const origin = env.STL_PUBLIC_ORIGIN || "https://consentresolve.com";
  const cta = trackedUrl(env, { dest: issue.run.dest, email: c.primary_email, campaign: "newsletter-" + issue.id, label: issue.run.label });
  const tok = await optinToken(env, c.id);
  const pollLink = (v) => `${origin}/api/newsletter/poll?c=${encodeURIComponent(c.id)}&f=${issue.poll.field}&v=${encodeURIComponent(v)}&i=${issue.id}&t=${tok}`;

  const btn = (href, label, color = "#00a37a") => `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px;margin:6px 8px 6px 0">${label}</a>`;
  const p = (s) => s.split("\n\n").map((x) => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("");

  let html = `<div style="font-family:-apple-system,system-ui,Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111;max-width:560px">
<p>Hey ${first},</p>${p(issue.one_thing)}
<p style="font-weight:700;margin-top:20px">${issue.run.heading}</p>${p(issue.run.body)}
<p>${btn(cta, issue.run.label)}</p>`;
  let text = `Hey ${first},\n\n${issue.one_thing}\n\n${issue.run.heading}\n${issue.run.body}\n${issue.run.label}: ${cta}\n`;

  if (issue.poll) {
    html += `<p style="font-weight:700;margin-top:20px">${issue.poll.q}</p><p>${issue.poll.options.map((o) => btn(pollLink(o.v), o.l, "#25405d")).join("")}</p>`;
    if (issue.poll.note) html += `<p style="color:#6b7a8a;font-size:14px">${issue.poll.note}</p>`;
    text += `\n${issue.poll.q}\n${issue.poll.options.map((o) => `- ${o.l}: ${pollLink(o.v)}`).join("\n")}\n`;
  }
  if (issue.reply_ask) { html += `${p(issue.reply_ask)}`; text += `\n${issue.reply_ask}\n`; }

  html += `<p style="margin-top:20px">— Aaron<br>Consent Resolve</p>
<p style="color:#6b7a8a;font-size:14px"><i>P.S. ${issue.ps}</i></p>
<hr style="border:none;border-top:1px solid #e5e9f0;margin:22px 0 12px">
<div style="font-size:12px;color:#8a97a6">Consent Resolve · 1907 Gulf Way #1, St Pete Beach, FL 33706<br><a href="${unsubUrl}" style="color:#8a97a6">Unsubscribe</a></div></div>`;
  text += `\n— Aaron\nConsent Resolve\n\nP.S. ${issue.ps}\n\nUnsubscribe: ${unsubUrl}`;

  return { subject: issue.subjects[0], html, text };
}
