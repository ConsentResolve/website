// Glossary terms — sourced from the home-service marketing & consent glossary.
// 138 plain-English definitions. Rendered on /resources/glossary/.
export interface GlossaryRelated { id: string; label: string; }
export interface GlossaryTerm { id: string; term: string; category: string; definition: string; related: GlossaryRelated[]; }
export interface GlossaryCategory { key: string; label: string; count: number; }

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  {
    "key": "consent",
    "label": "Privacy & Consent",
    "count": 31
  },
  {
    "key": "visid",
    "label": "Visitor Identification",
    "count": 24
  },
  {
    "key": "leadgen",
    "label": "Lead Generation",
    "count": 22
  },
  {
    "key": "metrics",
    "label": "Metrics & ROI",
    "count": 27
  },
  {
    "key": "channels",
    "label": "Marketing Channels",
    "count": 18
  },
  {
    "key": "homeserv",
    "label": "Home Services",
    "count": 16
  }
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    "id": "a-b-testing",
    "term": "A/B Testing",
    "category": "metrics",
    "definition": "A/B testing compares two versions of something, such as a landing page or ad, by showing each to part of your audience to see which performs better. It replaces guessing with evidence about what actually drives conversions. Even simple tests, run honestly, compound into real gains over time.",
    "related": [
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      },
      {
        "id": "landing-page",
        "label": "Landing Page"
      },
      {
        "id": "key-performance-indicator-kpi",
        "label": "Key Performance Indicator (KPI)"
      }
    ]
  },
  {
    "id": "aged-lead",
    "term": "Aged Lead",
    "category": "leadgen",
    "definition": "An aged lead is an older lead, often weeks or months old, resold at a discount after it failed to convert for someone else. They are cheap for a reason: intent has cooled and the consent behind them is frequently unclear. Buying aged leads is one of the easiest ways to inherit someone else's compliance risk.",
    "related": [
      {
        "id": "shared-lead",
        "label": "Shared Lead"
      },
      {
        "id": "lead-provenance",
        "label": "Lead Provenance"
      },
      {
        "id": "cold-lead",
        "label": "Cold Lead"
      }
    ]
  },
  {
    "id": "anonymization",
    "term": "Anonymization",
    "category": "consent",
    "definition": "Anonymization is irreversibly stripping personal identifiers from data so it can no longer be traced back to an individual. Truly anonymized data falls outside most privacy laws because it is no longer personal. The catch is that weak anonymization can often be reversed, which is why it must be done carefully.",
    "related": [
      {
        "id": "pseudonymization",
        "label": "Pseudonymization"
      },
      {
        "id": "pii",
        "label": "PII"
      },
      {
        "id": "hashed-email",
        "label": "Hashed Email"
      }
    ]
  },
  {
    "id": "anonymous-visitor",
    "term": "Anonymous Visitor",
    "category": "visid",
    "definition": "An anonymous visitor is someone browsing your website who has not filled out a form or otherwise told you who they are. The vast majority of website traffic is anonymous, which is why most ad spend produces no contact. The question is whether you recover them with consent or without it.",
    "related": [
      {
        "id": "visitor-identification",
        "label": "Visitor Identification"
      },
      {
        "id": "form-fill",
        "label": "Form Fill"
      },
      {
        "id": "website-conversion-rate",
        "label": "Website Conversion Rate"
      }
    ]
  },
  {
    "id": "attribution",
    "term": "Attribution",
    "category": "metrics",
    "definition": "Attribution is figuring out which marketing efforts get credit for a lead or sale. It answers the question every contractor asks: which of my marketing dollars actually worked? Getting it roughly right is what lets you cut what fails and double down on what books jobs.",
    "related": [
      {
        "id": "multitouch-attribution",
        "label": "Multi-Touch Attribution"
      },
      {
        "id": "conversion",
        "label": "Conversion"
      },
      {
        "id": "return-on-investment-roi",
        "label": "Return on Investment (ROI)"
      }
    ]
  },
  {
    "id": "autodialer-atds",
    "term": "Autodialer (ATDS)",
    "category": "consent",
    "definition": "An autodialer, or ATDS (automatic telephone dialing system), is equipment that dials phone numbers automatically rather than one at a time by hand. The TCPA places heavy restrictions on using one to call or text mobile numbers without consent, and the term has been the subject of major litigation. If your outreach touches an autodialer, your consent needs to be airtight.",
    "related": [
      {
        "id": "tcpa",
        "label": "TCPA"
      },
      {
        "id": "robocall",
        "label": "Robocall"
      },
      {
        "id": "express-written-consent",
        "label": "Express Written Consent"
      }
    ]
  },
  {
    "id": "average-ticket",
    "term": "Average Ticket",
    "category": "metrics",
    "definition": "Average ticket is the typical revenue from one job or transaction, found by dividing total revenue by number of jobs. If you did $100,000 across 200 jobs, your average ticket is $500. It is the anchor for deciding what you can afford to pay for a lead.",
    "related": [
      {
        "id": "lifetime-value-ltv",
        "label": "Lifetime Value (LTV)"
      },
      {
        "id": "cost-per-lead-cpl",
        "label": "Cost Per Lead (CPL)"
      },
      {
        "id": "return-on-investment-roi",
        "label": "Return on Investment (ROI)"
      }
    ]
  },
  {
    "id": "biometric-data",
    "term": "Biometric Data",
    "category": "consent",
    "definition": "Biometric data is information derived from a person's physical traits, such as fingerprints, facial geometry, or voiceprints. It is treated as especially sensitive and is regulated by specific laws, including Illinois's BIPA, which carries steep per-violation penalties. Most home-service marketing never touches it, but it is worth knowing the line exists.",
    "related": [
      {
        "id": "pii",
        "label": "PII"
      },
      {
        "id": "state-privacy-laws",
        "label": "State Privacy Laws"
      },
      {
        "id": "device-fingerprinting",
        "label": "Device Fingerprinting"
      }
    ]
  },
  {
    "id": "booked-job",
    "term": "Booked Job",
    "category": "homeserv",
    "definition": "A booked job is a lead that has turned into a scheduled, confirmed appointment, which is the real goal of all the marketing upstream of it. Leads and clicks are only proxies; the booked job is the thing that pays. Measuring cost and conversion all the way to booked jobs keeps marketing honest.",
    "related": [
      {
        "id": "close-rate",
        "label": "Close Rate"
      },
      {
        "id": "conversion",
        "label": "Conversion"
      },
      {
        "id": "cost-per-booked-job",
        "label": "Cost Per Booked Job"
      }
    ]
  },
  {
    "id": "bounce-rate",
    "term": "Bounce Rate",
    "category": "metrics",
    "definition": "Bounce rate is the percentage of visitors who leave after viewing just one page without interacting. A high bounce rate on a landing page can signal a mismatch between what you promised and what the page delivered. Context matters: a high bounce on a quick-answer blog post may be perfectly fine.",
    "related": [
      {
        "id": "website-conversion-rate",
        "label": "Website Conversion Rate"
      },
      {
        "id": "landing-page",
        "label": "Landing Page"
      },
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      }
    ]
  },
  {
    "id": "brand-awareness",
    "term": "Brand Awareness",
    "category": "channels",
    "definition": "Brand awareness is how familiar potential customers are with your business before they need you. It is hard to measure directly, but it strongly influences whether someone clicks your ad, trusts your site, and chooses you over a competitor. The more they have seen your name, the easier every other marketing dollar works.",
    "related": [
      {
        "id": "display-ads",
        "label": "Display Ads"
      },
      {
        "id": "direct-mail",
        "label": "Direct Mail"
      },
      {
        "id": "yard-sign",
        "label": "Yard Sign"
      }
    ]
  },
  {
    "id": "call-tracking",
    "term": "Call Tracking",
    "category": "leadgen",
    "definition": "Call tracking uses a unique phone number for each marketing channel so you can see which efforts actually generate phone calls. It answers whether your Google ad, your truck wrap, or your website is producing the calls. For phone-driven trades, it is essential for knowing what to keep paying for.",
    "related": [
      {
        "id": "attribution",
        "label": "Attribution"
      },
      {
        "id": "utm-parameters",
        "label": "UTM Parameters"
      },
      {
        "id": "cost-per-lead-cpl",
        "label": "Cost Per Lead (CPL)"
      }
    ]
  },
  {
    "id": "canspam-act",
    "term": "CAN-SPAM Act",
    "category": "consent",
    "definition": "The CAN-SPAM Act is the U.S. law that sets the rules for commercial email, requiring honest subject lines, a real physical mailing address, and a working unsubscribe link honored promptly. Unlike the TCPA's opt-in standard for calls and texts, email is largely opt-out: you can email until someone unsubscribes, but you must make leaving easy. Ignoring an unsubscribe is where most email violations happen.",
    "related": [
      {
        "id": "tcpa",
        "label": "TCPA"
      },
      {
        "id": "optout",
        "label": "Opt-Out"
      },
      {
        "id": "email-marketing",
        "label": "Email Marketing"
      }
    ]
  },
  {
    "id": "ccpa-cpra",
    "term": "CCPA / CPRA",
    "category": "consent",
    "definition": "The CCPA and its amendment the CPRA are California laws that give residents rights over their personal information, including the right to know what is collected, to delete it, and to opt out of its sale or sharing. They apply to many businesses that handle California consumers' data, even from outside the state. They are the most influential of a growing set of U.S. state privacy laws.",
    "related": [
      {
        "id": "pii",
        "label": "PII"
      },
      {
        "id": "data-broker",
        "label": "Data Broker"
      },
      {
        "id": "gdpr",
        "label": "GDPR"
      }
    ]
  },
  {
    "id": "churn-rate",
    "term": "Churn Rate",
    "category": "metrics",
    "definition": "Churn rate is the percentage of customers you lose over a period of time. For trades with recurring revenue, like maintenance plans, low churn is what protects lifetime value. Reducing churn is usually cheaper than replacing customers with new acquisition.",
    "related": [
      {
        "id": "lifetime-value-ltv",
        "label": "Lifetime Value (LTV)"
      },
      {
        "id": "maintenance-plan",
        "label": "Maintenance Plan"
      },
      {
        "id": "customer-acquisition-cost-cac",
        "label": "Customer Acquisition Cost (CAC)"
      }
    ]
  },
  {
    "id": "clickthrough-rate-ctr",
    "term": "Click-Through Rate (CTR)",
    "category": "metrics",
    "definition": "Click-through rate (CTR) is the percentage of people who click an ad or link after seeing it. If 1,000 people see an ad and 30 click, the CTR is 3%. It tells you whether your message is compelling, but clicks only matter if they convert.",
    "related": [
      {
        "id": "cost-per-click-cpc",
        "label": "Cost Per Click (CPC)"
      },
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      }
    ]
  },
  {
    "id": "close-rate",
    "term": "Close Rate",
    "category": "leadgen",
    "definition": "Close rate is the percentage of leads or estimates that turn into booked jobs. It reveals how well your sales process converts the demand your marketing creates. A modest lift in close rate often beats spending more on leads.",
    "related": [
      {
        "id": "booked-job",
        "label": "Booked Job"
      },
      {
        "id": "estimate",
        "label": "Estimate"
      },
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      }
    ]
  },
  {
    "id": "cold-lead",
    "term": "Cold Lead",
    "category": "leadgen",
    "definition": "A cold lead is a potential customer with no prior relationship with you and no expressed interest yet. Converting them takes more touches and more trust-building than a warm lead. Cold outreach also carries the most consent and compliance considerations.",
    "related": [
      {
        "id": "warm-lead",
        "label": "Warm Lead"
      },
      {
        "id": "outbound-marketing",
        "label": "Outbound Marketing"
      },
      {
        "id": "aged-lead",
        "label": "Aged Lead"
      }
    ]
  },
  {
    "id": "consent",
    "term": "Consent",
    "category": "consent",
    "definition": "Consent is a person's clear, informed agreement to be contacted or to have their information used for a stated purpose. In marketing, it is the legal and ethical foundation that separates a welcome message from an unwanted one. Strong consent records who agreed, to what, when, and how.",
    "related": [
      {
        "id": "optin",
        "label": "Opt-In"
      },
      {
        "id": "express-written-consent",
        "label": "Express Written Consent"
      },
      {
        "id": "consent-management-platform-cmp",
        "label": "Consent Management Platform (CMP)"
      }
    ]
  },
  {
    "id": "consent-management-platform-cmp",
    "term": "Consent Management Platform (CMP)",
    "category": "consent",
    "definition": "A Consent Management Platform (CMP) is software that captures, records, and stores the consent a website visitor gives, along with proof of when and how they gave it. It is the system of record that lets you demonstrate a lead actually agreed to be contacted. ConsentResolve connects to CMP signals so the consent and the contact are linked from the start.",
    "related": [
      {
        "id": "cookie-consent",
        "label": "Cookie Consent"
      },
      {
        "id": "consent",
        "label": "Consent"
      },
      {
        "id": "consent-trail",
        "label": "Consent Trail"
      }
    ]
  },
  {
    "id": "consent-trail",
    "term": "Consent Trail",
    "category": "consent",
    "definition": "A consent trail is the documented record proving a specific person agreed to be contacted, capturing what they consented to, when, where, and how. It is what you show if a contact is ever challenged. ConsentResolve attaches a consent trail to every lead so the proof travels with the contact.",
    "related": [
      {
        "id": "consent-management-platform-cmp",
        "label": "Consent Management Platform (CMP)"
      },
      {
        "id": "express-written-consent",
        "label": "Express Written Consent"
      },
      {
        "id": "lead-provenance",
        "label": "Lead Provenance"
      }
    ]
  },
  {
    "id": "consentfirst",
    "term": "Consent-First",
    "category": "consent",
    "definition": "Consent-first is an approach where a business only identifies and contacts website visitors who have actively agreed to it, rather than de-anonymizing everyone who lands on the site. It is the principle ConsentResolve is built on. The result is fewer leads than a no-consent vendor, but leads you can contact without taking on legal risk.",
    "related": [
      {
        "id": "visitor-identification",
        "label": "Visitor Identification"
      },
      {
        "id": "optin",
        "label": "Opt-In"
      },
      {
        "id": "emailgrade-lead",
        "label": "Email-Grade Lead"
      }
    ]
  },
  {
    "id": "content-marketing",
    "term": "Content Marketing",
    "category": "channels",
    "definition": "Content marketing is creating useful information, such as guides, FAQs, and articles, that attracts and educates potential customers. For home services it answers the questions people search before they hire, building trust and SEO at once. A glossary like this one is content marketing in action.",
    "related": [
      {
        "id": "seo-search-engine-optimization",
        "label": "SEO (Search Engine Optimization)"
      },
      {
        "id": "inbound-marketing",
        "label": "Inbound Marketing"
      },
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      }
    ]
  },
  {
    "id": "conversion",
    "term": "Conversion",
    "category": "metrics",
    "definition": "A conversion is when a visitor takes the action you wanted, such as filling out a form, calling, or booking. It does not always mean a sale, but it marks real progress down the funnel. Defining your conversion clearly is what makes all your other metrics meaningful.",
    "related": [
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      },
      {
        "id": "funnel",
        "label": "Funnel"
      },
      {
        "id": "form-fill",
        "label": "Form Fill"
      }
    ]
  },
  {
    "id": "conversion-rate",
    "term": "Conversion Rate",
    "category": "metrics",
    "definition": "Conversion rate is the percentage of visitors who take your desired action. If 1,000 people visit and 30 fill out a form, your conversion rate is 3%. It is the lever that often moves results faster than buying more traffic.",
    "related": [
      {
        "id": "conversion",
        "label": "Conversion"
      },
      {
        "id": "website-conversion-rate",
        "label": "Website Conversion Rate"
      },
      {
        "id": "landing-page",
        "label": "Landing Page"
      }
    ]
  },
  {
    "id": "cookie",
    "term": "Cookie",
    "category": "visid",
    "definition": "A cookie is a small file a website stores in a visitor's browser to remember information between visits. First-party cookies are set by the site you're on and are widely accepted; third-party cookies, set by other domains for tracking, are being phased out by major browsers. Their decline is pushing marketing toward consented, first-party approaches.",
    "related": [
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      },
      {
        "id": "cookie-consent",
        "label": "Cookie Consent"
      },
      {
        "id": "device-fingerprinting",
        "label": "Device Fingerprinting"
      }
    ]
  },
  {
    "id": "cookie-consent",
    "term": "Cookie Consent",
    "category": "consent",
    "definition": "Cookie consent is the visitor's agreement to let a website store and read cookies or similar trackers in their browser, usually captured through a banner. It governs analytics, advertising, and some identification tools. Done properly, it is part of the documented trail showing a visitor agreed to tracking.",
    "related": [
      {
        "id": "consent-management-platform-cmp",
        "label": "Consent Management Platform (CMP)"
      },
      {
        "id": "pixel",
        "label": "Pixel"
      },
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      }
    ]
  },
  {
    "id": "cost-per-acquisition-cpa",
    "term": "Cost Per Acquisition (CPA)",
    "category": "metrics",
    "definition": "Cost per acquisition (CPA) is what it costs to win an actual paying customer, not just a lead. Because only some leads become jobs, CPA is always higher than CPL. It is the number to compare against your average ticket and lifetime value.",
    "related": [
      {
        "id": "cost-per-lead-cpl",
        "label": "Cost Per Lead (CPL)"
      },
      {
        "id": "customer-acquisition-cost-cac",
        "label": "Customer Acquisition Cost (CAC)"
      },
      {
        "id": "lifetime-value-ltv",
        "label": "Lifetime Value (LTV)"
      }
    ]
  },
  {
    "id": "cost-per-booked-job",
    "term": "Cost Per Booked Job",
    "category": "metrics",
    "definition": "Cost per booked job is your total marketing spend divided by the number of jobs you actually booked, not just leads generated. It is the truest cost metric for a contractor because it ties spend to revenue, not to activity. A channel with cheap leads but a high cost per booked job is quietly losing money.",
    "related": [
      {
        "id": "cost-per-acquisition-cpa",
        "label": "Cost Per Acquisition (CPA)"
      },
      {
        "id": "close-rate",
        "label": "Close Rate"
      },
      {
        "id": "average-ticket",
        "label": "Average Ticket"
      }
    ]
  },
  {
    "id": "cost-per-click-cpc",
    "term": "Cost Per Click (CPC)",
    "category": "metrics",
    "definition": "Cost per click (CPC) is what you pay each time someone clicks your ad on platforms like Google Ads. In competitive home-service trades a single click can cost anywhere from a few dollars to well over fifty. CPC only tells half the story; what matters is the cost of the clicks that actually become jobs.",
    "related": [
      {
        "id": "cost-per-lead-cpl",
        "label": "Cost Per Lead (CPL)"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      },
      {
        "id": "clickthrough-rate-ctr",
        "label": "Click-Through Rate (CTR)"
      }
    ]
  },
  {
    "id": "cost-per-lead-cpl",
    "term": "Cost Per Lead (CPL)",
    "category": "metrics",
    "definition": "Cost per lead (CPL) is what you pay to generate a single lead, calculated by dividing marketing spend by the number of leads it produced. It is the metric most home-service contractors live and die by. A flat, predictable CPL makes budgeting sane in a way that auction-based ad costs rarely do.",
    "related": [
      {
        "id": "cost-per-acquisition-cpa",
        "label": "Cost Per Acquisition (CPA)"
      },
      {
        "id": "exclusive-lead",
        "label": "Exclusive Lead"
      },
      {
        "id": "average-ticket",
        "label": "Average Ticket"
      }
    ]
  },
  {
    "id": "cpm-cost-per-mille",
    "term": "CPM (Cost Per Mille)",
    "category": "metrics",
    "definition": "CPM (cost per mille) is the cost to show your ad one thousand times, the standard pricing unit for awareness advertising. It measures the cost of exposure, not of leads or sales. It's useful for comparing reach efficiency but says nothing about whether anyone booked.",
    "related": [
      {
        "id": "impressions",
        "label": "Impressions"
      },
      {
        "id": "cost-per-click-cpc",
        "label": "Cost Per Click (CPC)"
      },
      {
        "id": "display-ads",
        "label": "Display Ads"
      }
    ]
  },
  {
    "id": "crm",
    "term": "CRM",
    "category": "channels",
    "definition": "A CRM (customer relationship management system) is software for tracking leads, customers, and every interaction with them in one place. It is where follow-up gets organized so leads do not fall through the cracks. For a busy crew, the CRM is the memory the business cannot keep in its head.",
    "related": [
      {
        "id": "lead-nurturing",
        "label": "Lead Nurturing"
      },
      {
        "id": "drip-campaign",
        "label": "Drip Campaign"
      },
      {
        "id": "pipeline",
        "label": "Pipeline"
      }
    ]
  },
  {
    "id": "crossdevice-tracking",
    "term": "Cross-Device Tracking",
    "category": "visid",
    "definition": "Cross-device tracking follows a single person as they move between phone, tablet, and computer. It gives a fuller picture of the path to booking, since people rarely research and convert on the same device. Because it stitches identities together, the consent and method behind it matter a great deal.",
    "related": [
      {
        "id": "identity-graph",
        "label": "Identity Graph"
      },
      {
        "id": "identity-resolution",
        "label": "Identity Resolution"
      },
      {
        "id": "cookie",
        "label": "Cookie"
      }
    ]
  },
  {
    "id": "customer-acquisition-cost-cac",
    "term": "Customer Acquisition Cost (CAC)",
    "category": "metrics",
    "definition": "Customer acquisition cost (CAC) is the total cost of winning a new customer, found by dividing all marketing and sales spend by the number of customers gained. If you spent $10,000 and gained 50, your CAC is $200. It is healthy only when it is comfortably below the value that customer brings you.",
    "related": [
      {
        "id": "lifetime-value-ltv",
        "label": "Lifetime Value (LTV)"
      },
      {
        "id": "cost-per-acquisition-cpa",
        "label": "Cost Per Acquisition (CPA)"
      },
      {
        "id": "return-on-investment-roi",
        "label": "Return on Investment (ROI)"
      }
    ]
  },
  {
    "id": "customer-data-platform-cdp",
    "term": "Customer Data Platform (CDP)",
    "category": "visid",
    "definition": "A customer data platform (CDP) is software that unifies customer information from all your sources into a single, usable profile. It gives marketing one clean view of each customer instead of scattered records. A CDP is only as trustworthy as the consent behind the data flowing into it.",
    "related": [
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      },
      {
        "id": "data-enrichment",
        "label": "Data Enrichment"
      },
      {
        "id": "crm",
        "label": "CRM"
      }
    ]
  },
  {
    "id": "data-broker",
    "term": "Data Broker",
    "category": "consent",
    "definition": "A data broker is a company that collects personal information from many sources and sells or licenses it to others, often without the individual's direct knowledge. Many visitor-identification tools quietly rely on broker data to put a name to an anonymous visitor. Consent-first identification avoids depending on that pipeline.",
    "related": [
      {
        "id": "thirdparty-data",
        "label": "Third-Party Data"
      },
      {
        "id": "visitor-identification",
        "label": "Visitor Identification"
      },
      {
        "id": "deanonymization",
        "label": "De-anonymization"
      }
    ]
  },
  {
    "id": "data-controller",
    "term": "Data Controller",
    "category": "consent",
    "definition": "A data controller is the party that decides why and how personal data gets collected and used, a key role under GDPR and similar laws. In a contractor's world, you are usually the controller of your customers' data. The controller carries the primary legal responsibility for protecting it.",
    "related": [
      {
        "id": "data-processor",
        "label": "Data Processor"
      },
      {
        "id": "gdpr",
        "label": "GDPR"
      },
      {
        "id": "pii",
        "label": "PII"
      }
    ]
  },
  {
    "id": "data-enrichment",
    "term": "Data Enrichment",
    "category": "visid",
    "definition": "Data enrichment is adding extra detail to a contact record, such as company, role, or location, to make follow-up more relevant. Useful enrichment builds on data the person provided or consented to. Enrichment that quietly appends purchased personal data reintroduces the consent problem.",
    "related": [
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      },
      {
        "id": "thirdparty-data",
        "label": "Third-Party Data"
      },
      {
        "id": "crm",
        "label": "CRM"
      }
    ]
  },
  {
    "id": "data-minimization",
    "term": "Data Minimization",
    "category": "consent",
    "definition": "Data minimization is the privacy principle of collecting only the personal information you actually need for a stated purpose, and no more. It reduces both your risk if data is breached and your obligations under privacy laws. Collecting less is one of the simplest ways to stay compliant.",
    "related": [
      {
        "id": "pii",
        "label": "PII"
      },
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      },
      {
        "id": "privacy-policy",
        "label": "Privacy Policy"
      }
    ]
  },
  {
    "id": "data-processor",
    "term": "Data Processor",
    "category": "consent",
    "definition": "A data processor is a company that handles personal data on a controller's behalf, such as a software vendor or email platform. Processors must follow the controller's instructions and protect the data, typically under a written agreement. When you use a tool like ConsentResolve, it acts as a processor of the data you control.",
    "related": [
      {
        "id": "data-controller",
        "label": "Data Controller"
      },
      {
        "id": "gdpr",
        "label": "GDPR"
      },
      {
        "id": "sdk",
        "label": "SDK"
      }
    ]
  },
  {
    "id": "deanonymization",
    "term": "De-anonymization",
    "category": "visid",
    "definition": "De-anonymization is the act of attaching a real identity to a previously anonymous visitor. The term is neutral, but the method matters: de-anonymizing people who never agreed is the practice that draws regulatory and legal scrutiny. Consent-first identification only resolves visitors who opted in.",
    "related": [
      {
        "id": "anonymous-visitor",
        "label": "Anonymous Visitor"
      },
      {
        "id": "data-broker",
        "label": "Data Broker"
      },
      {
        "id": "consentfirst",
        "label": "Consent-First"
      }
    ]
  },
  {
    "id": "deterministic-matching",
    "term": "Deterministic Matching",
    "category": "visid",
    "definition": "Deterministic matching connects data using known, exact identifiers, such as a logged-in email address, giving high confidence that it's really the same person. It is far more accurate than guessing from behavioral signals. Consent-first identification favors deterministic matches tied to a real opt-in.",
    "related": [
      {
        "id": "probabilistic-matching",
        "label": "Probabilistic Matching"
      },
      {
        "id": "identity-resolution",
        "label": "Identity Resolution"
      },
      {
        "id": "hashed-email",
        "label": "Hashed Email"
      }
    ]
  },
  {
    "id": "device-fingerprinting",
    "term": "Device Fingerprinting",
    "category": "visid",
    "definition": "Device fingerprinting identifies a visitor by the unique combination of their device and browser settings, such as screen size, fonts, and configuration, without needing a cookie. Because it can track people who never agreed to it, it draws privacy scrutiny and is restricted under some laws. It is a clear example of identification that runs ahead of consent.",
    "related": [
      {
        "id": "cookie",
        "label": "Cookie"
      },
      {
        "id": "deanonymization",
        "label": "De-anonymization"
      },
      {
        "id": "probabilistic-matching",
        "label": "Probabilistic Matching"
      }
    ]
  },
  {
    "id": "direct-mail",
    "term": "Direct Mail",
    "category": "channels",
    "definition": "Direct mail is physical marketing sent to potential customers, such as postcards, letters, and flyers. It remains effective for home services, especially for reaching neighbors around a job you just completed. Pairing a mailed postcard with a consented digital follow-up can compound results.",
    "related": [
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      },
      {
        "id": "service-area-business-sab",
        "label": "Service Area Business (SAB)"
      },
      {
        "id": "yard-sign",
        "label": "Yard Sign"
      }
    ]
  },
  {
    "id": "display-ads",
    "term": "Display Ads",
    "category": "channels",
    "definition": "Display ads are the visual banner and image ads you see across websites, apps, and videos. They are better for building awareness and for remarketing than for capturing ready-to-buy demand. For contractors they usually support search advertising rather than replace it.",
    "related": [
      {
        "id": "retargeting",
        "label": "Retargeting"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      },
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      }
    ]
  },
  {
    "id": "do-not-call-dnc",
    "term": "Do Not Call (DNC)",
    "category": "consent",
    "definition": "The Do Not Call (DNC) registry is a U.S. list of phone numbers whose owners have asked not to receive telemarketing calls. Calling a registered number for marketing without an existing relationship or written consent can trigger penalties. Reputable calling workflows scrub against the DNC list before dialing.",
    "related": [
      {
        "id": "tcpa",
        "label": "TCPA"
      },
      {
        "id": "optout",
        "label": "Opt-Out"
      },
      {
        "id": "phonegrade-lead",
        "label": "Phone-Grade Lead"
      }
    ]
  },
  {
    "id": "double-optin",
    "term": "Double Opt-In",
    "category": "consent",
    "definition": "Double opt-in is a consent process where a person signs up and then confirms by clicking a link in a follow-up message before being added to your list. It proves the address is real and the consent is genuine, which protects both your deliverability and your legal footing. It is the gold standard for building a list you can safely contact.",
    "related": [
      {
        "id": "optin",
        "label": "Opt-In"
      },
      {
        "id": "consent-trail",
        "label": "Consent Trail"
      },
      {
        "id": "email-deliverability",
        "label": "Email Deliverability"
      }
    ]
  },
  {
    "id": "drip-campaign",
    "term": "Drip Campaign",
    "category": "leadgen",
    "definition": "A drip campaign is a series of automated messages sent over time to nurture a lead, instead of one message and silence. For contractors it keeps you top of mind from the day someone inquires until the day they book. It does the follow-up your crew is too busy to do by hand.",
    "related": [
      {
        "id": "lead-nurturing",
        "label": "Lead Nurturing"
      },
      {
        "id": "emailgrade-lead",
        "label": "Email-Grade Lead"
      },
      {
        "id": "crm",
        "label": "CRM"
      }
    ]
  },
  {
    "id": "email-deliverability",
    "term": "Email Deliverability",
    "category": "metrics",
    "definition": "Email deliverability is whether your emails actually reach the inbox instead of the spam folder or being blocked entirely. It depends heavily on sending to people who consented and engage, not on blasting purchased lists. Permission isn't just legal hygiene; it's what keeps your email working at all.",
    "related": [
      {
        "id": "sender-reputation",
        "label": "Sender Reputation"
      },
      {
        "id": "suppression-list",
        "label": "Suppression List"
      },
      {
        "id": "double-optin",
        "label": "Double Opt-In"
      }
    ]
  },
  {
    "id": "email-marketing",
    "term": "Email Marketing",
    "category": "channels",
    "definition": "Email marketing is sending commercial messages to a list of contacts, and it remains one of the highest-ROI channels when done with permission. It is governed by CAN-SPAM and works best on a consented, well-maintained list rather than a purchased one. The asset you are really building is an audience that wants to hear from you.",
    "related": [
      {
        "id": "canspam-act",
        "label": "CAN-SPAM Act"
      },
      {
        "id": "drip-campaign",
        "label": "Drip Campaign"
      },
      {
        "id": "email-deliverability",
        "label": "Email Deliverability"
      }
    ]
  },
  {
    "id": "emailgrade-lead",
    "term": "Email-Grade Lead",
    "category": "visid",
    "definition": "An email-grade lead is a consented contact whose permission level supports email outreach. It is the core lead type ConsentResolve delivers, because email consent is more straightforward to document than phone consent. You get a real person who agreed to hear from you, ready for a follow-up sequence.",
    "related": [
      {
        "id": "phonegrade-lead",
        "label": "Phone-Grade Lead"
      },
      {
        "id": "consentfirst",
        "label": "Consent-First"
      },
      {
        "id": "drip-campaign",
        "label": "Drip Campaign"
      }
    ]
  },
  {
    "id": "emergency-service",
    "term": "Emergency Service",
    "category": "homeserv",
    "definition": "Emergency service is urgent, same-day work like a burst pipe, no heat, or no power, and it produces some of the highest-intent, highest-margin calls a contractor gets. These customers are ready to book immediately, so speed to answer is everything. They search with urgent, high-intent keywords and reward whoever responds first.",
    "related": [
      {
        "id": "highintent-keyword",
        "label": "High-Intent Keyword"
      },
      {
        "id": "speed-to-lead",
        "label": "Speed to Lead"
      },
      {
        "id": "local-services-ads-lsa",
        "label": "Local Services Ads (LSA)"
      }
    ]
  },
  {
    "id": "established-business-relationship-ebr",
    "term": "Established Business Relationship (EBR)",
    "category": "consent",
    "definition": "An established business relationship (EBR) is a prior connection, such as a recent purchase or inquiry, that can permit some contact that would otherwise require fresh consent. It is narrower and shorter-lived than most businesses assume, and rule changes have tightened it. Treating an old EBR as permanent consent is a common and risky mistake.",
    "related": [
      {
        "id": "express-written-consent",
        "label": "Express Written Consent"
      },
      {
        "id": "consent",
        "label": "Consent"
      },
      {
        "id": "do-not-call-dnc",
        "label": "Do Not Call (DNC)"
      }
    ]
  },
  {
    "id": "estimate",
    "term": "Estimate",
    "category": "homeserv",
    "definition": "An estimate is a quote for the expected cost of a job, and the rate at which estimates turn into booked work is a key sales metric. Fast, clear, professional estimates win more jobs than slow or vague ones. How quickly you follow an estimate with a nudge often decides who gets hired.",
    "related": [
      {
        "id": "close-rate",
        "label": "Close Rate"
      },
      {
        "id": "speed-to-lead",
        "label": "Speed to Lead"
      },
      {
        "id": "booked-job",
        "label": "Booked Job"
      }
    ]
  },
  {
    "id": "exclusive-lead",
    "term": "Exclusive Lead",
    "category": "leadgen",
    "definition": "An exclusive lead is sold to only one business, so you are not competing with three other contractors for the same call. Exclusivity dramatically raises the odds of booking the job. ConsentResolve delivers exclusive leads at a flat price rather than reselling the same contact.",
    "related": [
      {
        "id": "shared-lead",
        "label": "Shared Lead"
      },
      {
        "id": "cost-per-lead-cpl",
        "label": "Cost Per Lead (CPL)"
      },
      {
        "id": "lead-provenance",
        "label": "Lead Provenance"
      }
    ]
  },
  {
    "id": "express-written-consent",
    "term": "Express Written Consent",
    "category": "consent",
    "definition": "Express written consent is a signed agreement in which a consumer specifically authorizes a named business to contact them, including by automated calls or texts. Under the TCPA, this is the high bar required before sending marketing calls or texts to a mobile number using automated systems. It must clearly identify who is contacting them and cannot be hidden in fine print.",
    "related": [
      {
        "id": "tcpa",
        "label": "TCPA"
      },
      {
        "id": "consent",
        "label": "Consent"
      },
      {
        "id": "phonegrade-lead",
        "label": "Phone-Grade Lead"
      }
    ]
  },
  {
    "id": "firstparty-data",
    "term": "First-Party Data",
    "category": "visid",
    "definition": "First-party data is information a business collects directly from its own customers and visitors, with their knowledge. It is the most durable and trustworthy data source because you own the relationship and the consent. As third-party tracking erodes, first-party data is what marketing increasingly runs on.",
    "related": [
      {
        "id": "thirdparty-data",
        "label": "Third-Party Data"
      },
      {
        "id": "pii",
        "label": "PII"
      },
      {
        "id": "consent",
        "label": "Consent"
      }
    ]
  },
  {
    "id": "form-fill",
    "term": "Form Fill",
    "category": "leadgen",
    "definition": "A form fill happens when someone submits a contact form on your website, voluntarily handing you their information and, usually, their consent to follow up. It is one of the cleanest conversion actions you can track. A form fill is the original consent-first lead.",
    "related": [
      {
        "id": "conversion",
        "label": "Conversion"
      },
      {
        "id": "optin",
        "label": "Opt-In"
      },
      {
        "id": "landing-page",
        "label": "Landing Page"
      }
    ]
  },
  {
    "id": "frequency",
    "term": "Frequency",
    "category": "metrics",
    "definition": "Frequency is the average number of times each person saw your ad. A little repetition builds recognition; too much wastes money and annoys people into ignoring you. Watching frequency keeps an awareness campaign from quietly burning budget.",
    "related": [
      {
        "id": "reach",
        "label": "Reach"
      },
      {
        "id": "impressions",
        "label": "Impressions"
      },
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      }
    ]
  },
  {
    "id": "funnel",
    "term": "Funnel",
    "category": "leadgen",
    "definition": "A funnel is the path a potential customer takes from first becoming aware of you to becoming a paying job. It is called a funnel because fewer people remain at each successive stage. Understanding where people drop tells you where to fix your marketing.",
    "related": [
      {
        "id": "conversion",
        "label": "Conversion"
      },
      {
        "id": "landing-page",
        "label": "Landing Page"
      },
      {
        "id": "website-conversion-rate",
        "label": "Website Conversion Rate"
      }
    ]
  },
  {
    "id": "gdpr",
    "term": "GDPR",
    "category": "consent",
    "definition": "The GDPR (General Data Protection Regulation) is the European Union's data protection law, requiring a lawful basis (often explicit consent) before collecting or using personal data. It carries large fines and set the global template that many newer privacy laws follow. Most U.S. home-service contractors won't fall under it directly, but it shapes the consent standards software vendors build to.",
    "related": [
      {
        "id": "ccpa-cpra",
        "label": "CCPA / CPRA"
      },
      {
        "id": "consent",
        "label": "Consent"
      },
      {
        "id": "pii",
        "label": "PII"
      }
    ]
  },
  {
    "id": "geotargeting",
    "term": "Geotargeting",
    "category": "channels",
    "definition": "Geotargeting shows your ads or content to people based on their location, such as a specific city, ZIP code, or radius. Geofencing is a tighter version that draws a virtual boundary around an area. For a service-area business, targeting only where you actually work keeps spend from leaking.",
    "related": [
      {
        "id": "service-area-business-sab",
        "label": "Service Area Business (SAB)"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      },
      {
        "id": "local-seo",
        "label": "Local SEO"
      }
    ]
  },
  {
    "id": "google-business-profile-gbp",
    "term": "Google Business Profile (GBP)",
    "category": "homeserv",
    "definition": "A Google Business Profile (GBP) is your business's free listing that appears in Google Maps and local search results, formerly called Google My Business. It is one of the most important assets in local marketing and often a customer's first impression. A complete, well-reviewed profile drives calls before a website ever does.",
    "related": [
      {
        "id": "local-seo",
        "label": "Local SEO"
      },
      {
        "id": "local-pack",
        "label": "Local Pack"
      },
      {
        "id": "local-services-ads-lsa",
        "label": "Local Services Ads (LSA)"
      }
    ]
  },
  {
    "id": "hashed-email",
    "term": "Hashed Email",
    "category": "visid",
    "definition": "A hashed email is an email address run through a one-way encryption function so it becomes a scrambled string that can be matched without exposing the raw address. It lets systems recognize the same person across touchpoints while limiting who can read the underlying PII. It is a common building block of privacy-aware identity resolution.",
    "related": [
      {
        "id": "identity-resolution",
        "label": "Identity Resolution"
      },
      {
        "id": "pii",
        "label": "PII"
      },
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      }
    ]
  },
  {
    "id": "highintent-keyword",
    "term": "High-Intent Keyword",
    "category": "homeserv",
    "definition": "A high-intent keyword is a search term that signals someone is ready to buy, such as 'emergency plumber near me' or 'AC repair today.' These convert far better than research-stage searches like 'how to unclog a drain.' Targeting high-intent keywords is how you spend ad and SEO effort where the jobs are.",
    "related": [
      {
        "id": "keyword",
        "label": "Keyword"
      },
      {
        "id": "local-services-ads-lsa",
        "label": "Local Services Ads (LSA)"
      },
      {
        "id": "local-pack",
        "label": "Local Pack"
      }
    ]
  },
  {
    "id": "identity-graph",
    "term": "Identity Graph",
    "category": "visid",
    "definition": "An identity graph is a database that links all the identifiers belonging to one person, such as their emails, devices, and cookies, into a single profile. It is the backbone of cross-device tracking and identity resolution. How that graph is built, and whether the person consented, determines whether using it is safe.",
    "related": [
      {
        "id": "identity-resolution",
        "label": "Identity Resolution"
      },
      {
        "id": "crossdevice-tracking",
        "label": "Cross-Device Tracking"
      },
      {
        "id": "deterministic-matching",
        "label": "Deterministic Matching"
      }
    ]
  },
  {
    "id": "identity-resolution",
    "term": "Identity Resolution",
    "category": "visid",
    "definition": "Identity resolution is the process of matching scattered signals (a device, an email, a browsing session) to a single real person. It is the engine underneath visitor identification. The accuracy and the consent behind that match determine whether the resulting lead is usable and safe.",
    "related": [
      {
        "id": "match-rate",
        "label": "Match Rate"
      },
      {
        "id": "hashed-email",
        "label": "Hashed Email"
      },
      {
        "id": "visitor-identification",
        "label": "Visitor Identification"
      }
    ]
  },
  {
    "id": "impressions",
    "term": "Impressions",
    "category": "metrics",
    "definition": "Impressions are the number of times your ad or content is displayed, whether or not anyone clicks. They measure exposure, not engagement, so high impressions with no clicks usually means the message isn't landing. Impressions are an awareness metric, not a results metric.",
    "related": [
      {
        "id": "reach",
        "label": "Reach"
      },
      {
        "id": "frequency",
        "label": "Frequency"
      },
      {
        "id": "clickthrough-rate-ctr",
        "label": "Click-Through Rate (CTR)"
      }
    ]
  },
  {
    "id": "inbound-marketing",
    "term": "Inbound Marketing",
    "category": "leadgen",
    "definition": "Inbound marketing attracts customers who come to you, through search, content, and reputation, rather than chasing them. It tends to produce warmer, higher-consent leads because the person initiated contact. It compounds over time but is slower to start than paid outbound.",
    "related": [
      {
        "id": "outbound-marketing",
        "label": "Outbound Marketing"
      },
      {
        "id": "content-marketing",
        "label": "Content Marketing"
      },
      {
        "id": "local-seo",
        "label": "Local SEO"
      }
    ]
  },
  {
    "id": "key-performance-indicator-kpi",
    "term": "Key Performance Indicator (KPI)",
    "category": "metrics",
    "definition": "A KPI (key performance indicator) is a metric you track because it measures success against a goal. Common marketing KPIs include leads generated, cost per lead, conversion rate, and revenue. Picking the right few KPIs keeps you focused on what moves the business instead of vanity numbers.",
    "related": [
      {
        "id": "cost-per-lead-cpl",
        "label": "Cost Per Lead (CPL)"
      },
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      },
      {
        "id": "return-on-investment-roi",
        "label": "Return on Investment (ROI)"
      }
    ]
  },
  {
    "id": "keyword",
    "term": "Keyword",
    "category": "homeserv",
    "definition": "A keyword is a word or phrase people type into a search engine to find what they need. Choosing the right keywords to target is fundamental to both SEO and paid search. The art is matching keywords to real customer intent rather than just high search volume.",
    "related": [
      {
        "id": "highintent-keyword",
        "label": "High-Intent Keyword"
      },
      {
        "id": "local-seo",
        "label": "Local SEO"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      }
    ]
  },
  {
    "id": "landing-page",
    "term": "Landing Page",
    "category": "leadgen",
    "definition": "A landing page is a web page built for one specific campaign and one specific action, such as booking an estimate. It removes the distractions of a normal website so more visitors convert. Sending ad traffic to a focused landing page almost always beats sending it to a homepage.",
    "related": [
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      },
      {
        "id": "form-fill",
        "label": "Form Fill"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      }
    ]
  },
  {
    "id": "lead",
    "term": "Lead",
    "category": "leadgen",
    "definition": "A lead is a potential customer who has shown interest in your service and whom you can follow up with. Definitions vary in quality: some leads are ready to book, others are barely curious. The value of a lead depends on its intent, its exclusivity, and the consent behind it.",
    "related": [
      {
        "id": "qualified-lead",
        "label": "Qualified Lead"
      },
      {
        "id": "exclusive-lead",
        "label": "Exclusive Lead"
      },
      {
        "id": "highintent-keyword",
        "label": "High-Intent Keyword"
      }
    ]
  },
  {
    "id": "lead-distribution",
    "term": "Lead Distribution",
    "category": "leadgen",
    "definition": "Lead distribution is how incoming leads get routed, whether to a single business or blasted to many at once. With shared leads, distribution often means the same customer is sent to several competitors simultaneously. Exclusive distribution to one business is what gives a lead its real value.",
    "related": [
      {
        "id": "exclusive-lead",
        "label": "Exclusive Lead"
      },
      {
        "id": "shared-lead",
        "label": "Shared Lead"
      },
      {
        "id": "speed-to-lead",
        "label": "Speed to Lead"
      }
    ]
  },
  {
    "id": "lead-generation",
    "term": "Lead Generation",
    "category": "leadgen",
    "definition": "Lead generation is the work of attracting potential customers and capturing enough information to follow up with them. For home services it spans local SEO, Google Ads, referrals, and website conversion. The goal is not just volume but contactable, consented, bookable demand.",
    "related": [
      {
        "id": "lead",
        "label": "Lead"
      },
      {
        "id": "landing-page",
        "label": "Landing Page"
      },
      {
        "id": "conversion",
        "label": "Conversion"
      }
    ]
  },
  {
    "id": "lead-magnet",
    "term": "Lead Magnet",
    "category": "leadgen",
    "definition": "A lead magnet is a valuable free offer, such as a buyer's guide, checklist, or instant quote, given in exchange for someone's contact details and permission to follow up. It turns anonymous interest into a consented lead you can nurture. The best lead magnets solve a real problem your customer has right before they buy.",
    "related": [
      {
        "id": "form-fill",
        "label": "Form Fill"
      },
      {
        "id": "optin",
        "label": "Opt-In"
      },
      {
        "id": "lead-nurturing",
        "label": "Lead Nurturing"
      }
    ]
  },
  {
    "id": "lead-nurturing",
    "term": "Lead Nurturing",
    "category": "leadgen",
    "definition": "Lead nurturing is the process of staying in touch with potential customers over time until they are ready to book. Most leads do not hire on first contact, so consistent, helpful follow-up is what converts interest into jobs. Speed plus persistence beats a single phone call almost every time.",
    "related": [
      {
        "id": "drip-campaign",
        "label": "Drip Campaign"
      },
      {
        "id": "speed-to-lead",
        "label": "Speed to Lead"
      },
      {
        "id": "lead-scoring",
        "label": "Lead Scoring"
      }
    ]
  },
  {
    "id": "lead-provenance",
    "term": "Lead Provenance",
    "category": "consent",
    "definition": "Lead provenance is the verifiable origin story of a lead: where it came from, how the person's interest was captured, and what they agreed to. Leads with clear provenance can be contacted with confidence; leads with murky provenance are where compliance trouble starts. It is the difference between a lead you own and a list you rented.",
    "related": [
      {
        "id": "consent-trail",
        "label": "Consent Trail"
      },
      {
        "id": "exclusive-lead",
        "label": "Exclusive Lead"
      },
      {
        "id": "shared-lead",
        "label": "Shared Lead"
      }
    ]
  },
  {
    "id": "lead-scoring",
    "term": "Lead Scoring",
    "category": "leadgen",
    "definition": "Lead scoring is assigning points to leads based on how likely they are to convert, so you focus effort on the best ones. A visitor who viewed your pricing page three times scores higher than one who bounced. It helps a busy crew prioritize follow-up instead of treating every lead the same.",
    "related": [
      {
        "id": "qualified-lead",
        "label": "Qualified Lead"
      },
      {
        "id": "lead-nurturing",
        "label": "Lead Nurturing"
      },
      {
        "id": "highintent-keyword",
        "label": "High-Intent Keyword"
      }
    ]
  },
  {
    "id": "lifetime-value-ltv",
    "term": "Lifetime Value (LTV)",
    "category": "metrics",
    "definition": "Lifetime value (LTV) is the total revenue a customer generates across their entire relationship with your business, including repeat jobs and referrals. Understanding LTV tells you how much you can responsibly spend to acquire one. For trades with recurring service or maintenance plans, LTV is often far larger than a single ticket suggests.",
    "related": [
      {
        "id": "customer-acquisition-cost-cac",
        "label": "Customer Acquisition Cost (CAC)"
      },
      {
        "id": "average-ticket",
        "label": "Average Ticket"
      },
      {
        "id": "return-on-investment-roi",
        "label": "Return on Investment (ROI)"
      }
    ]
  },
  {
    "id": "local-pack",
    "term": "Local Pack",
    "category": "homeserv",
    "definition": "The local pack is the group of three local business listings, shown with a map, that appears near the top of many local search results. Landing in the local pack is a primary goal of local SEO because it captures high-intent clicks. The businesses shown are pulled largely from Google Business Profiles.",
    "related": [
      {
        "id": "local-seo",
        "label": "Local SEO"
      },
      {
        "id": "google-business-profile-gbp",
        "label": "Google Business Profile (GBP)"
      },
      {
        "id": "highintent-keyword",
        "label": "High-Intent Keyword"
      }
    ]
  },
  {
    "id": "local-seo",
    "term": "Local SEO",
    "category": "homeserv",
    "definition": "Local SEO is the practice of optimizing to rank in local searches, the ones with implied or explicit local intent like 'plumber near me.' It includes your Google Business Profile, consistent listings, reviews, and location-relevant website content. For most home-service contractors it is the highest-leverage organic channel.",
    "related": [
      {
        "id": "google-business-profile-gbp",
        "label": "Google Business Profile (GBP)"
      },
      {
        "id": "local-pack",
        "label": "Local Pack"
      },
      {
        "id": "nap",
        "label": "NAP"
      }
    ]
  },
  {
    "id": "local-services-ads-lsa",
    "term": "Local Services Ads (LSA)",
    "category": "channels",
    "definition": "Local Services Ads (LSA) are Google's pay-per-lead ads for local businesses, appearing at the very top of search with a Google Guaranteed badge. You pay when a customer contacts you through the ad, not merely for a click. For many home-service trades they are among the highest-intent lead sources available.",
    "related": [
      {
        "id": "google-business-profile-gbp",
        "label": "Google Business Profile (GBP)"
      },
      {
        "id": "local-seo",
        "label": "Local SEO"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      }
    ]
  },
  {
    "id": "maintenance-plan",
    "term": "Maintenance Plan",
    "category": "homeserv",
    "definition": "A maintenance plan is a recurring service agreement, such as annual HVAC tune-ups or plumbing inspections, that customers pay for on a schedule. It smooths out seasonal demand, builds loyalty, and dramatically raises lifetime value. Plan members also call you first when something bigger goes wrong.",
    "related": [
      {
        "id": "lifetime-value-ltv",
        "label": "Lifetime Value (LTV)"
      },
      {
        "id": "churn-rate",
        "label": "Churn Rate"
      },
      {
        "id": "seasonal-demand",
        "label": "Seasonal Demand"
      }
    ]
  },
  {
    "id": "marketing-automation",
    "term": "Marketing Automation",
    "category": "channels",
    "definition": "Marketing automation is software that runs repetitive marketing tasks, such as follow-up sequences and triggered messages, without manual effort. It lets a small business follow up like a big one, consistently and on time. The follow-up it powers must still respect each contact's consent.",
    "related": [
      {
        "id": "drip-campaign",
        "label": "Drip Campaign"
      },
      {
        "id": "crm",
        "label": "CRM"
      },
      {
        "id": "lead-nurturing",
        "label": "Lead Nurturing"
      }
    ]
  },
  {
    "id": "match-rate",
    "term": "Match Rate",
    "category": "visid",
    "definition": "Match rate is the percentage of your website visitors that an identification tool can resolve to a contactable person. A 40% match rate means roughly 4 in 10 visitors are identified. Higher is not always better: a sky-high match rate often means a vendor is matching people who never consented.",
    "related": [
      {
        "id": "identity-resolution",
        "label": "Identity Resolution"
      },
      {
        "id": "visitor-identification",
        "label": "Visitor Identification"
      },
      {
        "id": "consentfirst",
        "label": "Consent-First"
      }
    ]
  },
  {
    "id": "multitouch-attribution",
    "term": "Multi-Touch Attribution",
    "category": "metrics",
    "definition": "Multi-touch attribution gives credit to several marketing touchpoints along a customer's journey, not just the last click before they converted. It acknowledges that someone might find you on Google, see a Facebook ad, then call a week later. It paints a fairer picture than single-touch models, at the cost of more complexity.",
    "related": [
      {
        "id": "attribution",
        "label": "Attribution"
      },
      {
        "id": "funnel",
        "label": "Funnel"
      },
      {
        "id": "conversion",
        "label": "Conversion"
      }
    ]
  },
  {
    "id": "nap",
    "term": "NAP",
    "category": "homeserv",
    "definition": "NAP stands for Name, Address, Phone number, the core business details that must be consistent everywhere they appear online. Inconsistent NAP across your website, Google profile, and directories confuses search engines and hurts local rankings. Cleaning up NAP is often the first fix in a local SEO audit.",
    "related": [
      {
        "id": "local-seo",
        "label": "Local SEO"
      },
      {
        "id": "google-business-profile-gbp",
        "label": "Google Business Profile (GBP)"
      },
      {
        "id": "service-area-business-sab",
        "label": "Service Area Business (SAB)"
      }
    ]
  },
  {
    "id": "negative-keywords",
    "term": "Negative Keywords",
    "category": "channels",
    "definition": "Negative keywords are terms you tell your ads not to show for, so you stop paying for irrelevant clicks. An HVAC company, for example, might block words like jobs, salary, or DIY to avoid people who will never hire. Well-tended negative keyword lists are one of the quietest ways to cut wasted ad spend.",
    "related": [
      {
        "id": "keyword",
        "label": "Keyword"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      },
      {
        "id": "quality-score",
        "label": "Quality Score"
      }
    ]
  },
  {
    "id": "online-reviews",
    "term": "Online Reviews",
    "category": "homeserv",
    "definition": "Online reviews are the public ratings and written feedback customers leave on platforms like Google, and they are among the strongest trust and ranking signals in local marketing. A steady stream of recent, positive reviews influences both whether you appear in the local pack and whether someone calls. Star rating and review count together shape your first impression.",
    "related": [
      {
        "id": "reputation-management",
        "label": "Reputation Management"
      },
      {
        "id": "local-pack",
        "label": "Local Pack"
      },
      {
        "id": "google-business-profile-gbp",
        "label": "Google Business Profile (GBP)"
      }
    ]
  },
  {
    "id": "open-rate",
    "term": "Open Rate",
    "category": "metrics",
    "definition": "Open rate is the percentage of email recipients who open a given message. It signals whether your subject lines and sender reputation are working, though privacy features have made it less precise than it once was. A healthy open rate starts with a consented, engaged list.",
    "related": [
      {
        "id": "email-deliverability",
        "label": "Email Deliverability"
      },
      {
        "id": "email-marketing",
        "label": "Email Marketing"
      },
      {
        "id": "sender-reputation",
        "label": "Sender Reputation"
      }
    ]
  },
  {
    "id": "optin",
    "term": "Opt-In",
    "category": "consent",
    "definition": "An opt-in is the action a person takes to affirmatively agree to be contacted, such as checking a box or submitting a form with clear disclosure. Single opt-in records one agreement; double opt-in adds a confirmation step (like clicking an email link) to prove the address is real and the consent is genuine.",
    "related": [
      {
        "id": "optout",
        "label": "Opt-Out"
      },
      {
        "id": "consent",
        "label": "Consent"
      },
      {
        "id": "form-fill",
        "label": "Form Fill"
      }
    ]
  },
  {
    "id": "optout",
    "term": "Opt-Out",
    "category": "consent",
    "definition": "An opt-out is a person's request to stop being contacted, such as replying STOP to a text or clicking unsubscribe in an email. Honoring opt-outs promptly is a legal requirement under most privacy and anti-spam laws. Every list you contact must have a working, easy opt-out path.",
    "related": [
      {
        "id": "optin",
        "label": "Opt-In"
      },
      {
        "id": "do-not-call-dnc",
        "label": "Do Not Call (DNC)"
      },
      {
        "id": "consent",
        "label": "Consent"
      }
    ]
  },
  {
    "id": "outbound-marketing",
    "term": "Outbound Marketing",
    "category": "leadgen",
    "definition": "Outbound marketing proactively reaches potential customers through channels like ads, direct mail, and cold outreach. It can create demand quickly but requires careful attention to consent, especially for calls and texts. It works best when paired with a strong inbound presence to land on.",
    "related": [
      {
        "id": "inbound-marketing",
        "label": "Inbound Marketing"
      },
      {
        "id": "direct-mail",
        "label": "Direct Mail"
      },
      {
        "id": "tcpa",
        "label": "TCPA"
      }
    ]
  },
  {
    "id": "phonegrade-lead",
    "term": "Phone-Grade Lead",
    "category": "visid",
    "definition": "A phone-grade lead is a contact whose consent meets the higher bar required to legally call or text them under the TCPA. Because that bar is steep and the liability is real, ConsentResolve focuses on email-grade leads and does not put phone numbers into the product. The distinction protects you from the exact lawsuits that target contractors.",
    "related": [
      {
        "id": "emailgrade-lead",
        "label": "Email-Grade Lead"
      },
      {
        "id": "tcpa",
        "label": "TCPA"
      },
      {
        "id": "express-written-consent",
        "label": "Express Written Consent"
      }
    ]
  },
  {
    "id": "pii",
    "term": "PII",
    "category": "consent",
    "definition": "PII (personally identifiable information) is any data that can identify a specific person, such as a name, email address, phone number, or home address. Privacy laws regulate how it is collected, stored, and shared. Handling PII responsibly is the core obligation behind every consent rule.",
    "related": [
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      },
      {
        "id": "data-broker",
        "label": "Data Broker"
      },
      {
        "id": "ccpa-cpra",
        "label": "CCPA / CPRA"
      }
    ]
  },
  {
    "id": "pipeline",
    "term": "Pipeline",
    "category": "channels",
    "definition": "A pipeline is the set of opportunities you are actively working, shown as stages from first contact to closed job. It makes the health of your sales visible: too few new leads, or too many stuck in the middle, shows up immediately. Managing the pipeline is a core part of running on a CRM.",
    "related": [
      {
        "id": "crm",
        "label": "CRM"
      },
      {
        "id": "funnel",
        "label": "Funnel"
      },
      {
        "id": "qualified-lead",
        "label": "Qualified Lead"
      }
    ]
  },
  {
    "id": "pixel",
    "term": "Pixel",
    "category": "visid",
    "definition": "A pixel (or tag) is a small piece of code placed on your website that records visitor activity and powers things like analytics, advertising, and identification. It is how a platform knows a visit happened. What a pixel is allowed to capture should be governed by the visitor's consent.",
    "related": [
      {
        "id": "sdk",
        "label": "SDK"
      },
      {
        "id": "cookie-consent",
        "label": "Cookie Consent"
      },
      {
        "id": "retargeting",
        "label": "Retargeting"
      }
    ]
  },
  {
    "id": "ppc-payperclick",
    "term": "PPC (Pay-Per-Click)",
    "category": "channels",
    "definition": "PPC (pay-per-click) is advertising where you pay each time someone clicks your ad, most commonly on Google Ads and Meta. It can turn on demand instantly, but costs rise with competition and stop the moment you stop paying. It works best paired with strong landing pages and fast follow-up.",
    "related": [
      {
        "id": "cost-per-click-cpc",
        "label": "Cost Per Click (CPC)"
      },
      {
        "id": "landing-page",
        "label": "Landing Page"
      },
      {
        "id": "local-services-ads-lsa",
        "label": "Local Services Ads (LSA)"
      }
    ]
  },
  {
    "id": "privacy-policy",
    "term": "Privacy Policy",
    "category": "consent",
    "definition": "A privacy policy is the public document where a business discloses what personal data it collects, why, and how it is used and shared. Most privacy laws require one, and the consent a visitor gives usually references it. It is the written promise your data practices are measured against.",
    "related": [
      {
        "id": "consent",
        "label": "Consent"
      },
      {
        "id": "data-minimization",
        "label": "Data Minimization"
      },
      {
        "id": "ccpa-cpra",
        "label": "CCPA / CPRA"
      }
    ]
  },
  {
    "id": "probabilistic-matching",
    "term": "Probabilistic Matching",
    "category": "visid",
    "definition": "Probabilistic matching links data based on statistical likelihood drawn from signals like IP address, device, and behavior, rather than a confirmed identifier. It can cover more visitors but is essentially educated guessing, so it produces more wrong matches. Those wrong matches are exactly how non-consented identification ends up contacting the wrong people.",
    "related": [
      {
        "id": "deterministic-matching",
        "label": "Deterministic Matching"
      },
      {
        "id": "match-rate",
        "label": "Match Rate"
      },
      {
        "id": "device-fingerprinting",
        "label": "Device Fingerprinting"
      }
    ]
  },
  {
    "id": "pseudonymization",
    "term": "Pseudonymization",
    "category": "consent",
    "definition": "Pseudonymization replaces direct identifiers with tokens or codes that can be reversed only with a separate key, unlike permanent anonymization. It lets businesses work with data while limiting who can tie it to a real person. It reduces risk but, because it is reversible, the data is still treated as personal under most laws.",
    "related": [
      {
        "id": "anonymization",
        "label": "Anonymization"
      },
      {
        "id": "hashed-email",
        "label": "Hashed Email"
      },
      {
        "id": "pii",
        "label": "PII"
      }
    ]
  },
  {
    "id": "qualified-lead",
    "term": "Qualified Lead",
    "category": "leadgen",
    "definition": "A qualified lead is one that meets your real criteria for a worthwhile job, such as being in your service area, having a genuine need, and being able to pay. Qualifying leads keeps your crew from burning hours on dead ends. Unqualified volume looks good on a dashboard and bad on a P&L.",
    "related": [
      {
        "id": "lead",
        "label": "Lead"
      },
      {
        "id": "lead-scoring",
        "label": "Lead Scoring"
      },
      {
        "id": "service-area-business-sab",
        "label": "Service Area Business (SAB)"
      }
    ]
  },
  {
    "id": "quality-score",
    "term": "Quality Score",
    "category": "metrics",
    "definition": "Quality Score is Google Ads' rating of how relevant your keywords, ads, and landing pages are to a searcher. A higher score lowers your cost per click and improves where your ads appear. It rewards advertisers who match their message tightly to what people are searching for.",
    "related": [
      {
        "id": "cost-per-click-cpc",
        "label": "Cost Per Click (CPC)"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      },
      {
        "id": "landing-page",
        "label": "Landing Page"
      }
    ]
  },
  {
    "id": "quiet-hours",
    "term": "Quiet Hours",
    "category": "consent",
    "definition": "Quiet hours are the times when telemarketing calls and texts are prohibited, generally before 8 a.m. or after 9 p.m. in the recipient's local time zone under the TCPA. Contacting people outside these windows is a violation even if you have consent. Outreach tools should respect the lead's time zone automatically.",
    "related": [
      {
        "id": "tcpa",
        "label": "TCPA"
      },
      {
        "id": "do-not-call-dnc",
        "label": "Do Not Call (DNC)"
      },
      {
        "id": "sms-marketing",
        "label": "SMS Marketing"
      }
    ]
  },
  {
    "id": "reach",
    "term": "Reach",
    "category": "metrics",
    "definition": "Reach is the number of unique people who saw your content, as opposed to total views. It tells you how many distinct potential customers you touched. Reach paired with frequency shows whether you're hitting a few people often or many people once.",
    "related": [
      {
        "id": "impressions",
        "label": "Impressions"
      },
      {
        "id": "frequency",
        "label": "Frequency"
      },
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      }
    ]
  },
  {
    "id": "referral",
    "term": "Referral",
    "category": "leadgen",
    "definition": "A referral is a potential customer sent to you by someone who already knows and trusts your work. Referrals are typically the highest-converting, lowest-cost leads a contractor can get because trust is transferred along with the introduction. A simple, consistent ask-for-referrals habit is one of the cheapest growth levers there is.",
    "related": [
      {
        "id": "lifetime-value-ltv",
        "label": "Lifetime Value (LTV)"
      },
      {
        "id": "online-reviews",
        "label": "Online Reviews"
      },
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      }
    ]
  },
  {
    "id": "reputation-management",
    "term": "Reputation Management",
    "category": "homeserv",
    "definition": "Reputation management is the ongoing work of monitoring and improving how your business appears online, especially in reviews. It means earning new reviews, responding to feedback, and addressing problems before they spread. For local trades, your reputation often closes the sale before you ever speak to the customer.",
    "related": [
      {
        "id": "online-reviews",
        "label": "Online Reviews"
      },
      {
        "id": "review-automation",
        "label": "Review Automation"
      },
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      }
    ]
  },
  {
    "id": "retargeting",
    "term": "Retargeting",
    "category": "channels",
    "definition": "Retargeting (also called remarketing) shows ads to people who already visited your website, keeping you in front of them as they browse elsewhere. Because these people already showed interest, it tends to convert better than ads to strangers. What your retargeting pixel may track should respect the visitor's consent.",
    "related": [
      {
        "id": "display-ads",
        "label": "Display Ads"
      },
      {
        "id": "pixel",
        "label": "Pixel"
      },
      {
        "id": "funnel",
        "label": "Funnel"
      }
    ]
  },
  {
    "id": "return-on-ad-spend-roas",
    "term": "Return on Ad Spend (ROAS)",
    "category": "metrics",
    "definition": "Return on ad spend (ROAS) is revenue generated divided by ad spend, focused specifically on advertising. If $1,000 in ads produces $4,000 in revenue, your ROAS is 4x or 400%. It is similar to ROI but narrower, measuring the ads alone rather than the whole business.",
    "related": [
      {
        "id": "return-on-investment-roi",
        "label": "Return on Investment (ROI)"
      },
      {
        "id": "cost-per-click-cpc",
        "label": "Cost Per Click (CPC)"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      }
    ]
  },
  {
    "id": "return-on-investment-roi",
    "term": "Return on Investment (ROI)",
    "category": "metrics",
    "definition": "Return on investment (ROI) is the profit generated relative to the cost of generating it. If you spend $1,000 and make $5,000 in profit, your ROI is 400%. It is the ultimate scoreboard for whether a marketing channel is worth keeping.",
    "related": [
      {
        "id": "return-on-ad-spend-roas",
        "label": "Return on Ad Spend (ROAS)"
      },
      {
        "id": "customer-acquisition-cost-cac",
        "label": "Customer Acquisition Cost (CAC)"
      },
      {
        "id": "lifetime-value-ltv",
        "label": "Lifetime Value (LTV)"
      }
    ]
  },
  {
    "id": "reverse-ip-lookup",
    "term": "Reverse IP Lookup",
    "category": "visid",
    "definition": "Reverse IP lookup matches a visitor's IP address to a company or rough location. It is common in business-to-business identification but unreliable for pinpointing individuals and operates without their consent. For home-service contractors it tends to produce noise rather than bookable leads.",
    "related": [
      {
        "id": "visitor-identification",
        "label": "Visitor Identification"
      },
      {
        "id": "probabilistic-matching",
        "label": "Probabilistic Matching"
      },
      {
        "id": "deanonymization",
        "label": "De-anonymization"
      }
    ]
  },
  {
    "id": "review-automation",
    "term": "Review Automation",
    "category": "channels",
    "definition": "Review automation uses software to systematically request and manage customer reviews after a job is done. It turns happy customers into public proof at scale instead of leaving reviews to chance. Steady, recent reviews lift both trust and local rankings.",
    "related": [
      {
        "id": "online-reviews",
        "label": "Online Reviews"
      },
      {
        "id": "reputation-management",
        "label": "Reputation Management"
      },
      {
        "id": "local-seo",
        "label": "Local SEO"
      }
    ]
  },
  {
    "id": "right-to-deletion",
    "term": "Right to Deletion",
    "category": "consent",
    "definition": "The right to deletion is a consumer's ability to ask a business to erase the personal information it holds about them, granted under laws like the CCPA and GDPR. Businesses subject to these laws must have a process to receive and honor those requests. It is a core reason to know exactly what data you store and where.",
    "related": [
      {
        "id": "ccpa-cpra",
        "label": "CCPA / CPRA"
      },
      {
        "id": "gdpr",
        "label": "GDPR"
      },
      {
        "id": "pii",
        "label": "PII"
      }
    ]
  },
  {
    "id": "robocall",
    "term": "Robocall",
    "category": "consent",
    "definition": "A robocall is a call delivered with a prerecorded or artificial voice, common in marketing and notoriously regulated. Sending marketing robocalls or texts to consumers generally requires prior express written consent under the TCPA. The rules are strict because robocalls are among the most-complained-about contact methods.",
    "related": [
      {
        "id": "autodialer-atds",
        "label": "Autodialer (ATDS)"
      },
      {
        "id": "tcpa",
        "label": "TCPA"
      },
      {
        "id": "express-written-consent",
        "label": "Express Written Consent"
      }
    ]
  },
  {
    "id": "sdk",
    "term": "SDK",
    "category": "visid",
    "definition": "An SDK (software development kit) is the package of code a vendor gives you to install so their service works on your site or app. ConsentResolve's SDK captures consented visitor signals and passes them along securely. Installation can be self-serve or, for trial customers, white-glove.",
    "related": [
      {
        "id": "pixel",
        "label": "Pixel"
      },
      {
        "id": "visitor-identification",
        "label": "Visitor Identification"
      },
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      }
    ]
  },
  {
    "id": "seasonal-demand",
    "term": "Seasonal Demand",
    "category": "homeserv",
    "definition": "Seasonal demand is the predictable rise and fall in work tied to the calendar, such as air conditioning in summer or heating in winter. Smart marketing spends ahead of each season and uses slow periods to fill the pipeline. Maintenance plans are one way to smooth the swings.",
    "related": [
      {
        "id": "maintenance-plan",
        "label": "Maintenance Plan"
      },
      {
        "id": "pipeline",
        "label": "Pipeline"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      }
    ]
  },
  {
    "id": "sender-reputation",
    "term": "Sender Reputation",
    "category": "metrics",
    "definition": "Sender reputation is the score mailbox providers assign your sending domain and IP, which decides how much of your email reaches inboxes. Spam complaints, bad addresses, and emailing people who never opted in all drag it down. Once damaged, it is slow and painful to rebuild.",
    "related": [
      {
        "id": "email-deliverability",
        "label": "Email Deliverability"
      },
      {
        "id": "suppression-list",
        "label": "Suppression List"
      },
      {
        "id": "canspam-act",
        "label": "CAN-SPAM Act"
      }
    ]
  },
  {
    "id": "seo-search-engine-optimization",
    "term": "SEO (Search Engine Optimization)",
    "category": "channels",
    "definition": "SEO (search engine optimization) is the practice of improving your visibility in unpaid search results. It spans technical setup, content quality, and authority signals, and it is increasingly read by AI answer engines, not just Google. For contractors, the local flavor of SEO usually matters most.",
    "related": [
      {
        "id": "local-seo",
        "label": "Local SEO"
      },
      {
        "id": "serp-search-engine-results-page",
        "label": "SERP (Search Engine Results Page)"
      },
      {
        "id": "content-marketing",
        "label": "Content Marketing"
      }
    ]
  },
  {
    "id": "serp-search-engine-results-page",
    "term": "SERP (Search Engine Results Page)",
    "category": "channels",
    "definition": "The SERP (search engine results page) is what Google shows after a search, now a crowded mix of ads, the local pack, organic links, and AI-generated overviews. Where you appear on it, and in which feature, shapes how much traffic you actually capture. Understanding the SERP is understanding the battlefield.",
    "related": [
      {
        "id": "seo-search-engine-optimization",
        "label": "SEO (Search Engine Optimization)"
      },
      {
        "id": "local-pack",
        "label": "Local Pack"
      },
      {
        "id": "local-services-ads-lsa",
        "label": "Local Services Ads (LSA)"
      }
    ]
  },
  {
    "id": "serverside-tracking",
    "term": "Server-Side Tracking",
    "category": "visid",
    "definition": "Server-side tracking sends analytics and conversion data through your own server rather than directly from the visitor's browser. It is more reliable against ad blockers and gives you more control over what data leaves and how consent is applied. It is increasingly how privacy-aware businesses measure marketing.",
    "related": [
      {
        "id": "pixel",
        "label": "Pixel"
      },
      {
        "id": "tag-manager",
        "label": "Tag Manager"
      },
      {
        "id": "utm-parameters",
        "label": "UTM Parameters"
      }
    ]
  },
  {
    "id": "service-area-business-sab",
    "term": "Service Area Business (SAB)",
    "category": "homeserv",
    "definition": "A service area business (SAB) is one that travels to customers rather than serving them at a storefront, like most plumbers, electricians, and HVAC companies. Google treats SABs differently in local search and Business Profiles. Knowing you are an SAB changes how you should set up your local listings.",
    "related": [
      {
        "id": "local-seo",
        "label": "Local SEO"
      },
      {
        "id": "google-business-profile-gbp",
        "label": "Google Business Profile (GBP)"
      },
      {
        "id": "qualified-lead",
        "label": "Qualified Lead"
      }
    ]
  },
  {
    "id": "shared-lead",
    "term": "Shared Lead",
    "category": "leadgen",
    "definition": "A shared lead is sold to several businesses at once, meaning the customer is fielding calls from multiple competitors. Shared leads are cheaper per lead but convert worse and reward whoever calls first. The math often favors paying more for exclusivity.",
    "related": [
      {
        "id": "exclusive-lead",
        "label": "Exclusive Lead"
      },
      {
        "id": "speed-to-lead",
        "label": "Speed to Lead"
      },
      {
        "id": "cost-per-lead-cpl",
        "label": "Cost Per Lead (CPL)"
      }
    ]
  },
  {
    "id": "sms-marketing",
    "term": "SMS Marketing",
    "category": "channels",
    "definition": "SMS marketing is reaching customers by text message, which earns very high open rates but carries strict rules. Marketing texts generally require prior express written consent under the TCPA, and violations are costly. Because of that bar, ConsentResolve keeps phone numbers out of its product and focuses on email-grade leads.",
    "related": [
      {
        "id": "tcpa",
        "label": "TCPA"
      },
      {
        "id": "express-written-consent",
        "label": "Express Written Consent"
      },
      {
        "id": "phonegrade-lead",
        "label": "Phone-Grade Lead"
      }
    ]
  },
  {
    "id": "social-media-marketing",
    "term": "Social Media Marketing",
    "category": "channels",
    "definition": "Social media marketing uses platforms like Facebook, Instagram, and others to build awareness, show your work, and generate leads. For contractors, before-and-after photos and local presence often outperform polished ads. It builds familiarity that makes every other channel convert better.",
    "related": [
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      },
      {
        "id": "display-ads",
        "label": "Display Ads"
      },
      {
        "id": "ppc-payperclick",
        "label": "PPC (Pay-Per-Click)"
      }
    ]
  },
  {
    "id": "speed-to-lead",
    "term": "Speed to Lead",
    "category": "leadgen",
    "definition": "Speed to lead is how quickly you respond after a new lead comes in, and it is one of the strongest predictors of whether you book the job. Studies consistently show that responding within minutes wins far more business than responding hours later. With shared leads especially, the first contractor to reach the customer usually wins.",
    "related": [
      {
        "id": "lead-nurturing",
        "label": "Lead Nurturing"
      },
      {
        "id": "shared-lead",
        "label": "Shared Lead"
      },
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      }
    ]
  },
  {
    "id": "state-privacy-laws",
    "term": "State Privacy Laws",
    "category": "consent",
    "definition": "State privacy laws are the growing patchwork of U.S. data-privacy statutes beyond California, with states including Texas, Virginia, and Colorado enacting their own comprehensive rules. Each sets its own thresholds and consumer rights, so a business operating across state lines may face several at once. The trend is clearly toward more regulation, not less, which is why a consent-first foundation ages well.",
    "related": [
      {
        "id": "ccpa-cpra",
        "label": "CCPA / CPRA"
      },
      {
        "id": "right-to-deletion",
        "label": "Right to Deletion"
      },
      {
        "id": "privacy-policy",
        "label": "Privacy Policy"
      }
    ]
  },
  {
    "id": "suppression-list",
    "term": "Suppression List",
    "category": "consent",
    "definition": "A suppression list is the record of contacts you must not message, including people who opted out, complained, or hard-bounced. Maintaining and honoring it is both a legal duty and a protection for your sender reputation. The fastest way to get blocked is to keep emailing people who already said stop.",
    "related": [
      {
        "id": "optout",
        "label": "Opt-Out"
      },
      {
        "id": "sender-reputation",
        "label": "Sender Reputation"
      },
      {
        "id": "canspam-act",
        "label": "CAN-SPAM Act"
      }
    ]
  },
  {
    "id": "tag-manager",
    "term": "Tag Manager",
    "category": "visid",
    "definition": "A tag manager, such as Google Tag Manager, is a tool that lets you add and update tracking codes on your site without editing the code each time. It makes deploying pixels, analytics, and conversion tags faster and less error-prone. It is also where consent rules can be enforced before tags fire.",
    "related": [
      {
        "id": "pixel",
        "label": "Pixel"
      },
      {
        "id": "serverside-tracking",
        "label": "Server-Side Tracking"
      },
      {
        "id": "cookie-consent",
        "label": "Cookie Consent"
      }
    ]
  },
  {
    "id": "tcpa",
    "term": "TCPA",
    "category": "consent",
    "definition": "The TCPA (Telephone Consumer Protection Act) is a U.S. federal law that restricts telemarketing calls, automated texts, and the use of autodialers, especially to mobile phones. It is the law most often behind lawsuits against contractors and lead sellers, because it allows statutory damages per individual message sent without proper consent. Calling or texting a purchased lead without documented consent is where the exposure lives.",
    "related": [
      {
        "id": "express-written-consent",
        "label": "Express Written Consent"
      },
      {
        "id": "do-not-call-dnc",
        "label": "Do Not Call (DNC)"
      },
      {
        "id": "phonegrade-lead",
        "label": "Phone-Grade Lead"
      }
    ]
  },
  {
    "id": "thirdparty-data",
    "term": "Third-Party Data",
    "category": "visid",
    "definition": "Third-party data is information about people gathered by someone other than the business using it, then bought, licensed, or aggregated. It powers a lot of cheap identification, but it carries consent gaps and is declining as browsers and laws restrict it. Relying on it is increasingly a liability rather than an edge.",
    "related": [
      {
        "id": "firstparty-data",
        "label": "First-Party Data"
      },
      {
        "id": "data-broker",
        "label": "Data Broker"
      },
      {
        "id": "deanonymization",
        "label": "De-anonymization"
      }
    ]
  },
  {
    "id": "truck-wrap",
    "term": "Truck Wrap",
    "category": "homeserv",
    "definition": "A truck wrap is branded graphics applied to a service vehicle so it advertises wherever it drives and parks. It is a one-time cost that generates impressions for years, doubling as proof you're active in the area. Paired with a memorable name and number, it quietly builds local brand awareness.",
    "related": [
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      },
      {
        "id": "yard-sign",
        "label": "Yard Sign"
      },
      {
        "id": "impressions",
        "label": "Impressions"
      }
    ]
  },
  {
    "id": "utm-parameters",
    "term": "UTM Parameters",
    "category": "visid",
    "definition": "UTM parameters are tags added to the end of a link's URL to record which campaign, source, and medium sent a visitor. They are how you tell whether a lead came from an email, a Google ad, or a Facebook post. Consistent UTM tagging is the foundation of accurate attribution.",
    "related": [
      {
        "id": "attribution",
        "label": "Attribution"
      },
      {
        "id": "call-tracking",
        "label": "Call Tracking"
      },
      {
        "id": "conversion",
        "label": "Conversion"
      }
    ]
  },
  {
    "id": "visitor-identification",
    "term": "Visitor Identification",
    "category": "visid",
    "definition": "Visitor identification is the practice of determining who an anonymous website visitor is so you can follow up with them. Traditional tools do this for everyone, often using purchased data; consent-first identification does it only for visitors who agreed. It turns wasted traffic into contactable leads when done with permission.",
    "related": [
      {
        "id": "anonymous-visitor",
        "label": "Anonymous Visitor"
      },
      {
        "id": "identity-resolution",
        "label": "Identity Resolution"
      },
      {
        "id": "consentfirst",
        "label": "Consent-First"
      }
    ]
  },
  {
    "id": "warm-lead",
    "term": "Warm Lead",
    "category": "leadgen",
    "definition": "A warm lead is someone who has already shown interest in your business, such as visiting your site, requesting info, or engaging with your content. They are easier to convert than strangers because the relationship has started. Warm leads reward fast, relevant follow-up.",
    "related": [
      {
        "id": "cold-lead",
        "label": "Cold Lead"
      },
      {
        "id": "lead-scoring",
        "label": "Lead Scoring"
      },
      {
        "id": "speed-to-lead",
        "label": "Speed to Lead"
      }
    ]
  },
  {
    "id": "website-conversion-rate",
    "term": "Website Conversion Rate",
    "category": "metrics",
    "definition": "Website conversion rate is the share of all site visitors who become a lead, typically through a form fill or call. For home services it commonly runs in the low single digits, which means most traffic leaves without a trace. Raising this rate is one of the highest-value marketing activities, and it is exactly the gap consented visitor identification addresses.",
    "related": [
      {
        "id": "conversion-rate",
        "label": "Conversion Rate"
      },
      {
        "id": "anonymous-visitor",
        "label": "Anonymous Visitor"
      },
      {
        "id": "visitor-identification",
        "label": "Visitor Identification"
      }
    ]
  },
  {
    "id": "yard-sign",
    "term": "Yard Sign",
    "category": "homeserv",
    "definition": "A yard sign is a physical sign placed at a job site to advertise your services to neighbors and passersby. It is a simple, low-cost form of local marketing that doubles as social proof: it shows you are working in the area. Pairing it with a clear call to action makes it work harder.",
    "related": [
      {
        "id": "brand-awareness",
        "label": "Brand Awareness"
      },
      {
        "id": "direct-mail",
        "label": "Direct Mail"
      },
      {
        "id": "service-area-business-sab",
        "label": "Service Area Business (SAB)"
      }
    ]
  }
];
