import type { APIRoute } from "astro";
import { buildResourceFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildResourceFeed({
    type: "plain-language-explainer",
    title: "Consent Resolve Plain-Language Explainers",
    description:
      "The confusing parts of privacy-first marketing, explained simply and tied back to what it means for your business.",
    feedPath: "/feeds/plain-language-explainers.xml",
    pagePath: "/resources/plain-language-explainers/",
  });
