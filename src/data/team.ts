/**
 * Team data spine — feeds /about/ (stat band is separate; this drives the
 * "Receipts" credential grid and the team section). Bios + credentials are
 * the verified copy supplied for the About v2 rebuild (June 2026).
 *
 * Photos: drop a square JPG/PNG at /public/team/<slug>.jpg and set `photo`.
 * Until then the team cards render an initials avatar.
 *
 * FLAG before launch: confirm each LinkedIn URL resolves (schema sameAs must
 * match the real profile) — esp. aaronphillips vs aaronphillipsmarketing,
 * tylerspurlock-478660276, stefandimitrov-2486b766.
 */

export type BadgeType =
  | "POLICY" | "OPERATIONS" | "COMPLIANCE" | "MARKETING" | "CUSTOMER" | "ENGINEERING";

export interface Credential {
  /** Badge label (uppercase tag on the receipt card). */
  badge: BadgeType;
  /** The credential, in plain text. */
  headline: string;
}

export interface TeamMember {
  slug: string;
  name: string;
  /** Display role, e.g. "Chief Executive Officer". */
  role: string;
  /** City/region line under the role. */
  location: string;
  /** One-line hook in the team card. */
  hook: string;
  /** Bio paragraphs for the team card. */
  bioParas: string[];
  /** Plain-text, LinkedIn-verifiable credentials shown in the Receipts grid. */
  credentials: Credential[];
  linkedin: string;
  /** Optional public photo path under /public. Falls back to initials. */
  photo?: string;
}

