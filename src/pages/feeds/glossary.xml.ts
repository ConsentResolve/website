import type { APIRoute } from "astro";
import { buildResourceFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildResourceFeed({
    type: "glossary",
    title: "Consent Resolve Glossary",
    description:
      "Plain-English definitions for visitor identification, consent, attribution, and first-party data.",
    feedPath: "/feeds/glossary.xml",
    pagePath: "/resources/glossary/",
  });
