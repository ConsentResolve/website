/**
 * Industry data spine — feeds /industries/ hub and /[trade]-leads/ template.
 * All copy sourced from consent-resolve-industry-pages-seo.md.
 * Voice + facts governed by /style-guide/voice/ (single source of truth — see src/pages/style-guide/voice.astro).
 */

export interface IndustryFaq {
  q: string;
  a: string;
}

export interface IndustryTradeMath {
  avgJobValue: number;
  closeRatePct: number;
  /** Representative competitor cost-per-lead — Thumbtack benchmark from the
   *  Consent Resolve Competitor CPL Matrix (loaded estimate: avg of researched
   *  range × 1.2, rounded). Used as the calculator preset for "current cost
   *  per lead" so the math models a typical reseller spend. */
  competitorCpl: number;
}

export interface Industry {
  slug: string;                 // URL slug, e.g. "plumber"
  name: string;                 // human label, e.g. "Plumbers"
  shortName: string;            // single-word for card chips, e.g. "Plumbing"
  iconKey: string;              // Tabler icon name, e.g. "IconDroplet" — still used on the per-trade hero panel
  /** Path under /public to the brand-locked SVG illustration shown
   *  on the /industries/ hub IllustrationCard. Generated via
   *  scripts/generate-recraft.py --set=trades. */
  illustration: string;
  /** Unique SEO card blurb for /industries/. Keyword-rich, contractor-
   *  voice, 1–3 sentences. Should NOT be templated — every card
   *  reads different to a Google or AI engine crawler. */
  cardCopy: string;
  // SEO
  titleTag: string;
  metaDescription: string;
  keywords: string;
  // AEO
  aeoAnswer: string;            // 40–55 word answer paragraph
  // Hero
  heroH1: string;
  heroSubhead: string;
  // Problem
  problem: string;
  urgencyLine: string;
  // Math
  math: IndustryTradeMath;
  // 3 cards (titles must match FeatureBento variants we have)
  cardKeys: string[];           // 3 of: 'on-phone-five' | 'why-shopping' | 'mapped-zip' | 'came-back' | 'crm' | 'yours-alone' | 'real-numbers'
  // FAQ — 3 unique Qs per trade
  faqs: IndustryFaq[];
  // Final CTA
  finalCtaH2: string;
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "general-contractor",
    name: "General Contractors",
    shortName: "Remodeling",
    iconKey: "IconBuildingCommunity",
    illustration: "/illustrations/trades/01-general-contractor.svg",
    cardCopy: "Catch the homeowners pricing a remodel, addition, or whole-house renovation before they call three other GCs. Real names, real budgets, $7 per exclusive general-contractor lead — never resold.",
    titleTag: "Exclusive General Contractor Leads | Consent Resolve",
    metaDescription: "Identify the homeowners pricing a remodel or addition on your site — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "general contractor leads, remodeling leads, home addition leads, GC lead generation",
    aeoAnswer: "General contractors get exclusive leads with Consent Resolve by identifying the homeowners already researching a remodel or addition on their website. After the homeowner consents, you get a recovered record fed into your funnel. Each lead is yours alone — never resold — for $7.",
    heroH1: "Exclusive remodeling and addition leads — yours alone.",
    heroSubhead: "Big projects get researched for weeks before a homeowner picks up the phone. See who's pricing a remodel or addition on your site, recover the bounce when they consent, and let your retargeting and email keep you in front of them until they call — before three other GCs even know they're shopping.",
    problem: "A remodel is a long, careful decision. Homeowners compare bids for weeks and visit your site more than once. Most leave without a name — and the GC who stays in front of them usually lands the bid.",
    urgencyLine: "The GC who stays in front of them usually lands the bid.",
    math: { avgJobValue: 25000, closeRatePct: 20, competitorCpl: 144 },
    cardKeys: ["came-back", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do general contractors get exclusive leads?", a: "You identify homeowners already pricing a project on your site. When they consent, you get a recovered record — yours alone, never shared." },
      { q: "Will I know what project they want?", a: "Yes. You see what they were shopping for, so you walk into the call already knowing it's a kitchen, a bath, or an addition." },
      { q: "What does it cost?", a: "Flat $7 a lead — a rounding error against one signed remodel. Card required, cancel anytime." },
    ],
    finalCtaH2: "Your next remodel is already pricing the job on your site.",
  },
  {
    slug: "handyman",
    name: "Handymen",
    shortName: "Handyman",
    illustration: "/illustrations/trades/02-handyman.svg",
    cardCopy: "The honey-do list lands in your funnel. Recover the homeowners shopping mounts, small repairs, and odd-job punch lists on your site — $7 per recovered handyman lead, fed straight into your retargeting and CRM.",
    iconKey: "IconTool",
    titleTag: "Exclusive Handyman Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for repairs and to-do lists — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "handyman leads, home repair leads, handyman jobs near me, handyman lead generation",
    aeoAnswer: "Handymen get exclusive leads with Consent Resolve by identifying the homeowners browsing their site for repairs and odd jobs. Once the homeowner consents, you get a recovered record routed into your funnel. Leads are yours alone for $7 — no platform sharing them with five other handymen.",
    heroH1: "Exclusive handyman leads — yours alone, never resold.",
    heroSubhead: "Handyman work runs on volume and speed. See the homeowners shopping your site for a to-do list, recover the bounce when they consent, and let your funnel keep you in front of them so they book with you, not the next guy.",
    problem: "Most handyman jobs start with a quick search and a website peek. The homeowner doesn't call — they keep scrolling. The handyman who stays in front of them usually fills the slot.",
    urgencyLine: "The handyman who stays in front of them usually fills the slot.",
    math: { avgJobValue: 300, closeRatePct: 40, competitorCpl: 24 },
    cardKeys: ["on-phone-five", "crm", "yours-alone"],
    faqs: [
      { q: "How do handymen find local jobs without paying for shared leads?", a: "You identify the homeowners already on your site. When they consent, the lead is yours alone — not auctioned to other handymen." },
      { q: "Is it worth it for small jobs?", a: "At $7 a lead, one booked afternoon of work pays for a stack of them." },
      { q: "Do I need a developer to set it up?", a: "No. Paste one line of code, and you're live in about 10 minutes." },
    ],
    finalCtaH2: "Your next job is already on your site looking for help.",
  },
  {
    slug: "tree-removal",
    name: "Tree Removal",
    shortName: "Tree Services",
    iconKey: "IconTrees",
    illustration: "/illustrations/trades/03-tree-removal.svg",
    cardCopy: "Storm cleanup, dead-tree removal, and stump grinding shoppers — identified the moment they consent on your site. One big removal pays for months of $7 exclusive tree-service leads.",
    titleTag: "Exclusive Tree Removal Leads | Consent Resolve",
    metaDescription: "Identify the homeowners pricing tree removal or storm cleanup on your site — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "tree removal leads, tree service leads, storm cleanup leads, arborist lead generation",
    aeoAnswer: "Tree services get exclusive leads with Consent Resolve by identifying the homeowners already pricing a removal or storm cleanup on their site. After they consent, the recovered record drops into your funnel. Leads are exclusive — yours alone — for $7.",
    heroH1: "Exclusive tree removal leads — yours alone.",
    heroSubhead: "A leaning tree or a storm-snapped limb is a \"today\" problem. See who's pricing removal in your area, recover the bounce when they consent, and let your funnel keep you in front of them before the cleanup crews roll in.",
    problem: "After a storm, every homeowner with a downed tree is shopping at once — and they call whoever stayed in front of them. Miss that window and the high-ticket removal goes to another crew.",
    urgencyLine: "After a storm, the crew they remember books the work.",
    math: { avgJobValue: 1200, closeRatePct: 30, competitorCpl: 36 },
    cardKeys: ["on-phone-five", "mapped-zip", "yours-alone"],
    faqs: [
      { q: "How do tree removal companies get more local jobs after a storm?", a: "You see the homeowners pricing removal in your area in real time. When they consent, the recovered record drops into your retargeting and CRM so they come back through your funnel — inbound, not cold-call." },
      { q: "Can I see which neighborhoods are shopping?", a: "Yes. Every lead drops a pin on your service-area map." },
      { q: "What's the cost?", a: "Flat $7 a lead — one big removal covers months of leads. Card required, cancel anytime." },
    ],
    finalCtaH2: "That downed tree is already being priced on your site.",
  },
  {
    slug: "hvac",
    name: "HVAC & AC",
    shortName: "HVAC",
    iconKey: "IconAirConditioning",
    illustration: "/illustrations/trades/04-hvac.svg",
    cardCopy: "The \"no-cool\" calls before they hit the next contractor's voicemail. Identify the homeowners shopping AC replacement, furnace repair, or maintenance plans — $7 per exclusive HVAC lead, never resold.",
    titleTag: "Exclusive HVAC & AC Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing a new AC, furnace, or no-cool fix on your site — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "HVAC leads, AC repair leads, furnace replacement leads, HVAC lead generation",
    aeoAnswer: "HVAC pros get exclusive leads with Consent Resolve by identifying the homeowners already pricing a system or repair on their site. After they consent, you get a recovered record routed into your funnel while it still matters. Leads are yours alone for $7.",
    heroH1: "Exclusive HVAC & AC leads — yours alone, never resold.",
    heroSubhead: "A hot house turns a \"someday\" homeowner into a \"right now\" buyer. See who's shopping your site for a new AC or a no-cool fix, recover the bounce when they consent, and let your retargeting + email funnel be the contractor they remember while they're still sweating.",
    problem: "When the AC quits in July, minutes matter. The homeowner checks your site, doesn't call, and dials the next shop. The shop they remember books the install.",
    urgencyLine: "When the AC quits in July, minutes matter.",
    math: { avgJobValue: 5500, closeRatePct: 28, competitorCpl: 87 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "Can I tell a new-system shopper from a repair?", a: "Yes — you get what they were shopping for, so you know if it's a tune-up or a replacement before you call." },
      { q: "How fast does a lead reach me?", a: "Seconds. A text or Slack fires the moment they consent." },
      { q: "Are these leads shared with other shops?", a: "Never. Every HVAC lead is yours alone." },
    ],
    finalCtaH2: "Your next install is already shopping your site.",
  },
  {
    slug: "plumber",
    name: "Plumbers",
    shortName: "Plumbing",
    iconKey: "IconDroplet",
    illustration: "/illustrations/trades/05-plumber.svg",
    cardCopy: "Water heater quotes, re-pipes, and burst-pipe shoppers — captured at consent and fed into your funnel as a consented email. Flat $7 per exclusive plumber lead, never sold to another shop.",
    titleTag: "Exclusive Plumbing Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing a water heater, re-pipe, or burst-pipe fix on your site — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "plumbing leads, plumber leads, water heater leads, plumbing lead generation",
    aeoAnswer: "Plumbers get exclusive recovered leads with Consent Resolve by identifying the homeowners already pricing a plumbing job on their site. After they consent, the recovered record is fed back into the plumber's retargeting and CRM so the homeowner returns via the funnel. Recovered leads are yours alone for $7 — incremental on top of every ad channel.",
    heroH1: "Exclusive plumbing leads — yours alone, never resold.",
    heroSubhead: "A burst pipe doesn't wait for a callback. See who's shopping your area for a water heater or a leak fix, recover the bounce when they consent, and let your retargeting and email funnel bring them back to dial you first.",
    problem: "Plumbing problems get searched fast and booked fast. The homeowner checks your site, doesn't call, and dials the next name on the list. You never knew they were there.",
    urgencyLine: "A burst pipe doesn't wait for a callback.",
    math: { avgJobValue: 450, closeRatePct: 30, competitorCpl: 57 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "What if it's an emergency, like a burst pipe?", a: "You get the alert in seconds, and the recovered contact feeds your funnel so you stay in front of them before they settle on another plumber." },
      { q: "Will I know what the job is?", a: "Yes — you see what they were shopping for, so you call ready." },
      { q: "How much does it cost?", a: "Flat $7 a lead, no contract. Card required, cancel anytime." },
    ],
    finalCtaH2: "Your next plumbing job is already shopping your site.",
  },
  {
    slug: "locksmith",
    name: "Locksmiths",
    shortName: "Locksmith",
    iconKey: "IconKey",
    illustration: "/illustrations/trades/06-locksmith.svg",
    cardCopy: "Lockouts, rekeys, and security-upgrade shoppers — recovered the moment they consent on your site. $7 per recovered locksmith lead, fed straight into your CRM and retargeting funnel.",
    titleTag: "Exclusive Locksmith Leads, Never Resold | Consent Resolve",
    metaDescription: "Identify the homeowners shopping your site for a lockout, rekey, or security upgrade — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "locksmith leads, lockout service leads, rekey leads, locksmith lead generation",
    aeoAnswer: "Locksmiths get exclusive recovered leads with Consent Resolve by identifying the people already on their site for a lockout, rekey, or lock install. Once they consent, the recovered record routes into the locksmith's existing dispatch and retargeting tools. Recovered leads are yours alone for $7 — incremental on top of every ad channel you run.",
    heroH1: "Exclusive locksmith leads — yours alone.",
    heroSubhead: "A lockout is the definition of \"right now.\" See who's shopping your site for a lockout, rekey, or new locks, recover the bounce when they consent, and let your funnel keep you top of mind so you're the locksmith they call.",
    problem: "Locksmith jobs are won on speed. Someone standing outside a locked door calls the first shop that picks up. If they left your site without calling, you just need a way to stay in front of them.",
    urgencyLine: "Locksmith jobs are won on speed.",
    math: { avgJobValue: 180, closeRatePct: 45, competitorCpl: 33 },
    cardKeys: ["on-phone-five", "mapped-zip", "yours-alone"],
    faqs: [
      { q: "How do locksmiths get more local calls?", a: "You recover the people already on your site for lock work. When they consent, the recovered record feeds your dispatch and retargeting so they come back to you, not another shop." },
      { q: "Does it work for emergency lockouts?", a: "Yes — the alert fires in seconds, which is the whole game." },
      { q: "Are these leads exclusive?", a: "Yes. Yours alone, never resold." },
    ],
    finalCtaH2: "Someone's locked out and on your site right now.",
  },
  {
    slug: "electrician",
    name: "Electricians",
    shortName: "Electrical",
    iconKey: "IconBolt",
    illustration: "/illustrations/trades/07-electrician.svg",
    cardCopy: "Panel upgrades, EV-charger installs, and rewire-pricing homeowners fed into your funnel in real time. Real names and emails, $7 per exclusive electrician lead — yours alone.",
    titleTag: "Exclusive Electrical Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing a panel upgrade, EV charger, or rewire on your site — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "electrician leads, electrical leads, panel upgrade leads, EV charger install leads",
    aeoAnswer: "Electricians get exclusive leads with Consent Resolve by identifying the homeowners already pricing a panel upgrade, EV charger, or rewire on their site. After they consent, you get a recovered record routed into your funnel while they're ready to buy. Leads are yours alone for $7.",
    heroH1: "Exclusive electrical leads — yours alone, never resold.",
    heroSubhead: "Electrical work gets researched before it gets booked. See who's pricing a panel upgrade or EV charger on your site, recover the bounce when they consent, and let your retargeting and email keep you in front of them while it's top of mind.",
    problem: "A homeowner pricing a panel upgrade is ready to buy — they just haven't picked a shop. They read your site, leave, and book whoever stays in front of them.",
    urgencyLine: "A homeowner pricing a panel upgrade is ready to buy now.",
    math: { avgJobValue: 2000, closeRatePct: 30, competitorCpl: 51 },
    cardKeys: ["why-shopping", "crm", "yours-alone"],
    faqs: [
      { q: "Are these leads ready to buy?", a: "They were on your site pricing the work. Your funnel keeps you in front of them while it's still top of mind." },
      { q: "Will I know if it's a panel job or a small fix?", a: "Yes — you see what they were shopping for." },
      { q: "What does it cost?", a: "Flat $7 a lead, no contract. Card required, cancel anytime." },
    ],
    finalCtaH2: "Your next panel job is already pricing it on your site.",
  },
  {
    slug: "roofing",
    name: "Roofers",
    shortName: "Roofing",
    iconKey: "IconHome",
    illustration: "/illustrations/trades/08-roofing.svg",
    cardCopy: "Homeowners pricing a re-roof, storm damage, or leak repair on your site — captured before any competitor knows they exist. One signed re-roof pays for a year of $7 exclusive roofing leads.",
    titleTag: "Exclusive Roofing Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing a new roof, storm damage, or leak repair on your site — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "roofing leads, roof replacement leads, storm damage roofing leads, roofer lead generation",
    aeoAnswer: "Roofers get exclusive leads with Consent Resolve by identifying the homeowners already pricing a roof on their site. After they consent, the recovered record feeds your retargeting and email so you stay in front of them — not the storm chasers. Leads are exclusive — yours alone — for $7.",
    heroH1: "Exclusive roofing leads — yours alone, never resold.",
    heroSubhead: "After a storm, the roofer the homeowner remembers wins the call. See who's pricing a new roof or storm repair in your area, recover the bounce when they consent, and stay in front of them through your retargeting until they're ready to dial.",
    problem: "A roof is one of the biggest checks a homeowner ever writes, and they shop it online. They visit your site, leave, and go with whoever stayed in front of them — often a chaser from out of town.",
    urgencyLine: "Storm season — every recovered visitor is one your competitor didn't get.",
    math: { avgJobValue: 9500, closeRatePct: 25, competitorCpl: 78 },
    cardKeys: ["came-back", "mapped-zip", "yours-alone"],
    faqs: [
      { q: "Do these work for storm and insurance jobs?", a: "Yes. You see who's pricing roof repairs right after a storm, and your retargeting and email keep you in front of them until they call — so you're not racing the chasers on the phone." },
      { q: "How do I beat out-of-town storm chasers?", a: "Stay in front of the homeowner. The recovered visitor drops into your retargeting and CRM, so they keep seeing you long after the chaser packs up the parking lot." },
      { q: "What's the cost?", a: "Flat $7 a lead — one re-roof pays for a year of leads. Card required, cancel anytime." },
    ],
    finalCtaH2: "Your next roof is already shopping your site.",
  },
  {
    slug: "painter",
    name: "Painters",
    shortName: "Painting",
    iconKey: "IconPaint",
    illustration: "/illustrations/trades/09-painter.svg",
    cardCopy: "Interior and exterior paint-job shoppers — identified at consent and handed to you with name, consented email, and exactly what they're pricing. Flat $7 per exclusive painter lead, never auctioned.",
    titleTag: "Exclusive Painting Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing an interior or exterior paint job on your site — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "painting leads, painter leads, house painting leads, painting lead generation",
    aeoAnswer: "Painters get exclusive leads with Consent Resolve by identifying the homeowners already pricing an interior or exterior job on their site. After they consent, you get a recovered record routed into your funnel and schedule the estimate. Leads are yours alone for $7.",
    heroH1: "Exclusive painting leads — yours alone, never resold.",
    heroSubhead: "Paint jobs are won at the estimate. See who's pricing interior or exterior work on your site, recover the bounce when they consent, and stay in front of them through retargeting and email until they book the walkthrough with you.",
    problem: "Homeowners gather two or three paint quotes and pick fast. They browse your site, leave without calling, and the painter who books the estimate first usually gets the job.",
    urgencyLine: "Paint jobs are won at the estimate.",
    math: { avgJobValue: 3500, closeRatePct: 28, competitorCpl: 39 },
    cardKeys: ["why-shopping", "on-phone-five", "yours-alone"],
    faqs: [
      { q: "How do painters get more estimate requests?", a: "You identify the homeowners already pricing a job on your site. When they consent, the recovered contact feeds your funnel so you stay in front of them and book the walkthrough." },
      { q: "Will I know if it's interior or exterior?", a: "Yes — you see what they were shopping for." },
      { q: "Are leads shared with other painters?", a: "Never. Each one is yours alone." },
    ],
    finalCtaH2: "Your next paint job is already getting priced on your site.",
  },
  {
    slug: "deck-fence",
    name: "Deck & Fence Builders",
    shortName: "Deck & Fence",
    iconKey: "IconFence",
    illustration: "/illustrations/trades/10-deck-fence.svg",
    cardCopy: "Deck-build, fence-replace, and pergola shoppers captured the moment they consent. Real names, real budgets, $7 per exclusive deck and fence lead — never blasted to four other crews.",
    titleTag: "Exclusive Deck & Fence Leads | Consent Resolve",
    metaDescription: "See the homeowners pricing a new deck or fence on your site — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "deck building leads, fence installation leads, deck and fence leads, contractor lead generation",
    aeoAnswer: "Deck and fence builders get exclusive leads with Consent Resolve by identifying the homeowners already pricing a build on their site. After they consent, you get a recovered record routed into your funnel and quote. Leads are yours alone for $7.",
    heroH1: "Exclusive deck and fence leads — yours alone.",
    heroSubhead: "Deck and fence projects are seasonal and quote-driven. See who's pricing a build on your site, recover the bounce when they consent, and let your funnel keep you in front of them so you land the bid before the season fills up.",
    problem: "Spring hits and everyone wants a deck or fence at once. Homeowners compare a few builders and book early. The one who quotes first tends to win — and lock up the calendar.",
    urgencyLine: "Spring hits and everyone wants one at once.",
    math: { avgJobValue: 6000, closeRatePct: 25, competitorCpl: 42 },
    cardKeys: ["why-shopping", "came-back", "yours-alone"],
    faqs: [
      { q: "How do deck and fence builders get leads in the busy season?", a: "You identify the homeowners already pricing a build on your site and stay in front of them through your funnel, so you land the bid while your calendar still has room." },
      { q: "Will I know the project type?", a: "Yes — you see what they were shopping for before you call." },
      { q: "What's the cost?", a: "Flat $7 a lead — one deck covers a full season of leads. Card required, cancel anytime." },
    ],
    finalCtaH2: "Your next build is already being priced on your site.",
  },
  {
    slug: "garage-door",
    name: "Garage Door Repair",
    shortName: "Garage Doors",
    iconKey: "IconGarage",
    illustration: "/illustrations/trades/11-garage-door.svg",
    cardCopy: "Broken-spring, opener-replace, and new-door shoppers identified the second they consent on your site. Flat $7 per exclusive garage-door lead — yours alone, never resold to the shop down the road.",
    titleTag: "Exclusive Garage Door Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for a broken spring, opener, or new door — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "garage door leads, garage door repair leads, garage door opener leads, garage door lead generation",
    aeoAnswer: "Garage door companies get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for a repair or new door. After they consent, you get a recovered record routed into your funnel fast. Leads are yours alone for $7.",
    heroH1: "Exclusive garage door leads — yours alone, never resold.",
    heroSubhead: "A broken spring means a car trapped in the garage — that's a same-day call. See who's shopping your site for a repair or new door, recover the bounce when they consent, and let your funnel keep you the name they call first.",
    problem: "A jammed door or snapped spring is urgent and easy to price online. The homeowner checks your site, doesn't call, and books the next company that stayed in front of them.",
    urgencyLine: "A jammed door is a same-day call.",
    math: { avgJobValue: 650, closeRatePct: 35, competitorCpl: 42 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do garage door companies get same-day jobs?", a: "You identify the homeowners already on your site — your alert fires in seconds and your funnel keeps you in front of them while the door's still stuck." },
      { q: "Repair or replacement — will I know?", a: "Yes, you see what they were shopping for." },
      { q: "Are these leads exclusive?", a: "Yes — yours alone, never resold." },
    ],
    finalCtaH2: "A stuck door is on your site right now looking for help.",
  },
  {
    slug: "appliance-repair",
    name: "Appliance Repair",
    shortName: "Appliance Repair",
    iconKey: "IconFridge",
    illustration: "/illustrations/trades/12-appliance-repair.svg",
    cardCopy: "Fridge, washer, dryer, and oven-repair homeowners shopping your service area — fed into your funnel the moment they consent. $7 per exclusive appliance-repair lead, never shared.",
    titleTag: "Exclusive Appliance Repair Leads | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for a fridge, washer, or oven repair — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "appliance repair leads, refrigerator repair leads, washer repair leads, appliance lead generation",
    aeoAnswer: "Appliance repair techs get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for a fix. After they consent, you get a recovered record routed into your funnel and schedule the visit. Leads are yours alone for $7.",
    heroH1: "Exclusive appliance repair leads — yours alone.",
    heroSubhead: "A dead fridge is a today problem with food on the line. See who's shopping your site for a repair, recover the bounce when they consent, and let your retargeting + email funnel be the shop they call before they keep searching.",
    problem: "When an appliance quits, the homeowner searches, peeks at a site, and calls the next tech. The shop they remember books the diagnostic.",
    urgencyLine: "A dead fridge is a today problem with food on the line.",
    math: { avgJobValue: 250, closeRatePct: 40, competitorCpl: 24 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do appliance repair techs get more local calls?", a: "You identify the homeowners already on your site and stay in front of them through your funnel, before they book someone else." },
      { q: "Will I know which appliance?", a: "Yes — you see what they were shopping for, so you bring the right parts." },
      { q: "What's the cost?", a: "Flat $7 a lead — one repair covers a week of them. Card required, cancel anytime." },
    ],
    finalCtaH2: "A dead appliance is on your site right now.",
  },
  {
    slug: "house-cleaning",
    name: "House Cleaners",
    shortName: "House Cleaning",
    iconKey: "IconSparkles",
    illustration: "/illustrations/trades/13-house-cleaning.svg",
    cardCopy: "Recurring-clean, deep-clean, and move-out shoppers identified the moment they say yes on your site. $7 per exclusive cleaning lead — never auctioned to four other crews racing for the same job.",
    titleTag: "Exclusive House Cleaning Leads | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for a recurring clean, deep clean, or move-out — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "house cleaning leads, maid service leads, recurring cleaning leads, cleaning lead generation",
    aeoAnswer: "House cleaning businesses get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for a clean. After they consent, you get a recovered record routed into your funnel and book. Leads are yours alone for $7 — and a recurring client is worth them many times over.",
    heroH1: "Exclusive house cleaning leads — yours alone, never resold.",
    heroSubhead: "One recurring client is months of revenue. See who's shopping your site for a clean, recover the bounce when they consent, and let your retargeting + email funnel land them with you, not the next service they search.",
    problem: "Homeowners shopping for a cleaner compare a few sites and pick fast on trust and response time. Most leave without a name — and the service that follows up first earns the recurring spot.",
    urgencyLine: "First reply earns the recurring spot.",
    math: { avgJobValue: 180, closeRatePct: 35, competitorCpl: 17 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do cleaning companies get recurring clients?", a: "You identify the homeowners already shopping your site and stay in front of them through your funnel — recurring clients usually go to the service that stays top of mind." },
      { q: "Will I know if it's recurring or one-time?", a: "Yes — you see what they were shopping for." },
      { q: "Are leads shared with other cleaners?", a: "Never. Each one is yours alone." },
    ],
    finalCtaH2: "Your next recurring client is shopping your site today.",
  },
  {
    slug: "pest-control",
    name: "Pest Control",
    shortName: "Pest Control",
    iconKey: "IconBug",
    illustration: "/illustrations/trades/14-pest-control.svg",
    cardCopy: "Termite, rodent, and recurring-treatment shoppers captured at consent on your site. One signed quarterly contract pays for months of $7 exclusive pest-control leads — yours alone.",
    titleTag: "Exclusive Pest Control Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for pest, termite, or rodent control — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "pest control leads, exterminator leads, termite treatment leads, pest control lead generation",
    aeoAnswer: "Pest control companies get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for treatment. After they consent, you get a recovered record routed into your funnel. Leads are yours alone for $7 — and many turn into recurring service plans.",
    heroH1: "Exclusive pest control leads — yours alone.",
    heroSubhead: "An infestation is an urgent, \"make it stop today\" problem. See who's shopping your site for treatment, recover the bounce when they consent, and stay in front of them through your retargeting and email so they call you, not another company.",
    problem: "Bugs or rodents send a homeowner searching fast. They scan a site, don't call, and book the company they remember — often onto a recurring plan worth far more than one visit.",
    urgencyLine: "Bugs and rodents are a \"make it stop today\" problem.",
    math: { avgJobValue: 250, closeRatePct: 35, competitorCpl: 32 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do pest control companies get more local jobs?", a: "You identify the homeowners already shopping your site and stay in front of them through your funnel, while the problem's still driving them crazy." },
      { q: "Will I know the pest type?", a: "Yes — you see what they were shopping for, so you call prepared." },
      { q: "What's the cost?", a: "Flat $7 a lead — one recurring plan pays for many. Card required, cancel anytime." },
    ],
    finalCtaH2: "Someone's fighting an infestation on your site right now.",
  },
  {
    slug: "power-washing",
    name: "Power Washing",
    shortName: "Power Washing",
    iconKey: "IconSpray",
    illustration: "/illustrations/trades/15-power-washing.svg",
    cardCopy: "Driveway, house-wash, deck, and soft-wash-roof shoppers — recovered at consent and dropped into your funnel. $7 per recovered power-washing lead, with a verified service-area pin baked in.",
    titleTag: "Exclusive Power Washing Leads | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for driveway, house, or deck washing — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "power washing leads, pressure washing leads, exterior cleaning leads, power washing lead generation",
    aeoAnswer: "Power washing businesses get exclusive leads with Consent Resolve by identifying the homeowners already pricing a wash on their site. After they consent, you get a recovered record routed into your funnel and quote. Leads are yours alone for $7.",
    heroH1: "Exclusive power washing leads — yours alone, never resold.",
    heroSubhead: "Curb-appeal jobs are easy to say yes to and easy to book. See who's pricing a driveway or house wash on your site, recover the bounce when they consent, and let your funnel keep you in front of them so they come back to you for the quote.",
    problem: "Power washing is a quick decision — homeowners see a dirty driveway, search, and want it gone. They browse your site, leave, and book whoever quotes first.",
    urgencyLine: "Quick decisions go to whoever quotes first.",
    math: { avgJobValue: 350, closeRatePct: 35, competitorCpl: 25 },
    cardKeys: ["on-phone-five", "mapped-zip", "yours-alone"],
    faqs: [
      { q: "How do power washing businesses get more jobs?", a: "You identify the homeowners already pricing a wash on your site and stay in front of them through your funnel, before they book another crew." },
      { q: "Can I group jobs by area?", a: "Yes — every lead drops a pin, so you can route nearby jobs together." },
      { q: "Are these leads exclusive?", a: "Yes. Yours alone, never resold." },
    ],
    finalCtaH2: "Your next wash is already getting priced on your site.",
  },
  {
    slug: "lawn-care",
    name: "Lawn Care",
    shortName: "Lawn Care",
    iconKey: "IconPlant",
    illustration: "/illustrations/trades/16-lawn-care.svg",
    cardCopy: "Mowing, treatment, and landscape-pricing homeowners fed into your funnel in real time. $7 per exclusive lawn-care lead — yours alone for the season, never sold to the next outfit.",
    titleTag: "Exclusive Lawn Care Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for mowing, treatment, or landscaping — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "lawn care leads, lawn mowing leads, landscaping leads, lawn care lead generation",
    aeoAnswer: "Lawn care companies get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for mowing or treatment. After they consent, you get a recovered record routed into your funnel. Leads are yours alone for $7 — and recurring routes make each one worth far more.",
    heroH1: "Exclusive lawn care leads — yours alone.",
    heroSubhead: "A recurring mowing client is revenue all season. See who's shopping your site for lawn care, recover the bounce when they consent, and let your retargeting and email funnel lock them onto your route — not the next crew they call.",
    problem: "Lawn care lives on recurring routes, and homeowners pick a crew early in the season. They browse your site, don't call, and sign with whoever follows up first.",
    urgencyLine: "Recurring routes go to whoever signs them up early.",
    math: { avgJobValue: 200, closeRatePct: 35, competitorCpl: 19 },
    cardKeys: ["mapped-zip", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do lawn care companies get recurring customers?", a: "You identify the homeowners already shopping your site and stay in front of them through your funnel — recurring routes go to whoever stays top of mind." },
      { q: "Can I keep my route tight?", a: "Yes — every lead is mapped, so you can build by neighborhood." },
      { q: "What's the cost?", a: "Flat $7 a lead — one season of one client covers a lot of leads. Card required, cancel anytime." },
    ],
    finalCtaH2: "Your next route stop is shopping your site today.",
  },
  {
    slug: "mobile-car-service",
    name: "Mobile Car Services",
    shortName: "Mobile Auto",
    iconKey: "IconCar",
    illustration: "/illustrations/trades/17-mobile-car-service.svg",
    cardCopy: "Mobile-detail, on-site oil-change, and roadside-repair shoppers — captured the moment they consent on your site. $7 per exclusive mobile-car-service lead, with name, consented email, and service area.",
    titleTag: "Exclusive Mobile Mechanic & Detail Leads | Consent Resolve",
    metaDescription: "See the drivers shopping your site for mobile repair or detailing — only after they consent. Real names and emails, yours alone. Flat $7 a lead, no contract.",
    keywords: "mobile mechanic leads, mobile detailing leads, mobile car service leads, auto service lead generation",
    aeoAnswer: "Mobile car services get exclusive leads with Consent Resolve by identifying the drivers already shopping their site for at-home repair or detailing. After they consent, you get a recovered record routed into your funnel and schedule. Leads are yours alone for $7.",
    heroH1: "Exclusive mobile car service leads — yours alone, never resold.",
    heroSubhead: "Your whole pitch is convenience — you come to them. See who's shopping your site for mobile repair or detailing, recover the bounce when they consent, and let your funnel keep you in front of them so they book the driveway visit with you.",
    problem: "Drivers who want service at home compare a couple of options and book on convenience and speed. They check your site, leave, and schedule with whoever stayed in front of them.",
    urgencyLine: "Drivers book whoever stayed in front of them.",
    math: { avgJobValue: 250, closeRatePct: 35, competitorCpl: 24 },
    cardKeys: ["mapped-zip", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do mobile mechanics and detailers get more bookings?", a: "You identify the drivers already shopping your site and stay in front of them through your funnel, while they're still deciding." },
      { q: "Repair or detail — will I know?", a: "Yes, you see what they were shopping for before you call." },
      { q: "Are these leads exclusive?", a: "Yes — yours alone, never resold." },
    ],
    finalCtaH2: "A driver wants service in their driveway and they're on your site now.",
  },
];

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}
