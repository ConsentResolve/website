/**
 * Features data spine — feeds /features/ hub, /features/[slug]/ pages,
 * and the grouped FeatureBento on the homepage. Single source of truth.
 *
 * Content comes from /Users/aaronphillips/Downloads/consent-resolve-feature-pages.md
 * (the "Copy Deck"). Two policy items to confirm BEFORE go-live:
 *
 *   1. EVERY `quote.isSample === true` is a placeholder. Replace with a
 *      real customer testimonial or remove the quote block — publishing
 *      fabricated testimonials violates FTC rules.
 *
 *   2. Three recurring product claims still need a sign-off from Andy/Jason:
 *        - multi-state consent handling (Built-In Compliance)
 *        - "recently active / verified" contact data (Verified Contact Data)
 *        - the Termageddon partnership wording
 *      Confirm the product actually does what we say before launch.
 */

export type FeatureIconKey =
  | "IconLock"
  | "IconUserCheck"
  | "IconRefresh"
  | "IconCode"
  | "IconEye"
  | "IconAddressBook"
  | "IconShieldCheck"
  | "IconBolt"
  | "IconBellRinging"
  | "IconStar"
  | "IconClipboardCheck"
  | "IconMapPin"
  | "IconFilter"
  | "IconPlugConnected"
  | "IconMessage"
  | "IconCertificate"
  | "IconChartHistogram";

export interface FeatureStep { title: string; body: string }
export interface FeatureBenefit { title: string; body: string }
export interface FeatureFaq { q: string; a: string }
export interface FeatureQuote {
  text: string;
  name: string;
  shop: string;
  city: string;
  /** True until we replace the placeholder with a real testimonial. */
  isSample: boolean;
}

export interface Feature {
  slug: string;
  name: string;                        // H1
  iconKey: FeatureIconKey;
  tagline: string;                     // hero card right panel + cards
  subhead: string;                     // hero left body + meta description
  aeoAnswer: string;                   // 40–55-word AEO citation paragraph
  problem: { headline: string; body: string };
  howItWorks: { headline: string; steps: FeatureStep[] };   // length 3
  benefits:   { headline: string; items: FeatureBenefit[] };// length 3
  quote: FeatureQuote;
  included:   { headline: string; items: string[] };        // length 6
  faq:        { headline: string; items: FeatureFaq[] };    // length 4
  /** 3 sibling feature slugs to surface in the "Pairs Well With" rail. */
  pairsWith: string[];
}

export interface FeatureGroup {
  slug: string;                        // anchor on hub
  eyebrow: string;                     // theme tagline (uppercase)
  title: string;                       // "Your leads. Nobody else's."
  blurb: string;
  features: Feature[];
}

// -----------------------------------------------------------------------
// THEME A — "What makes Consent Resolve different"
// -----------------------------------------------------------------------

const exclusiveLeads: Feature = {
  slug: "exclusive-leads",
  name: "Exclusive Leads",
  iconKey: "IconLock",
  tagline: "Yours alone. Never resold.",
  subhead: "The visitors we identify came to your site — so the lead is yours alone. Never shared, never resold, never handed to the contractor down the road.",
  aeoAnswer:
    "Exclusive Leads means every person Consent Resolve identifies belongs to you and only you. Because they visited your website, the lead is never shared, sold, or routed to competing contractors. You get the name, the number, and a clear shot at the job — with no bidding war and no race to call first.",
  problem: {
    headline: "You're paying for leads three other guys already got.",
    body: "On Angi, Thumbtack, and HomeAdvisor, the same lead gets blasted to a handful of pros at once. By the time you call, two competitors already did — and the homeowner's annoyed at all of you. You paid full price to fight over a customer who's already sick of the phone ringing.",
  },
  howItWorks: {
    headline: "Your traffic, your lead — start to finish.",
    steps: [
      { title: "Someone visits your site.",   body: "A real person lands on your website from Google, an ad, a yard sign, wherever." },
      { title: "We identify them — for you.", body: "Consent Resolve matches that consented visitor to contact info and hands it straight to you." },
      { title: "Nobody else gets it.",        body: "The lead never touches a marketplace. No other contractor ever sees it." },
    ],
  },
  benefits: {
    headline: "Three reasons exclusive beats shared.",
    items: [
      { title: "No bidding war.",     body: "You're not paying to out-shout four other roofers for the same job." },
      { title: "A warmer first call.", body: "The homeowner isn't already buried in calls from your competitors." },
      { title: "Higher close rate.",   body: "When you're the only one calling, \"yes\" comes a lot easier." },
    ],
  },
  quote: {
    text: "On Angi I was racing five other guys to the same phone number. With Consent Resolve, the lead's mine and nobody else is calling. I close way more of them.",
    name: "Dale R.", shop: "Dale's Roofing", city: "Tyler, TX", isSample: true,
  },
  included: {
    headline: "What \"exclusive\" actually means.",
    items: [
      "One lead, one contractor — always you",
      "No reselling to competitors, ever",
      "No shared marketplace queue",
      "Leads sourced from your own website traffic",
      "Full contact detail, not a teaser",
      "Yours to keep in your CRM forever",
    ],
  },
  faq: {
    headline: "What pros ask about exclusive leads.",
    items: [
      { q: "Is the lead really never shared?",                    a: "Correct. It came from your website, so it's yours. We never sell or route it to another contractor." },
      { q: "How is this different from Angi or Thumbtack?",       a: "Those platforms send one customer to several pros at once. Consent Resolve identifies your own visitors and gives them only to you." },
      { q: "What if the same person visits two contractors' sites?", a: "Then each contractor earned that visit on their own site. You only ever get visitors from yours." },
      { q: "Do I own the contact after the trial?",               a: "Yes. Every lead you pull is yours to keep and follow up with." },
    ],
  },
  pairsWith: ["consent-first-identification", "channel-recovery", "visitor-identification"],
};

