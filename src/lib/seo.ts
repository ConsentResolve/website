import { SITE } from "./site";

export interface SeoProps {
  title: string;
  description: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
  ogType?: "website" | "article";
}

export function buildCanonical(pathname: string): string {
  const clean = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return new URL(clean, SITE.url).toString();
}

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: new URL(item.href, SITE.url).toString(),
    })),
  };
}

/** Canonical Organization node — define once here (with a stable @id),
 *  cite everywhere via "@id": "https://consentresolve.com/#organization".
 *  Founder/employee @ids resolve to the Person nodes on /about/. */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE.url}/#organization`,
  name: SITE.name,
  legalName: SITE.name,
  url: `${SITE.url}/`,
  logo: {
    "@type": "ImageObject",
    "@id": `${SITE.url}/#logo`,
    url: `${SITE.url}/crnewlogo.svg`,
    contentUrl: `${SITE.url}/crnewlogo.svg`,
    caption: SITE.name,
  },
  image: `${SITE.url}/og-default.png`,
  description:
    "Consent Resolve is a consent-first website visitor identification layer. It identifies anonymous website visitors as sales leads only after each visitor gives explicit, logged consent — eliminating the wiretapping and privacy-law exposure created by traditional visitor-ID and pixel-tracking tools. Leads come from the customer's own website traffic, are sold exclusively, never resold, at a flat $7 per lead. Not a shared-lead marketplace.",
  slogan: "Consent-first by design. Audit trail on every lead.",
  foundingDate: "2025-12-01",
  foundingLocation: {
    "@type": "Place",
    address: { "@type": "PostalAddress", addressLocality: "St Pete Beach", addressRegion: "FL", addressCountry: "US" },
  },
  numberOfEmployees: { "@type": "QuantitativeValue", value: 5 },
  email: "hello@consentresolve.com",
  telephone: "+1-727-202-5996",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1907 Gulf Way #1",
    addressLocality: "St Pete Beach",
    addressRegion: "FL",
    postalCode: "33706",
    addressCountry: "US",
  },
  contactPoint: [
    { "@type": "ContactPoint", telephone: "+1-727-202-5996", email: "hello@consentresolve.com", contactType: "sales", areaServed: "US", availableLanguage: "English" },
    { "@type": "ContactPoint", telephone: "+1-727-202-5996", email: "hello@consentresolve.com", contactType: "customer support", areaServed: "US", availableLanguage: "English" },
  ],
  areaServed: { "@type": "Country", name: "United States" },
  makesOffer: [
    { "@type": "Offer", name: "Exclusive consented lead", description: "One consented, exclusive lead identified from the customer's own website traffic. Never resold. Includes a timestamped consent record. Flat $7, no contract, cancel anytime.", price: "7.00", priceCurrency: "USD", url: `${SITE.url}/pricing/` },
  ],
  knowsAbout: [
    "Website visitor identification", "Identity resolution", "Consent management",
    "Data privacy compliance", "California Invasion of Privacy Act (CIPA)",
    "Wiretapping litigation risk", "Lead generation for home service contractors",
    "GDPR", "CCPA", "First-party data",
  ],
  founder: [
    { "@id": `${SITE.url}/about/#andy-mentges` },
    { "@id": `${SITE.url}/about/#jason-beyke` },
    { "@id": `${SITE.url}/about/#aaron-phillips` },
  ],
  employee: [
    { "@id": `${SITE.url}/about/#andy-mentges` },
    { "@id": `${SITE.url}/about/#jason-beyke` },
    { "@id": `${SITE.url}/about/#aaron-phillips` },
    { "@id": `${SITE.url}/about/#tyler-spurlock` },
    { "@id": `${SITE.url}/about/#stefan-dimitrov` },
  ],
  sameAs: [
    "https://www.linkedin.com/company/consent-resolve/",
    "https://www.facebook.com/consentresolve",
    "https://medium.com/@consentresolve",
    "https://www.instagram.com/consentresolve/",
    "https://www.youtube.com/@ConsentResolve",
  ],
};

/** SoftwareApplication — emitted on the homepage so search engines treat
 *  Consent Resolve as a citable product, not just a content site. */
