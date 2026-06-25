/**
 * Compare-page data spine — feeds /compare/ hub and /compare/[platform]/.
 * Voice/facts: /style-guide/voice/ (single source of truth — see src/pages/style-guide/voice.astro).
 *
 * Positioning (changed June 2026): every compare page is now ADDITIVE,
 * never head-to-head. The reader keeps their channel; Consent Resolve
 * sits on top and recovers the ~98 of 100 visitors that channel sent
 * who left without contacting them. Cost-per-booked-job is the math
 * unit, NEVER cost-per-lead — competitor CPL is the anchor, not the
 * target.
 *
 * Math posture (June 2026, LOCKED): NO invented recovery/booked-job rate
 * constants. We do not publish performance claims. Outcomes are stated
 * qualitatively ("recovered visitors are incremental on the same budget").
 * The only hard numbers are the sourced competitor CPL anchors and the
 * flat $7 Consent Resolve cost. Sourced industry data lives on /stats/.
 *
 * Per-trade CPL anchors are LSA cost-per-lead by trade, sourced to
 * HomeServiceDirect (the same ranges shown on /stats/: roofing $50–$95,
 * HVAC $45–$85, plumbing $35–$65, electrical $35–$70) and displayed here
 * as single mid-range points so they never exceed the sourced range.
 * Per-platform blended averages live on each page.
 */

export type CompareType = "reseller" | "complement";

export interface CompareTableRow {
  feature: string;
  with: string;   // with Consent Resolve added on top
  without: string; // channel alone
}