export const TEAM: TeamMember[] = [
  {
    slug: "andy-mentges",
    name: "Andy Mentges",
    role: "Chief Executive Officer",
    location: "St. Petersburg, FL",
    hook: "Fights regulators so you don't have to.",
    bioParas: [
      "Andy Mentges is the CEO of Consent Resolve and the CEO of VerticalResponse, the email marketing platform founded in 2001. Over 25+ years in the technology industry he has launched, scaled, and exited multiple companies — including leading more than 50 acquisitions as General Manager at Deluxe Corporation, where he ran a $100M+ portfolio spanning web hosting, email marketing, and SEM brands.",
      "Andy served eight years on the Executive Board of the i2Coalition, the internet infrastructure industry's policy voice in Washington, including as Treasurer. He has testified on Capitol Hill and contributed to White House discussions on internet and technology policy — so when Consent Resolve says something is legally sound, it's coming from someone who has been in the room where those laws get debated. He holds an MBA from Ohio Dominican University and an MS in Information Systems from DePaul University.",
    ],
    credentials: [
      { badge: "POLICY",     headline: "Testified on Capitol Hill on internet policy" },
      { badge: "POLICY",     headline: "White House technology policy contributor" },
      { badge: "OPERATIONS", headline: "Led 50+ acquisitions in hosting & SaaS" },
      { badge: "COMPLIANCE", headline: "i2Coalition Executive Board, Treasurer (2012–2020)" },
    ],
    linkedin: "https://www.linkedin.com/in/andymentges/",
    photo: "/team/andy-mentges.jpg",
  },
  {
    slug: "jason-beyke",
    name: "Jason Beyke",
    role: "Chief Operating Officer",
    location: "Fort Myers, FL",
    hook: "Turns chaos into systems.",
    bioParas: [
      "Jason Beyke is the COO of Consent Resolve and the COO of VerticalResponse. At Deluxe Corporation he served as Director of Business Operations and Head of Hosting for North America, where he ran financial and operational due diligence on ten acquisition targets — nine of which closed — and then maintained full P&L responsibility over seven business entities, 60+ employees, and four locations across the US and Canada.",
      "Before that, he spent 14 years helping grow hosting provider Jumpline.com from a five-person shop and led business development at Attracta, one of the world's largest SEO platforms, growing the business 20% year-over-year within six months. The operational playbook behind Consent Resolve — onboarding, lead delivery, support — is his.",
    ],
    credentials: [
      { badge: "OPERATIONS", headline: "COO at VerticalResponse since 2020" },
      { badge: "OPERATIONS", headline: "Managed 7 business entities, 60+ employees, 4 locations at Deluxe" },
      { badge: "COMPLIANCE", headline: "Financial & operational due diligence on 10 acquisition targets" },
    ],
    linkedin: "https://www.linkedin.com/in/jasonbeyke/",
    photo: "/team/jason-beyke.jpg",
  },
  {
    slug: "aaron-phillips",
    name: "Aaron Phillips",
    role: "Chief Marketing Officer",
    location: "Coldspring, TX",
    hook: "Positioning. Calling out the BS.",
    bioParas: [
      "Aaron Phillips is the CMO and a co-founder of Consent Resolve, with 20+ years marketing web hosting, security, and SaaS to audiences who can smell a sales pitch a mile away. He spent eight years in executive leadership at cPanel — including Chief Business Officer and VP of Operations — handled business development at WHMCS, sat on the i2Coalition board, and most recently served as CMO of anti-malware platform Monarx.",
      "Aaron also runs Hey Aaron! Marketing, a consultancy serving plumbers, roofers, and other home-service contractors in East Texas. That's not a side note — it's why Consent Resolve speaks contractor instead of ad-tech. Every job he's had has been some version of \"translate complicated tech into plain English without lying about it.\" That's the job here, too.",
    ],
    credentials: [
      { badge: "MARKETING", headline: "8 years in cPanel executive leadership" },
      { badge: "MARKETING", headline: "CMO at anti-malware platform Monarx" },
      { badge: "MARKETING", headline: "Runs a marketing shop for real contractors in East Texas" },
    ],
    linkedin: "https://www.linkedin.com/in/aaronphillips/",
    photo: "/team/aaron-phillips.jpg",
  },
  {
    slug: "tyler-spurlock",
    name: "Tyler Spurlock",
    role: "Account Manager",
    location: "Cincinnati, OH",
    hook: "The human who answers the phone.",
    bioParas: [
      "Tyler Spurlock is the Account Manager at Consent Resolve and the person on the team who actually talks to contractors and brands every day. A University of Cincinnati graduate, he came up through financial and data analytics — including reporting for the $92M-per-year food and beverage division at the Hotel del Coronado — before moving into consultative sales and account management.",
      "Tyler hears what's working and what isn't directly from customers, and walks it back to engineering before any marketing copy gets written. If a claim survives Tyler, it survives contact with real contractors. When you call (727) 202-5996, he's usually who picks up.",
    ],
    credentials: [
      { badge: "CUSTOMER", headline: "Owned financial reporting on a $92M division" },
      { badge: "CUSTOMER", headline: "Daily conversations with contractors" },
    ],
    linkedin: "https://www.linkedin.com/in/tylerspurlock-478660276/",
    photo: "/team/tyler-spurlock.jpg",
  },
  {
    slug: "stefan-dimitrov",
    name: "Stefan Dimitrov",
    role: "Engineering",
    location: "Bulgaria (EU)",
    hook: "The guy who makes \"legal\" actually true.",
    bioParas: [
      "Stefan Dimitrov leads engineering at Consent Resolve. He is the co-founder of Data Crafted Consulting Ltd. and CEO of Ensidia Ltd., and has been writing production web code since 1999 — including nearly a decade as a web application developer at hosting provider Jumpline.com, back when \"compliance\" meant a meta tag.",
      "Building from the EU means Stefan works under the world's strictest privacy regime, GDPR, every day — and Consent Resolve is engineered to that bar, not the loosest one we could get away with. When the product says every consent is logged with a timestamp and every lead carries an audit trail, that's because Stefan wrote the code that does it.",
    ],
    credentials: [
      { badge: "ENGINEERING", headline: "Writing production web code since 1999" },
      { badge: "ENGINEERING", headline: "Co-founder, Data Crafted Consulting · CEO, Ensidia Ltd" },
      { badge: "COMPLIANCE",  headline: "Built the timestamped consent-logging pipeline" },
    ],
    linkedin: "https://www.linkedin.com/in/stefandimitrov-2486b766/",
    photo: "/team/stefan-dimitrov.jpg",
  },
];

/** Flat list of every credential with its owner — drives the Receipts grid. */
export const RECEIPTS = TEAM.flatMap((m) =>
  m.credentials.map((c) => ({ ...c, who: m.name })),
);

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
