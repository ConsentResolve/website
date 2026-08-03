// worker/_lib/newsletter-issues.js
// The 12-issue "Better Together" newsletter — field-kit only, in the voice of CEO Andy Mentges.
// Every issue runs the same five beats:
//   1) From Andy's truck  — a founder note (thought/feeling/story), stored in the `one_thing` col
//   2) The 30-minute lead — one organic, no-cost tactic a contractor can run in <30 min (run_* cols)
//   3) A yard sign would never say — the fun/meme line (meme col)
//   4) The pitch, plainly — the one promotional field-kit CTA (pitch_* cols)
//   5) P.S. from Andy     — sign-off + reply bait (ps col)
//
// These are a first stab at Andy's voice — to be refined against his voice doc + the Founder Voice
// intake. Copy is intentionally plain: the 30-minute tip is pure value (usually no button); the
// single button per issue is the field-kit pitch. Render adds tracked links (clicks score) and
// signed poll links (taps capture a segmentation field + score).
import { trackedUrl } from "./click-track.js";
import { optinToken } from "./newsletter.js";

// Bump SEED_VERSION to force a one-time re-seed of ALL issues from the code defaults below
// (overwrites the D1 rows). v2 = the field-kit / Andy rewrite. After a reseed, CRM edits persist
// until the next bump.
export const SEED_VERSION = 2;

