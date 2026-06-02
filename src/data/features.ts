/**
 * Features data spine — feeds /features/ hub, /features/[slug]/ pages,
 * and the grouped FeatureBento on the homepage. Single source of truth.
 *
 * Adding a feature? Push it into the right group's `features` array.
 * Photos/illustrations live at /public/illustrations/features/<slug>.svg
 * (optional — pages render fine without them).
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

export interface Feature {
  slug: string;                      // URL: /features/<slug>/
  name: string;                      // "Exclusive Leads"
  iconKey: FeatureIconKey;
  /** One-sentence summary used on cards. Voice: peer to contractor. */
  tagline: string;
  /** Full description used on the hub and the detail page's hero. */
  description: string;
}

export interface FeatureGroup {
  slug: string;                      // section anchor on hub
  title: string;                     // "Your leads. Nobody else's."
  /** Short body shown under the group heading. */
  blurb: string;
  features: Feature[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    slug: "your-leads",
    title: "Your leads. Nobody else's.",
    blurb:
      "The people we identify came to your website — so the lead is yours alone. Never resold, never shared, never auctioned.",
    features: [
      {
        slug: "exclusive-leads",
        name: "Exclusive Leads",
        iconKey: "IconLock",
        tagline: "Yours alone. Never shared, never resold.",
        description:
          "The people we identify came to your website — so the lead is yours alone. We never share it, never resell it, never blast it to three other contractors in your town. No bidding war. No racing to call first before someone else closes the job you paid to find.",
      },
      {
        slug: "consent-first-identification",
        name: "Consent-First Identification",
        iconKey: "IconUserCheck",
        tagline: "Every name opted in. Warmer call, cleaner conscience.",
        description:
          "Every person we identify opted in. You're not buying a cold name off some list — you're reaching out to someone who already raised their hand and showed real interest in what you do. That's a warmer call and a cleaner conscience.",
      },
      {
        slug: "channel-recovery",
        name: "Channel Recovery",
        iconKey: "IconRefresh",
        tagline: "Catches the visitors Google and the resellers let slip away.",
        description:
          "Consent Resolve doesn't replace Google, Thumbtack, or Angi. It sits on top of them. Whatever's sending people to your site, we catch the ones who would've slipped away — and hand them back to you as real, reachable leads.",
      },
    ],
  },
  {
    slug: "see-who-is-there",
    title: "See who's there. Reach them fast.",
    blurb:
      "One script, real names, real numbers — and a phone alert the second a homeowner is ready to talk.",
    features: [
      {
        slug: "easy-setup-with-one-script",
        name: "Easy Setup With One Script",
        iconKey: "IconCode",
        tagline: "Paste one line. Live the same day.",
        description:
          "One small piece of code on your website and you're live. No new software to learn, no app to babysit, no IT guy required. Paste it once and Consent Resolve goes to work — most pros are up and running the same day.",
      },
      {
        slug: "visitor-identification",
        name: "Visitor Identification",
        iconKey: "IconEye",
        tagline: "See the real people behind your traffic.",
        description:
          "Stop staring at a visitor counter that tells you nothing. See the real people behind your traffic — who came, what they wanted, and how to reach them.",
      },
      {
        slug: "formless-contact-capture",
        name: "Formless Contact Capture",
        iconKey: "IconAddressBook",
        tagline: "Name, phone, email — no form required on their end.",
        description:
          "Get a name, phone number, and email for visitors who never filled out a single form — the ones who'd normally just disappear. No \"contact us\" page required on their end.",
      },
      {
        slug: "verified-contact-data",
        name: "Verified Contact Data",
        iconKey: "IconShieldCheck",
        tagline: "Reachable and recently active. No dead numbers.",
        description:
          "We only hand you people who are reachable and recently active. Your crew isn't burning the morning dialing dead numbers and bad emails.",
      },
      {
        slug: "instant-connect",
        name: "Instant Connect",
        iconKey: "IconBolt",
        tagline: "Number in hand while they're still deciding.",
        description:
          "The number's in your hand, ready to dial while they're still deciding who to hire. Strike while the interest is hot.",
      },
      {
        slug: "real-time-mobile-alerts",
        name: "Real-Time Mobile Alerts",
        iconKey: "IconBellRinging",
        tagline: "Leads on your phone in minutes — wherever you are.",
        description:
          "New leads hit your phone within minutes — wherever you are, on the roof or in the truck — so you reach out before your competitor even knows that customer existed.",
      },
    ],
  },
  {
    slug: "quality-over-quantity",
    title: "Spend your time on the ones that matter.",
    blurb:
      "Score, segment, and filter so your day goes to the visitors who are actually ready to book.",
    features: [
      {
        slug: "lead-scoring",
        name: "Lead Scoring",
        iconKey: "IconStar",
        tagline: "Serious ones first. Bouncers last.",
        description:
          "Not every visitor is worth a call. We surface the serious ones first — someone who checked your pricing page three times beats a one-second bounce every time.",
      },
      {
        slug: "behavior-and-job-type-insights",
        name: "Behavior & Job-Type Insights",
        iconKey: "IconClipboardCheck",
        tagline: "Know the job before you dial.",
        description:
          "See which service each visitor was looking at and how long they spent doing it. Your first call already knows whether they want a quick repair or a full replacement — so you walk in sounding like you read their mind.",
      },
      {
        slug: "service-area-filtering",
        name: "Service-Area Filtering",
        iconKey: "IconMapPin",
        tagline: "Only the zips and towns you actually serve.",
        description:
          "Only see visitors in the zip codes and towns you actually serve. No leads from three counties over that you'd never drive to anyway.",
      },
      {
        slug: "qualified-leads-only",
        name: "Qualified Leads Only",
        iconKey: "IconFilter",
        tagline: "Real, identified, in-area. Nothing else.",
        description:
          "You spend your time on real, identified, in-area people — not anonymous clicks that lead nowhere.",
      },
    ],
  },
  {
    slug: "route-and-prove",
    title: "Route it, work it, prove it paid off.",
    blurb:
      "Leads land in your CRM, your team works them across every channel, and the dashboard shows the dollars.",
    features: [
      {
        slug: "crm-delivery",
        name: "CRM Delivery",
        iconKey: "IconPlugConnected",
        tagline: "Routed to the right person automatically.",
        description:
          "Leads flow straight into the tools you already use, routed to the right person on your team automatically. Nothing falls through the cracks.",
      },
      {
        slug: "multi-channel-follow-up",
        name: "Multi-Channel Follow-Up",
        iconKey: "IconMessage",
        tagline: "Call, email, or text — catch them however.",
        description:
          "Reach identified visitors by call, email, or text — not one shot in the dark. Catch them however they're easiest to catch.",
      },
      {
        slug: "built-in-compliance",
        name: "Built-In Compliance",
        iconKey: "IconCertificate",
        tagline: "Consent logged, opt-outs honored — automatically.",
        description:
          "Consent gets recorded and opt-outs get honored automatically, across every state. You stay covered without becoming a privacy-law expert.",
      },
      {
        slug: "roi-reporting",
        name: "ROI Reporting",
        iconKey: "IconChartHistogram",
        tagline: "Cost per lead vs jobs booked — in plain dollars.",
        description:
          "See your cost per identified lead against the jobs you actually booked — so you know, in plain dollars, that it's paying for itself.",
      },
    ],
  },
];

export const ALL_FEATURES: Feature[] = FEATURE_GROUPS.flatMap((g) => g.features);

export function getFeature(slug: string): Feature | undefined {
  return ALL_FEATURES.find((f) => f.slug === slug);
}

export function getFeatureGroupOf(slug: string): FeatureGroup | undefined {
  return FEATURE_GROUPS.find((g) => g.features.some((f) => f.slug === slug));
}
