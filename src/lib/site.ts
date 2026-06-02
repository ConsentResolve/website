export const SITE = {
  name: "Consent Resolve",
  url: "https://consentresolve.com",
  description:
    "Identify website visitors after explicit consent. GDPR & CCPA compliant. Stop guessing — start following up.",
  defaultOgImage: "/og-default.png",
  twitter: "@consentresolve",
} as const;

export type NavItem = { label: string; href: string };

export const PRIMARY_NAV: NavItem[] = [
  { label: "How It Works", href: "/how-it-works/" },
  { label: "Industries", href: "/industries/" },
  { label: "Compare", href: "/compare/" },
  { label: "Pricing", href: "/pricing/" },
  { label: "Resources", href: "/resources/" },
];

export const FOOTER_NAV = {
  product: [
    { label: "How It Works", href: "/how-it-works/" },
    { label: "Pricing", href: "/pricing/" },
    { label: "Sample Lead", href: "/sample-lead/" },
    { label: "Demo", href: "/demo/" },
    { label: "Get Started", href: "/get-started/" },
  ],
  industries: [
    { label: "Plumbers", href: "/plumber-leads/" },
    { label: "Roofers", href: "/roofing-leads/" },
    { label: "HVAC", href: "/hvac-leads/" },
    { label: "Electricians", href: "/electrician-leads/" },
    { label: "All industries", href: "/industries/" },
  ],
  compare: [
    { label: "vs Google LSA", href: "/compare/google-local-service-ads/" },
    { label: "vs Thumbtack", href: "/compare/thumbtack/" },
    { label: "vs Angi", href: "/compare/angi/" },
    { label: "vs HomeAdvisor", href: "/compare/homeadvisor/" },
    { label: "All comparisons", href: "/compare/" },
  ],
  company: [
    { label: "About", href: "/about/" },
    { label: "Contact", href: "/contact/" },
    { label: "Blog", href: "/blog/" },
    { label: "FAQ", href: "/faq/" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy/" },
    { label: "Terms of Service", href: "/terms/" },
    { label: "Cookie Policy", href: "/cookie-policy/" },
    { label: "GDPR", href: "/gdpr/" },
    { label: "CCPA", href: "/ccpa/" },
  ],
} as const;
