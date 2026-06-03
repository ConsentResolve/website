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
  iconKey: string;              // Tabler icon name, e.g. "IconDroplet"
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
    titleTag: "Exclusive General Contractor Leads | Consent Resolve",
    metaDescription: "Identify the homeowners pricing a remodel or addition on your site — only after they consent. Real names, real numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "general contractor leads, remodeling leads, home addition leads, GC lead generation",
    aeoAnswer: "General contractors get exclusive leads with Consent Resolve by identifying the homeowners already researching a remodel or addition on their website. After the homeowner consents, you get their name and number and call them directly. Each lead is yours alone — never resold — for $7.",
    heroH1: "Exclusive remodeling and addition leads — yours alone.",
    heroSubhead: "Big projects get researched for weeks before a homeowner picks up the phone. See who's pricing a remodel or addition on your site, get their name and number when they consent, and follow up before three other GCs do.",
    problem: "A remodel is a long, careful decision. Homeowners compare bids for weeks and visit your site more than once. Most leave without a name — and the GC who follows up first usually lands the bid.",
    urgencyLine: "The first GC to follow up usually lands the bid.",
    math: { avgJobValue: 25000, closeRatePct: 20, competitorCpl: 144 },
    cardKeys: ["came-back", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do general contractors get exclusive leads?", a: "You identify homeowners already pricing a project on your site. When they consent, you get their name and number — yours alone, never shared." },
      { q: "Will I know what project they want?", a: "Yes. You see what they were shopping for, so you walk into the call already knowing it's a kitchen, a bath, or an addition." },
      { q: "What does it cost?", a: "Your first 10 leads are $10, then $7 a lead — a rounding error against one signed remodel." },
    ],
    finalCtaH2: "Your next remodel is already pricing the job on your site.",
  },
  {
    slug: "handyman",
    name: "Handymen",
    shortName: "Handyman",
    iconKey: "IconTool",
    titleTag: "Exclusive Handyman Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for repairs and to-do lists — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "handyman leads, home repair leads, handyman jobs near me, handyman lead generation",
    aeoAnswer: "Handymen get exclusive leads with Consent Resolve by identifying the homeowners browsing their site for repairs and odd jobs. Once the homeowner consents, you get their name and number to call. Leads are yours alone for $7 — no platform sharing them with five other handymen.",
    heroH1: "Exclusive handyman leads — yours alone, never resold.",
    heroSubhead: "Handyman work runs on volume and speed. See the homeowners shopping your site for a to-do list, get their name and number when they consent, and book the work before they call the next guy.",
    problem: "Most handyman jobs start with a quick search and a website peek. The homeowner doesn't call — they keep scrolling. First handyman to reach out usually fills the slot.",
    urgencyLine: "First handyman to reach out usually fills the slot.",
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
    titleTag: "Exclusive Tree Removal Leads | Consent Resolve",
    metaDescription: "Identify the homeowners pricing tree removal or storm cleanup on your site — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "tree removal leads, tree service leads, storm cleanup leads, arborist lead generation",
    aeoAnswer: "Tree services get exclusive leads with Consent Resolve by identifying the homeowners already pricing a removal or storm cleanup on their site. After they consent, you get their name and number and call first. Leads are exclusive — yours alone — for $7.",
    heroH1: "Exclusive tree removal leads — yours alone.",
    heroSubhead: "A leaning tree or a storm-snapped limb is a \"today\" problem. See who's pricing removal in your area, get their name and number when they consent, and reach out before the cleanup crews roll in.",
    problem: "After a storm, every homeowner with a downed tree is shopping at once — and they call whoever reaches them first. Miss that window and the high-ticket removal goes to another crew.",
    urgencyLine: "After a storm, whoever calls first books the work.",
    math: { avgJobValue: 1200, closeRatePct: 30, competitorCpl: 36 },
    cardKeys: ["on-phone-five", "mapped-zip", "yours-alone"],
    faqs: [
      { q: "How do tree removal companies get more local jobs after a storm?", a: "You see the homeowners pricing removal in your area in real time. When they consent, you get the name and number to call first." },
      { q: "Can I see which neighborhoods are shopping?", a: "Yes. Every lead drops a pin on your service-area map." },
      { q: "What's the cost?", a: "First 10 leads for $10, then $7 each — one big removal covers months of leads." },
    ],
    finalCtaH2: "That downed tree is already being priced on your site.",
  },
  {
    slug: "hvac",
    name: "HVAC & AC",
    shortName: "HVAC",
    iconKey: "IconAirConditioning",
    titleTag: "Exclusive HVAC & AC Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing a new AC, furnace, or no-cool fix on your site — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "HVAC leads, AC repair leads, furnace replacement leads, HVAC lead generation",
    aeoAnswer: "HVAC pros get exclusive leads with Consent Resolve by identifying the homeowners already pricing a system or repair on their site. After they consent, you get their name and number to call while it still matters. Leads are yours alone for $7.",
    heroH1: "Exclusive HVAC & AC leads — yours alone, never resold.",
    heroSubhead: "A hot house turns a \"someday\" homeowner into a \"right now\" buyer. See who's shopping your site for a new AC or a no-cool fix, get their name and number when they consent, and call while they're sweating.",
    problem: "When the AC quits in July, minutes matter. The homeowner checks your site, doesn't call, and dials the next shop. First one on the phone books the install.",
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
    titleTag: "Exclusive Plumbing Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing a water heater, re-pipe, or burst-pipe fix on your site — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "plumbing leads, plumber leads, water heater leads, plumbing lead generation",
    aeoAnswer: "Plumbers get exclusive leads with Consent Resolve by identifying the homeowners already pricing a plumbing job on their site. After they consent, you get their name and number and call before they reach another plumber. Leads are yours alone for $7.",
    heroH1: "Exclusive plumbing leads — yours alone, never resold.",
    heroSubhead: "A burst pipe doesn't wait for a callback. See who's shopping your area for a water heater or a leak fix, get their name and number when they consent, and call before the next plumber does.",
    problem: "Plumbing problems get searched fast and booked fast. The homeowner checks your site, doesn't call, and dials the next name on the list. You never knew they were there.",
    urgencyLine: "A burst pipe doesn't wait for a callback.",
    math: { avgJobValue: 450, closeRatePct: 30, competitorCpl: 57 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "What if it's an emergency, like a burst pipe?", a: "You get the alert in seconds, so you can reach out before they find another plumber." },
      { q: "Will I know what the job is?", a: "Yes — you see what they were shopping for, so you call ready." },
      { q: "How much does it cost?", a: "Your first 10 leads are $10, then $7 a lead — flat." },
    ],
    finalCtaH2: "Your next plumbing job is already shopping your site.",
  },
  {
    slug: "locksmith",
    name: "Locksmiths",
    shortName: "Locksmith",
    iconKey: "IconKey",
    titleTag: "Exclusive Locksmith Leads, Never Resold | Consent Resolve",
    metaDescription: "Identify the homeowners shopping your site for a lockout, rekey, or security upgrade — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "locksmith leads, lockout service leads, rekey leads, locksmith lead generation",
    aeoAnswer: "Locksmiths get exclusive leads with Consent Resolve by identifying the people already on their site for a lockout, rekey, or lock install. Once they consent, you get a name and number to call immediately. Leads are yours alone for $7 — critical when response time decides the job.",
    heroH1: "Exclusive locksmith leads — yours alone.",
    heroSubhead: "A lockout is the definition of \"right now.\" See who's shopping your site for a lockout, rekey, or new locks, get their number when they consent, and be the first locksmith to answer.",
    problem: "Locksmith jobs are won on speed. Someone standing outside a locked door calls the first shop that picks up. If they left your site without calling, you just need a way to reach them first.",
    urgencyLine: "Locksmith jobs are won on speed.",
    math: { avgJobValue: 180, closeRatePct: 45, competitorCpl: 33 },
    cardKeys: ["on-phone-five", "mapped-zip", "yours-alone"],
    faqs: [
      { q: "How do locksmiths get more local calls?", a: "You identify the people already on your site for lock work. When they consent, you get their number and call before another shop does." },
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
    titleTag: "Exclusive Electrical Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing a panel upgrade, EV charger, or rewire on your site — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "electrician leads, electrical leads, panel upgrade leads, EV charger install leads",
    aeoAnswer: "Electricians get exclusive leads with Consent Resolve by identifying the homeowners already pricing a panel upgrade, EV charger, or rewire on their site. After they consent, you get their name and number to call while they're ready to buy. Leads are yours alone for $7.",
    heroH1: "Exclusive electrical leads — yours alone, never resold.",
    heroSubhead: "Electrical work gets researched before it gets booked. See who's pricing a panel upgrade or EV charger on your site, get their name and number when they consent, and follow up while it's top of mind.",
    problem: "A homeowner pricing a panel upgrade is ready to buy — they just haven't picked a shop. They read your site, leave, and book whoever follows up first.",
    urgencyLine: "A homeowner pricing a panel upgrade is ready to buy now.",
    math: { avgJobValue: 2000, closeRatePct: 30, competitorCpl: 51 },
    cardKeys: ["why-shopping", "crm", "yours-alone"],
    faqs: [
      { q: "Are these leads ready to buy?", a: "They were on your site pricing the work. You reach out while it's still top of mind." },
      { q: "Will I know if it's a panel job or a small fix?", a: "Yes — you see what they were shopping for." },
      { q: "What does it cost?", a: "First 10 leads for $10, then $7 a lead — flat." },
    ],
    finalCtaH2: "Your next panel job is already pricing it on your site.",
  },
  {
    slug: "roofing",
    name: "Roofers",
    shortName: "Roofing",
    iconKey: "IconHome",
    titleTag: "Exclusive Roofing Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing a new roof, storm damage, or leak repair on your site — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "roofing leads, roof replacement leads, storm damage roofing leads, roofer lead generation",
    aeoAnswer: "Roofers get exclusive leads with Consent Resolve by identifying the homeowners already pricing a roof on their site. After they consent, you get their name and number and call before the storm chasers. Leads are exclusive — yours alone — for $7.",
    heroH1: "Exclusive roofing leads — yours alone, never resold.",
    heroSubhead: "After a storm, the first roofer to call gets the claim. See who's pricing a new roof or storm repair in your area, get their name and number when they consent, and reach out first.",
    problem: "A roof is one of the biggest checks a homeowner ever writes, and they shop it online. They visit your site, leave, and go with whoever follows up first — often a chaser from out of town.",
    urgencyLine: "After a storm, the first roofer to call gets the claim.",
    math: { avgJobValue: 9500, closeRatePct: 25, competitorCpl: 78 },
    cardKeys: ["came-back", "mapped-zip", "yours-alone"],
    faqs: [
      { q: "Do these work for storm and insurance jobs?", a: "Yes. You see who's pricing roof repairs right after a storm and reach out first." },
      { q: "How do I beat out-of-town storm chasers?", a: "Speed. You get the local lead in seconds and call before they're set up in a parking lot." },
      { q: "What's the cost?", a: "First 10 leads for $10, then $7 — one re-roof pays for a year of leads." },
    ],
    finalCtaH2: "Your next roof is already shopping your site.",
  },
  {
    slug: "painter",
    name: "Painters",
    shortName: "Painting",
    iconKey: "IconPaint",
    titleTag: "Exclusive Painting Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners pricing an interior or exterior paint job on your site — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "painting leads, painter leads, house painting leads, painting lead generation",
    aeoAnswer: "Painters get exclusive leads with Consent Resolve by identifying the homeowners already pricing an interior or exterior job on their site. After they consent, you get their name and number to call and schedule the estimate. Leads are yours alone for $7.",
    heroH1: "Exclusive painting leads — yours alone, never resold.",
    heroSubhead: "Paint jobs are won at the estimate. See who's pricing interior or exterior work on your site, get their name and number when they consent, and book the walkthrough before another crew does.",
    problem: "Homeowners gather two or three paint quotes and pick fast. They browse your site, leave without calling, and the painter who books the estimate first usually gets the job.",
    urgencyLine: "Paint jobs are won at the estimate.",
    math: { avgJobValue: 3500, closeRatePct: 28, competitorCpl: 39 },
    cardKeys: ["why-shopping", "on-phone-five", "yours-alone"],
    faqs: [
      { q: "How do painters get more estimate requests?", a: "You identify the homeowners already pricing a job on your site. When they consent, you get their number and book the walkthrough first." },
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
    titleTag: "Exclusive Deck & Fence Leads | Consent Resolve",
    metaDescription: "See the homeowners pricing a new deck or fence on your site — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "deck building leads, fence installation leads, deck and fence leads, contractor lead generation",
    aeoAnswer: "Deck and fence builders get exclusive leads with Consent Resolve by identifying the homeowners already pricing a build on their site. After they consent, you get their name and number to call and quote. Leads are yours alone for $7.",
    heroH1: "Exclusive deck and fence leads — yours alone.",
    heroSubhead: "Deck and fence projects are seasonal and quote-driven. See who's pricing a build on your site, get their name and number when they consent, and get your bid in before the season fills up.",
    problem: "Spring hits and everyone wants a deck or fence at once. Homeowners compare a few builders and book early. The one who quotes first tends to win — and lock up the calendar.",
    urgencyLine: "Spring hits and everyone wants one at once.",
    math: { avgJobValue: 6000, closeRatePct: 25, competitorCpl: 42 },
    cardKeys: ["why-shopping", "came-back", "yours-alone"],
    faqs: [
      { q: "How do deck and fence builders get leads in the busy season?", a: "You identify the homeowners already pricing a build on your site and reach out first, while your calendar still has room." },
      { q: "Will I know the project type?", a: "Yes — you see what they were shopping for before you call." },
      { q: "What's the cost?", a: "First 10 leads for $10, then $7 each — one deck covers a full season of leads." },
    ],
    finalCtaH2: "Your next build is already being priced on your site.",
  },
  {
    slug: "garage-door",
    name: "Garage Door Repair",
    shortName: "Garage Doors",
    iconKey: "IconGarage",
    titleTag: "Exclusive Garage Door Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for a broken spring, opener, or new door — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "garage door leads, garage door repair leads, garage door opener leads, garage door lead generation",
    aeoAnswer: "Garage door companies get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for a repair or new door. After they consent, you get their name and number to call fast. Leads are yours alone for $7.",
    heroH1: "Exclusive garage door leads — yours alone, never resold.",
    heroSubhead: "A broken spring means a car trapped in the garage — that's a same-day call. See who's shopping your site for a repair or new door, get their number when they consent, and answer first.",
    problem: "A jammed door or snapped spring is urgent and easy to price online. The homeowner checks your site, doesn't call, and books the next company that reaches out.",
    urgencyLine: "A jammed door is a same-day call.",
    math: { avgJobValue: 650, closeRatePct: 35, competitorCpl: 42 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do garage door companies get same-day jobs?", a: "You identify the homeowners already on your site and reach out in seconds, while the door's still stuck." },
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
    titleTag: "Exclusive Appliance Repair Leads | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for a fridge, washer, or oven repair — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "appliance repair leads, refrigerator repair leads, washer repair leads, appliance lead generation",
    aeoAnswer: "Appliance repair techs get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for a fix. After they consent, you get their name and number to call and schedule the visit. Leads are yours alone for $7.",
    heroH1: "Exclusive appliance repair leads — yours alone.",
    heroSubhead: "A dead fridge is a today problem with food on the line. See who's shopping your site for a repair, get their name and number when they consent, and book the service call before they keep searching.",
    problem: "When an appliance quits, the homeowner searches, peeks at a site, and calls the next tech. The one who reaches out first books the diagnostic.",
    urgencyLine: "A dead fridge is a today problem with food on the line.",
    math: { avgJobValue: 250, closeRatePct: 40, competitorCpl: 24 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do appliance repair techs get more local calls?", a: "You identify the homeowners already on your site and reach out fast, before they book someone else." },
      { q: "Will I know which appliance?", a: "Yes — you see what they were shopping for, so you bring the right parts." },
      { q: "What's the cost?", a: "First 10 leads for $10, then $7 a lead — one repair covers a week of them." },
    ],
    finalCtaH2: "A dead appliance is on your site right now.",
  },
  {
    slug: "house-cleaning",
    name: "House Cleaners",
    shortName: "House Cleaning",
    iconKey: "IconSparkles",
    titleTag: "Exclusive House Cleaning Leads | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for a recurring clean, deep clean, or move-out — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "house cleaning leads, maid service leads, recurring cleaning leads, cleaning lead generation",
    aeoAnswer: "House cleaning businesses get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for a clean. After they consent, you get their name and number to call and book. Leads are yours alone for $7 — and a recurring client is worth them many times over.",
    heroH1: "Exclusive house cleaning leads — yours alone, never resold.",
    heroSubhead: "One recurring client is months of revenue. See who's shopping your site for a clean, get their name and number when they consent, and book them before another service replies.",
    problem: "Homeowners shopping for a cleaner compare a few sites and pick fast on trust and response time. Most leave without a name — and the service that follows up first earns the recurring spot.",
    urgencyLine: "First reply earns the recurring spot.",
    math: { avgJobValue: 180, closeRatePct: 35, competitorCpl: 17 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do cleaning companies get recurring clients?", a: "You identify the homeowners already shopping your site and reach out first — recurring clients usually go to the service that responds fastest." },
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
    titleTag: "Exclusive Pest Control Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for pest, termite, or rodent control — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "pest control leads, exterminator leads, termite treatment leads, pest control lead generation",
    aeoAnswer: "Pest control companies get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for treatment. After they consent, you get their name and number to call. Leads are yours alone for $7 — and many turn into recurring service plans.",
    heroH1: "Exclusive pest control leads — yours alone.",
    heroSubhead: "An infestation is an urgent, \"make it stop today\" problem. See who's shopping your site for treatment, get their name and number when they consent, and call before they book another company.",
    problem: "Bugs or rodents send a homeowner searching fast. They scan a site, don't call, and book the first company that reaches out — often onto a recurring plan worth far more than one visit.",
    urgencyLine: "Bugs and rodents are a \"make it stop today\" problem.",
    math: { avgJobValue: 250, closeRatePct: 35, competitorCpl: 32 },
    cardKeys: ["on-phone-five", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do pest control companies get more local jobs?", a: "You identify the homeowners already shopping your site and reach out first, while the problem's still driving them crazy." },
      { q: "Will I know the pest type?", a: "Yes — you see what they were shopping for, so you call prepared." },
      { q: "What's the cost?", a: "First 10 leads for $10, then $7 — one recurring plan pays for many." },
    ],
    finalCtaH2: "Someone's fighting an infestation on your site right now.",
  },
  {
    slug: "power-washing",
    name: "Power Washing",
    shortName: "Power Washing",
    iconKey: "IconSpray",
    titleTag: "Exclusive Power Washing Leads | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for driveway, house, or deck washing — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "power washing leads, pressure washing leads, exterior cleaning leads, power washing lead generation",
    aeoAnswer: "Power washing businesses get exclusive leads with Consent Resolve by identifying the homeowners already pricing a wash on their site. After they consent, you get their name and number to call and quote. Leads are yours alone for $7.",
    heroH1: "Exclusive power washing leads — yours alone, never resold.",
    heroSubhead: "Curb-appeal jobs are easy to say yes to and easy to book. See who's pricing a driveway or house wash on your site, get their name and number when they consent, and quote them first.",
    problem: "Power washing is a quick decision — homeowners see a dirty driveway, search, and want it gone. They browse your site, leave, and book whoever quotes first.",
    urgencyLine: "Quick decisions go to whoever quotes first.",
    math: { avgJobValue: 350, closeRatePct: 35, competitorCpl: 25 },
    cardKeys: ["on-phone-five", "mapped-zip", "yours-alone"],
    faqs: [
      { q: "How do power washing businesses get more jobs?", a: "You identify the homeowners already pricing a wash on your site and reach out first, before they book another crew." },
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
    titleTag: "Exclusive Lawn Care Leads, Never Resold | Consent Resolve",
    metaDescription: "See the homeowners shopping your site for mowing, treatment, or landscaping — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "lawn care leads, lawn mowing leads, landscaping leads, lawn care lead generation",
    aeoAnswer: "Lawn care companies get exclusive leads with Consent Resolve by identifying the homeowners already shopping their site for mowing or treatment. After they consent, you get their name and number to call. Leads are yours alone for $7 — and recurring routes make each one worth far more.",
    heroH1: "Exclusive lawn care leads — yours alone.",
    heroSubhead: "A recurring mowing client is revenue all season. See who's shopping your site for lawn care, get their name and number when they consent, and lock in the route before another crew does.",
    problem: "Lawn care lives on recurring routes, and homeowners pick a crew early in the season. They browse your site, don't call, and sign with whoever follows up first.",
    urgencyLine: "Recurring routes go to whoever signs them up early.",
    math: { avgJobValue: 200, closeRatePct: 35, competitorCpl: 19 },
    cardKeys: ["mapped-zip", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do lawn care companies get recurring customers?", a: "You identify the homeowners already shopping your site and reach out first — recurring routes go to whoever signs them up early." },
      { q: "Can I keep my route tight?", a: "Yes — every lead is mapped, so you can build by neighborhood." },
      { q: "What's the cost?", a: "First 10 leads for $10, then $7 — one season of one client covers a lot of leads." },
    ],
    finalCtaH2: "Your next route stop is shopping your site today.",
  },
  {
    slug: "mobile-car-service",
    name: "Mobile Car Services",
    shortName: "Mobile Auto",
    iconKey: "IconCar",
    titleTag: "Exclusive Mobile Mechanic & Detail Leads | Consent Resolve",
    metaDescription: "See the drivers shopping your site for mobile repair or detailing — only after they consent. Real names and numbers, yours alone. $7 a lead. Start for $10.",
    keywords: "mobile mechanic leads, mobile detailing leads, mobile car service leads, auto service lead generation",
    aeoAnswer: "Mobile car services get exclusive leads with Consent Resolve by identifying the drivers already shopping their site for at-home repair or detailing. After they consent, you get their name and number to call and schedule. Leads are yours alone for $7.",
    heroH1: "Exclusive mobile car service leads — yours alone, never resold.",
    heroSubhead: "Your whole pitch is convenience — you come to them. See who's shopping your site for mobile repair or detailing, get their name and number when they consent, and book the driveway visit first.",
    problem: "Drivers who want service at home compare a couple of options and book on convenience and speed. They check your site, leave, and schedule with whoever reaches out first.",
    urgencyLine: "Drivers book whoever reaches them first.",
    math: { avgJobValue: 250, closeRatePct: 35, competitorCpl: 24 },
    cardKeys: ["mapped-zip", "why-shopping", "yours-alone"],
    faqs: [
      { q: "How do mobile mechanics and detailers get more bookings?", a: "You identify the drivers already shopping your site and reach out first, while they're still deciding." },
      { q: "Repair or detail — will I know?", a: "Yes, you see what they were shopping for before you call." },
      { q: "Are these leads exclusive?", a: "Yes — yours alone, never resold." },
    ],
    finalCtaH2: "A driver wants service in their driveway and they're on your site now.",
  },
];

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}