const consentFirstIdentification: Feature = {
  slug: "consent-first-identification",
  name: "Consent-First Identification",
  iconKey: "IconUserCheck",
  tagline: "They opted in. You reach out.",
  subhead: "Every person we identify opted in. You're reaching out to someone who already raised their hand — not a cold name off a purchased list.",
  aeoAnswer:
    "Consent-First Identification means Consent Resolve only identifies website visitors who have given permission through your site's consent banner. You receive a name, phone, and email for someone who already agreed to be contacted — a warmer, cleaner lead than any purchased list, and one that keeps your shop on the right side of privacy law.",
  problem: {
    headline: "Bought lists are cold, stale, and a legal headache.",
    body: "Most \"lead lists\" are scraped names who never heard of you and never agreed to a call. Half the numbers are dead. And in a growing list of states, dialing people who never opted in is how you end up with a fine. There's a better way to get a warm name.",
  },
  howItWorks: {
    headline: "Permission first, then the lead.",
    steps: [
      { title: "Your banner asks.",      body: "The consent banner on your site gives every visitor a clear choice." },
      { title: "They say yes.",          body: "Only visitors who opt in move forward — their choice is recorded." },
      { title: "You get a warm lead.",   body: "We match the consented visitor to contact info and send it to you." },
    ],
  },
  benefits: {
    headline: "A warm name, not a cold one.",
    items: [
      { title: "Friendlier calls.",   body: "They already showed interest, so you're not interrupting a stranger." },
      { title: "Cleaner conscience.", body: "No sketchy lists, no \"how'd you get my number?\"" },
      { title: "Legal cover.",        body: "Consent is captured and logged from the first click." },
    ],
  },
  quote: {
    text: "I quit buying lists years ago — too many angry people asking how I got their number. These folks actually asked to hear from someone. Night and day.",
    name: "Marcus T.", shop: "Lone Star Exteriors", city: "Huntsville, TX", isSample: true,
  },
  included: {
    headline: "What consent-first includes.",
    items: [
      "Opt-in captured at the visitor's first click",
      "Every consent timestamped and stored",
      "Opt-outs honored automatically",
      "Works with your existing cookie banner",
      "No purchased or scraped lists",
      "Audit trail you can show a regulator",
    ],
  },
  faq: {
    headline: "What pros ask about consent-first identification.",
    items: [
      { q: "Do visitors know they can be contacted?", a: "Yes. Consent is collected through the banner on your site before anyone is identified." },
      { q: "Is this legal in my state?",              a: "It's built to be. Consent is recorded and opt-outs honored across states — check the compliance section and your own policy." },
      { q: "What if someone opts out?",               a: "They're suppressed automatically — you'll never get their info." },
      { q: "How is this warmer than a list?",         a: "A list is strangers. These are people who were on your site and agreed to be reached." },
    ],
  },
  pairsWith: ["exclusive-leads", "built-in-compliance", "verified-contact-data"],
};

const channelRecovery: Feature = {
  slug: "channel-recovery",
  name: "Channel Recovery",
  iconKey: "IconRefresh",
  tagline: "Catch what your ads miss.",
  subhead: "Consent Resolve doesn't replace Google, Thumbtack, or Angi. It sits on top of them and catches the customers they send who leave without calling.",
  aeoAnswer:
    "Channel Recovery captures the website visitors your existing ads already paid for but lost. Consent Resolve works on top of Google LSA, Thumbtack, Angi, and your own campaigns — identifying the roughly 95% who visit and leave without converting, then handing them back as named leads. It doesn't compete with your channels; it rescues the traffic they waste.",
  problem: {
    headline: "You paid for the click. Then you lost the customer.",
    body: "Every channel you run — LSA, Thumbtack, Angi, Facebook — sends people to your site. About 95 out of 100 look around and leave without calling. You already paid to get them there. Right now that money just evaporates the second they close the tab.",
  },
  howItWorks: {
    headline: "One layer over every channel you run.",
    steps: [
      { title: "Your channels send traffic.", body: "Keep running Google, Thumbtack, Angi — whatever works for you." },
      { title: "We watch who slips away.",    body: "Consent Resolve identifies the consented visitors who leave without calling." },
      { title: "You get them back.",          body: "Those lost visitors come back to you as named, reachable leads." },
    ],
  },
  benefits: {
    headline: "More out of what you already spend.",
    items: [
      { title: "Lower real cost per lead.", body: "You squeeze more jobs out of the same ad budget." },
      { title: "No channel switching.",     body: "Keep every source you already trust." },
      { title: "Found money.",              body: "Customers you'd written off become callable leads." },
    ],
  },
  quote: {
    text: "I'm not dropping LSA — it works. But for every call I got, a dozen people looked and vanished. Consent Resolve hands those back. It's like getting a refund on the clicks I lost.",
    name: "Tony G.", shop: "Apex Roofing & Repair", city: "Orlando, FL", isSample: true,
  },
  included: {
    headline: "What channel recovery covers.",
    items: [
      "Works on top of Google LSA",
      "Works on top of Thumbtack and Angi",
      "Works with your own paid ads",
      "Works with organic and direct traffic",
      "No change to your current setup",
      "One script covers every channel",
    ],
  },
  faq: {
    headline: "What pros ask about channel recovery.",
    items: [
      { q: "Do I have to stop using Angi or LSA?", a: "No. Consent Resolve sits on top of them — keep everything you've got." },
      { q: "Does it compete with my ads?",         a: "The opposite. It rescues the visitors your ads already paid for and lost." },
      { q: "Which channels does it work with?",    a: "All of them — paid, organic, social, direct. If traffic hits your site, we can catch it." },
      { q: "Will it mess with my Google account?", a: "No. It's a script on your site, not a change to your ad platforms." },
    ],
  },
  pairsWith: ["exclusive-leads", "visitor-identification", "roi-reporting"],
};

// -----------------------------------------------------------------------
// THEME B — "See who's there, reach them fast"
// -----------------------------------------------------------------------

