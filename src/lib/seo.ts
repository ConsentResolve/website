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

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  email: "hello@consentresolve.com",
  telephone: "+1-727-202-5996",
  logo: `${SITE.url}/favicon.svg`,
  sameAs: [
    "https://www.linkedin.com/company/consentresolve/",
  ],
  address: {
    "@type": "PostalAddress",
    streetAddress: "1907 Gulf Way #1",
    addressLocality: "St Pete Beach",
    addressRegion: "FL",
    postalCode: "33706",
    addressCountry: "US",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+1-727-202-5996",
    email: "hello@consentresolve.com",
    contactType: "customer service",
    areaServed: "US",
    availableLanguage: ["en"],
  },
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
  provider: { "@type": "Organization", name: SITE.name, url: SITE.url },
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

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: SITE.url,
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
    provider: { "@type": "Organization", name: SITE.name, url: SITE.url },
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
    provider: { "@type": "Organization", name: SITE.name, url: SITE.url + "/" },
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
