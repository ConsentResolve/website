// Author bank — the five real Consent Resolve authors (source: 00-author-bank.md
// / consentresolve.com/about/). Drives blog bylines, author boxes, the
// /resources/authors/<slug>/ profile pages, and Person JSON-LD. Person @id is
// the author profile URL + #person, reused everywhere for E-E-A-T.
import { SITE } from "~/lib/site";

export interface Author {
  key: string;
  slug: string;
  name: string;
  title: string;
  photo: string;
  linkedin: string;
  location: string;
  tagline: string;
  writesAbout: string;
  knowsAbout: string[];
  alumniOf: string[];
  credentials: string[];
  shortBio: string;
  longBio: string;
}

export const AUTHORS: Record<string, Author> = {
  "andy-mentges": {
    key: "andy",
    slug: "andy-mentges",
    name: "Andy Mentges",
    title: "Chief Executive Officer",
    photo: "/team/andy-mentges.jpg",
    linkedin: "https://www.linkedin.com/in/andymentges/",
    location: "St. Petersburg, FL",
    tagline: "Fights regulators so you don't have to.",
    writesAbout: "Policy, privacy law, and the regulatory case for consent-first.",
    knowsAbout: ["internet policy", "data privacy law", "TCPA", "CIPA", "Texas TDPSA", "technology mergers and acquisitions", "email marketing", "web hosting industry"],
    alumniOf: ["Ohio Dominican University", "DePaul University"],
    credentials: ["Testified on Capitol Hill on internet policy", "White House technology-policy contributor", "i2Coalition Executive Board, Treasurer (2012–2020)", "Led 50+ acquisitions in hosting & SaaS", "CEO, VerticalResponse"],
    shortBio: "Andy Mentges is CEO of Consent Resolve and VerticalResponse. He has testified on Capitol Hill on internet policy, served as Treasurer on the i2Coalition executive board, and led 50+ acquisitions in hosting and SaaS.",
    longBio: "Andy Mentges is the CEO of Consent Resolve and the CEO of VerticalResponse. Over 25+ years he has launched, scaled, and exited multiple companies, including leading 50+ acquisitions as General Manager at Deluxe Corporation. He spent eight years on the i2Coalition executive board (including as Treasurer), has testified on Capitol Hill, and contributed to White House technology-policy discussions. MBA, Ohio Dominican University; MS in Information Systems, DePaul University.",
  },
  "jason-beyke": {
    key: "jason",
    slug: "jason-beyke",
    name: "Jason Beyke",
    title: "Chief Operating Officer",
    photo: "/team/jason-beyke.jpg",
    linkedin: "https://www.linkedin.com/in/jasonbeyke/",
    location: "Fort Myers, FL",
    tagline: "Turns chaos into systems.",
    writesAbout: "Operations, lead delivery, CRM/funnel systems, and the mechanics that keep leads flowing.",
    knowsAbout: ["business operations", "SaaS operations", "lead delivery systems", "CRM integration", "SEO platforms", "P&L management", "customer onboarding"],
    alumniOf: [],
    credentials: ["COO, VerticalResponse (since 2020)", "Ran P&L over 7 entities, 60+ employees, 4 locations at Deluxe", "Financial & operational due diligence on 10 acquisition targets", "BD lead at SEO platform Attracta"],
    shortBio: "Jason Beyke is COO of Consent Resolve and VerticalResponse. At Deluxe he held P&L over seven entities, 60+ employees, and four locations, and led due diligence on ten acquisitions.",
    longBio: "Jason Beyke is the COO of Consent Resolve and the COO of VerticalResponse. At Deluxe Corporation he was Director of Business Operations and Head of Hosting for North America, running due diligence on ten acquisition targets and full P&L over seven business entities, 60+ employees, and four locations. He spent 14 years growing Jumpline.com and led business development at SEO platform Attracta. The operational playbook behind Consent Resolve — onboarding, lead delivery, support — is his.",
  },
  "aaron-phillips": {
    key: "aaron",
    slug: "aaron-phillips",
    name: "Aaron Phillips",
    title: "Chief Marketing Officer & Co-Founder",
    photo: "/team/aaron-phillips.jpg",
    linkedin: "https://www.linkedin.com/in/aaronphillips/",
    location: "Coldspring, TX",
    tagline: "Positioning. Calling out the BS.",
    writesAbout: "Marketing, positioning, lead-gen strategy, and translating tech into contractor English.",
    knowsAbout: ["marketing for home-service contractors", "brand positioning", "lead generation", "StoryBrand messaging", "web hosting marketing", "cybersecurity marketing", "local SEO"],
    alumniOf: [],
    credentials: ["8 years cPanel executive leadership (CBO, VP Ops)", "CMO, Monarx (anti-malware)", "Business development at WHMCS", "i2Coalition board", "Runs Hey Aaron! Marketing for East Texas contractors"],
    shortBio: "Aaron Phillips is CMO and co-founder of Consent Resolve, with 20+ years marketing hosting, security, and SaaS. He spent eight years in cPanel executive leadership, was CMO of Monarx, and runs a marketing shop for home-service contractors in East Texas.",
    longBio: "Aaron Phillips is the CMO and a co-founder of Consent Resolve, with 20+ years marketing web hosting, security, and SaaS. He spent eight years in cPanel executive leadership (including Chief Business Officer and VP of Operations), handled business development at WHMCS, sat on the i2Coalition board, and served as CMO of anti-malware platform Monarx. He also runs Hey Aaron! Marketing, a consultancy serving plumbers, roofers, and other home-service contractors in East Texas — which is why Consent Resolve speaks contractor, not ad-tech.",
  },
  "tyler-spurlock": {
    key: "tyler",
    slug: "tyler-spurlock",
    name: "Tyler Spurlock",
    title: "Account Manager",
    photo: "/team/tyler-spurlock.jpg",
    linkedin: "https://www.linkedin.com/in/tylerspurlock-478660276/",
    location: "Cincinnati, OH",
    tagline: "The human who answers the phone.",
    writesAbout: "The contractor's-eye view — what real shops actually say, ask, and need.",
    knowsAbout: ["home-service contractor sales", "account management", "customer success", "consultative sales", "data analytics", "financial reporting"],
    alumniOf: ["University of Cincinnati"],
    credentials: ["Owned financial reporting on a $92M division (Hotel del Coronado)", "Daily consultative conversations with contractors", "Consultative sales & account management"],
    shortBio: "Tyler Spurlock is the Account Manager at Consent Resolve and the person who talks to contractors every day. A University of Cincinnati grad, he came up through financial and data analytics before consultative sales.",
    longBio: "Tyler Spurlock is the Account Manager at Consent Resolve and the person on the team who actually talks to contractors every day. A University of Cincinnati graduate, he came up through financial and data analytics — including reporting for the $92M-per-year food and beverage division at the Hotel del Coronado — before moving into consultative sales and account management. He hears what's working directly from customers and walks it back to engineering before any marketing copy gets written.",
  },
  "stefan-dimitrov": {
    key: "stefan",
    slug: "stefan-dimitrov",
    name: "Stefan Dimitrov",
    title: "Head of Engineering",
    photo: "/team/stefan-dimitrov.jpg",
    linkedin: "https://www.linkedin.com/in/stefandimitrov-2486b766/",
    location: "Bulgaria (EU)",
    tagline: "The guy who makes 'legal' actually true.",
    writesAbout: "How the product actually works, and how consent/compliance is built in code.",
    knowsAbout: ["web engineering", "GDPR compliance", "consent management", "data privacy engineering", "software architecture", "audit logging"],
    alumniOf: [],
    credentials: ["Writing production web code since 1999", "Co-founder, Data Crafted Consulting", "CEO, Ensidia Ltd", "Built the timestamped consent-logging pipeline", "Engineers to GDPR by default"],
    shortBio: "Stefan Dimitrov leads engineering at Consent Resolve. Writing production web code since 1999 and building under GDPR every day, he engineered the timestamped consent-logging pipeline behind every lead.",
    longBio: "Stefan Dimitrov leads engineering at Consent Resolve. He is co-founder of Data Crafted Consulting Ltd. and CEO of Ensidia Ltd., and has written production web code since 1999 — including nearly a decade as a web application developer at hosting provider Jumpline.com. Building from the EU, he works under GDPR, the world's strictest privacy regime, every day; Consent Resolve is engineered to that bar. He wrote the code that logs every consent with a timestamp and gives every lead an audit trail.",
  },
};

export const AUTHOR_ORDER = ["andy-mentges", "jason-beyke", "aaron-phillips", "tyler-spurlock", "stefan-dimitrov"];

export function getAuthor(slug: string): Author | undefined {
  return AUTHORS[slug];
}

/** Author profile URL + Person @id (E-E-A-T entity, reused across the site). */
export function authorUrl(slug: string): string {
  return `/resources/authors/${slug}/`;
}
export function authorPersonId(slug: string): string {
  return `${SITE.url}/resources/authors/${slug}/#person`;
}

/** Person JSON-LD node for an author (same @id everywhere). */
export function authorPersonSchema(a: Author) {
  return {
    "@type": "Person",
    "@id": authorPersonId(a.slug),
    name: a.name,
    jobTitle: a.title,
    worksFor: { "@id": `${SITE.url}/#organization` },
    url: `${SITE.url}${authorUrl(a.slug)}`,
    image: `${SITE.url}${a.photo}`,
    sameAs: [a.linkedin],
    knowsAbout: a.knowsAbout,
    ...(a.alumniOf.length ? { alumniOf: a.alumniOf.map((n) => ({ "@type": "EducationalOrganization", name: n })) } : {}),
    description: a.shortBio,
  };
}
