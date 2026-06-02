/**
 * Team data spine — feeds /about/ (authority strip, team grid, drawer).
 * Photos: drop square JPG/PNG at /public/team/<slug>.jpg and update `photo`.
 * Until then, components render an initials avatar.
 */

export type BadgeType = "COMPLIANCE" | "POLICY" | "OPERATIONS" | "MARKETING" | "CUSTOMER" | "ENGINEERING";

export interface Credential {
  /** Short headline shown on the marquee card. */
  headline: string;
  /** Badge label (uppercase tag on the marquee card). */
  badge: BadgeType;
}

export interface TeamMember {
  slug: string;
  name: string;
  role: string;
  /** Green pill badge on the team grid card. */
  tagline: string;
  /** Long bio for the grid card. */
  bio: string;
  /** "Why this matters for you" — drawer copy. */
  whyItMatters: string;
  /** Verified credentials list shown in the drawer. */
  verified: string[];
  /** Credentials surfaced in the scrolling authority strip. */
  credentials: Credential[];
  linkedin: string;
  /** Optional public photo path under /public. Falls back to initials. */
  photo?: string;
}

export const TEAM: TeamMember[] = [
  {
    slug: "andy-mentges",
    name: "Andy Mentges",
    role: "CEO",
    tagline: "Fights regulators so you don't have to.",
    bio: "25+ years building internet companies. Led 50+ acquisitions, sat on the i2Coalition board, served as CEO of VerticalResponse, and has been in the room when internet policy gets written — including Capitol Hill testimony and White House technology advisory work. He runs Consent Resolve the same way he ran those companies: pick a side, say it plainly, and put it in writing.",
    whyItMatters: "Consent law is the whole product. Andy's spent his career writing it, defending it, and explaining it to the people who set the rules. When a regulator asks how Consent Resolve works, the answer comes from someone they've already met.",
    verified: [
      "Testified on Capitol Hill on internet policy",
      "Served as a White House technology advisor",
      "Board member, i2Coalition",
      "Former CEO, VerticalResponse",
      "Led 50+ acquisitions across hosting and SaaS",
      "25+ years building internet companies",
    ],
    credentials: [
      { badge: "POLICY",     headline: "Testified on Capitol Hill on internet policy" },
      { badge: "POLICY",     headline: "White House technology advisor" },
      { badge: "OPERATIONS", headline: "Led 50+ acquisitions in hosting & SaaS" },
      { badge: "COMPLIANCE", headline: "Board member, i2Coalition" },
    ],
    linkedin: "https://www.linkedin.com/in/andymentges/",
  },
  {
    slug: "jason-beyke",
    name: "Jason Beyke",
    role: "COO",
    tagline: "Turns chaos into systems.",
    bio: "Scaled tech companies from chaos to clockwork. COO at VerticalResponse, Director at Deluxe, leadership at SiteLock — and the guy quietly running M&A due diligence on the deals nobody talks about. He's managed teams across the US, Europe, and Asia, so the playbook he writes for Consent Resolve has to work in every timezone before he ships it.",
    whyItMatters: "Email, hosting, security — Jason has scaled all three. He knows what breaks when a consent platform actually catches on, and he's built the operations to handle it before it happens to you.",
    verified: [
      "COO, VerticalResponse",
      "Director, Deluxe",
      "Leadership, SiteLock (anti-malware platform)",
      "Led M&A due diligence on multi-company acquisitions",
      "Managed 60+ employees across US, Europe, Asia",
      "20+ years in hosting, email, and security ops",
    ],
    credentials: [
      { badge: "OPERATIONS", headline: "Scaled 60+ employees across three regions" },
      { badge: "OPERATIONS", headline: "COO at VerticalResponse" },
      { badge: "COMPLIANCE", headline: "M&A due diligence lead on SaaS acquisitions" },
      { badge: "OPERATIONS", headline: "Director at Deluxe" },
    ],
    linkedin: "https://www.linkedin.com/in/jasonbeyke/",
  },
  {
    slug: "aaron-phillips",
    name: "Aaron Phillips",
    role: "Marketing",
    tagline: "Positioning. Calling out the BS.",
    bio: "20+ years marketing hosting, security, and SaaS to people who can smell a sales pitch a mile away. cPanel executive, CMO of an anti-malware platform, enterprise SEO lead — every job he's had has been some version of 'translate complicated tech into plain English without lying about it.' That's what he does here too.",
    whyItMatters: "Every word on this site is checked against what we actually do. Aaron's job is to make sure the marketing matches the product — no asterisks, no fine-print walk-backs, no 'free' that isn't free.",
    verified: [
      "Executive, cPanel",
      "CMO, anti-malware platform",
      "Enterprise SEO lead at scale",
      "20+ years in hosting and software marketing",
      "Built and led marketing for multiple SaaS exits",
    ],
    credentials: [
      { badge: "MARKETING", headline: "20+ years marketing hosting & SaaS" },
      { badge: "MARKETING", headline: "Former executive at cPanel" },
      { badge: "MARKETING", headline: "CMO at an anti-malware platform" },
      { badge: "MARKETING", headline: "Enterprise SEO at scale" },
    ],
    linkedin: "https://www.linkedin.com/in/aaronphillipsmarketing/",
  },
  {
    slug: "tyler-spurlock",
    name: "Tyler Spurlock",
    role: "Customer Voice",
    tagline: "Revenue reality check.",
    bio: "Came up in insurance account management and financial reporting — owned the P&L on a $92M division before pivoting into consultative sales. Tyler is the person on the team who actually talks to contractors every day, hears what's working, hears what isn't, and walks it back to engineering before the marketing copy ever gets written.",
    whyItMatters: "Every roadmap call starts with 'what did customers say this week?' Tyler is the one carrying that answer in. If a feature gets shipped, it's because a real owner-operator asked for it.",
    verified: [
      "Account management lead, commercial insurance",
      "Financial reporting on a $92M division",
      "Consultative sales for contractors and service businesses",
      "Daily customer conversations and deal-cycle ownership",
    ],
    credentials: [
      { badge: "CUSTOMER", headline: "Owned reporting on a $92M division" },
      { badge: "CUSTOMER", headline: "Daily conversations with contractors" },
      { badge: "CUSTOMER", headline: "Consultative sales background" },
    ],
    linkedin: "https://www.linkedin.com/in/tylerspurlock/",
  },
  {
    slug: "stefan-dimitrov",
    name: "Stefan Dimitrov",
    role: "Engineering",
    tagline: "The guy who makes 'legal' actually true.",
    bio: "Co-founder of Data Crafted Consulting and CEO of Ensidia Ltd. Has been writing web code since 1999 — back when 'compliance' meant a meta tag. He's built enterprise IT for companies that get audited every quarter, which is exactly the bar Consent Resolve is built to clear. If the product claims it logs every consent with a timestamp, that's because Stefan wrote the code that does it.",
    whyItMatters: "A consent claim is only as good as the audit trail behind it. Stefan engineers the audit trail first and the UI second — the opposite of how most marketing tools get built.",
    verified: [
      "Co-founder, Data Crafted Consulting",
      "CEO, Ensidia Ltd",
      "Web developer since 1999",
      "Enterprise IT for audit-heavy industries",
      "Built consent-first data pipelines from scratch",
    ],
    credentials: [
      { badge: "ENGINEERING", headline: "Writing web code since 1999" },
      { badge: "ENGINEERING", headline: "Co-founder, Data Crafted Consulting" },
      { badge: "ENGINEERING", headline: "CEO, Ensidia Ltd" },
      { badge: "COMPLIANCE",  headline: "Built consent-first audit pipelines" },
    ],
    linkedin: "https://www.linkedin.com/in/stefandimitrov/",
  },
];

export const DID_YOU_KNOW: string[] = [
  "25+ years building internet companies on the team.",
  "50+ acquisitions led across hosting and SaaS.",
  "Capitol Hill testimony on internet policy.",
  "White House technology advisory experience.",
  "60+ employees managed across US, Europe, and Asia.",
  "Engineering experience dating back to 1999.",
];

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
