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
  cpl?: string;                   // "~$48 a lead [CONFIRM CPL]"
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
    titleTag: "Consent Resolve vs Thumbtack | Exclusive Leads vs Shared",
    metaDescription: "Honest head-to-head: exclusive leads at $7 vs the same lead sold to four other shops. 10 leads for $10 to start.",
    eyebrow: "Consent Resolve vs Thumbtack",
    h1: "Consent Resolve vs Thumbtack: exclusive leads vs the same lead sold five times.",
    subhead: "Both get you leads. Only one keeps them yours. Here's the honest difference.",
    goodAt: [
      "Big lead volume, fast.",
      "Quick to set up and a solid mobile app.",
      "Useful if you want to fill a slow week with whatever comes in.",
    ],
    costsYou: [
      "The same lead gets sold to 4–6 shops — you're paying to race four other pros.",
      "You can get billed for tire-kickers who were never going to book.",
      "Average cost runs around $48 a lead [CONFIRM CPL] — and it's still shared.",
    ],
    cpl: "~$48 a lead [CONFIRM CPL]",
    comparisonRows: [
      { feature: "Lead exclusivity",           us: "Yours alone, never resold", them: "Sold to 4–6 shops" },
      { feature: "Cost per lead",              us: "$7",                        them: "~$48 [CONFIRM CPL]" },
      { feature: "Real name + mobile",         us: "Yes",                       them: "Varies" },
      { feature: "You own the relationship",   us: "Yes",                       them: "Through Thumbtack" },
      { feature: "Compliant by default",       us: "Yes (consent-first)",       them: "N/A" },
      { feature: "To start",                   us: "10 leads for $10",          them: "Per-lead billing" },
    ],
    finalCtaH2: "Stop paying to race four other shops.",
    finalCtaBody: "Your first 10 leads are just $10, and every one is yours alone. See the difference for the cost of lunch.",
  },
  {
    slug: "angi",
    brand: "Angi",
    brandColor: "#a3151c",
    type: "reseller",
    titleTag: "Consent Resolve vs Angi | One Lead for You, Not Five",
    metaDescription: "Angi has name recognition. But the lead you buy isn't only yours. Here's the honest difference. $7 a lead, exclusive.",
    eyebrow: "Consent Resolve vs Angi",
    h1: "Consent Resolve vs Angi: one lead for you, or one lead for everyone.",
    subhead: "Angi has the name recognition. But the lead you buy isn't only yours. Here's the honest difference.",
    goodAt: [
      "A brand homeowners already know.",
      "A vetted-pro program and wide trade coverage.",
      "Helpful if you want reach without building your own traffic.",
    ],
    costsYou: [
      "Leads are shared with 5 or more shops.",
      "Sales can be pushy, and folks often find it hard to cancel.",
      "Around $35 a lead [CONFIRM CPL] — still shared.",
    ],
    cpl: "~$35 a lead [CONFIRM CPL]",
    comparisonRows: [
      { feature: "Lead exclusivity",           us: "Yours alone, never resold", them: "Shared with 5+ shops" },
      { feature: "Cost per lead",              us: "$7",                        them: "~$35 [CONFIRM CPL]" },
      { feature: "Real name + mobile",         us: "Yes",                       them: "Varies" },
      { feature: "You own the relationship",   us: "Yes",                       them: "Through Angi" },
      { feature: "Compliant by default",       us: "Yes (consent-first)",       them: "N/A" },
      { feature: "Cancel",                     us: "Anytime, from your dashboard", them: "Often difficult" },
    ],
    finalCtaH2: "Keep the lead. Keep the relationship.",
    finalCtaBody: "Your first 10 leads are just $10, and not one of them gets sold to the shop down the road. Try it.",
  },
  {
    slug: "homeadvisor",
    brand: "HomeAdvisor",
    brandColor: "#f48120",
    type: "reseller",
    titleTag: "Consent Resolve vs HomeAdvisor | Owned vs Shared Leads",
    metaDescription: "HomeAdvisor sends volume. It also sends the same homeowner to your competitors. Exclusive leads at $7, never resold.",
    eyebrow: "Consent Resolve vs HomeAdvisor",
    h1: "Consent Resolve vs HomeAdvisor: a lead you own vs a lead you share.",
    subhead: "HomeAdvisor sends volume. It also sends the same homeowner to your competitors. Here's the honest difference.",
    goodAt: [
      "A large network and instant lead matching.",
      "Broad category coverage across the trades.",
      "Useful if you want a firehose and don't mind the spray.",
    ],
    costsYou: [
      "The same lead goes to several pros at once.",
      "Common complaints about lead quality and being charged for leads that don't convert.",
      "Per-lead pricing varies and adds up [CONFIRM CPL] — and it's still shared.",
    ],
    cpl: "Varies [CONFIRM CPL]",
    comparisonRows: [
      { feature: "Lead exclusivity",           us: "Yours alone, never resold", them: "Shared with several pros" },
      { feature: "Cost per lead",              us: "$7",                        them: "Varies [CONFIRM CPL]" },
      { feature: "Real name + mobile",         us: "Yes",                       them: "Varies" },
      { feature: "You own the relationship",   us: "Yes",                       them: "Through HomeAdvisor" },
      { feature: "Compliant by default",       us: "Yes (consent-first)",       them: "N/A" },
      { feature: "Charged for dead leads",     us: "No",                        them: "Common complaint" },
    ],
    finalCtaH2: "Pay for leads that are actually yours.",
    finalCtaBody: "Your first 10 leads are just $10 — exclusive, real, and yours to keep. See for yourself.",
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
      body: "Puts you at the top of search with the Google Guaranteed badge and sends you calls from homeowners ready to talk. Keep running it.",
    },
    weAddBlock: {
      title: "What Consent Resolve adds.",
      body: "Catches the homeowners who clicked, visited your site, and left without calling. When they consent, you get their name and number — so you can reach out instead of losing them.",
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
