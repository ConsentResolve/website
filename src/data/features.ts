/**
 * Features data spine — feeds /features/ hub, /features/[slug]/ pages,
 * and the grouped FeatureBento on the homepage. Single source of truth.
 *
 * Content comes from /Users/aaronphillips/Downloads/consent-resolve-feature-pages.md
 * (the "Copy Deck"). Voice + facts governed by /style-guide/voice/
 * (see src/pages/style-guide/voice.astro).
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

export interface Feature {
  slug: string;
  name: string;                        // H1
  iconKey: FeatureIconKey;
  tagline: string;                     // hero card right panel + (legacy) cards
  /** 1–3 sentence plain-English benefit. Drives the /features/ hub
   *  card body — must read like a contractor explaining it to another
   *  contractor over coffee, NOT like a SaaS feature description. */
  howItHelps: string;
  /** Path under /public to the brand-locked SVG illustration shown
   *  on the /features/ hub card (and as a side accent on the detail
   *  page hero). */
  illustration: string;
  subhead: string;                     // hero left body + meta description
  aeoAnswer: string;                   // 40–55-word AEO citation paragraph
  problem: { headline: string; body: string };
  howItWorks: { headline: string; steps: FeatureStep[] };   // length 3
  benefits:   { headline: string; items: FeatureBenefit[] };// length 3
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
  howItHelps: "The visitor came to your website. The recovery is yours — never resold, never shared, never auctioned. One consent, one contractor, one funnel. The recovered records never touch a marketplace.",
  illustration: "/illustrations/style/07-lead-house-lock.svg",
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
  pairsWith: ["consent-first-identification", "cart-recovery", "visitor-identification"],
};

