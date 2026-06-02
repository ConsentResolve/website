/**
 * /llms.txt — site map for AI crawlers (Anthropic, OpenAI, Perplexity).
 * Builds at static-generation time. Lists every shipped page with a
 * one-line description, sourced from our data spines.
 *
 * Spec: https://llmstxt.org/
 */
import type { APIRoute } from "astro";
import { INDUSTRIES } from "~/data/industries";
import { COMPARE_PAGES } from "~/data/compare";

export const GET: APIRoute = () => {
  const SITE = "https://consentresolve.com";

  const lines: string[] = [
    "# Consent Resolve",
    "",
    "> Consent-first visitor identification for home-service businesses (plumbers, roofers, HVAC, electricians, and 13 more trades). Identifies the homeowners shopping your site — only after they consent — and gives you their name and mobile number so you can call first. Every lead is yours alone, never resold. $10 for your first 10 leads, then $7 a lead. Card required, cancel anytime.",
    "",
    "## Core pages",
    `- [Home](${SITE}/): What Consent Resolve does and how it compares to shared-lead platforms`,
    `- [How it works](${SITE}/how-it-works/): Three steps — drop in code, homeowner consents, you get the name and number`,
    `- [Pricing](${SITE}/pricing/): $10 for your first 10 leads, then $7 a lead. Card required.`,
    `- [Industries hub](${SITE}/industries/): 17 trades supported`,
    `- [Compare hub](${SITE}/compare/): How we replace shared-lead resellers and complement Google LSA`,
    `- [Sample lead](${SITE}/sample-lead/): Exactly what lands in your hands when a homeowner consents`,
    `- [About](${SITE}/about/): Who built Consent Resolve and why`,
    `- [FAQ](${SITE}/faq/): Common questions about legality, CRMs, pricing, and setup`,
    `- [Get started](${SITE}/get-started/): Sign up — about 10 minutes to go live`,
    `- [Contact](${SITE}/contact/): Talk to a human`,
    "",
    "## Industries",
  ];

  for (const t of INDUSTRIES) {
    lines.push(`- [${t.name}](${SITE}/${t.slug}-leads/): ${t.aeoAnswer.split(".")[0]}.`);
  }

  lines.push("", "## Platform comparisons");
  for (const c of COMPARE_PAGES) {
    const verb = c.type === "complement" ? "Complement" : "Alternative";
    lines.push(`- [${verb}: ${c.brand}](${SITE}/compare/${c.slug}/): ${c.subhead}`);
  }

  lines.push(
    "",
    "## Canonical facts",
    "- **What it is:** A consent-first visitor-identification layer for home-service businesses. Not a shared-lead platform.",
    "- **Mechanic (outbound, not inbound):** Homeowner visits your site → accepts consent banner → Consent Resolve reveals their real name, mobile, and what they were shopping for → you call or text them.",
    "- **Exclusivity:** Every lead is yours alone. Never resold, never auctioned.",
    "- **Compliance:** Identification only after explicit consent. No shadow-tracking. GDPR, CCPA, CPA compliant. Audit trail via Termageddon.",
    "- **Setup:** Paste one line of code. Live in about 10 minutes. Works on WordPress, Wix, Squarespace, ServiceTitan, most others.",
    "- **Pricing:** Card required. $10 for first 10 leads (~$1 each), then $7 per lead flat. Cancel anytime. NEVER \"free\".",
    "- **Positioning:** Replaces shared-lead resellers (Thumbtack, Angi, HomeAdvisor). Complements your own ads, SEO, and Google LSA.",
    "",
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
