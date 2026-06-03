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