const easySetupWithOneScript: Feature = {
  slug: "easy-setup-with-one-script",
  name: "Easy Setup With One Script",
  iconKey: "IconCode",
  tagline: "Paste once. You're live.",
  subhead: "One small piece of code on your site and you're live. No new software to learn, no app to babysit, no IT guy required.",
  aeoAnswer:
    "Easy Setup With One Script means Consent Resolve installs with a single snippet of code on your website. There's no software to learn, no developer needed, and no ongoing maintenance. Paste it once and identification starts the same day — most service pros are capturing leads within hours of signing up.",
  problem: {
    headline: "Most marketing tools die in the setup screen.",
    body: "You signed up for something once, hit a wall of settings and integrations, and quietly gave up two weeks later. Contractors don't have an IT department or a free afternoon to wire up software. If it's not running today, it's not running.",
  },
  howItWorks: {
    headline: "Three minutes, start to finish.",
    steps: [
      { title: "Copy the script.",       body: "We give you one small snippet when you sign up." },
      { title: "Paste it on your site.", body: "Drop it into Mocha, WordPress, GHL — wherever your site lives." },
      { title: "You're live.",           body: "Identification starts immediately. No waiting, no config." },
    ],
  },
  benefits: {
    headline: "Up and running today, not next month.",
    items: [
      { title: "No tech skills needed.", body: "If you can copy and paste, you can install it." },
      { title: "No IT bill.",            body: "No developer, no agency setup fee." },
      { title: "Same-day leads.",        body: "Most pros see their first identified visitor within hours." },
    ],
  },
  quote: {
    text: "I'm a roofer, not a computer guy. Pasted the code between two jobs and had leads showing up by that afternoon. That was the whole setup.",
    name: "Ray D.", shop: "Ray's Quality Roofing", city: "Conroe, TX", isSample: true,
  },
  included: {
    headline: "What setup includes.",
    items: [
      "One universal script",
      "Works on Mocha, WordPress, GHL, and more",
      "No developer required",
      "Step-by-step paste guide",
      "Live the same day",
      "Free install help if you want it",
    ],
  },
  faq: {
    headline: "What pros ask about setup.",
    items: [
      { q: "Do I need a developer?",            a: "No. It's copy and paste. If you can edit your site, you can install it." },
      { q: "What platforms does it work on?",   a: "Mocha, WordPress, GoHighLevel, Wix, Squarespace — anywhere you can add a script." },
      { q: "How long until I see leads?",       a: "Usually the same day, often within hours of pasting the code." },
      { q: "What if I get stuck?",              a: "We'll install it with you on a quick call. No charge." },
    ],
  },
  pairsWith: ["visitor-identification", "real-time-mobile-alerts", "crm-delivery"],
};

const visitorIdentification: Feature = {
  slug: "visitor-identification",
  name: "Visitor Identification",
  iconKey: "IconEye",
  tagline: "Real people, not numbers.",
  subhead: "Stop staring at a visitor counter that tells you nothing. See the real people behind your traffic — who came, what they wanted, how to reach them.",
  aeoAnswer:
    "Visitor Identification reveals the actual people browsing your website instead of an anonymous traffic count. Consent Resolve matches consented visitors to a name, phone, and email, plus the pages they viewed. You learn who's interested in your services and exactly how to reach them — turning silent web traffic into a callable list of prospects.",
  problem: {
    headline: "\"47 visitors today\" never booked a single job.",
    body: "Your analytics shows traffic going up and you still have nothing to call. A number on a dashboard doesn't pay payroll. You know people are interested — you just can't see who they are or how to reach them. So they leave, and you're back to waiting for the phone.",
  },
  howItWorks: {
    headline: "From a number to a name.",
    steps: [
      { title: "A consented visitor lands.", body: "Someone interested in your services hits your site and opts in." },
      { title: "We match them.",             body: "Consent Resolve connects that visit to a real identity." },
      { title: "You see the person.",        body: "Name, contact info, and what they looked at — all in one place." },
    ],
  },
  benefits: {
    headline: "Know exactly who's interested.",
    items: [
      { title: "Names you can act on.",          body: "Real people instead of a faceless count." },
      { title: "A pipeline that fills itself.",  body: "Every interested visitor becomes a prospect." },
      { title: "Insight before you dial.",       body: "You see what they came for before you say hello." },
    ],
  },
  quote: {
    text: "My website got plenty of traffic and I had no idea what to do with it. Now I open my phone and there's a name, a number, and what they were looking at. Game changer.",
    name: "Will H.", shop: "Hill Country HVAC", city: "Huntsville, TX", isSample: true,
  },
  included: {
    headline: "What identification includes.",
    items: [
      "Visitor's full name",
      "Phone number and email",
      "Pages they viewed",
      "Time spent on site",
      "Repeat-visit tracking",
      "Consent status on every record",
    ],
  },
  faq: {
    headline: "What pros ask about visitor identification.",
    items: [
      { q: "How many visitors get identified?",            a: "It varies by traffic, but a meaningful share of your consented visitors — far more than the handful who fill out a form." },
      { q: "Do they have to fill out a form?",             a: "No. That's the point. We identify them without one." },
      { q: "Is it just business visitors or homeowners too?", a: "Both. Consent Resolve identifies individual people, which is what home service pros need." },
      { q: "What info do I actually get?",                 a: "A name, a way to reach them, and what they looked at on your site." },
    ],
  },
  pairsWith: ["formless-contact-capture", "behavior-and-job-type-insights", "instant-connect"],
};

const formlessContactCapture: Feature = {
  slug: "formless-contact-capture",
  name: "Formless Contact Capture",
  iconKey: "IconAddressBook",
  tagline: "No form? No problem.",
  subhead: "Get a name, phone, and email for visitors who never filled out a single form — the ones who'd normally just disappear.",
  aeoAnswer:
    "Formless Contact Capture collects a visitor's name, phone number, and email without requiring them to fill out any form. Since only about 2% of website visitors ever complete a contact form, Consent Resolve captures the consented contact details of the other 98% automatically — so you reach the customers who would have left no trace.",
  problem: {
    headline: "Almost nobody fills out your contact form.",
    body: "Out of every 100 people on your site, maybe two fill out the form. The other 98 want the work done — they just don't feel like typing their life story into a box. Then they're gone. Your form is a locked door that most customers walk right past.",
  },
  howItWorks: {
    headline: "Skip the form, keep the customer.",
    steps: [
      { title: "They browse.",            body: "A consented visitor checks out your services — no form needed." },
      { title: "We capture the contact.", body: "Name, phone, and email come through without a single field filled." },
      { title: "You reach out.",          body: "You've got what you need to call, with no \"contact us\" page required." },
    ],
  },
  benefits: {
    headline: "Catch the 98% who never type a word.",
    items: [
      { title: "Way more leads.",        body: "You capture the customers your form was scaring off." },
      { title: "No friction for them.",  body: "Nothing to fill out means nothing to abandon." },
      { title: "Complete contact info.", body: "Not just an email — a name and a number too." },
    ],
  },
  quote: {
    text: "I always wondered why a busy site barely produced form fills. Turns out people just don't fill them out. Now I get their info anyway. Doubled my callable leads easy.",
    name: "Brian K.", shop: "Coastal Contracting", city: "Tampa, FL", isSample: true,
  },
  included: {
    headline: "What formless capture includes.",
    items: [
      "Name captured without a form",
      "Phone number included",
      "Email address included",
      "Works on every page of your site",
      "No \"contact us\" form required",
      "Consent recorded with each capture",
    ],
  },
  faq: {
    headline: "What pros ask about formless capture.",
    items: [
      { q: "How do you get their info without a form?",          a: "Through consented identification tied to your site's banner — they opted in, so we can match them." },
      { q: "Is this just their email?",                          a: "No — name, phone, and email where available, so you can actually call." },
      { q: "Do I still need a contact form on my site?",         a: "You can keep one, but you no longer depend on it to get leads." },
      { q: "What if they only viewed one page?",                 a: "We can still capture a consented visitor even on a short visit." },
    ],
  },
  pairsWith: ["visitor-identification", "verified-contact-data", "instant-connect"],
};