export interface ComparePage {
  slug: string;
  brand: string;
  brandColor: string;
  type: CompareType;
  // SEO
  titleTag: string;
  ogTitle?: string;
  metaDescription: string;
  // Hero
  eyebrow: string;
  h1: string;
  subhead: string;
  /** 40–55-word AEO answer paragraph rendered as a citation-ready band
   *  below the hero. Frames the channel + CR as additive. */
  aeoAnswer: string;
  /** What this channel is good at. Honest, no slight. */
  channelGoodAt: string[];
  /** Where this channel leaks money. The setup for why CR helps —
   *  NOT a "switch to us" pitch. */
  channelLeaks: string[];
  /** Anchor CPL for the channel, displayed in small print and used by
   *  any math copy. Always range-or-blended; never compared 1:1 to $7. */
  channelCpl: string;
  /** Per-trade anchor numbers from the CPL matrix, used by per-page
   *  math callouts. */
  trades: { trade: string; cpl: number }[];
  /** Cost-per-booked-job math — the with/without framing. */
  bookedJobMath: {
    setup: string;       // describes the without-CR baseline
    withCR: string;      // describes the new combined result
    breakEven: string;   // credibility line — "you only need N booked jobs to cover the cost"
  };
  /** Always-required "how CR feeds the funnel" explanation for
   *  mid-evaluation readers. Page MUST render this. */
  funnelExplain: { headline: string; body: string };
  /** Side-by-side WITH/WITHOUT comparison rows (cost-per-booked-job
   *  oriented, never per-lead). */
  withWithoutRows: CompareTableRow[];
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
    titleTag: "More Jobs From Your Thumbtack Spend · Consent Resolve",
    ogTitle: "Keep your Thumbtack spend. Recover the 98% who don't call.",
    metaDescription: "Thumbtack already sends contractors traffic — about 98 of every 100 of them bounce. Recover the bounce with consent, feed it back into your funnel, and book more jobs on the same Thumbtack budget. Flat $7 per recovered lead.",
    eyebrow: "Channel ROI · Thumbtack",
    h1: "More booked jobs from the Thumbtack budget you already spend.",
    subhead: "Thumbtack drives visitors to your site. About 98 out of 100 of them leave without contacting you. Consent Resolve recovers the bounce — with consent — and feeds it back into the retargeting, email, and CRM funnels you already run.",
    aeoAnswer: "Thumbtack costs contractors roughly $25–$75 per lead on average (about $46 loaded across most trades). Of the visitors Thumbtack sends to a contractor's website, around 98% leave without contacting them — pure waste on top of the per-lead fee. Consent Resolve recovers those bounced visitors with consent at a flat $7 per recovered lead and feeds them into the contractor's existing funnel, lowering the blended cost per booked job.",
    channelGoodAt: [
      "Volume and speed — fills a slow week.",
      "Mobile dispatch app + quick setup.",
      "Recognized brand homeowners search for directly.",
    ],
    channelLeaks: [
      "98 of 100 visitors Thumbtack sends to your site leave without contacting you.",
      "Same lead pings 4–5 other contractors — most of the spend ends up paying for races you lose.",
      "Loaded cost runs ~$46 per lead before factoring in tire-kickers and denied refunds.",
    ],
    channelCpl: "~$46 average loaded cost per lead (range $25–$75 most trades).",
    trades: [
      { trade: "Roofing",     cpl: 73 },
      { trade: "HVAC",        cpl: 65 },
      { trade: "Plumbing",    cpl: 50 },
      { trade: "Electrician", cpl: 53 },
    ],
    bookedJobMath: {
      setup: "You're already paying Thumbtack to send traffic. Whatever your blended cost per booked job is today on Thumbtack alone, that's the baseline.",
      withCR: "Add Consent Resolve as a recovery layer: the bounced visitors who consent become recovered records at $7 each, and a share of those book a job — set your own assumptions. Same Thumbtack budget — more booked jobs at a lower blended $ per booked job.",
      breakEven: "Recovered visitors are incremental on the same budget — at $7 each, it takes only a handful of booked jobs to cover the recovery cost. We don't publish recovery or close rates; set your own assumptions and see /stats/ for sourced industry data.",
    },
    funnelExplain: {
      headline: "You don't choose between us and Thumbtack.",
      body: "Keep running Thumbtack. Consent Resolve sits on top of your website — it doesn't compete with the leads Thumbtack hands you. It recovers the homeowners Thumbtack already sent to your site who left without contacting you. Those recovered visitors flow into your retargeting audiences, your email sequences, and your CRM. They come back on their own time and call you — a warm inbound, on top of the Thumbtack leads you already get.",
    },
    withWithoutRows: [
      { feature: "Visitors Thumbtack sends to your site",  without: "Most bounce — 98 of 100",            with: "Same — Thumbtack delivery unchanged" },
      { feature: "Bounced visitors recovered",              without: "0 (lost)",                            with: "A share recovered, with consent" },
      { feature: "Cost of recovery layer",                  without: "—",                                    with: "$7 flat per recovered lead" },
      { feature: "Where recovered visitors go",             without: "—",                                    with: "Your retargeting, email/SMS, CRM" },
      { feature: "Result",                                  without: "What Thumbtack books",                with: "Thumbtack bookings + incremental inbound calls" },
      { feature: "Blended cost per booked job",             without: "Thumbtack-only baseline",             with: "Lower (more jobs on same ad budget)" },
      { feature: "Compliance",                              without: "On you",                              with: "Consent-first, audit receipt on every lead" },
    ],
    finalCtaH2: "Keep Thumbtack. Recover the rest.",
    finalCtaBody: "Add the recovery layer that turns the 98% you're losing into incremental inbound calls. Flat $7 per recovered lead. No contract.",
  },
  {
    slug: "angi",
    brand: "Angi",
    brandColor: "#a3151c",
    type: "reseller",
    titleTag: "More Jobs From Your Angi Spend · Consent Resolve",
    ogTitle: "Keep your Angi spend. Recover the 98% who don't call.",
    metaDescription: "Angi already sends contractors traffic — about 98 of every 100 of them bounce. Recover the bounce with consent, feed it back into your funnel, and book more jobs on the same Angi budget. Flat $7 per recovered lead.",
    eyebrow: "Channel ROI · Angi",
    h1: "More booked jobs from the Angi budget you already spend.",
    subhead: "Angi drives visitors to your site. About 98 out of 100 of them leave without contacting you. Consent Resolve recovers the bounce — with consent — and feeds it back into the retargeting, email, and CRM funnels you already run.",
    aeoAnswer: "Angi (parent of HomeAdvisor) typically costs contractors $15–$100+ per lead with a ~$50 average, and each lead is shared with 3–8 pros at once. Of the visitors Angi sends to a contractor's website, around 98% leave without contacting them. Consent Resolve recovers those bounced visitors with consent at a flat $7 per recovered lead, feeding them into the contractor's existing funnel and lowering the blended cost per booked job.",
    channelGoodAt: [
      "Brand recognition homeowners already trust.",
      "Vetted-pro program + wide trade coverage.",
      "Useful when you want reach without building your own traffic.",
    ],
    channelLeaks: [
      "98 of 100 visitors Angi sends to your site leave without contacting you.",
      "Each lead is shared with 3–8 contractors — you're paying to race them.",
      "Loaded cost averages ~$50 per lead, with bad-lead dispute denials around 30–50% and 30–35% cancellation penalties on auto-renew contracts.",
    ],
    channelCpl: "~$50 average loaded cost per lead (range $15–$100+ by trade).",
    trades: [
      { trade: "Roofing",     cpl: 73 },
      { trade: "HVAC",        cpl: 65 },
      { trade: "Plumbing",    cpl: 50 },
      { trade: "Electrician", cpl: 53 },
    ],
    bookedJobMath: {
      setup: "Whatever your blended cost per booked job is today on Angi alone, that's the baseline. You're already paying for the visitors who came and left.",
      withCR: "Add Consent Resolve as a recovery layer: the bounced visitors who consent become recovered records at $7 each, and a share of those book a job — set your own assumptions. Same Angi budget — more booked jobs at a lower blended $ per booked job.",
      breakEven: "Recovered visitors are incremental on the same budget — at $7 each, it takes only a handful of booked jobs to cover the recovery cost. We don't publish recovery or close rates; set your own assumptions and see /stats/ for sourced industry data.",
    },
    funnelExplain: {
      headline: "You don't choose between us and Angi.",
      body: "Keep running Angi. Consent Resolve doesn't replace the leads Angi sends you — it recovers the homeowners Angi already drove to your site who left without contacting you. Those recovered visitors flow into your retargeting audiences, your email sequences, and your CRM. They return on their own time and call you. Inbound on top of the Angi leads you already get.",
    },
    withWithoutRows: [
      { feature: "Visitors Angi sends to your site",       without: "Most bounce — 98 of 100",            with: "Same — Angi delivery unchanged" },
      { feature: "Bounced visitors recovered",              without: "0 (lost)",                            with: "A share recovered, with consent" },
      { feature: "Cost of recovery layer",                  without: "—",                                    with: "$7 flat per recovered lead" },
      { feature: "Where recovered visitors go",             without: "—",                                    with: "Your retargeting, email/SMS, CRM" },
      { feature: "Result",                                  without: "What Angi books",                     with: "Angi bookings + incremental inbound calls" },
      { feature: "Blended cost per booked job",             without: "Angi-only baseline",                  with: "Lower (more jobs on same ad budget)" },
      { feature: "Compliance",                              without: "On you",                              with: "Consent-first, audit receipt on every lead" },
    ],
    finalCtaH2: "Keep Angi. Recover the rest.",
    finalCtaBody: "Add the recovery layer that turns the 98% you're losing into incremental inbound calls. Flat $7 per recovered lead. No contract.",
  },
  {
    slug: "homeadvisor",
    brand: "HomeAdvisor",
    brandColor: "#f48120",
    type: "reseller",
    titleTag: "More Jobs From Your HomeAdvisor Spend · Consent Resolve",
    ogTitle: "Keep your HomeAdvisor spend. Recover the 98% who don't call.",
    metaDescription: "HomeAdvisor already sends contractors traffic — about 98 of every 100 of them bounce. Recover the bounce with consent, feed it back into your funnel, and book more jobs on the same HomeAdvisor budget. Flat $7 per recovered lead.",
    eyebrow: "Channel ROI · HomeAdvisor",
    h1: "More booked jobs from the HomeAdvisor budget you already spend.",
    subhead: "HomeAdvisor (now owned by Angi) drives visitors to your site. About 98 out of 100 of them leave without contacting you. Consent Resolve recovers the bounce — with consent — and feeds it back into the funnel you already run.",
    aeoAnswer: "HomeAdvisor (now owned by Angi) typically costs contractors ~$50 per lead and shares each lead with 3–8 pros. In 2023 the FTC ordered HomeAdvisor to pay up to $7.2M to settle charges of deceptive lead-quality claims. Of the visitors HomeAdvisor sends to a contractor's website, around 98% leave without contacting them. Consent Resolve recovers those bounced visitors with consent at $7 each, lowering blended cost per booked job.",
    channelGoodAt: [
      "Large network and instant lead matching.",
      "Broad category coverage across the trades.",
      "Useful if you want a firehose and don't mind the spray.",
    ],
    channelLeaks: [
      "98 of 100 visitors HomeAdvisor sends to your site leave without contacting you.",
      "Each lead is shared with 3–8 contractors at the same time.",
      "Loaded cost averages ~$50 per lead, dispute denials ~30–50%, auto-renew contracts with 30–35% cancellation penalties.",
    ],
    channelCpl: "~$50 average loaded cost per lead (range $15–$100+ by trade).",
    trades: [
      { trade: "Roofing",     cpl: 73 },
      { trade: "HVAC",        cpl: 65 },
      { trade: "Plumbing",    cpl: 50 },
      { trade: "Electrician", cpl: 53 },
    ],
    bookedJobMath: {
      setup: "Whatever your blended cost per booked job is today on HomeAdvisor alone, that's the baseline. The visitors who arrived and left are already paid for.",
      withCR: "Add Consent Resolve as a recovery layer: the bounced visitors who consent become recovered records at $7 each, and a share of those book a job — set your own assumptions. Same HomeAdvisor budget — more booked jobs at a lower blended $ per booked job.",
      breakEven: "Recovered visitors are incremental on the same budget — at $7 each, it takes only a handful of booked jobs to cover the recovery cost. We don't publish recovery or close rates; set your own assumptions and see /stats/ for sourced industry data.",
    },
    funnelExplain: {
      headline: "You don't choose between us and HomeAdvisor.",
      body: "Keep running HomeAdvisor. Consent Resolve doesn't replace the leads HomeAdvisor sends you — it recovers the homeowners HomeAdvisor already drove to your site who left without contacting you. Those recovered visitors flow into your retargeting audiences, your email sequences, and your CRM. They return on their own time and call you.",
    },
    withWithoutRows: [
      { feature: "Visitors HomeAdvisor sends to your site", without: "Most bounce — 98 of 100",            with: "Same — HomeAdvisor delivery unchanged" },
      { feature: "Bounced visitors recovered",              without: "0 (lost)",                            with: "A share recovered, with consent" },
      { feature: "Cost of recovery layer",                  without: "—",                                    with: "$7 flat per recovered lead" },
      { feature: "Where recovered visitors go",             without: "—",                                    with: "Your retargeting, email/SMS, CRM" },
      { feature: "Result",                                  without: "What HomeAdvisor books",              with: "HomeAdvisor bookings + incremental inbound calls" },
      { feature: "Blended cost per booked job",             without: "HomeAdvisor-only baseline",           with: "Lower (more jobs on same ad budget)" },
      { feature: "Compliance",                              without: "On you",                              with: "Consent-first, audit receipt on every lead" },
    ],
    finalCtaH2: "Keep HomeAdvisor. Recover the rest.",
    finalCtaBody: "Add the recovery layer that turns the 98% you're losing into incremental inbound calls. Flat $7 per recovered lead. No contract.",
  },
  {
    slug: "google-local-service-ads",
    brand: "Google LSA",
    brandColor: "#1a73e8",
    type: "complement",
    titleTag: "More Jobs From Your Google LSA Spend · Consent Resolve",
    ogTitle: "Keep your LSA spend. Recover the 98% who don't call.",
    metaDescription: "Google LSA already sends contractors calls and visitors — about 98 of every 100 site visitors bounce without dialing. Recover the bounce with consent, feed it back into your funnel, and book more jobs on the same LSA budget.",
    eyebrow: "Channel ROI · Google LSA",
    h1: "More booked jobs from the LSA budget you already spend.",
    subhead: "LSA is great at one thing — calls from people ready to dial. But the homeowners who clicked your ad, looked at your site, and didn't call are still paid for. Consent Resolve recovers them — with consent — and feeds them back into your funnel.",
    aeoAnswer: "Google Local Service Ads (LSA) deliver calls at a blended ~$53 per lead with a ~44% book rate — the channel that doesn't share leads. But about 98% of the visitors LSA sends to a contractor's website never call. Consent Resolve recovers those bounced visitors with consent at flat $7 per recovered lead, feeding them into the contractor's retargeting and CRM. LSA stays unchanged; recovered visitors are pure incremental upside.",
    channelGoodAt: [
      "Calls from people ready to talk — ~44% book rate.",
      "Google Verified badge places you at the top of search.",
      "The channel that doesn't share leads — every LSA call is yours.",
    ],
    channelLeaks: [
      "98 of 100 visitors LSA sends to your site never call you.",
      "In 2025 Google killed credits for 'wrong-job-type' and 'out-of-area' leads.",
      "Blended cost runs around $53 per lead, with trade ranges from $39 to $162.",
    ],
    channelCpl: "~$53 average blended cost per lead (range $39–$162 by trade).",
    trades: [
      { trade: "Roofing",     cpl: 73 },
      { trade: "HVAC",        cpl: 65 },
      { trade: "Plumbing",    cpl: 50 },
      { trade: "Electrician", cpl: 53 },
    ],
    bookedJobMath: {
      setup: "LSA already books some of the contacts it generates. The visitors who clicked, looked, and didn't call are already paid for.",
      withCR: "Add Consent Resolve as a recovery layer: the bounced visitors who consent become recovered records at $7 each, and a share of those book a job — set your own assumptions. LSA's book rate stays the same — you just get incremental inbound calls on top.",
      breakEven: "Recovered visitors are incremental on the same budget — at $7 each, it takes only a handful of booked jobs to cover the recovery cost. We don't publish recovery or close rates; set your own assumptions and see /stats/ for sourced industry data.",
    },
    funnelExplain: {
      headline: "Don't replace LSA. Finish the job it starts.",
      body: "LSA gets the homeowner to your site or on the phone. Consent Resolve handles the ones who visited but didn't call — they flow into your retargeting, your email sequences, your CRM, and return on their own time as inbound calls. You keep LSA running and you keep every LSA call. The recovered visitors are pure additive upside.",
    },
    withWithoutRows: [
      { feature: "Calls LSA generates",                     without: "Same as today",                       with: "Unchanged — LSA stays" },
      { feature: "Visitors who clicked, didn't call",       without: "Bounce — 98 of 100",                  with: "A share recovered, with consent" },
      { feature: "Cost of recovery layer",                  without: "—",                                    with: "$7 flat per recovered lead" },
      { feature: "Where recovered visitors go",             without: "—",                                    with: "Your retargeting, email/SMS, CRM" },
      { feature: "Result",                                  without: "LSA's book rate",                     with: "LSA bookings + incremental inbound calls" },
      { feature: "Blended cost per booked job",             without: "LSA-only baseline",                   with: "Lower (more jobs on same ad budget)" },
      { feature: "Compliance",                              without: "Your responsibility",                  with: "Consent-first, audit receipt on every lead" },
    ],
    finalCtaH2: "Keep LSA. Recover the rest.",
    finalCtaBody: "Add the recovery layer that turns the 98% you're losing into incremental inbound calls. Flat $7 per recovered lead.",
  },
];

export function getCompare(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((c) => c.slug === slug);
}