// poll.field must be one of the contacts segmentation columns: seg_ticket|seg_channel|seg_trucks|seg_crm
export const ISSUES = [
  {
    id: "01", month: "2026-09", cep: "The sign does half the job",
    subjects: ["The sign in your yard is doing half a job", "Your yard sign can't close. Here's what can.", "I stared at my first yard sign for a week"],
    andy_note: `I put my first yard sign in a customer's lawn twelve years ago and drove past it every day for a week just to look at it. Felt like I'd made it.\n\nThen I did the math and it stung: that sign got seen by maybe 40 cars a day, a few of them pulled up my website that night — and every one of them left without me ever knowing they existed. The sign did its job. My website didn't. That's the whole reason Consent Resolve exists, and it's why we mail you the signs now: your sign gets them to the door, our code actually lets them in.`,
    tip: { heading: `The 30-minute lead — the "we were just down the street" text`, body: `Pull your last 20 invoices. For each job, find the two houses on either side. Text them: "Hey — we just replaced the Johnsons' water heater at 214 Oak. If yours is 10+ years old, happy to take a look while our truck's in the neighborhood." Costs you 30 minutes and nothing else. Proximity plus a real recent job beats any ad. Do it Thursday for weekend work.`, dest: "", label: "" },
    meme: `"Eh, tomorrow's fine." — your yard sign has never once said that. Be the sign.`,
    pitch: { body: `No games: exclusive leads from your own site's visitors, $7 flat, and we mail you the signs, hangers, and eventually a truck wrap as you stack them up. You only ever pay for the leads. Signs go up, leads come in, we send more signs.`, dest: "/better-together/", label: "Show me the field kit" },
    poll: { q: "What's your average ticket?", field: "seg_ticket", options: [{ l: "Under $500", v: "u500" }, { l: "$500–$2,500", v: "500-2500" }, { l: "$2,500–$10,000", v: "2500-10000" }, { l: "$10,000+", v: "10000+" }], note: "One tap. It changes what I send you next month." },
    ps: `Hit reply and tell me the weirdest place you've ever staked a yard sign. I collect these.`,
  },
  {
    id: "02", month: "2026-10", cep: "$7 vs the shared-lead racket",
    subjects: ["The lead you bought is in four other trucks", "$7. Not $47.", "You didn't buy that lead. You rented it."],
    andy_note: `I spent years buying shared leads before I built this. You know the feeling — you pay forty-some bucks, you call fast, and a homeowner tells you three other guys already called. You didn't buy a lead. You rented one, and so did your competition.\n\nThat's the thing that still makes me a little angry. A lead off your OWN sign, your OWN site, should be yours. Just yours. That's the whole model here: one homeowner says yes, one contractor — you — gets the name.`,
    tip: { heading: `The 30-minute lead — one Google Business post`, body: `Snap a photo on your next job. Post it to your Google Business Profile with one line ("New AC install in Oakwood — swipe by if yours is struggling") and the "Book" button on. Ten minutes. It shows up in Maps right where people are searching for you, and it costs you nothing.`, dest: "", label: "" },
    meme: `"Let me check with the other four contractors first." — no sign has ever said this. Shared leads do it every time.`,
    pitch: { body: `A Consent Resolve lead is $7, flat, and it's yours alone — never resold, never split four ways, never a race to call first. It came off your own traffic, so nobody else even knows it exists.`, dest: "/better-together/", label: "See how it works" },
    poll: { q: "Which lead source burns you the most right now?", field: "seg_channel", options: [{ l: "Google LSA", v: "lsa" }, { l: "Angi / Thumbtack", v: "reseller" }, { l: "Meta / Google Ads", v: "ads" }, { l: "Just referrals", v: "referral" }], note: "" },
    ps: `Reply with what you paid for your last shared lead. I like to keep a tally of the damage.`,
  },
  {
    id: "03", month: "2026-11", cep: "The gear ladder",
    subjects: ["Hit 25 leads, I mail you signs", "The marketing that mails itself", "You stack leads, we ship gear"],
    andy_note: `People ask me why we give away the signs and hangers. It's not charity — it's the smartest money I spend. Every sign you stake sends more people to your site, and more site visitors means more $7 leads for both of us. When your marketing works, mine does too.\n\nSo we built it into a ladder. The more leads you rack up, the more gear shows up at your door.`,
    tip: { heading: `The 30-minute lead — three review texts`, body: `Text your three happiest recent customers a one-tap Google review link (grab yours from your Business Profile). "Loved working with you — 20 seconds if you've got 'em?" Reviews are the thing that turns a Maps search into a phone call, and this costs you three texts.`, dest: "", label: "" },
    meme: `"I only work business hours." — a yard sign works 3am in the rain and never asks for overtime.`,
    pitch: { body: `Here's the ladder: 25 leads → yard signs & stickers. 100 → door hangers & review cards. 250 → truck magnets. 1,000 → a full truck wrap. All shipped to you, no charge — you only ever pay the $7 per lead.`, dest: "/better-together/", label: "See the reward ladder" },
    poll: null,
    reply_ask: `Which piece of gear would move the needle most for you — signs, hangers, or the wrap? Reply and tell me; it shapes what we make more of.`,
    ps: `Yes, the truck wrap is real. Yes, people send me photos when theirs shows up. Keep 'em coming.`,
  },
  {
    id: "04", month: "2026-12", cep: "Be the recommendation",
    subjects: ["Where the good leads actually hide", "30 minutes in a Facebook group", "Help first. The DMs follow."],
    andy_note: `The best leads I ever got didn't come from an ad. They came from being the guy who answered when a neighbor asked "who do you trust for this?" in a local group. I wasn't selling. I was just the one who showed up and gave a straight answer.\n\nThat's the same instinct behind the field kit. Be visible, be helpful, be everywhere your name can honestly be — and the work comes to you.`,
    tip: { heading: `The 30-minute lead — answer three "who do you recommend?" posts`, body: `Open your local Facebook group or Nextdoor. Find three posts where someone's asking for a recommendation in your trade. Don't pitch. Give a genuinely useful two-sentence answer ("check the pressure-relief valve before you replace the whole heater"). The DMs come to the helpful one. Costs you 30 minutes and zero dollars.`, dest: "", label: "" },
    meme: `"Actually, call my competitor." — your yard sign would rather eat dirt. Literally.`,
    pitch: { body: `The field kit is the offline version of the same move — your name on signs, hangers, and a wrapped truck, everywhere your work already is. And every one of those quietly feeds your site the visitors we turn into $7 leads.`, dest: "/better-together/", label: "See the whole loop" },
    poll: null,
    ps: `What's the best lead you ever got from just being helpful? Reply — I'm collecting these for a slow-week issue.`,
  },
  {
    id: "05", month: "2027-01", cep: "Reactivate the ghosts",
    subjects: ["The leads you already had", "Ten texts, one afternoon", "The follow-up nobody sends"],
    andy_note: `New year, everyone's chasing new leads. But the cheapest lead you'll get all January is one you already quoted and never closed. I used to let those die in a notebook. Biggest waste in the business.\n\nThe flywheel isn't just new signs and new visitors — it's remembering that the people who already know your name are the warmest traffic you've got.`,
    tip: { heading: `The 30-minute lead — text your last 10 "quoted but ghosted"`, body: `Scroll back through last year's estimates that never booked. Pick 10. Send one honest line: "Hey — circling back on that quote. Still on your list, or should I close it out?" Half won't answer. One or two will say "actually, yeah." That's a booked job for the cost of ten texts.`, dest: "", label: "" },
    meme: `"Can you resize me? I'm feeling insecure." — no sign has body-image issues. Only your website does.`,
    pitch: { body: `Consent Resolve does the reactivation you don't have time for automatically — when a past visitor comes back and consents, you get the name in seconds. Exclusive, consent-first, $7 flat.`, dest: "/better-together/", label: "Catch the returners" },
    poll: null,
    ps: `Try the ten texts this week and reply with how many bit. I'll bet you a coffee it's more than zero.`,
  },
  {
    id: "06", month: "2027-02", cep: "Warm inbound wins",
    subjects: ["Let them call you", "A 30-second video that books jobs", "The $0 thing every homeowner should check"],
    andy_note: `The best sales pitch I ever made was no pitch at all — a homeowner watched me explain what to look for, decided I knew my stuff, and called me first. Warm inbound. They come to you already trusting you.\n\nThat's what the whole system is built to do: your sign, your video, your wrapped truck all say "this person knows their trade" long before they ever pick up the phone.`,
    tip: { heading: `The 30-minute lead — one 30-second phone video`, body: `Film yourself on a job explaining one free thing every homeowner should check ("here's how to tell if your water heater's on its last year"). No script, no editing. Post it to your Google Business Profile and Facebook. Helpful beats polished every time, and it costs you half an hour.`, dest: "", label: "" },
    meme: `"I'd rather not be seen." — the single most un-yard-sign thing anyone could ever say.`,
    pitch: { body: `When our code turns a consenting visitor into a lead, it's warm inbound by design — they came to you. You get their name, email, and what they were shopping for. Never a cold call, never a resold list.`, dest: "/better-together/", label: "How warm inbound works" },
    poll: { q: "How many trucks do you run?", field: "seg_trucks", options: [{ l: "1", v: "1" }, { l: "2–4", v: "2-4" }, { l: "5–10", v: "5-10" }, { l: "10+", v: "10+" }], note: "" },
    ps: `Shoot the video. Reply with the link. I'll tell you honestly if it'd make me call you.`,
  },
  {
    id: "07", month: "2027-03", cep: "Own your neighborhood online",
    subjects: ["Put the neighborhood name in the caption", "Local SEO in one photo", "Before/after, done right"],
    andy_note: `Spring's coming and your traffic's about to double. Every extra visitor who lands on your site and leaves without a name is a lead you paid to attract and never met. The leak costs the most exactly when volume peaks.\n\nThe fix is being unmissable — online and on the lawn. Same name, everywhere they look, right when they're finally shopping.`,
    tip: { heading: `The 30-minute lead — one before/after with the neighborhood name`, body: `Post one before/after photo pair from a recent job. In the caption, name the actual neighborhood ("New roof in Cedar Hills"). Google reads that; so do neighbors. It's the cheapest local SEO there is and it takes ten minutes.`, dest: "", label: "" },
    meme: `"Let's circle back in Q3." — a yard sign has never scheduled a follow-up in its life. It just works.`,
    pitch: { body: `Get set up before the surge, not during it. Ten minutes now, and every extra spring visitor who leaves without a form still becomes a $7 lead you can call — while your signs are out front doing their half.`, dest: "/get-started/", label: "Set it up before spring" },
    poll: null,
    ps: `Drop me your best before/after. I'll feature a few (with your name on them) in a spring issue.`,
  },
  {
    id: "08", month: "2027-04", cep: "Stop paying for the click twice",
    subjects: ["You already paid for that visitor", "Fix the map that's making you invisible", "Same spend, more names"],
    andy_note: `Every spring the ad auction gets crowded and your cost per click climbs, but your bookings don't move with it. The reflex is "spend more." I hate that answer. You already paid to get them to your site — the money's not in more clicks, it's in not losing the ones you bought.\n\nSame instinct on the ground: you already own the truck and the yard signs. Make them work harder before you buy more anything.`,
    tip: { heading: `The 30-minute lead — fix your Google Business categories`, body: `Open your Google Business Profile. Check your primary category and your service area — most contractors have the wrong ones, which quietly makes them invisible in Maps for half their trade. Fix the category, add every service area you actually cover. Free, and it can turn the Maps tap back on the same day.`, dest: "", label: "" },
    meme: `"I need a raise." — your yard sign costs you nothing and never once asked. Your ad budget, on the other hand...`,
    pitch: { body: `You already paid for the click. Recovery is how you stop paying for it twice — we turn the visitors your ads sent (who leave without a form) into $7 leads that are yours alone.`, dest: "/better-together/", label: "Stop paying twice" },
    poll: null,
    ps: `Go check your GBP category right now. Reply and tell me if it was wrong. It usually is.`,
  },
  {
    id: "09", month: "2027-05", cep: "Show up in their inbox",
    subjects: ["The reminder that books itself", "Seasonal texts that print work", "Your past customers forgot you (fix it)"],
    andy_note: `Here's a hard truth: your past customers like you, but they forget you. Not out of disloyalty — life's busy. The contractor who reminds them at the right moment gets the repeat job. The one who waits to be remembered doesn't.\n\nThe field kit is a reminder machine. Every sign, every hanger, every wrapped truck is a nudge that keeps your name in the neighborhood's head until they need you.`,
    tip: { heading: `The 30-minute lead — a seasonal reminder text`, body: `Pull your past customers due for seasonal work (furnace check, gutter clean, AC tune-up — whatever your season is). Send a simple heads-up: "It's about that time — want me to get you on the schedule before the rush?" Costs you a batch of texts and books work from people who already trust you.`, dest: "", label: "" },
    meme: `"Sorry, that's not in my scope." — a yard sign has no scope. It just stands there winning.`,
    pitch: { body: `Consent Resolve keeps the top of that funnel full: when a past visitor comes back to your site and consents, you get the name — so your reminders go to a list that keeps growing on its own.`, dest: "/better-together/", label: "Keep the list growing" },
    poll: { q: "What CRM do you run?", field: "seg_crm", options: [{ l: "Jobber", v: "jobber" }, { l: "Housecall Pro", v: "housecall" }, { l: "ServiceTitan", v: "servicetitan" }, { l: "Spreadsheet", v: "spreadsheet" }], note: "" },
    ps: `Send the seasonal batch this week. Reply with your booking count — I love a number.`,
  },
  {
    id: "10", month: "2027-06", cep: "Make yourself easy to reach",
    subjects: ["The 'call' button you forgot to turn on", "Two settings, more calls", "Make it stupid-easy to hire you"],
    andy_note: `I lost jobs for years for the dumbest reason: I was hard to reach. Voicemail full, no text option, a contact form nobody fills out. The homeowner didn't care that I was the best on the street — they called the guy who picked up.\n\nEvery piece of the field kit points the same direction: get them to reach out, and make it effortless when they do.`,
    tip: { heading: `The 30-minute lead — turn on messaging + put your cell everywhere`, body: `Two moves, both free: turn on messaging in your Google Business Profile so people can text you straight from Maps, and put your actual cell number in your email signature and voicemail-to-text auto-reply. You'll be shocked how many jobs come from just being reachable in one tap.`, dest: "", label: "" },
    meme: `"I'll get to it after lunch." — the yard sign already got to it. The yard sign skipped lunch.`,
    pitch: { body: `When we hand you a recovered lead, it hits your phone in seconds — text, email, straight into your CRM — so you're the one who picks up first. Speed is the whole game, and $7 buys you the head start.`, dest: "/better-together/", label: "Be the first call" },
    poll: null,
    reply_ask: `How fast do you answer a web lead — honestly? Reply "seconds," "hours," or "yikes." No judgment.`,
    ps: `Turn on GBP messaging today. Reply when you get your first text-from-Maps — it's a fun day.`,
  },
  {
    id: "11", month: "2027-07", cep: "Two doors and a hanger",
    subjects: ["The two doors you walk past", "Knock, hang, leave", "The cheapest lead is next door"],
    andy_note: `On every job, there are two houses you walk right past: the ones on either side. Same street, same age of house, same problems coming. And most contractors never say a word to them.\n\nThat's exactly why we put door hangers in the field kit. You're already there. The truck's already in the driveway. Twenty extra seconds turns one job into three.`,
    tip: { heading: `The 30-minute lead — hit the two doors beside every job`, body: `Before you pull away from today's job, knock the two doors on either side (or just leave a hanger if nobody's home): "Hey, we're working on your neighbor's place — if you've been putting anything off, we're right here today." Proximity plus a live truck is the highest-converting pitch there is, and it costs you a minute a house.`, dest: "", label: "" },
    meme: `"Have you considered NOT calling?" — no sign, hanger, or magnet has ever talked you out of a job. That's a website thing.`,
    pitch: { body: `Hit 100 leads and the door hangers show up at your door — printed, on us, ready to leave on every job. Your work's already the ad; the hanger just makes sure the neighbors know who did it.`, dest: "/better-together/", label: "Get the hangers" },
    poll: null,
    ps: `Try the two-door move this week. Reply with how many turned into a look. I'm keeping score.`,
  },
  {
    id: "12", month: "2027-08", cep: "The whole thing, plainly",
    subjects: ["A year of Better Together", "The whole offer, no fluff", "Storm season — let's fill the truck"],
    andy_note: `A year of these letters. If you've read this far, you already get it: your marketing and mine aren't two things. Your signs bring them to the door. My code lets them in. One machine.\n\nStorm season's here and the phone should be ringing. If any month's the month to make the flywheel official, it's this one.`,
    tip: { heading: `The 30-minute lead — do the one you've been skipping`, body: `You've had twelve of these tips now. Pick the one you nodded at and never did — the neighbor text, the review asks, the two-door knock — and just do it today. Thirty minutes, no cost, one more lead. That's the whole point of this letter: the cheapest lead is the one you almost got and didn't chase.`, dest: "", label: "" },
    meme: `"I only come out in good weather." — the yard sign works the storm. So should the rest of your marketing.`,
    pitch: { body: `Here it is, plainly: exclusive leads from your own visitors, $7 flat, cancel anytime — and the signs, hangers, magnets, and truck wrap ship to you as you stack them up. Signs go up, leads come in, we send more signs. That's Better Together.`, dest: "/get-started/", label: "Start the flywheel" },
    poll: null,
    ps: `A year in — reply and tell me the one tip that actually made you a lead. I read every single one. —Andy`,
  },
];