const verifiedContactData: Feature = {
  slug: "verified-contact-data",
  name: "Verified Contact Data",
  iconKey: "IconShieldCheck",
  tagline: "Reachable, not dead.",
  subhead: "We only hand you people who are reachable and recently active — so your crew isn't burning the morning dialing dead numbers.",
  aeoAnswer:
    "Verified Contact Data means Consent Resolve only passes you contacts confirmed reachable and recently active. Instead of a list padded with dead numbers and stale emails, you get leads you can actually connect with — so your team spends time talking to real prospects, not listening to disconnected tones.",
  problem: {
    headline: "Half the numbers on a cheap list are dead.",
    body: "Nothing kills a morning faster than a stack of leads where every third number is disconnected and the emails bounce. You paid for those names. Your guy still spent two hours getting nowhere. A lead you can't reach isn't a lead — it's a waste of a phone.",
  },
  howItWorks: {
    headline: "Checked before it ever reaches you.",
    steps: [
      { title: "We identify a visitor.", body: "A consented person is matched to contact info." },
      { title: "We verify it's live.",   body: "The contact is checked for reachability and recent activity." },
      { title: "You get a real one.",    body: "Only verified, reachable contacts land in your pipeline." },
    ],
  },
  benefits: {
    headline: "Every lead is one you can actually reach.",
    items: [
      { title: "No wasted dials.",      body: "Your crew talks to people, not voicemail tones." },
      { title: "Higher connect rate.",  body: "More conversations per hour on the phone." },
      { title: "Trust in your list.",   body: "When you call, someone picks up." },
    ],
  },
  quote: {
    text: "Old lists, I'd hit a dead number every couple calls and lose my rhythm. These actually connect. My guy books more because he's talking to people, not redialing.",
    name: "Sam P.", shop: "Five Star Plumbing", city: "Livingston, TX", isSample: true,
  },
  included: {
    headline: "What verification includes.",
    items: [
      "Reachability check on every contact",
      "Recent-activity filter",
      "Stale and dead records removed",
      "Phone and email both checked",
      "Fresh data, not a recycled list",
      "Quality held to a connect standard",
    ],
  },
  faq: {
    headline: "What pros ask about verified data.",
    items: [
      { q: "What does \"recently active\" mean?",   a: "The contact shows recent online activity, so they're a live, reachable person — not a years-old record." },
      { q: "Will every number connect?",             a: "No tool is perfect, but verified contacts connect far more often than a raw purchased list." },
      { q: "Do you check emails too?",               a: "Yes — both phone and email are screened before you get them." },
      { q: "Why does this matter?",                  a: "Because your time on the phone is money. Dead numbers waste it." },
    ],
  },
  pairsWith: ["formless-contact-capture", "qualified-leads-only", "multi-channel-follow-up"],
};

const instantConnect: Feature = {
  slug: "instant-connect",
  name: "Instant Connect",
  iconKey: "IconBolt",
  tagline: "Call while it's hot.",
  subhead: "The number's in your hand, ready to dial while they're still deciding who to hire. Strike while the interest is hot.",
  aeoAnswer:
    "Instant Connect puts an identified visitor's phone number in your hands the moment they're captured, so you can call while they're still actively shopping. In home services, the first pro to reach a customer usually wins the job — Instant Connect makes sure that's you, not the contractor down the street.",
  problem: {
    headline: "The first one to call usually wins the job.",
    body: "A homeowner with a leaking roof isn't waiting around. They're calling whoever gets to them first. If your lead sits in an inbox for three hours, the job's already gone. Speed isn't a nice-to-have in this business — it's the whole game.",
  },
  howItWorks: {
    headline: "From identified to dialing in seconds.",
    steps: [
      { title: "Visitor is identified.",   body: "A consented person shows interest on your site." },
      { title: "Number hits your phone.",  body: "Their contact info lands with you right away." },
      { title: "You call now.",            body: "Tap and dial while they're still on the fence." },
    ],
  },
  benefits: {
    headline: "Beat every competitor to the phone.",
    items: [
      { title: "First-mover advantage.",  body: "You call before they've talked to anyone else." },
      { title: "Hotter conversations.",   body: "They're still actively looking when you reach them." },
      { title: "More booked jobs.",       body: "Speed-to-lead is the number-one predictor of who wins." },
    ],
  },
  quote: {
    text: "Used to be I'd see a lead at lunch and call after work — gone. Now it buzzes my phone and I call from the truck. I'm the first voice they hear. Closes itself.",
    name: "Derek M.", shop: "Reliable Roofing Co.", city: "Cleveland, TX", isSample: true,
  },
  included: {
    headline: "What instant connect includes.",
    items: [
      "Phone number delivered on identification",
      "Tap-to-call from your phone",
      "No waiting on a daily export",
      "Works hand-in-hand with mobile alerts",
      "Time-stamped so you know how fresh it is",
      "Ready the moment interest is highest",
    ],
  },
  faq: {
    headline: "What pros ask about instant connect.",
    items: [
      { q: "How fast do I get the number?",         a: "Within minutes of the visitor being identified — while they're still shopping." },
      { q: "Can I call straight from my phone?",    a: "Yes. Tap the lead and dial." },
      { q: "What if I can't answer right then?",    a: "The lead's saved in your pipeline, but the sooner you call, the better you do." },
      { q: "Why does speed matter so much?",        a: "The first pro to call wins most home service jobs. Instant Connect makes that you." },
    ],
  },
  pairsWith: ["real-time-mobile-alerts", "visitor-identification", "multi-channel-follow-up"],
};

