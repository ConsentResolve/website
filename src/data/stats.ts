/**
 * Stats data spine — drives /stats/ ("The Data Behind the Story").
 * Source-accurate copy from /Users/aaronphillips/Downloads/consent-resolve-data-page-rework.md.
 *
 * Every stat carries the EXACT label, description, and live source link
 * from the rework spec. If you tune the display, keep the citation honest.
 *
 * `numeric` is optional — present when the value can be animated (a single
 * number with prefix/suffix). Range values like "$25–$75" or compound
 * values like "4–5 pros" are rendered as styled static text.
 */

export type StatTone = "danger" | "warning" | "brand" | "info" | "neutral";

export interface StatSource {
  name: string;
  url: string;
  /** Optional one-line note shown on the Sources section. */
  note?: string;
}

export interface AnimatedValue {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export interface Stat {
  /** Display string — e.g. "98%", "$25–$75", "4–5 pros". */
  value: string;
  /** Short label, ~3 words. */
  label: string;
  /** One-line description that appears under the label. */
  description: string;
  /** Set when the display value is a single number we can count up to. */
  numeric?: AnimatedValue;
  source: StatSource;
}

export interface StatsSection {
  slug: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  tone: StatTone;
  stats: Stat[];
  /** Optional inline strip rendered between the grid and the callout. */
  inline?: { title: string; items: string[]; source: StatSource };
  callout: { title: string; body: string };
  /** Optional editorial note shown above the callout (e.g. legal caveat). */
  note?: string;
}

// -----------------------------------------------------------------------
// HERO STAT STRIP — Option B (contractor-focused, per the spec recommendation)
// -----------------------------------------------------------------------

export const HERO_STATS: Stat[] = [
  {
    value: "98%",
    label: "Visitors Never Convert",
    description: "Browse without identifying themselves",
    numeric: { value: 98, suffix: "%" },
    source: { name: "WordStream", url: "https://www.wordstream.com/blog/conversion-rate-benchmarks" },
  },
  {
    value: "$25–$100+",
    label: "Paid per shared lead",
    description: "What you pay for a lead 4–5 other pros also got",
    source: { name: "Pipeline On", url: "https://pipelineon.com/blog/is-thumbtack-worth-it/" },
  },
  {
    value: "4–5 pros",
    label: "Get the same lead",
    description: "The same project quoted to everyone it's sent to",
    source: { name: "Pipeline On", url: "https://pipelineon.com/blog/how-much-does-thumbtack-charge-per-lead/" },
  },
  {
    value: "26%",
    label: "Recovery With Follow-Up",
    description: "Conversion lift from identification and outreach",
    numeric: { value: 26, suffix: "%" },
    source: { name: "BigSur AI", url: "https://bigsur.ai/blog/cro-statistics" },
  },
];

// -----------------------------------------------------------------------
// SECTIONS
// -----------------------------------------------------------------------

export const STAT_SECTIONS: StatsSection[] = [
  {
    slug: "anonymous-traffic",
    eyebrow: "The problem",
    headline: "You're Watching Revenue Walk Away",
    subhead:
      "Most visitors never identify themselves. They browse, compare, and leave — often to buy from competitors.",
    tone: "warning",
    stats: [
      {
        value: "98%",
        label: "Stay Anonymous",
        description: "Visitors who browse without converting or identifying themselves.",
        numeric: { value: 98, suffix: "%" },
        source: { name: "WordStream", url: "https://www.wordstream.com/blog/conversion-rate-benchmarks" },
      },
      {
        value: "70%",
        label: "Abandon Carts",
        description: "Average cart abandonment rate across all industries.",
        numeric: { value: 70, suffix: "%" },
        source: { name: "Baymard Institute", url: "https://baymard.com/lists/cart-abandonment-rate" },
      },
      {
        value: "26%",
        label: "Buy From Competitors",
        description: "Visitors who research on your site then purchase elsewhere.",
        numeric: { value: 26, suffix: "%" },
        source: { name: "MobiLoud", url: "https://www.mobiloud.com/blog/cart-abandonment-statistics" },
      },
      {
        value: "87s",
        label: "Average Browse Time",
        description: "You have less than 90 seconds to capture their attention.",
        numeric: { value: 87, suffix: "s" },
        source: { name: "Spectrum Infinite", url: "https://spectruminfinite.com/blogs/average-time-spent-on-website-2025/" },
      },
      {
        value: "70%",
        label: "Decide Anonymously",
        description: "Purchase decisions made before identifying themselves.",
        numeric: { value: 70, suffix: "%" },
        source: { name: "Challenger Inc.", url: "https://challengerinc.com/blog/how-sales-leaders-can-unlock-seller-performance-in-an-uncertain-economy/" },
      },
      {
        value: "$5.6T",
        label: "Lost Globally",
        description: "Revenue abandoned in carts each year worldwide.",
        source: { name: "Envisage Digital", url: "https://www.envisagedigital.co.uk/shopping-cart-abandonment-statistics/" },
      },
    ],
    callout: {
      title: "The real cost",
      body:
        "98% of your traffic disappears without a trace. No email, no phone number, no way to follow up. You spent money driving them to your site, and they leave to buy from someone who can reach them.",
    },
  },
  {
    slug: "lead-trap",
    eyebrow: "The lead trap",
    headline: "You're Already Paying for Leads You Don't Even Own",
    subhead:
      "The lead sellers charge you premium prices for leads they hand to four other contractors at the same time — then charge you whether the customer answers or not. Here's the real math.",
    tone: "danger",
    stats: [
      {
        value: "$53",
        label: "Avg. LSA cost per lead",
        description: "Home-services blended, across 888 contractors & 126,650 leads.",
        numeric: { value: 53, prefix: "$" },
        source: { name: "SearchLight Digital", url: "https://searchlightdigital.io/google-local-service-ads-cost-per-lead/" },
      },
      {
        value: "$25–$75",
        label: "Thumbtack cost per lead",
        description: "Typical range for most home-service trades.",
        source: { name: "Pipeline On", url: "https://pipelineon.com/blog/how-much-does-thumbtack-charge-per-lead/" },
      },
      {
        value: "$15–$100+",
        label: "Angi cost per lead",
        description: "Plus a $300–$500 annual membership fee, charged whether the customer answers or not.",
        source: { name: "Pipeline On", url: "https://pipelineon.com/blog/is-thumbtack-worth-it/" },
      },
      {
        value: "4–5 pros",
        label: "Share every Thumbtack lead",
        description: "The same project is quoted by everyone it's sent to.",
        source: { name: "Pipeline On", url: "https://pipelineon.com/blog/how-much-does-thumbtack-charge-per-lead/" },
      },
      {
        value: "$7.2M",
        label: "FTC settlement vs Angi's HomeAdvisor",
        description: "For deceptive claims about lead quality and source.",
        numeric: { value: 7.2, prefix: "$", suffix: "M", decimals: 1 },
        source: { name: "FTC", url: "https://www.ftc.gov/news-events/news/press-releases/2023/01/ftc-order-requires-homeadvisor-pay-72-million-stop-deceptively-marketing-its-leads-home-improvement" },
      },
      {
        value: "78%",
        label: "Hire the first to respond",
        description: "Not the cheapest or highest-rated — the fastest.",
        numeric: { value: 78, suffix: "%" },
        source: { name: "Pipeline On", url: "https://pipelineon.com/blog/how-much-does-thumbtack-charge-per-lead/" },
      },
      {
        value: "21×",
        label: "Better odds inside 5 minutes",
        description: "Vs. contacting a lead after 30 minutes.",
        numeric: { value: 21, suffix: "×" },
        source: { name: "MIT Study", url: "https://cdn2.hubspot.net/hub/25649/file-13535879-pdf/docs/mit_study.pdf" },
      },
      {
        value: "43.9%",
        label: "Best-case LSA book rate",
        description: "And that's the channel that doesn't share leads.",
        numeric: { value: 43.9, suffix: "%", decimals: 1 },
        source: { name: "SearchLight Digital", url: "https://searchlightdigital.io/google-local-service-ads-cost-per-lead/" },
      },
    ],
    inline: {
      title: "LSA cost-per-lead by trade",
      items: ["HVAC $45–$85", "Plumbing $35–$65", "Electrical $35–$70", "Roofing $50–$95"],
      source: { name: "HomeServiceDirect", url: "https://www.homeservicedirect.net/local-service-ads-for-contractors/" },
    },
    callout: {
      title: "The lead trap",
      body:
        "You pay $25–$100+ for a lead that four other contractors are also calling. Angi charges you whether the homeowner picks up or not — and the FTC ordered HomeAdvisor to pay up to $7.2 million to settle charges of misleading pros about lead quality. Meanwhile, the visitors on your own website — the ones you already paid to get there — leave with no name at all. Those leads would be exclusive. And they'd be yours.",
    },
  },
  // TODO (WS7 / pre-launch): this section + the "$5.6T lost globally" stat in
  // anonymous-traffic read DTC/enterprise-sales ("sales reps", "550h per rep"),
  // not home-services contractor. Sourced, so left in place rather than deleted
  // — marketing to reframe or cut before launch. Flagged, not silently kept.
  {
    slug: "wasted-effort",
    eyebrow: "The impact",
    headline: "Your Team Is Drowning in Inefficiency",
    subhead:
      "Without visitor data, your sales and marketing teams waste time on manual work instead of revenue-generating activities.",
    tone: "warning",
    stats: [
      {
        value: "72%",
        label: "Time Wasted",
        description: "Sales reps spending time on admin instead of selling.",
        numeric: { value: 72, suffix: "%" },
        source: { name: "Salesforce", url: "https://www.salesforce.com/news/stories/sales-research-2023/" },
      },
      {
        value: "550h",
        label: "Lost Per Rep",
        description: "Annual hours wasted on bad data and manual cleanup.",
        numeric: { value: 550, suffix: "h" },
        source: { name: "Neil Patel", url: "https://neilpatel.com/blog/bad-data-killing-sales/" },
      },
      {
        value: "42h",
        label: "Response Delay",
        description: "Average lead response time with manual processes.",
        numeric: { value: 42, suffix: "h" },
        source: { name: "Chili Piper", url: "https://www.chilipiper.com/article/speed-to-lead-statistics" },
      },
      {
        value: "21×",
        label: "Less Likely",
        description: "To qualify when waiting 30 min vs 5 min to respond.",
        numeric: { value: 21, suffix: "×" },
        source: { name: "MIT Study", url: "https://cdn2.hubspot.net/hub/25649/file-13535879-pdf/docs/mit_study.pdf" },
      },
    ],
    callout: {
      title: "Every minute compounds",
      body:
        "550 wasted hours per rep per year is the equivalent of nearly three months of work. Speed isn't optional — speed is the job.",
    },
  },
  {
    slug: "recovery-works",
    eyebrow: "The opportunity",
    headline: "The Data Shows Recovery Works",
    subhead:
      "When you can identify and follow up with visitors, conversion rates climb dramatically. Here's the proof.",
    tone: "brand",
    stats: [
      {
        value: "26%",
        label: "Conversion Lift",
        description: "From personalized outreach and product recommendations.",
        numeric: { value: 26, suffix: "%" },
        source: { name: "BigSur AI / Wiser", url: "https://bigsur.ai/blog/cro-statistics" },
      },
      {
        value: "20%",
        label: "Cart Recovery",
        description: "Average recovery rate with email follow-up campaigns.",
        numeric: { value: 20, suffix: "%" },
        source: { name: "ConvertCart", url: "https://www.convertcart.com/blog/cart-abandonment-rate-statistics" },
      },
      {
        value: "45%",
        label: "Email Open Rate",
        description: "Engagement on abandoned cart recovery emails.",
        numeric: { value: 45, suffix: "%" },
        source: { name: "Klaviyo", url: "https://www.klaviyo.com/blog/abandoned-cart-benchmarks" },
      },
      {
        value: "10–15×",
        label: "List Growth",
        description: "More subscribers from automated capture vs forms alone.",
        source: { name: "BDOW", url: "https://bdow.com/stories/email-signup-benchmarks/" },
      },
      {
        value: "6–10×",
        label: "ROI",
        description: "Return on visitor identification and smart data strategies.",
        source: { name: "Practical Ecommerce", url: "https://www.practicalecommerce.com/how-brands-boost-roi-with-smart-data" },
      },
      {
        value: "2%",
        label: "Organic Growth",
        description: "Monthly email list growth from traditional opt-in forms.",
        numeric: { value: 2, suffix: "%" },
        source: { name: "Retainful", url: "https://www.retainful.com/blog/grow-your-email-list" },
      },
    ],
    callout: {
      title: "The math is clear",
      body:
        "When you identify and follow up with anonymous visitors, you recover 20–26% of otherwise-lost sales. That's not theory — it's proven across industries.",
    },
  },
  {
    slug: "privacy-enforcement",
    eyebrow: "Privacy enforcement",
    headline: "Privacy Enforcement Is Real",
    subhead:
      "This isn't theoretical. The laws that hit contractors are about how you reach people and how your website tracks them — and the checks being written are getting bigger.",
    tone: "info",
    stats: [
      {
        value: "$500–$1,500",
        label: "TCPA — per call or text",
        description: "Statutory damages for a marketing call or text to someone who never opted in. Private right of action — they can sue, per message.",
        source: { name: "47 U.S.C. §227 (Cornell LII)", url: "https://www.law.cornell.edu/uscode/text/47/227" },
      },
      {
        value: "$5,000",
        label: "CIPA — per violation",
        description: "California's wiretap statute, now used against non-consented website tracking. Plaintiffs' firms mass-file against ordinary business sites.",
        source: { name: "CA Penal Code §637.2", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=637.2" },
      },
      {
        value: "$1.4B",
        label: "Meta — Texas settlement",
        description: "The largest privacy settlement a single state has ever obtained, over biometric data captured without consent.",
        numeric: { value: 1.4, prefix: "$", suffix: "B", decimals: 1 },
        source: { name: "Texas Attorney General", url: "https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-secures-14-billion-settlement-meta-over-its-unauthorized-capture" },
      },
      {
        value: "$1.375B",
        label: "Google — Texas settlement",
        description: "Over location, search, and biometric tracking of Texans without consent.",
        numeric: { value: 1.375, prefix: "$", suffix: "B", decimals: 3 },
        source: { name: "Texas Attorney General", url: "https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-secures-historic-1375-billion-settlement-google-related-texans-data" },
      },
      {
        value: "1st",
        label: "TDPSA enforcement suit",
        description: "Texas v. Allstate/Arity — the first suit ever filed to enforce a comprehensive state data-privacy law, over driving data collected and sold without consent.",
        source: { name: "Texas Attorney General", url: "https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-sues-allstate-and-arity-unlawfully-collecting-using-and-selling-over-45" },
      },
      {
        value: "€20M",
        label: "GDPR max fine",
        description: "The strictest privacy standard in the world (or 4% of global revenue) — and the one we engineered to, so the U.S. state patchwork is covered by design.",
        numeric: { value: 20, prefix: "€", suffix: "M" },
        source: { name: "GDPR Info", url: "https://gdpr-info.eu/issues/fines-penalties/" },
      },
    ],
    callout: {
      title: "The pattern is clear",
      body:
        "The lawsuits and settlements aren't about privacy buzzwords. They're about reaching people who never opted in and tracking visitors who never agreed. Consent Resolve is built the other way — identification only after a consented yes, an audit receipt on every record, and never a number handed to you to cold-call.",
    },
  },
];

// -----------------------------------------------------------------------
// SOURCES (footer of /stats/)
// -----------------------------------------------------------------------

export interface SourceGroup {
  title: string;
  /** Use note for the inline annotation; omit when the citation is self-explanatory. */
  sources: StatSource[];
}

export const SOURCE_GROUPS: SourceGroup[] = [
  {
    title: "Conversion & funnel research",
    sources: [
      { name: "WordStream", url: "https://www.wordstream.com/blog/conversion-rate-benchmarks" },
      { name: "Baymard Institute", url: "https://baymard.com/lists/cart-abandonment-rate" },
      { name: "MobiLoud", url: "https://www.mobiloud.com/blog/cart-abandonment-statistics" },
      { name: "Spectrum Infinite", url: "https://spectruminfinite.com/blogs/average-time-spent-on-website-2025/" },
      { name: "Challenger Inc.", url: "https://challengerinc.com/blog/how-sales-leaders-can-unlock-seller-performance-in-an-uncertain-economy/" },
      { name: "Envisage Digital", url: "https://www.envisagedigital.co.uk/shopping-cart-abandonment-statistics/" },
      { name: "BigSur AI / Wiser", url: "https://bigsur.ai/blog/cro-statistics" },
      { name: "ConvertCart", url: "https://www.convertcart.com/blog/cart-abandonment-rate-statistics" },
      { name: "Klaviyo", url: "https://www.klaviyo.com/blog/abandoned-cart-benchmarks" },
      { name: "BDOW", url: "https://bdow.com/stories/email-signup-benchmarks/" },
      { name: "Practical Ecommerce", url: "https://www.practicalecommerce.com/how-brands-boost-roi-with-smart-data" },
      { name: "Retainful", url: "https://www.retainful.com/blog/grow-your-email-list" },
    ],
  },
  {
    title: "Sales productivity research",
    sources: [
      { name: "Salesforce", url: "https://www.salesforce.com/news/stories/sales-research-2023/" },
      { name: "Neil Patel", url: "https://neilpatel.com/blog/bad-data-killing-sales/" },
      { name: "Chili Piper", url: "https://www.chilipiper.com/article/speed-to-lead-statistics" },
      { name: "MIT Study", url: "https://cdn2.hubspot.net/hub/25649/file-13535879-pdf/docs/mit_study.pdf" },
    ],
  },
  {
    title: "Lead generation & platform economics",
    sources: [
      { name: "SearchLight Digital", url: "https://searchlightdigital.io/google-local-service-ads-cost-per-lead/", note: "LSA Benchmark, Feb 2026 (888 contractors, 126,650 leads). $53 avg CPL, 43.9% book rate." },
      { name: "99 Calls", url: "https://99calls.com/LSA-Cost-Estimator/general-contractor", note: "LSA Cost-Per-Lead by industry (live Google Ads API data)." },
      { name: "Pipeline On — Thumbtack CPL", url: "https://pipelineon.com/blog/how-much-does-thumbtack-charge-per-lead/", note: "Thumbtack / Angi / LSA cost-per-lead and shared-lead analysis, 2026." },
      { name: "Pipeline On — Angi vs Thumbtack", url: "https://pipelineon.com/blog/is-thumbtack-worth-it/", note: "Angi/HomeAdvisor fee and lead-cost breakdown, 2026." },
      { name: "ServiceMag", url: "https://www.servicemag.org/software/thumbtack", note: "Thumbtack for Contractors review, 2026." },
      { name: "NZ Leads", url: "https://nzleads.com/blog/thumbtack-cost-per-lead-2026/", note: "Thumbtack cost-per-booked-job breakdown, 2026." },
      { name: "HomeServiceDirect", url: "https://www.homeservicedirect.net/local-service-ads-for-contractors/", note: "LSA cost-per-lead by trade, 2026." },
      { name: "FTC", url: "https://www.ftc.gov/news-events/news/press-releases/2023/01/ftc-order-requires-homeadvisor-pay-72-million-stop-deceptively-marketing-its-leads-home-improvement", note: "HomeAdvisor / Angi Leads consent order, 2023. Up to $7.2M; $3M+ refunded." },
    ],
  },
  {
    title: "Privacy enforcement & compliance documentation",
    sources: [
      { name: "47 U.S.C. §227 — TCPA (Cornell LII)", url: "https://www.law.cornell.edu/uscode/text/47/227", note: "Telephone Consumer Protection Act — $500–$1,500 statutory damages per call/text, private right of action." },
      { name: "CA Penal Code §637.2 — CIPA", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PEN&sectionNum=637.2", note: "California Invasion of Privacy Act — $5,000 per violation, applied to non-consented website tracking." },
      { name: "Texas AG — Meta $1.4B settlement", url: "https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-secures-14-billion-settlement-meta-over-its-unauthorized-capture", note: "Largest privacy settlement obtained by a single state, biometric data captured without consent." },
      { name: "Texas AG — Google $1.375B settlement", url: "https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-secures-historic-1375-billion-settlement-google-related-texans-data", note: "Location, search, and biometric tracking without consent." },
      { name: "Texas AG — Allstate/Arity TDPSA suit", url: "https://www.texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-sues-allstate-and-arity-unlawfully-collecting-using-and-selling-over-45", note: "First-ever enforcement suit under a comprehensive state data-privacy law (Jan 2025)." },
      { name: "CA Civil Code §1798.155 — CCPA", url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.155" },
      { name: "GDPR Info — Fines", url: "https://gdpr-info.eu/issues/fines-penalties/" },
    ],
  },
];

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

export const ALL_STATS: Stat[] = [...HERO_STATS, ...STAT_SECTIONS.flatMap((s) => s.stats)];

/** All stats deduped by label — used by the "Share a Random Stat" button. */
export function getAllStatsForSharing(): Stat[] {
  const seen = new Set<string>();
  const out: Stat[] = [];
  for (const stat of ALL_STATS) {
    if (seen.has(stat.label)) continue;
    seen.add(stat.label);
    out.push(stat);
  }
  return out;
}
