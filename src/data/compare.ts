/**
 * Compare-page data spine — feeds /compare/ hub and /compare/[platform]/.
 * Voice/facts: /docs/voice.md. LSA is a complement, never a competitor.
 */

export type CompareType = "reseller" | "complement";

export interface CompareTableRow {
  feature: string;
  us: string;
  them: string;
}

export interface CompareFaq {
  q: string;
  a: string;
}

export interface ComparePage {
  slug: string;                   // e.g. "thumbtack"
  brand: string;                  // "Thumbtack"
  brandColor: string;             // logo color
  type: CompareType;
  // SEO
  titleTag: string;
  metaDescription: string;
  // Hero
  eyebrow: string;
  h1: string;
  subhead: string;
  // Reseller-only blocks
  goodAt?: string[];              // "What they're good at" honest list
  costsYou?: string[];            // "Where it costs you" list
  cpl?: string;                   // "~$46 a lead (range $25–$75)"
  comparisonRows?: CompareTableRow[];
  // Complement-only blocks
  goodAtBlock?: { title: string; body: string };
  weAddBlock?: { title: string; body: string };
  howTheyFit?: string[];
  // Final CTA
  finalCtaH2: string;
  finalCtaBody: string;
}

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: "thumbtack",
    brand: "Thumbtack",
    brandColor: "#04b760",
    type: "reseller",
    titleTag: "Consent Resolve vs Thumbtack | Exclusive Leads at $7 vs ~$46 Shared",
    metaDescription: "Honest head-to-head: $7 exclusive leads vs ~$46 leads sold to 4–5 other shops. You get a real homeowner with a real phone, not a billable 'no thanks' reply.",
    eyebrow: "Consent Resolve vs Thumbtack",
    h1: "Consent Resolve vs Thumbtack: exclusive leads vs the same lead sold five times.",
    subhead: "Both get you leads. Only one keeps them yours. Here's the honest difference.",
    goodAt: [
      "Big lead volume, fast.",
      "Quick to set up and a solid mobile app.",
      "Useful if you want to fill a slow week with whatever comes in.",
    ],
    costsYou: [
      "You pay for the contact, not the job — you can be billed when a homeowner just replies, even 'no thanks.'",
      "Same lead goes to 4–5 other pros — you're racing them.",
      "Tire-kickers, ghosts, and fake numbers count. Refund requests are often auto-denied.",
      "Typical loaded cost runs about $46 a lead (range ~$25–$75 most trades) — and it's still shared.",
    ],
    cpl: "~$46 a lead (range $25–$75 most trades)",
    comparisonRows: [
      { feature: "Lead exclusivity",                us: "Yours alone, never resold",  them: "Sold to 4–5 shops" },
      { feature: "Average cost per lead",           us: "$7",                          them: "~$46 (range $25–$75)" },
      { feature: "Billed for a 'no thanks' reply",  us: "No",                          them: "Yes" },
      { feature: "Real name + mobile",              us: "Always",                      them: "Varies" },
      { feature: "Refund process",                  us: "Credits for unreachable lines", them: "Frequently auto-denied" },
      { feature: "You own the relationship",        us: "Yes",                         them: "Through Thumbtack" },
      { feature: "Compliant by default",            us: "Yes (consent-first)",         them: "N/A" },
    ],
    finalCtaH2: "Stop paying to race four other shops.",
    finalCtaBody: "At $7 a lead, every one is yours alone. Try it and see the difference for the cost of lunch.",
  },
  {
    slug: "angi",
    brand: "Angi",
    brandColor: "#a3151c",
    type: "reseller",
    titleTag: "Consent Resolve vs Angi | $7 Exclusive vs ~$50 Shared 3–8 Ways",
    metaDescription: "Angi has the name recognition. But the lead you buy gets sold to 3–8 pros and ~30–50% of bad-lead disputes get denied. $7, exclusive, never resold.",
    eyebrow: "Consent Resolve vs Angi",
    h1: "Consent Resolve vs Angi: one lead for you, or one lead for everyone.",
    subhead: "Angi has the name recognition. But the lead you buy isn't only yours. Here's the honest difference.",
    goodAt: [
      "A brand homeowners already know.",
      "A vetted-pro program and wide trade coverage.",
      "Helpful if you want reach without building your own traffic.",
    ],
    costsYou: [
      "Same lead resold to 3–8 pros — you're racing them all to respond first.",
      "Bad-lead dispute credits denied roughly 30–50% of the time.",
      "Auto-renew contracts with 30–35% cancellation penalties.",
      "Typical loaded cost about $50 a lead (range ~$15–$100+ by trade) — still shared.",
    ],
    cpl: "~$50 a lead (range $15–$100+ by trade)",
    comparisonRows: [
      { feature: "Lead exclusivity",                us: "Yours alone, never resold",  them: "Shared with 3–8 pros" },
      { feature: "Average cost per lead",           us: "$7",                          them: "~$50 (range $15–$100+)" },
      { feature: "Real name + mobile",              us: "Always",                      them: "Varies" },
      { feature: "Bad-lead dispute denial rate",    us: "Credits issued for unreachable lines", them: "~30–50% denied" },
      { feature: "Contract",                        us: "No contract, cancel anytime", them: "Auto-renew, 30–35% cancel penalty" },
      { feature: "You own the relationship",        us: "Yes",                         them: "Through Angi" },
      { feature: "Compliant by default",            us: "Yes (consent-first)",         them: "N/A" },
    ],
    finalCtaH2: "Keep the lead. Keep the relationship.",
    finalCtaBody: "At $7 a lead, not one gets sold to the shop down the road. No contract, no cancellation penalty.",
  },
  {
    slug: "homeadvisor",
    brand: "HomeAdvisor",
    brandColor: "#f48120",
    type: "reseller",
    titleTag: "Consent Resolve vs HomeAdvisor | $7 Exclusive vs Shared Leads",
    metaDescription: "HomeAdvisor (now owned by Angi) sends the same homeowner to several pros and denies most dispute credits. $7 exclusive, never resold.",
    eyebrow: "Consent Resolve vs HomeAdvisor",
    h1: "Consent Resolve vs HomeAdvisor: a lead you own vs a lead you share.",
    subhead: "HomeAdvisor (now owned by Angi) sends volume — and sends the same homeowner to your competitors. Here's the honest difference.",
    goodAt: [
      "A large network and instant lead matching.",
      "Broad category coverage across the trades.",
      "Useful if you want a firehose and don't mind the spray.",
    ],
    costsYou: [
      "Same lead resold to 3–8 pros at once — race to respond or lose it.",
      "Bad-lead dispute credits denied ~30–50% of the time.",
      "Auto-renew contracts with 30–35% cancellation penalties.",
      "Typical loaded cost about $50 a lead (range ~$15–$100+ by trade).",
    ],
    cpl: "~$50 a lead (range $15–$100+ by trade)",
    comparisonRows: [
      { feature: "Lead exclusivity",                us: "Yours alone, never resold",  them: "Shared with 3–8 pros" },
      { feature: "Average cost per lead",           us: "$7",                          them: "~$50 (range $15–$100+)" },
      { feature: "Real name + mobile",              us: "Always",                      them: "Varies" },
      { feature: "Bad-lead dispute denial rate",    us: "Credits issued for unreachable lines", them: "~30–50% denied" },
      { feature: "Contract",                        us: "No contract, cancel anytime", them: "Auto-renew, 30–35% cancel penalty" },
      { feature: "You own the relationship",        us: "Yes",                         them: "Through HomeAdvisor" },
      { feature: "Compliant by default",            us: "Yes (consent-first)",         them: "N/A" },
    ],
    finalCtaH2: "Pay for leads that are actually yours.",
    finalCtaBody: "$7 a lead — exclusive, real, no contract, no cancellation penalty. See for yourself.",
  },
  {
    slug: "google-local-service-ads",
    brand: "Google LSA",
    brandColor: "#1a73e8",
    type: "complement",
    titleTag: "Consent Resolve + Google LSA | Keep the Calls, Catch the Rest",
    metaDescription: "LSA is great at one thing — calls from people ready to dial. Consent Resolve catches the homeowners who clicked, looked, and left. Run both.",
    eyebrow: "Consent Resolve + Google LSA",
    h1: "Consent Resolve + Google LSA: keep the calls, catch the rest.",
    subhead: "LSA is great at one thing — calls from people ready to dial. But plenty of homeowners click your ad, look around your site, and leave without calling. Consent Resolve hands you those names. Run both.",
    goodAtBlock: {
      title: "What Google LSA does well.",
      body: "Puts you at the top of search with the Google Verified badge and sends calls from homeowners ready to talk. ~44% of those calls book a job, blended cost around $53. Keep running it.",
    },
    weAddBlock: {
      title: "What Consent Resolve adds.",
      body: "Catches the homeowners who clicked, visited your site, and left without calling. When they consent, you get their name and number — so you can reach out instead of losing them. And in 2025 Google killed credits for 'wrong-job-type' or 'out-of-area' leads on LSA, so Consent Resolve is the safety net for the ones LSA never connects you with.",
    },
    howTheyFit: [
      "LSA gets the homeowner to your site or on the phone.",
      "Consent Resolve reveals the ones who visited but didn't call.",
      "You follow up on both. More of the traffic you already pay for turns into booked jobs.",
    ],
    finalCtaH2: "Don't replace LSA. Finish the job it starts.",
    finalCtaBody: "Keep your LSA running. Add Consent Resolve for $10 (your first 10 leads) and catch the homeowners LSA never connected you with.",
  },
];

export function getCompare(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((c) => c.slug === slug);
}