export function issueById(id) { return ISSUES.find((i) => i.id === String(id).padStart(2, "0")); }
export function currentIssue(ym) { return ISSUES.find((i) => i.month === ym) || null; }

// ---- D1-backed, editable issues -------------------------------------------
// The code ISSUES above are the DEFAULTS/seed. Once seeded into D1, the newsletter is edited
// in the CRM and the DB copy wins — EXCEPT when SEED_VERSION advances, which forces a one-time
// re-seed from code (that's how the field-kit rewrite lands over the old rows).
const J = (o) => (o == null ? null : JSON.stringify(o));
const P = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch (_) { return d; } };

// Column map (semantic field -> db column): andy_note=one_thing, tip=run_*, meme=meme, pitch=pitch_*.
const COLS = "id,month,cep,subjects,one_thing,run_heading,run_body,run_dest,run_label,meme,pitch_body,pitch_dest,pitch_label,poll,reply_ask,ps,updated_at";
const bindVals = (i) => [
  i.id, i.month, i.cep, J(i.subjects), i.andy_note,
  i.tip.heading, i.tip.body, i.tip.dest, i.tip.label,
  i.meme || "", i.pitch.body, i.pitch.dest, i.pitch.label,
  J(i.poll || null), i.reply_ask || null, i.ps,
];