const realTimeMobileAlerts: Feature = {
  slug: "real-time-mobile-alerts",
  name: "Real-Time Mobile Alerts",
  iconKey: "IconBellRinging",
  tagline: "Buzzes the second they're in.",
  subhead: "New leads hit your phone within minutes — on the roof or in the truck — so you reach out before your competitor even knows that customer existed.",
  aeoAnswer:
    "Real-Time Mobile Alerts notify you on your phone the instant a new lead is identified, wherever you are. Instead of checking a dashboard, you get a push the moment a consented visitor is captured — so a contractor in the field can act on a fresh lead within minutes instead of finding it cold the next day.",
  problem: {
    headline: "A lead you find tomorrow is a lead you already lost.",
    body: "You're not sitting at a desk watching a screen — you're on a roof, under a sink, driving between jobs. If your leads pile up in some dashboard you check at night, they're stone cold by the time you see them. The customer already hired someone who answered today.",
  },
  howItWorks: {
    headline: "The lead finds you, wherever you are.",
    steps: [
      { title: "A lead comes in.",     body: "A consented visitor is identified on your site." },
      { title: "Your phone buzzes.",   body: "A push alert hits you in real time — no checking required." },
      { title: "You act on the spot.", body: "Call or text from the field before the trail goes cold." },
    ],
  },
  benefits: {
    headline: "Never miss a hot lead again.",
    items: [
      { title: "Act from anywhere.",         body: "The roof, the truck, the supply house — doesn't matter." },
      { title: "No dashboard babysitting.",  body: "The lead comes to you, not the other way around." },
      { title: "Faster than the competition.", body: "You're calling while they're still asleep at the wheel." },
    ],
  },
  quote: {
    text: "My phone buzzes, I look down, there's a fresh lead. I call from the ladder if I have to. By the time the next guy checks his email, I've already booked the estimate.",
    name: "Joe V.", shop: "Vasquez Exteriors", city: "Splendora, TX", isSample: true,
  },
  included: {
    headline: "What alerts include.",
    items: [
      "Instant push to your phone",
      "Lead name and number in the alert",
      "What they looked at, at a glance",
      "Works on iPhone and Android",
      "Alerts for the whole team if you want",
      "No dashboard check required",
    ],
  },
  faq: {
    headline: "What pros ask about mobile alerts.",
    items: [
      { q: "How do I get the alerts?",       a: "Straight to your phone as a push notification the moment a lead lands." },
      { q: "Can my team get them too?",      a: "Yes. Route alerts to whoever should make the call." },
      { q: "Will it blow up my phone?",      a: "You control it — filter by area and intent so you only get the ones worth your time." },
      { q: "iPhone or Android?",             a: "Both." },
    ],
  },
  pairsWith: ["instant-connect", "easy-setup-with-one-script", "lead-scoring"],
};

// -----------------------------------------------------------------------
// THEME C — "Spend your time on the ones that matter"
// -----------------------------------------------------------------------

const leadScoring: Feature = {
  slug: "lead-scoring",
  name: "Lead Scoring",
  iconKey: "IconStar",
  tagline: "Serious ones first.",
  subhead: "Not every visitor is worth a call. We surface the serious ones first — three pricing-page visits beats a one-second bounce every time.",
  aeoAnswer:
    "Lead Scoring ranks your identified visitors by how likely they are to buy, based on what they did on your site. Consent Resolve flags the people who viewed pricing, returned more than once, or spent real time on a service page — so you call your hottest prospects first instead of working a list in random order.",
  problem: {
    headline: "You're calling leads in the wrong order.",
    body: "When every lead looks the same on a list, you waste your best hours on tire-kickers and get to the serious buyer after they've hired someone else. A one-second bounce and a guy who read your whole pricing page three times are not the same lead — but a plain list treats them like they are.",
  },
  howItWorks: {
    headline: "We rank them so you don't have to.",
    steps: [
      { title: "We watch behavior.",  body: "Pages viewed, time spent, repeat visits." },
      { title: "We score each lead.", body: "Stronger buying signals push a lead up the list." },
      { title: "You work top-down.",  body: "Call the hottest prospects first, every time." },
    ],
  },
  benefits: {
    headline: "Spend your best hours on your best leads.",
    items: [
      { title: "Call the right ones first.", body: "Hot buyers get reached while they're hot." },
      { title: "Less wasted time.",          body: "Tire-kickers don't eat your morning." },
      { title: "More jobs per hour.",        body: "Your phone time goes where the money is." },
    ],
  },
  quote: {
    text: "I've only got so many hours to make calls. Now the serious ones are right at the top. I'm not wasting time on somebody who bounced in two seconds.",
    name: "Chris L.", shop: "Lakeside Remodeling", city: "Onalaska, TX", isSample: true,
  },
  included: {
    headline: "What scoring looks at.",
    items: [
      "Pricing-page visits",
      "Time spent on site",
      "Repeat visits",
      "Which services they viewed",
      "How recently they were active",
      "A clear hot-to-cold ranking",
    ],
  },
  faq: {
    headline: "What pros ask about lead scoring.",
    items: [
      { q: "How do you know who's serious?",        a: "Behavior. Repeat visits and time on your pricing or service pages are strong buying signals." },
      { q: "Can I still see the lower scores?",     a: "Yes — every lead's there, just ranked so you know where to start." },
      { q: "Does it learn my business?",            a: "Scoring is tuned to home service buying signals that matter for the trades." },
      { q: "Do I have to do anything?",             a: "No. The ranking is automatic." },
    ],
  },
  pairsWith: ["behavior-and-job-type-insights", "qualified-leads-only", "real-time-mobile-alerts"],
};

const behaviorAndJobTypeInsights: Feature = {
  slug: "behavior-and-job-type-insights",
  name: "Behavior & Job-Type Insights",
  iconKey: "IconClipboardCheck",
  tagline: "Know the job before you dial.",
  subhead: "See which service each visitor looked at and how long they spent. Your first call already knows whether they want a quick repair or a full replacement.",
  aeoAnswer:
    "Behavior and Job-Type Insights show you exactly what each identified visitor did on your site — which service pages they viewed, how long they stayed, and what they came for. Consent Resolve turns that into a clear picture of the job, so your first call is informed and specific instead of a blind \"how can I help you?\"",
  problem: {
    headline: "You're calling blind every single time.",
    body: "You dial a lead with no idea what they want. You fumble through \"so what are you looking for?\" while they wonder if you're the right pro. Meanwhile the contractor who opened with \"I see you're looking at a roof replacement\" already sounds like the expert. Information wins jobs.",
  },
  howItWorks: {
    headline: "See the job before you say hello.",
    steps: [
      { title: "They browse your services.", body: "Repair, replacement, financing — whatever they look at." },
      { title: "We track what matters.",     body: "Which pages, how long, how many times." },
      { title: "You call prepared.",         body: "You know the job before they finish saying hi." },
    ],
  },
  benefits: {
    headline: "Walk into every call already informed.",
    items: [
      { title: "Sound like the expert.",    body: "Open with exactly what they need." },
      { title: "Better quotes, faster.",    body: "You're not starting from zero on the phone." },
      { title: "Higher trust.",              body: "Knowing their problem makes you the obvious choice." },
    ],
  },
  quote: {
    text: "When I call and say 'looks like you're after a full re-roof, not just a patch,' they think I read their mind. It's right there on my screen. Closes way more.",
    name: "Pete S.", shop: "Summit Roofing", city: "Lufkin, TX", isSample: true,
  },
  included: {
    headline: "What insights include.",
    items: [
      "Service pages viewed",
      "Time spent on each page",
      "Repeat-visit history",
      "Repair vs. replacement signals",
      "Financing or pricing interest",
      "A quick read on what they want",
    ],
  },
  faq: {
    headline: "What pros ask about behavior insights.",
    items: [
      { q: "What exactly can I see?",            a: "Which of your pages they viewed, how long, and how often — enough to know what job they're after." },
      { q: "How does this help my call?",        a: "You open knowing their problem, so you sound like the right pro from the first sentence." },
      { q: "Is this creepy to the customer?",    a: "No — they consented, and you simply use what they showed interest in to help them faster." },
      { q: "Does it work for any trade?",        a: "Yes. Whatever services your site lists, you'll see what they looked at." },
    ],
  },
  pairsWith: ["lead-scoring", "visitor-identification", "service-area-filtering"],
};