export const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE.name,
  description:
    "Consent-first ad-spend recovery layer for home-service contractors. Identifies the ~98% of website visitors who would otherwise bounce after they accept a consent banner, then feeds them back into the retargeting, email/SMS, and CRM funnels the contractor already runs. Same ad budget, more inbound calls. Flat $7 per recovered lead, exclusive, never resold.",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Marketing Recovery / Visitor Identification",
  operatingSystem: "Web",
  url: SITE.url,
  offers: {
    "@type": "Offer",
    price: "7.00",
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "7.00",
      priceCurrency: "USD",
      unitText: "per recovered lead",
    },
    description: "Flat $7 per recovered lead. Card required. No contract, cancel anytime.",
  },
  provider: { "@id": `${SITE.url}/#organization` },
};

/** Founder Person schema — fed by src/data/team.ts. */
export interface FounderInput {
  name: string;
  role: string;
  bio?: string;
  linkedin?: string;
  knowsAbout?: string[];
}
export function personSchema(p: FounderInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    jobTitle: p.role,
    ...(p.bio ? { description: p.bio } : {}),
    worksFor: { "@type": "Organization", name: SITE.name, url: SITE.url },
    ...(p.linkedin ? { sameAs: [p.linkedin] } : {}),
    ...(p.knowsAbout?.length ? { knowsAbout: p.knowsAbout } : {}),
  };
}

/** HowTo schema — emitted on /how-it-works/ for the 4-step product flow. */
export function howToSchema(opts: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
  totalTime?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    ...(opts.totalTime ? { totalTime: opts.totalTime } : {}),
    step: opts.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

/** ItemList — used by hubs (industries, compare, features). */
export function itemListSchema(opts: {
  name: string;
  items: { name: string; url: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    itemListElement: opts.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

/** DefinedTerm — glossary entries. */
export function definedTermSchema(opts: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Consent Resolve Glossary",
      url: `${SITE.url}/resources/glossary/`,
    },
  };
}

/** Article / BlogPosting — explainers (Article) and blog posts (BlogPosting).
 *  Author + publisher both resolve to the canonical Organization @id. */
export function articleSchema(opts: {
  type?: "Article" | "BlogPosting";
  headline: string;
  description: string;
  url: string;
  datePublished?: Date;
  dateModified?: Date;
  image?: string;
  /** Person author (E-E-A-T). When set, links to that Person @id (e.g. an
   *  /about/#slug node). Defaults to the Organization as author. */
  author?: { name: string; id: string };
}) {
  return {
    "@context": "https://schema.org",
    "@type": opts.type ?? "Article",
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    mainEntityOfPage: { "@type": "WebPage", "@id": opts.url },
    ...(opts.datePublished ? { datePublished: opts.datePublished.toISOString() } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified.toISOString() } : {}),
    ...(opts.image ? { image: opts.image.startsWith("http") ? opts.image : `${SITE.url}${opts.image}` } : {}),
    author: opts.author
      ? { "@type": "Person", "@id": opts.author.id, name: opts.author.name }
      : { "@id": `${SITE.url}/#organization` },
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  name: SITE.name,
  url: `${SITE.url}/`,
  publisher: { "@id": `${SITE.url}/#organization` },
};

export function faqSchema(qa: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function serviceSchema(opts: {
  serviceType: string;
  areaServed?: string;
  description?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    provider: { "@id": `${SITE.url}/#organization` },
    serviceType: opts.serviceType,
    ...(opts.areaServed ? { areaServed: opts.areaServed } : {}),
    ...(opts.description ? { description: opts.description } : {}),
  };
}

/** Service + Offer schema for industry pages — $7/lead canonical. */
export function industryServiceSchema(opts: {
  tradeName: string;
  tradeSlug: string;
  description: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${opts.tradeName} Lead Identification`,
    serviceType: `Consent-based visitor identification for ${opts.tradeName.toLowerCase()} businesses`,
    provider: { "@id": `${SITE.url}/#organization` },
    areaServed: "US",
    description: opts.description,
    offers: {
      "@type": "Offer",
      price: "7.00",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "7.00",
        priceCurrency: "USD",
        unitText: "per lead",
      },
      description: `Exclusive ${opts.tradeName.toLowerCase()} leads. Flat $7 per lead, never resold. Card required, cancel anytime.`,
    },
    url: `${SITE.url}/${opts.tradeSlug}-leads/`,
  };
}