export async function ensureIssuesSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS newsletter_issues (
    id TEXT PRIMARY KEY, month TEXT, cep TEXT, subjects TEXT, one_thing TEXT,
    run_heading TEXT, run_body TEXT, run_dest TEXT, run_label TEXT,
    meme TEXT, pitch_body TEXT, pitch_dest TEXT, pitch_label TEXT,
    poll TEXT, reply_ask TEXT, ps TEXT, updated_at TEXT)`).run().catch(() => {});
  // Add the field-kit columns to any pre-existing table (idempotent — errors if already there).
  for (const c of ["meme TEXT", "pitch_body TEXT", "pitch_dest TEXT", "pitch_label TEXT"]) {
    await env.DB.prepare(`ALTER TABLE newsletter_issues ADD COLUMN ${c}`).run().catch(() => {});
  }
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS newsletter_meta (k TEXT PRIMARY KEY, v TEXT)`).run().catch(() => {});
  const verRow = await env.DB.prepare(`SELECT v FROM newsletter_meta WHERE k='seed_version'`).first().catch(() => null);
  const ver = verRow ? Number(verRow.v) : 0;
  const stmt = (verb) => env.DB.prepare(
    `INSERT OR ${verb} INTO newsletter_issues (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`
  );
  if (ver < SEED_VERSION) {
    // Forced reseed: overwrite every issue with the code default, then record the version.
    for (const i of ISSUES) await stmt("REPLACE").bind(...bindVals(i)).run().catch(() => {});
    await env.DB.prepare(`INSERT OR REPLACE INTO newsletter_meta (k,v) VALUES ('seed_version',?)`).bind(String(SEED_VERSION)).run().catch(() => {});
  } else {
    // Steady state: seed only issue ids not already present (never clobbers CRM edits).
    for (const i of ISSUES) await stmt("IGNORE").bind(...bindVals(i)).run().catch(() => {});
  }
}

