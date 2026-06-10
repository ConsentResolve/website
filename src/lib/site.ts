export const SITE = {
  name: "Consent Resolve",
  url: "https://consentresolve.com",
  description:
    "Identify website visitors after explicit consent. GDPR & CCPA compliant. Stop guessing — start following up.",
  defaultOgImage: "/og-default.png",
  twitter: "@consentresolve",
  // NAP — single source of truth
  email: "hello@consentresolve.com",
  phone: "(727) 202-5996",
  phoneE164: "+17272025996",
  address: {
    street: "1907 Gulf Way #1",
    city: "St Pete Beach",
    region: "FL",
    postalCode: "33706",
    country: "US",
  },
  hours: "Mon–Fri 9a–6p Eastern",
} as const;

export type NavItem = {
  label: string;
  href: string;
  /** Optional second line in dropdown panels. */
  desc?: string;
  /** When present, this item renders as a dropdown; `href` is the hub link. */
  children?: NavItem[];
};

export const PRIMARY_NAV: NavItem[] = [
  { label: "Features", href: "/features/" },
  { label: "How It Works", href: "/how-it-works/" },
  {
    label: "Industries",
    href: "/industries/",
    children: [
      { label: "Plumbers", href: "/plumber-leads/" },
      { label: "Roofers", href: "/roofing-leads/" },
      { label: "HVAC", href: "/hvac-leads/" },
      { label: "Electricians", href: "/electrician-leads/" },
      { label: "General Contractors", href: "/general-contractor-leads/" },
      { label: "All industries →", href: "/industries/" },
    ],
  },
  {
    label: "Resources",
    href: "/resources/",
    children: [
      { label: "How-To Guides", href: "/resources/how-to-guides/", desc: "Step-by-step playbooks" },
      { label: "Glossary", href: "/resources/glossary/", desc: "Plain-English definitions" },
      { label: "Straight Answers", href: "/resources/plain-language-explainers/", desc: "Plain “What is X?” answers" },
      { label: "Blog", href: "/resources/blog/", desc: "Ideas & evidence" },
      { label: "Channel Comparisons", href: "/resources/compare/", desc: "With/without booked-job math" },
      { label: "All resources →", href: "/resources/" },
    ],
  },
  { label: "Pricing", href: "/pricing/" },
];

export const FOOTER_NAV = {
  product: [
    { label: "Features", href: "/features/" },
    { label: "How It Works", href: "/how-it-works/" },
    { label: "Live Demo", href: "/demo/" },
    { label: "Channel ROI", href: "/resources/compare/" },
    { label: "Pricing", href: "/pricing/" },
    { label: "Get Started", href: "https://dashboard.consentresolve.com/register" },
  ],
  industries: [
    { label: "Plumbers", href: "/plumber-leads/" },
    { label: "Roofers", href: "/roofing-leads/" },
    { label: "HVAC", href: "/hvac-leads/" },
    { label: "Electricians", href: "/electrician-leads/" },
    { label: "All industries", href: "/industries/" },
  ],
  channels: [
    { label: "+ Google LSA", href: "/resources/compare/google-local-service-ads/" },
    { label: "+ Thumbtack", href: "/resources/compare/thumbtack/" },
    { label: "+ Angi", href: "/resources/compare/angi/" },
    { label: "+ HomeAdvisor", href: "/resources/compare/homeadvisor/" },
    { label: "All channels", href: "/resources/compare/" },
  ],
  company: [
    { label: "About", href: "/about/" },
    { label: "Why consent-first", href: "/why-consent-first/" },
    { label: "Contact", href: "/contact/" },
    { label: "Resource Center", href: "/resources/" },
    { label: "Straight Answers", href: "/resources/plain-language-explainers/" },
    { label: "Stats & Sources", href: "/stats/" },
    { label: "Glossary", href: "/resources/glossary/" },
    { label: "FAQ", href: "/faq/" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy-policy/" },
    { label: "Terms of Service", href: "/terms/" },
    { label: "EULA", href: "/eula/" },
    { label: "Disclaimer", href: "/disclaimer/" },
    { label: "Cookie Policy", href: "/cookie-policy/" },
    { label: "GDPR", href: "/gdpr/" },
    { label: "CCPA", href: "/ccpa/" },
  ],
} as const;
