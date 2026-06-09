import type { APIRoute } from "astro";
import { buildResourceFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildResourceFeed({
    title: "Consent Resolve Resource Center",
    description:
      "Guides, glossary, and explainers on consent-first, privacy-safe lead generation for home-service contractors.",
    feedPath: "/feeds/resources.xml",
    pagePath: "/resources/",
  });