function rowToIssue(r) {
  return {
    id: r.id, month: r.month, cep: r.cep, subjects: P(r.subjects, []),
    andy_note: r.one_thing || "",
    tip: { heading: r.run_heading || "", body: r.run_body || "", dest: r.run_dest || "", label: r.run_label || "" },
    meme: r.meme || "",
    pitch: { body: r.pitch_body || "", dest: r.pitch_dest || "/better-together/", label: r.pitch_label || "Learn more" },
    poll: P(r.poll, null), reply_ask: r.reply_ask || null, ps: r.ps || "",
  };
}

export async function loadIssues(env) {
  await ensureIssuesSchema(env);
  const rows = (await env.DB.prepare("SELECT * FROM newsletter_issues ORDER BY id").all()).results || [];
  return rows.map(rowToIssue);
}
export async function loadIssue(env, id) {
  await ensureIssuesSchema(env);
  const r = await env.DB.prepare("SELECT * FROM newsletter_issues WHERE id=?").bind(String(id).padStart(2, "0")).first();
  return r ? rowToIssue(r) : null;
}
// Save editable fields. `patch` may include: month, cep, subjects[], andy_note, tip{...},
// meme, pitch{body,dest,label}, poll{...}|null, reply_ask, ps.
export async function saveIssue(env, id, patch) {
  await ensureIssuesSchema(env);
  const cur = await loadIssue(env, id);
  if (!cur) return { ok: false, error: "unknown_issue" };
  const m = { ...cur, ...patch };
  if (patch.tip) m.tip = { ...cur.tip, ...patch.tip };
  if (patch.pitch) m.pitch = { ...cur.pitch, ...patch.pitch };
  await env.DB.prepare(
    `UPDATE newsletter_issues SET month=?,cep=?,subjects=?,one_thing=?,run_heading=?,run_body=?,run_dest=?,run_label=?,meme=?,pitch_body=?,pitch_dest=?,pitch_label=?,poll=?,reply_ask=?,ps=?,updated_at=datetime('now') WHERE id=?`
  ).bind(m.month, m.cep, J(m.subjects), m.andy_note, m.tip.heading, m.tip.body, m.tip.dest, m.tip.label, m.meme || "", m.pitch.body, m.pitch.dest, m.pitch.label, J(m.poll || null), m.reply_ask || null, m.ps, cur.id).run();
  return { ok: true, issue: m };
}