const serviceAreaFiltering: Feature = {
  slug: "service-area-filtering",
  name: "Service-Area Filtering",
  iconKey: "IconMapPin",
  tagline: "Only your towns.",
  subhead: "Only see visitors in the zip codes and towns you actually serve. No leads from three counties over that you'd never drive to.",
  aeoAnswer:
    "Service-Area Filtering limits your identified leads to the zip codes, cities, and counties you actually work in. Consent Resolve screens out visitors outside your service area before they ever reach your phone, so every lead you see is a job you could realistically drive to and win — no time wasted on out-of-range callers.",
  problem: {
    headline: "Out-of-area leads waste your whole day.",
    body: "There's nothing worse than a great-sounding lead three counties away you'd never drive to. You spend the call getting excited, then realize it's a two-hour haul each way. Multiply that by a week and you've lost real hours to jobs you were never going to take.",
  },
  howItWorks: {
    headline: "Draw your map, we handle the rest.",
    steps: [
      { title: "You set your area.",        body: "Pick the zips, towns, and counties you serve." },
      { title: "We filter in real time.",   body: "Visitors outside your range get screened out." },
      { title: "You only see fits.",        body: "Every lead is one you could actually drive to." },
    ],
  },
  benefits: {
    headline: "Every lead is one you'd actually take.",
    items: [
      { title: "No wasted calls.",   body: "Out-of-range leads never reach you." },
      { title: "Tighter routes.",    body: "Jobs cluster in the areas you already work." },
      { title: "Real local focus.",  body: "Your time stays in your territory." },
    ],
  },
  quote: {
    text: "I kept getting all excited about leads, then they'd be way out past my range. Now I only see my towns. Every name on my phone is somewhere I'd actually go.",
    name: "Aaron W.", shop: "Hometown Heat & Air", city: "Coldspring, TX", isSample: true,
  },
  included: {
    headline: "What filtering includes.",
    items: [
      "Filter by zip code",
      "Filter by city or town",
      "Filter by county",
      "Set multiple areas at once",
      "Change your range anytime",
      "Out-of-area leads screened automatically",
    ],
  },
  faq: {
    headline: "What pros ask about service-area filtering.",
    items: [
      { q: "How specific can I get?",                       a: "Down to the zip code, or as wide as multiple counties — your call." },
      { q: "Can I change my area later?",                   a: "Anytime. Add or drop zips as your business grows or shifts." },
      { q: "What happens to out-of-area visitors?",         a: "They're screened out, so they never clutter your list." },
      { q: "Can I cover more than one office's area?",      a: "Yes — set up multiple zones for multiple locations." },
    ],
  },
  pairsWith: ["lead-scoring", "behavior-and-job-type-insights", "qualified-leads-only"],
};

const qualifiedLeadsOnly: Feature = {
  slug: "qualified-leads-only",
  name: "Qualified Leads Only",
  iconKey: "IconFilter",
  tagline: "Real, identified, in-area. Nothing else.",
  subhead: "You spend your time on real, identified, in-area people — not anonymous clicks that lead nowhere.",
  aeoAnswer:
    "Qualified Leads Only means every lead Consent Resolve hands you is a real, identified person in your service area who showed genuine interest — not an anonymous click or a random form spammer. By screening for identity, location, and intent before delivery, it makes sure your phone time goes only to prospects who could actually become a paying job.",
  problem: {
    headline: "Most \"leads\" aren't leads at all.",
    body: "A click isn't a customer. A bot filling out your form isn't a customer. Somebody three counties over isn't a customer. When your list is full of junk, you waste your best hours chasing ghosts — and the real buyers slip past while you're busy with noise.",
  },
  howItWorks: {
    headline: "Three filters before a lead reaches you.",
    steps: [
      { title: "Is it a real person?",    body: "We confirm identity, not just a click." },
      { title: "Are they in your area?",  body: "Out-of-range visitors get screened out." },
      { title: "Did they show intent?",   body: "Only visitors with real interest come through." },
    ],
  },
  benefits: {
    headline: "A list with no junk on it.",
    items: [
      { title: "No anonymous clicks.",              body: "Every lead has a name and a face behind it." },
      { title: "No out-of-area time-wasters.",      body: "Only people you could actually serve." },
      { title: "No bots or spam.",                  body: "Real human interest, every time." },
    ],
  },
  quote: {
    text: "I used to dread my lead list — half of it was garbage. Now there's nothing on there but real people in my area who actually want the work. I trust it now.",
    name: "Mike B.", shop: "Deuces Contracting", city: "Huntsville, TX", isSample: true,
  },
  included: {
    headline: "What \"qualified\" actually means.",
    items: [
      "Identity confirmed",
      "In your service area",
      "Showed real intent",
      "Consented to contact",
      "Reachable contact info",
      "No bots, no spam, no anonymous clicks",
    ],
  },
  faq: {
    headline: "What pros ask about qualified leads only.",
    items: [
      { q: "What makes a lead \"qualified\"?",                     a: "It's a real, identified person, in your area, who showed genuine interest and opted in." },
      { q: "How is this different from a shared lead reseller?",   a: "Resellers blast unscreened leads to several pros. We screen for identity, area, and intent, and the lead is yours alone." },
      { q: "Will I get fewer leads this way?",                     a: "Fewer junk ones, yes. The ones you get are worth your time." },
      { q: "Can I loosen the filters?",                            a: "You control your area and can adjust what comes through." },
    ],
  },
  pairsWith: ["lead-scoring", "service-area-filtering", "verified-contact-data"],
};