const consentFirstIdentification: Feature = {
  slug: "consent-first-identification",
  name: "Consent-First Identification",
  iconKey: "IconUserCheck",
  tagline: "Every recovery starts with a yes.",
  howItHelps: "Every recovered visitor said yes to your consent banner first. The records that enter your funnel are clean, opted-in, and audit-logged — so the people retargeting and email reach are people who already raised a hand.",
  illustration: "/illustrations/features/02-consent-checkmark.svg",
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

const cartRecovery: Feature = {
  slug: "cart-recovery",
  name: "Cart Recovery",
  iconKey: "IconRefresh",
  tagline: "Bring abandoners back.",
  howItHelps: "Most shoppers leave before buying. Only the ones who log in can be followed up with. Cart Recovery identifies the anonymous abandoners who consented, resolves their email, and launches an automated recovery sequence — so the carts that walked away come back and close.",
  illustration: "/illustrations/features/03-cart-recovery.svg",
  subhead: "Cart abandonment isn't the problem. Anonymity is. Most shoppers leave before buying — only the ones who log in can be followed up with. We identify the rest so you can bring them back automatically.",
  aeoAnswer:
    "Cart Recovery identifies the anonymous shoppers who abandon their carts before checking out, resolves their email through the site's consent banner, and launches a multi-step automated recovery campaign. Even shoppers who never logged in get recovered — turning ~70% of cart abandoners into reachable subscribers without violating consent rules.",
  problem: {
    headline: "You can only email the ones who logged in.",
    body: "70% of shoppers leave items in their cart. They browsed your products, spent time choosing, then disappeared. If they never logged in or filled in their email at checkout, you have no way to reach them — and the next store with a recovery flow gets the sale instead.",
  },
  howItWorks: {
    headline: "Three steps to recover abandoned cart revenue.",
    steps: [
      { title: "Shopper adds items and abandons cart.", body: "A visitor browses your store, adds items to their cart, then leaves without completing checkout. They consented when they arrived — so we can identify them." },
      { title: "We identify them and resolve their email.", body: "Our system matches the abandoner to consented identification data and captures a deliverable email. Logs full consent documentation for compliance." },
      { title: "Automated recovery campaign launches.", body: "Multi-step sequence fires automatically: 1-hour reminder, 24-hour follow-up with social proof, 7-day last chance with discount. Perfectly timed to maximize recovery." },
    ],
  },
  benefits: {
    headline: "Turn invisible traffic into a revenue-generating list.",
    items: [
      { title: "Identify anonymous abandoners.",  body: "Know who abandoned their cart even if they never logged in. ~70% identification rate on consented traffic." },
      { title: "Automated email sequences.",       body: "Multi-step recovery campaigns launch automatically. Set it once, recover forever." },
      { title: "Track recovery revenue.",          body: "See exactly how much revenue you recover. Measure direct bottom-line impact week over week." },
    ],
  },
  included: {
    headline: "What Cart Recovery includes.",
    items: [
      "Anonymous cart-abandoner identification",
      "Automated multi-step email recovery sequences",
      "Perfectly timed follow-ups — 1 hour, 24 hours, 7 days",
      "Dynamic discount codes for high-value carts",
      "Recovery revenue tracking dashboard",
      "Multi-channel recovery — email, SMS, retargeting",
    ],
  },
  faq: {
    headline: "What stores ask about cart recovery.",
    items: [
      { q: "How do you identify a shopper who never logged in?",     a: "Through the consent banner on your site. When they accept, we resolve their email from consented identification data — no login, no form, no friction." },
      { q: "Is this legal?",                                         a: "Yes. Identification happens only after explicit consent via your cookie banner. Every record is timestamped and audit-logged. Termageddon keeps your privacy policy current automatically." },
      { q: "What if my abandoner email rates are low?",              a: "Abandoned-cart emails average around 45% open rates — well above any cold campaign. Intent is fresh, timing is right, and our deliverability checks make sure the email actually lands." },
      { q: "Can I use my existing email tool?",                      a: "Yes. We push recovered abandoners straight into Klaviyo, Mailchimp, HubSpot, or any tool that accepts a webhook. No new email platform required." },
    ],
  },
  pairsWith: ["instant-connect", "verified-contact-data", "multi-channel-follow-up"],
};

// -----------------------------------------------------------------------
// THEME B — "See who's there, feed the funnel"
// -----------------------------------------------------------------------

const easySetupWithOneScript: Feature = {
  slug: "easy-setup-with-one-script",
  name: "Easy Setup With One Script",
  iconKey: "IconCode",
  tagline: "Paste once. You're live.",
  howItHelps: "Paste one line of code into your website. Done. Most pros are live the same afternoon — no developer, no IT bill, no waiting around for setup.",
  illustration: "/illustrations/style/09-code-clock.svg",
  subhead: "One small piece of code on your site and you're live. No new software to learn, no app to babysit, no IT guy required.",
  aeoAnswer:
    "Easy Setup With One Script means Consent Resolve installs with a single snippet of code on your website. There's no software to learn, no developer needed, and no ongoing maintenance. Paste it once and identification starts the same day — most service pros are capturing leads within hours of signing up.",
  problem: {
    headline: "Most marketing tools die in the setup screen.",
    body: "You signed up for something once, hit a wall of settings and integrations, and quietly gave up two weeks later. Contractors don't have an IT department or a spare afternoon to wire up software. If it's not running today, it's not running.",
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
  included: {
    headline: "What setup includes.",
    items: [
      "One universal script",
      "Works on Mocha, WordPress, GHL, and more",
      "No developer required",
      "Step-by-step paste guide",
      "Live the same day",
      "No-charge install help if you want it",
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
  pairsWith: ["visitor-identification", "lead-scoring", "crm-delivery"],
};

const visitorIdentification: Feature = {
  slug: "visitor-identification",
  name: "Visitor Identification",
  iconKey: "IconEye",
  tagline: "Real people. Funnel fuel.",
  howItHelps: "Stop staring at a 'visitors today: 47' counter. See the real people behind your traffic — names, contact details, and what they were shopping — turned into funnel fuel your retargeting and email sequences can act on.",
  illustration: "/illustrations/style/01-contact-card.svg",
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
      { title: "Insight before the call.",       body: "You see what they came for before the inbound rings." },
    ],
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
  tagline: "Recover without a form.",
  howItHelps: "Only about 2% of website visitors ever fill out your contact form. Formless capture recovers the other 98% — with consent — so they can re-enter your funnel without typing a thing.",
  illustration: "/illustrations/features/06-formless-capture.svg",
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
      { title: "Funnel takes over.",      body: "The record flows into retargeting, email, and CRM — no \"contact us\" page required." },
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
  tagline: "Reachable records only.",
  howItHelps: "Every recovered visitor that enters your funnel is a real, reachable person — verified contact data, recent activity. Your retargeting and email sequences hit deliverable inboxes, not dead ones.",
  illustration: "/illustrations/features/07-verified-data.svg",
  subhead: "We only hand your funnel people who are reachable and recently active — so your retargeting and email sequences hit deliverable inboxes, not dead ones.",
  aeoAnswer:
    "Verified Contact Data means Consent Resolve only passes your funnel contacts confirmed reachable and recently active. Instead of audiences padded with dead numbers and stale emails, you get records your retargeting, email, and SMS sequences can actually deliver to — so the ad spend behind those audiences works on real homeowners, not bounced records.",
  problem: {
    headline: "Half the records on a cheap list are dead.",
    body: "Nothing kills your sequence faster than audiences where every third email bounces and the SMS opt-outs pile up. You paid to load those names. Your funnel still spent the budget delivering to nobody. A record you can't reach isn't a lead — it's wasted ad spend.",
  },
  howItWorks: {
    headline: "Checked before it ever reaches your funnel.",
    steps: [
      { title: "We identify a visitor.", body: "A consented person is matched to contact info." },
      { title: "We verify it's live.",   body: "The contact is checked for reachability and recent activity." },
      { title: "You get a real one.",    body: "Only verified, reachable contacts flow into your audiences and CRM." },
    ],
  },
  benefits: {
    headline: "Every record is one your funnel can actually reach.",
    items: [
      { title: "No wasted sends.",       body: "Email and SMS hit real inboxes, not bouncebacks." },
      { title: "Higher deliverability.", body: "Sequences stay healthy and ad audiences stay clean." },
      { title: "Trust in your list.",    body: "When the sequence runs, real people see it." },
    ],
  },
  included: {
    headline: "What verification includes.",
    items: [
      "Reachability check on every contact",
      "Recent-activity filter",
      "Stale and dead records removed",
      "Phone and email both checked",
      "Fresh data, not a recycled list",
      "Quality held to a deliverability standard",
    ],
  },
  faq: {
    headline: "What pros ask about verified data.",
    items: [
      { q: "What does \"recently active\" mean?",   a: "The contact shows recent online activity, so they're a live, reachable person — not a years-old record." },
      { q: "Will every record deliver?",             a: "No tool is perfect, but verified contacts hit inboxes far more often than a raw purchased list." },
      { q: "Do you check emails too?",               a: "Yes — both phone and email are screened before they ever enter your funnel." },
      { q: "Why does this matter?",                  a: "Because every send is ad spend. Dead records waste it." },
    ],
  },
  pairsWith: ["formless-contact-capture", "qualified-leads-only", "multi-channel-follow-up"],
};

const instantConnect: Feature = {
  slug: "instant-connect",
  name: "Instant Connect",
  iconKey: "IconBolt",
  tagline: "Funnel fires the moment they re-engage.",
  howItHelps: "The instant a recovered visitor re-engages — opens your email, clicks a retargeting ad, or returns to your site — your funnel knows. Your follow-up sequence fires at the right beat so the inbound call lands while the homeowner is still actively shopping.",
  illustration: "/illustrations/features/08-instant-connect.svg",
  subhead: "Recovered visitors don't sit in a queue. The moment they re-engage with your retargeting or email, your funnel fires — and the inbound call comes in warm.",
  aeoAnswer:
    "Instant Connect signals your retargeting and email funnel the moment a recovered visitor re-engages, so the next message in their sequence fires while interest is still hot. The result is an inbound call from a homeowner who's already been re-warmed by your funnel — not a cold outreach from you.",
  problem: {
    headline: "Funnel timing decides whether they come back.",
    body: "A homeowner with a leaking roof isn't waiting around. They're contacting whoever shows up in front of them first. If your retargeting and email sequence don't fire at the moment of re-engagement, the job's already gone to whoever did. Speed-to-funnel isn't a nice-to-have — it's the whole game.",
  },
  howItWorks: {
    headline: "From recovered to re-engaged in real time.",
    steps: [
      { title: "Visitor is recovered.",       body: "A consented person is identified on your site and added to your audiences." },
      { title: "Funnel fires automatically.", body: "Email, SMS, and retargeting ads queue up the moment they re-engage." },
      { title: "They call you.",              body: "By the time the inbound call hits your line, they're already warm." },
    ],
  },
  benefits: {
    headline: "Inbound calls that close themselves.",
    items: [
      { title: "Warm, not cold.",            body: "The homeowner has been touched by your funnel before they ever dial." },
      { title: "Right-time follow-up.",      body: "Sequences fire on re-engagement, not on a generic drip schedule." },
      { title: "More booked jobs.",          body: "Speed-to-funnel is the number-one predictor of who wins the call." },
    ],
  },
  included: {
    headline: "What Instant Connect includes.",
    items: [
      "Real-time re-engagement signals to your funnel",
      "Triggers email, SMS, and retargeting automations",
      "Works with the sequences you already run",
      "Time-stamped so you know how fresh interest is",
      "No daily export, no manual list pulls",
      "Fires the moment intent peaks, not after",
    ],
  },
  faq: {
    headline: "What pros ask about Instant Connect.",
    items: [
      { q: "What actually fires \"instantly\"?",        a: "The signal to your funnel. Your email, SMS, and ad sequences pick it up and queue the right message at the right beat." },
      { q: "Does this replace my existing automation?", a: "No — it feeds it. Keep the sequences you already run; Instant Connect just makes them fire on real intent." },
      { q: "Why does speed-to-funnel matter so much?",  a: "The first brand back in front of a re-engaged homeowner usually gets the inbound call. Instant Connect makes that you." },
      { q: "Can I see when a visitor re-engages?",      a: "Yes — the timeline shows every touch, so you can tune your sequence and your ad spend." },
    ],
  },
  pairsWith: ["qualified-leads-only", "visitor-identification", "multi-channel-follow-up"],
};

// -----------------------------------------------------------------------
// THEME C — "Spend your time on the ones that matter"
// -----------------------------------------------------------------------

const leadScoring: Feature = {
  slug: "lead-scoring",
  name: "Lead Scoring",
  iconKey: "IconStar",
  tagline: "Score recovered visitors.",
  howItHelps: "Not every recovered visitor is the same — three pricing-page visits beats a one-second bounce every time. Lead scoring ranks your recovered records so your hottest segments get into the warmest retargeting and the most urgent email sequences.",
  illustration: "/illustrations/features/10-lead-scoring.svg",
  subhead: "Not every visitor is worth the same ad spend. We rank them so your funnel hits the serious ones hardest — three pricing-page visits beats a one-second bounce every time.",
  aeoAnswer:
    "Lead Scoring ranks your identified visitors by how likely they are to buy, based on what they did on your site. Consent Resolve flags the people who viewed pricing, returned more than once, or spent real time on a service page — so your retargeting audiences and email sequences put the heaviest push on the hottest prospects instead of treating every record the same.",
  problem: {
    headline: "Your funnel is treating every recovered visitor the same.",
    body: "When every record gets the same retargeting bid and the same drip email, you waste budget on tire-kickers and under-spend on the serious buyer. A one-second bounce and a homeowner who read your whole pricing page three times are not the same lead — but a flat audience treats them like they are.",
  },
  howItWorks: {
    headline: "We rank them so your funnel doesn't have to.",
    steps: [
      { title: "We watch behavior.",          body: "Pages viewed, time spent, repeat visits." },
      { title: "We score each record.",       body: "Stronger buying signals push a lead up the list." },
      { title: "Your funnel works top-down.", body: "Hottest scores get the heaviest retargeting and the warmest email push." },
    ],
  },
  benefits: {
    headline: "Spend your best ad budget on your best leads.",
    items: [
      { title: "Right ones get more spend.", body: "Hot buyers see your ads more often, while they're still hot." },
      { title: "Less wasted budget.",        body: "Tire-kickers don't burn your retargeting cap." },
      { title: "More inbound per dollar.",   body: "Funnel pressure goes where the money is." },
    ],
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
  pairsWith: ["behavior-and-job-type-insights", "qualified-leads-only", "roi-reporting"],
};

const behaviorAndJobTypeInsights: Feature = {
  slug: "behavior-and-job-type-insights",
  name: "Behavior & Job-Type Insights",
  iconKey: "IconClipboardCheck",
  tagline: "Tag visitors by intent.",
  howItHelps: "Each recovered record carries what they were shopping — re-roof vs patch, water-heater quote vs full re-pipe. Your retargeting and email sequences segment by intent so the message that brings them back is the message they came for.",
  illustration: "/illustrations/style/03-speech-wrench.svg",
  subhead: "See which service each visitor looked at and how long they spent. Your retargeting ads, email sequences, and the inbound call already know whether they want a quick repair or a full replacement.",
  aeoAnswer:
    "Behavior and Job-Type Insights show you exactly what each identified visitor did on your site — which service pages they viewed, how long they stayed, and what they came for. Consent Resolve turns that into a clear picture of the job, so your retargeting message, email sequence, and the eventual inbound call all speak to the work they're actually shopping.",
  problem: {
    headline: "Your retargeting is firing blind.",
    body: "Generic \"need a roofer?\" ads chase everyone the same way. Meanwhile the shop that retargets with \"we do full re-roofs in your zip code\" speaks directly to the homeowner who was on the replacement page. Information wins funnels — without it, every audience looks identical and converts like spam.",
  },
  howItWorks: {
    headline: "See the job, then segment the funnel.",
    steps: [
      { title: "They browse your services.", body: "Repair, replacement, financing — whatever they look at." },
      { title: "We track what matters.",     body: "Which pages, how long, how many times." },
      { title: "Your funnel adapts.",        body: "Ads and email speak to the exact job they were shopping." },
    ],
  },
  benefits: {
    headline: "Segment every funnel touch by intent.",
    items: [
      { title: "Sharper retargeting.",    body: "Ads speak to exactly what they came for." },
      { title: "Better email sequences.", body: "The right message lands at the right moment." },
      { title: "Warmer inbound calls.",   body: "By the time they dial, they already think you get it." },
    ],
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
      { q: "How does this help my funnel?",      a: "Your retargeting and email sequences segment by intent, so each homeowner sees the message that matches the job they were shopping." },
      { q: "Is this creepy to the customer?",    a: "No — they consented, and the funnel simply uses what they showed interest in to help them faster." },
      { q: "Does it work for any trade?",        a: "Yes. Whatever services your site lists, you'll see what they looked at." },
    ],
  },
  pairsWith: ["lead-scoring", "visitor-identification", "qualified-leads-only"],
};

const qualifiedLeadsOnly: Feature = {
  slug: "qualified-leads-only",
  name: "Qualified Leads Only",
  iconKey: "IconFilter",
  tagline: "Real, identified, in-area. Nothing else.",
  howItHelps: "Every recovered record is a real, identified person inside your service area who showed real intent. The junk gets filtered out before it ever enters your retargeting audiences, email lists, or CRM — so the funnel you already run stays clean and your ad spend chases real homeowners.",
  illustration: "/illustrations/features/13-qualified-leads.svg",
  subhead: "Your retargeting audiences, email lists, and CRM only get real, identified, in-area homeowners — not anonymous clicks, not out-of-range visitors, not bots.",
  aeoAnswer:
    "Qualified Leads Only means every record Consent Resolve hands your funnel is a real, identified person inside your service area who showed genuine interest — not an anonymous click, not a bot, not a visitor three counties away. By screening for identity, location, and intent before delivery, it keeps the audiences, email lists, and CRM you already run clean so your ad spend only chases homeowners who could actually book a job.",
  problem: {
    headline: "Most \"leads\" aren't leads at all.",
    body: "A click isn't a customer. A bot in your form isn't a customer. A visitor three counties over isn't a customer. When your retargeting audiences and email lists are stuffed with junk, your ad spend chases ghosts and your inbound calls dry up. Clean audiences are what make the funnel pay.",
  },
  howItWorks: {
    headline: "Three filters before a record hits your funnel.",
    steps: [
      { title: "Is it a real person?",    body: "Identity is confirmed — not just a click or a session." },
      { title: "Are they in your area?",  body: "Visitors outside your zips, towns, and counties are screened out before delivery." },
      { title: "Did they show intent?",   body: "Only visitors with genuine interest enter your audiences." },
    ],
  },
  benefits: {
    headline: "Audiences that actually convert.",
    items: [
      { title: "No anonymous clicks.",              body: "Every record has a name and a face behind it." },
      { title: "No out-of-area noise.",             body: "Retargeting and email only reach homeowners you could actually serve." },
      { title: "No bots or spam.",                  body: "Real human interest only — the funnel stays clean." },
    ],
  },
  included: {
    headline: "What \"qualified\" actually means.",
    items: [
      "Identity confirmed",
      "Inside the zip codes, towns, and counties you serve",
      "Showed real intent on your site",
      "Consented to contact",
      "Reachable contact info",
      "No bots, no spam, no anonymous clicks",
    ],
  },
  faq: {
    headline: "What pros ask about qualified leads only.",
    items: [
      { q: "What makes a record \"qualified\"?",                   a: "It's a real, identified person, in your service area, who showed genuine interest on your site and opted in via your consent banner." },
      { q: "How is this different from a shared lead reseller?",   a: "Resellers blast unscreened leads to several pros. We screen for identity, area, and intent — and every record is yours alone, never resold." },
      { q: "Can I limit by zip code or town?",                     a: "Yes. You set the zips, cities, and counties you serve, and out-of-area visitors are screened out before they ever reach your funnel." },
      { q: "Will I get fewer records this way?",                   a: "Fewer junk ones, yes. The ones you get are worth your ad spend." },
    ],
  },
  pairsWith: ["lead-scoring", "behavior-and-job-type-insights", "verified-contact-data"],
};

// -----------------------------------------------------------------------
// THEME D — "Route it, work it, prove it paid off"
// -----------------------------------------------------------------------

const crmDelivery: Feature = {
  slug: "crm-delivery",
  name: "CRM Delivery",
  iconKey: "IconPlugConnected",
  tagline: "Funnel insertion, automated.",
  howItHelps: "Recovered records drop straight into Jobber, Housecall Pro, ServiceTitan, GoHighLevel, HubSpot — and into your retargeting audiences. Consent Resolve is an input to the marketing machine you already run, not another tool to manage.",
  illustration: "/illustrations/style/05-crm-inbox.svg",
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
  tagline: "Hit every funnel surface.",
  howItHelps: "Recovered visitors flow into your retargeting, your email/SMS sequences, and your CRM all at once — so the homeowner sees your message on the next ad they scroll, the next email they open, and the next time they search. The funnel does the work; the inbound call shows up.",
  illustration: "/illustrations/features/15-multi-channel.svg",
  subhead: "Recovered records flow into every funnel surface you run — retargeting, email, SMS, CRM — so the homeowner is touched wherever they're easiest to re-engage.",
  aeoAnswer:
    "Multi-Channel Follow-Up pipes each identified lead into every funnel channel you run — retargeting audiences, email sequences, SMS, and your CRM. Because Consent Resolve delivers full contact details with consent, your existing automations can re-engage the homeowner wherever they spend their attention — and the inbound call comes in warm.",
  problem: {
    headline: "One funnel surface shouldn't decide whether they come back.",
    body: "If retargeting is your only re-engagement move, every homeowner who doesn't scroll past your ad is a lost job. Email-only is no better. People live across surfaces — Facebook, Gmail, SMS, search. The funnels that book more inbound calls hit every surface, not just one.",
  },
  howItWorks: {
    headline: "Every surface picks up the record.",
    steps: [
      { title: "Full contact, all at once.",  body: "Phone, email, and SMS-eligible number land together." },
      { title: "Your funnel fans out.",       body: "Retargeting, email, SMS, and CRM all pick up the record." },
      { title: "Inbound call lands warm.",    body: "By the time they call, they've seen you across surfaces." },
    ],
  },
  benefits: {
    headline: "More surfaces, more inbound calls.",
    items: [
      { title: "Not just one channel.",      body: "Retargeting and email and SMS — together, not picking one." },
      { title: "Meet them where they are.",  body: "Some respond to ads, some to email, some to a text." },
      { title: "Fewer lost records.",        body: "Persistence across surfaces wins more work." },
    ],
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
  iconKey: "IconShieldCheck",
  tagline: "It all starts with consent.",
  howItHelps: "Every visitor decision is timestamped, logged, and exportable for seven years. Documentation that stands up to GDPR, CCPA, HIPAA, and GLBA audits — so one regulator request, lawsuit, or complaint doesn't put the business at risk.",
  illustration: "/illustrations/style/08-shield-doc.svg",
  subhead: "Other tools track visitors without clear consent and call it \"identification.\" One audit request, one lawsuit, one regulatory complaint — and you're defending tracking you can't prove was authorized. We start with consent.",
  aeoAnswer:
    "Built-In Compliance records every visitor's consent decision (yes, no, or dismiss) with a timestamp, IP, and user agent, then stores the audit trail for seven years. Documentation stands up to GDPR, CCPA, HIPAA, and GLBA audits — so a recovered lead can always be proven authorized, and a single complaint never becomes a multi-million-dollar regulatory event.",
  problem: {
    headline: "Visitor tracking without consent is a legal minefield.",
    body: "Other tools track first and ask never. One audit request from a regulator, one class-action lawsuit, or one consumer complaint — and you're defending tracking you can't prove was authorized. Higher match rates mean nothing if one violation destroys the business.",
  },
  howItWorks: {
    headline: "Transparent consent collection in three simple steps.",
    steps: [
      { title: "Visitor sees clear banner.",       body: "Plain-language banner explains what's tracked and why. No dark patterns. No pre-checked boxes. No hiding the \"no\" button." },
      { title: "Consent decision logged.",         body: "Every yes, no, or dismiss is timestamped and stored. IP address, user agent, and decision recorded for 7 years." },
      { title: "Export compliance records.",       body: "Download complete audit trail anytime. Show regulators documented consent for every tracked visitor." },
    ],
  },
  benefits: {
    headline: "Legal protection worth more than higher match rates.",
    items: [
      { title: "7-year audit trail.",     body: "Every consent decision timestamped and stored. Prove authorization for any visitor, anytime." },
      { title: "Regulatory defense.",     body: "Documentation that stands up to GDPR, CCPA, HIPAA, and GLBA audits." },
      { title: "Lawsuit protection.",     body: "Documented consent defeats class-action claims of unauthorized tracking." },
    ],
  },
  included: {
    headline: "What consent-first tracking includes.",
    items: [
      "7-year audit trail of every consent decision",
      "Regulatory defense — GDPR, CCPA, HIPAA, GLBA",
      "Withdrawal tracking — stop tracking the moment someone revokes",
      "No dark patterns — clear language, obvious decline button",
      "Exportable consent records — CSV, ready for legal review",
      "Lawsuit protection — documented consent defeats class-action claims",
    ],
  },
  faq: {
    headline: "What pros ask about consent-first tracking.",
    items: [
      { q: "How is this different from other visitor-ID tools?", a: "Most identification tools track first and ask never. We ask first and track second. Lower match rates, but every lead is defensible — and one violation can cost more than a lifetime of higher conversion." },
      { q: "What if a regulator asks for proof?",                a: "Export the complete audit trail in CSV. Every consent decision is timestamped with IP, user agent, and decision recorded for seven years — ready for legal review on demand." },
      { q: "What happens when someone withdraws consent?",       a: "Tracking stops immediately. The withdrawal is logged with a timestamp so you can prove exactly when it took effect — and the visitor is suppressed across every channel automatically." },
      { q: "Does this cover GDPR, CCPA, HIPAA, and GLBA?",        a: "Yes. The audit trail format and documentation depth are designed to stand up to all four. Termageddon keeps your underlying privacy policy current as the rules evolve." },
    ],
  },
  pairsWith: ["consent-first-identification", "exclusive-leads", "verified-contact-data"],
};

const roiReporting: Feature = {
  slug: "roi-reporting",
  name: "ROI Reporting",
  iconKey: "IconChartHistogram",
  tagline: "Cost-per-booked-job, not cost-per-lead.",
  howItHelps: "See your recovery spend tied to the jobs your funnel books from recovered visitors. The number that matters — blended cost per booked job — drops on the same ad budget. Marketing you can finally measure.",
  illustration: "/illustrations/features/17-roi-reporting.svg",
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
  pairsWith: ["cart-recovery", "crm-delivery", "lead-scoring"],
};

// -----------------------------------------------------------------------
// Groups
// -----------------------------------------------------------------------

// Four feature groups now map to the positioning's three pillars +
// the compliance moat (June 2026 reposition).
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    slug: "consent-foundation",
    eyebrow: "It all starts with consent",
    title: "The foundation everything else sits on.",
    blurb:
      "Every recovery, every audience, every lead — starts with the homeowner's documented yes. Consent-first tracking is the receipt that keeps the business defensible when a regulator, lawyer, or ad platform asks.",
    features: [builtInCompliance],
  },
  {
    slug: "ad-recovery",
    eyebrow: "Ad-spend recovery",
    title: "Recover the 98% that bounce.",
    blurb:
      "Every channel you run sends visitors to your site that mostly leave without contacting you. These features recover the bounce — with consent — so the ad spend you're already making converts to identified records.",
    features: [cartRecovery, visitorIdentification, formlessContactCapture, verifiedContactData],
  },
  {
    slug: "funnel-insertion",
    eyebrow: "Funnel insertion",
    title: "Drop into the funnel you already run.",
    blurb:
      "Recovered visitors flow into the retargeting audiences, email/SMS sequences, and CRM you've already built. We're an input to your marketing machine — not another tool to manage.",
    features: [easySetupWithOneScript, crmDelivery, multiChannelFollowUp, behaviorAndJobTypeInsights, leadScoring],
  },
  {
    slug: "inbound-call",
    eyebrow: "Inbound calls",
    title: "Turn the bounce into an inbound call.",
    blurb:
      "The recovered visitor comes back on their own time, through your funnel, and calls you — warm, not cold. These features keep the timing right, the area accurate, and the noise out.",
    features: [instantConnect, qualifiedLeadsOnly, roiReporting],
  },
  {
    slug: "consent-moat",
    eyebrow: "The moat — consent-first",
    title: "Compliant by design. Yours alone.",
    blurb:
      "This is the wall around the funnel insertion. Every recovery starts with an explicit consent capture, every record is timestamped and audit-logged, and every recovered visitor belongs to you and only you — never resold, never shared.",
    features: [consentFirstIdentification, exclusiveLeads],
  },
];

export const ALL_FEATURES: Feature[] = FEATURE_GROUPS.flatMap((g) => g.features);

export function getFeature(slug: string): Feature | undefined {
  return ALL_FEATURES.find((f) => f.slug === slug);
}

export function getFeatureGroupOf(slug: string): FeatureGroup | undefined {
  return FEATURE_GROUPS.find((g) => g.features.some((f) => f.slug === slug));
}
