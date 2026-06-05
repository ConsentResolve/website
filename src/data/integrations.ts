/**
 * Integrations data spine — the SINGLE source of truth for every place the
 * site names a CRM, marketing tool, or destination. Homepage logo marquee,
 * pricing "Native CRM integrations" row, FAQ answer, and the product-demo
 * Integrations screen all render from this list so the claim never drifts.
 *
 * Launch list confirmed June 2026 (see consent-resolve-site-update prompt,
 * Workstream 5). Trade CRMs lead — they're the buyer's own tools.
 *
 * NOTE FOR ENGINEERING (FLAG): every connector here must be shippable by
 * March 1. Anything not confirmed native gets moved to "via Zapier or
 * webhook" phrasing before launch, not left as a native claim.
 */

export type IntegrationCategory =
  | "trade-crm"
  | "crm"
  | "email"
  | "marketing"
  | "data"
  | "automation";

export interface Integration {
  name: string;
  category: IntegrationCategory;
  /** A home-services trade CRM — the buyer's own tool. Lead with these. */
  trade?: boolean;
  /** Path under /public to an in-repo logo asset, when one exists. Only
   *  these render in the logo marquee — never hotlink a missing asset. */
  logo?: string;
}

export const INTEGRATIONS: Integration[] = [
  // Trade CRMs — the buyer's tools, listed first everywhere.
  { name: "Jobber",            category: "trade-crm", trade: true },
  { name: "Housecall Pro",     category: "trade-crm", trade: true, logo: "/logos/integrations/housecallpro.svg" },
  { name: "ServiceTitan",      category: "trade-crm", trade: true, logo: "/logos/integrations/servicetitan.svg" },
  { name: "GoHighLevel",       category: "trade-crm", trade: true },
  // General CRM + marketing.
  { name: "Salesforce",        category: "crm",        logo: "/logos/integrations/salesforce.svg" },
  { name: "HubSpot",           category: "crm",        logo: "/logos/integrations/hubspot.svg" },
  { name: "Pipedrive",         category: "crm" },
  { name: "Zoho CRM",          category: "crm" },
  { name: "Microsoft Dynamics",category: "crm" },
  { name: "ActiveCampaign",    category: "email" },
  { name: "Mailchimp",         category: "email" },
  { name: "Klaviyo",           category: "email" },
  { name: "Marketo",           category: "marketing" },
  { name: "Pardot",            category: "marketing" },
  { name: "Intercom",          category: "marketing" },
  { name: "Segment",           category: "data" },
  { name: "Google Sheets",     category: "data" },
  { name: "Slack",             category: "automation", logo: "/logos/integrations/slack.svg" },
  { name: "Zapier",            category: "automation", logo: "/logos/integrations/zapier.svg" },
  { name: "Custom API / webhook", category: "automation" },
];

/** The enterprise catch-all line that always trails an integrations list. */
export const CUSTOM_INTEGRATION_LINE =
  "Don't see your CRM? We build custom integrations for enterprise customers.";

/** All integration names, trade CRMs first (matches array order). */
export const INTEGRATION_NAMES: string[] = INTEGRATIONS.map((i) => i.name);

/** Only integrations with an in-repo logo asset — the logo marquee set.
 *  Anything without a logo is intentionally text-only until art ships. */
export const INTEGRATION_LOGOS: Integration[] = INTEGRATIONS.filter((i) => i.logo);

/** Integrations still missing a logo asset in /public/logos/integrations/.
 *  Surfaced so the marketing/design team knows what art to commission —
 *  these are rendered as text, never hotlinked. */
export const INTEGRATIONS_MISSING_LOGO: string[] = INTEGRATIONS.filter(
  (i) => !i.logo && i.name !== "Custom API / webhook",
).map((i) => i.name);