// -----------------------------------------------------------------------
// THEME D — "Route it, work it, prove it paid off"
// -----------------------------------------------------------------------

const crmDelivery: Feature = {
  slug: "crm-delivery",
  name: "CRM Delivery",
  iconKey: "IconPlugConnected",
  tagline: "Straight into your CRM.",
  subhead: "Leads flow straight into the tools you already use, routed to the right person on your team automatically. Nothing falls through the cracks.",
  aeoAnswer:
    "CRM Delivery sends every identified lead directly into the tools your team already uses, automatically routed to the right person. Consent Resolve connects with common CRMs and platforms so leads don't sit in a separate dashboard — they land where your follow-up already happens, with nothing slipping through the cracks.",
  problem: {
    headline: "Leads die in the gap between tools.",
    body: "A lead lands in one place, your follow-up happens in another, and somewhere in between it gets forgotten. Sticky notes, screenshots, \"I'll add it later.\" Every lead that doesn't make it into your system is money you already spent and then dropped on the floor.",
  },
  howItWorks: {
    headline: "From your site to your system, automatically.",
    steps: [
      { title: "A lead is identified.", body: "A consented visitor is captured on your site." },
      { title: "It routes itself.",     body: "The lead flows into your CRM and to the right rep." },
      { title: "Your team works it.",   body: "Follow-up happens where it always does — nothing re-typed." },
    ],
  },
  benefits: {
    headline: "Every lead lands where it belongs.",
    items: [
      { title: "Nothing forgotten.",    body: "Leads go straight into your system, not a sticky note." },
      { title: "Right person, right lead.", body: "Auto-routing by area or rep." },
      { title: "No double entry.",      body: "No copying names between tools." },
    ],
  },
  quote: {
    text: "Before, half my leads lived in screenshots on my phone. Now they drop right into my CRM and get assigned. We stopped losing jobs to plain forgetfulness.",
    name: "Kevin R.", shop: "R&B Mechanical", city: "New Waverly, TX", isSample: true,
  },
  included: {
    headline: "What delivery includes.",
    items: [
      "Connects to common CRMs",
      "Auto-routing by rep",
      "Auto-routing by service area",
      "No manual data entry",
      "Full lead detail carried over",
      "Works with your existing workflow",
    ],
  },
  faq: {
    headline: "What pros ask about CRM delivery.",
    items: [
      { q: "Which CRMs do you connect to?",          a: "The common ones home service pros use, including GoHighLevel and others — ask us about yours." },
      { q: "Can I route leads to different people?", a: "Yes, by rep or by service area, automatically." },
      { q: "What if I don't use a CRM?",             a: "Leads still come to your phone and email — a CRM just makes it tidier." },
      { q: "Do I have to re-type anything?",         a: "No. The full lead carries over on its own." },
    ],
  },
  pairsWith: ["multi-channel-follow-up", "easy-setup-with-one-script", "roi-reporting"],
};

const multiChannelFollowUp: Feature = {
  slug: "multi-channel-follow-up",
  name: "Multi-Channel Follow-Up",
  iconKey: "IconMessage",
  tagline: "Call, text, or email.",
  subhead: "Reach identified visitors by call, email, or text — not one shot in the dark. Catch them however they're easiest to catch.",
  aeoAnswer:
    "Multi-Channel Follow-Up lets you reach each identified lead by phone, text, or email — whatever they respond to best. Because Consent Resolve captures full contact details, you're not limited to one shot in the dark; you can follow up across channels until you connect, which is how more leads turn into booked jobs.",
  problem: {
    headline: "One missed call shouldn't lose the job.",
    body: "You call once, they don't pick up, and that's the end of it. But people are busy — a missed call isn't a no. If calling is your only move, every unanswered ring is a customer gone. The pros who follow up more than one way book more work. Simple as that.",
  },
  howItWorks: {
    headline: "Reach them the way they'll answer.",
    steps: [
      { title: "You get full contact info.", body: "Phone, text, and email — all in hand." },
      { title: "You pick the channel.",      body: "Call first, then text or email if they're quiet." },
      { title: "You connect more often.",    body: "More ways to reach them means more answered." },
    ],
  },
  benefits: {
    headline: "More shots on goal, more jobs booked.",
    items: [
      { title: "Not just one call.",      body: "Follow up by text or email too." },
      { title: "Meet them where they are.", body: "Some answer texts, not calls." },
      { title: "Fewer lost leads.",       body: "Persistence across channels wins more work." },
    ],
  },
  quote: {
    text: "Half these folks won't answer a number they don't know, but they'll text back in a second. Having the call, text, and email means I actually reach 'em.",
    name: "Luis A.", shop: "All-Pro Fencing", city: "Cleveland, TX", isSample: true,
  },
  included: {
    headline: "What follow-up includes.",
    items: [
      "Phone number for calls",
      "Number for texting",
      "Email address",
      "Reach across all three",
      "Consent honored on every channel",
      "Opt-outs respected automatically",
    ],
  },
  faq: {
    headline: "What pros ask about multi-channel follow-up.",
    items: [
      { q: "Can I text these leads?",              a: "Yes, where they've consented — many people answer a text faster than a call." },
      { q: "Is texting them legal?",               a: "Consent is captured up front and opt-outs are honored, which is what keeps it clean — see the compliance section." },
      { q: "Do I have to use every channel?",      a: "No. Use what works for you; the options are just there." },
      { q: "What if they opt out?",                a: "They're suppressed automatically across every channel." },
    ],
  },
  pairsWith: ["instant-connect", "crm-delivery", "verified-contact-data"],
};