// Render an issue for a contact → { subject, html, text }. Tracked links score clicks; poll
// links capture a segmentation field + score a poll_response. Five beats, signed by Andy.
export async function renderIssue(env, c, issue, { unsubUrl }) {
  const first = (c.full_name || "there").split(" ")[0];
  const origin = env.STL_PUBLIC_ORIGIN || "https://consentresolve.com";
  const pitchCta = trackedUrl(env, { dest: issue.pitch.dest || "/better-together/", email: c.primary_email, campaign: "newsletter-" + issue.id, label: issue.pitch.label });
  const tipHasBtn = issue.tip.dest && issue.tip.label;
  const tipCta = tipHasBtn ? trackedUrl(env, { dest: issue.tip.dest, email: c.primary_email, campaign: "newsletter-" + issue.id + "-tip", label: issue.tip.label }) : "";
  const tok = await optinToken(env, c.id);
  const pollLink = (v) => `${origin}/api/newsletter/poll?c=${encodeURIComponent(c.id)}&f=${issue.poll.field}&v=${encodeURIComponent(v)}&i=${issue.id}&t=${tok}`;

  const btn = (href, label, color = "#00a37a") => `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px;margin:6px 8px 6px 0">${label}</a>`;
  const p = (s) => (s || "").split("\n\n").map((x) => `<p>${x.replace(/\n/g, "<br>")}</p>`).join("");
  const label = (t) => `<p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#00a37a;font-weight:700;margin:26px 0 6px">${t}</p>`;

  let html = `<div style="font-family:-apple-system,system-ui,Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.6;color:#111;max-width:560px">
<p>Hey ${first},</p>
${label("From Andy's truck")}${p(issue.andy_note)}
${label("The 30-minute lead")}<p style="font-weight:700;margin:0 0 6px">${issue.tip.heading}</p>${p(issue.tip.body)}${tipHasBtn ? `<p>${btn(tipCta, issue.tip.label, "#25405d")}</p>` : ""}`;
  let text = `Hey ${first},\n\nFROM ANDY'S TRUCK\n${issue.andy_note}\n\nTHE 30-MINUTE LEAD\n${issue.tip.heading}\n${issue.tip.body}\n${tipHasBtn ? issue.tip.label + ": " + tipCta + "\n" : ""}`;

  if (issue.meme) {
    html += `${label("A yard sign would never say")}<p style="background:#f4f7f5;border-left:3px solid #00a37a;padding:12px 16px;border-radius:8px;font-style:italic;color:#25405d">${issue.meme}</p>`;
    text += `\nA YARD SIGN WOULD NEVER SAY\n${issue.meme}\n`;
  }

  html += `${label("The pitch, plainly")}${p(issue.pitch.body)}<p>${btn(pitchCta, issue.pitch.label)}</p>`;
  text += `\nTHE PITCH, PLAINLY\n${issue.pitch.body}\n${issue.pitch.label}: ${pitchCta}\n`;

  if (issue.poll) {
    html += `<p style="font-weight:700;margin-top:20px">${issue.poll.q}</p><p>${issue.poll.options.map((o) => btn(pollLink(o.v), o.l, "#25405d")).join("")}</p>`;
    if (issue.poll.note) html += `<p style="color:#6b7a8a;font-size:14px">${issue.poll.note}</p>`;
    text += `\n${issue.poll.q}\n${issue.poll.options.map((o) => `- ${o.l}: ${pollLink(o.v)}`).join("\n")}\n`;
  }
  if (issue.reply_ask) { html += `${p(issue.reply_ask)}`; text += `\n${issue.reply_ask}\n`; }

  html += `<p style="margin-top:20px">— Andy<br>Andy Mentges · CEO, Consent Resolve</p>
<p style="color:#6b7a8a;font-size:14px"><i>P.S. ${issue.ps}</i></p>
<hr style="border:none;border-top:1px solid #e5e9f0;margin:22px 0 12px">
<div style="font-size:12px;color:#8a97a6">Consent Resolve · 1907 Gulf Way #1, St Pete Beach, FL 33706<br><a href="${unsubUrl}" style="color:#8a97a6">Unsubscribe</a></div></div>`;
  text += `\n— Andy\nAndy Mentges · CEO, Consent Resolve\n\nP.S. ${issue.ps}\n\nUnsubscribe: ${unsubUrl}`;

  return { subject: issue.subjects[0], html, text };
}