const builtInCompliance: Feature = {
  slug: "built-in-compliance",
  name: "Built-In Compliance",
  iconKey: "IconCertificate",
  tagline: "Legal, on autopilot.",
  subhead: "Consent gets recorded and opt-outs honored automatically, across every state. You stay covered without becoming a privacy-law expert.",
  aeoAnswer:
    "Built-In Compliance records every visitor's consent and honors opt-outs automatically, across state privacy laws. Working alongside Termageddon for policy coverage, Consent Resolve keeps a timestamped log of every lead's permission — so your shop stays on the right side of the rules without you having to track changing privacy laws yourself.",
  problem: {
    headline: "Privacy laws change faster than you can keep up.",
    body: "New state privacy laws keep landing, each with its own rules about contacting people. You didn't get into the trades to study legislation. But \"I didn't know\" isn't a defense if a complaint lands. You need the compliance handled for you, quietly, in the background.",
  },
  howItWorks: {
    headline: "Coverage that runs itself.",
    steps: [
      { title: "Consent is captured.",      body: "Every visitor's permission is recorded at the source." },
      { title: "It's logged and timestamped.", body: "You get a receipt for every lead." },
      { title: "Opt-outs are honored.",     body: "Anyone who says no is suppressed automatically." },
    ],
  },
  benefits: {
    headline: "Peace of mind, handled for you.",
    items: [
      { title: "No law degree needed.",     body: "The rules are handled in the background." },
      { title: "A receipt for everything.", body: "Every consent is timestamped and stored." },
      { title: "Automatic opt-outs.",       body: "No risk of calling someone who said no." },
    ],
  },
  quote: {
    text: "I don't have time to read up on privacy laws in ten states. Knowing every lead's got a signed timestamp behind it lets me sleep at night.",
    name: "Greg N.", shop: "Northshore Exteriors", city: "Onalaska, TX", isSample: true,
  },
  included: {
    headline: "What compliance covers.",
    items: [
      "Consent recorded at first click",
      "Timestamped receipt per lead",
      "Automatic opt-out suppression",
      "Works with Termageddon policies",
      "Multi-state coverage",
      "Audit trail on demand",
    ],
  },
  faq: {
    headline: "What pros ask about built-in compliance.",
    items: [
      { q: "Does this replace my privacy policy?",          a: "No. Consent Resolve handles consent capture and works with Termageddon for your policies — you still keep a policy on your site." },
      { q: "What if a regulator asks for proof?",           a: "Every consent is timestamped and logged, so you can show exactly what was agreed and when." },
      { q: "Does it cover my state?",                       a: "It's built for multi-state coverage. Confirm specifics for your state with us and your own advisor." },
      { q: "What happens when someone opts out?",           a: "They're suppressed automatically and you never get their info." },
    ],
  },
  pairsWith: ["consent-first-identification", "multi-channel-follow-up", "roi-reporting"],
};

const roiReporting: Feature = {
  slug: "roi-reporting",
  name: "ROI Reporting",
  iconKey: "IconChartHistogram",
  tagline: "Proof in plain dollars.",
  subhead: "See your cost per identified lead against the jobs you actually booked — so you know, in plain dollars, that it's paying for itself.",
  aeoAnswer:
    "ROI Reporting shows what your leads cost against the jobs you actually booked, in plain dollars. Consent Resolve tracks your cost per identified lead and ties it to closed work, so you can see at a glance whether the tool is paying for itself — no spreadsheets, no guesswork, just a clear return number.",
  problem: {
    headline: "You can't tell what's actually making you money.",
    body: "You spend on LSA, on Angi, on this and that, and at the end of the month you're guessing which one paid off. Marketing you can't measure is just hoping. If you can't see cost-in versus jobs-out in plain numbers, you're flying blind with your own money.",
  },
  howItWorks: {
    headline: "Cost in, jobs out, plain and simple.",
    steps: [
      { title: "We track your cost.",  body: "What you spend per identified lead." },
      { title: "You mark what booked.", body: "Tie leads to the jobs you actually won." },
      { title: "You see the return.",   body: "A clear dollar picture of what's working." },
    ],
  },
  benefits: {
    headline: "Know it's paying for itself.",
    items: [
      { title: "Real numbers.",        body: "Cost per lead against jobs booked, no guessing." },
      { title: "Smarter spending.",    body: "See what's working and put money there." },
      { title: "No spreadsheets.",     body: "The math is done for you." },
    ],
  },
  quote: {
    text: "I finally see what a lead costs me and what it turned into. Turns out this is the cheapest booked job I've got. Numbers don't lie.",
    name: "Frank D.", shop: "Diamond Roofing", city: "Tampa, FL", isSample: true,
  },
  included: {
    headline: "What reporting includes.",
    items: [
      "Cost per identified lead",
      "Jobs booked from leads",
      "Clear return on spend",
      "Trends over time",
      "Compare against other channels",
      "No spreadsheet required",
    ],
  },
  faq: {
    headline: "What pros ask about ROI reporting.",
    items: [
      { q: "How do you know what I booked?",       a: "You mark which leads turned into jobs, and the report ties it to cost." },
      { q: "Can I compare it to LSA or Angi?",     a: "Yes — you can see your cost per booked job side by side with other channels." },
      { q: "Do I need to build spreadsheets?",     a: "No. The numbers are calculated for you." },
      { q: "How fast do I see ROI?",               a: "As soon as you start marking booked jobs — often within the first week of the trial." },
    ],
  },
  pairsWith: ["channel-recovery", "crm-delivery", "lead-scoring"],
};

// -----------------------------------------------------------------------
// Groups
// -----------------------------------------------------------------------

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    slug: "your-leads",
    eyebrow: "What makes Consent Resolve different",
    title: "Your leads. Nobody else's.",
    blurb:
      "The people we identify came to your website — so the lead is yours alone. Never resold, never shared, never auctioned.",
    features: [exclusiveLeads, consentFirstIdentification, channelRecovery],
  },
  {
    slug: "see-who-is-there",
    eyebrow: "See who's there, reach them fast",
    title: "See who's there. Reach them fast.",
    blurb:
      "One script, real names, real numbers — and a phone alert the second a homeowner is ready to talk.",
    features: [
      easySetupWithOneScript,
      visitorIdentification,
      formlessContactCapture,
      verifiedContactData,
      instantConnect,
      realTimeMobileAlerts,
    ],
  },
  {
    slug: "quality-over-quantity",
    eyebrow: "Spend your time on the ones that matter",
    title: "Spend your time on the ones that matter.",
    blurb:
      "Score, segment, and filter so your day goes to the visitors who are actually ready to book.",
    features: [leadScoring, behaviorAndJobTypeInsights, serviceAreaFiltering, qualifiedLeadsOnly],
  },
  {
    slug: "route-and-prove",
    eyebrow: "Route it, work it, prove it paid off",
    title: "Route it, work it, prove it paid off.",
    blurb:
      "Leads land in your CRM, your team works them across every channel, and the dashboard shows the dollars.",
    features: [crmDelivery, multiChannelFollowUp, builtInCompliance, roiReporting],
  },
];

export const ALL_FEATURES: Feature[] = FEATURE_GROUPS.flatMap((g) => g.features);

export function getFeature(slug: string): Feature | undefined {
  return ALL_FEATURES.find((f) => f.slug === slug);
}

export function getFeatureGroupOf(slug: string): FeatureGroup | undefined {
  return FEATURE_GROUPS.find((g) => g.features.some((f) => f.slug === slug));
}
