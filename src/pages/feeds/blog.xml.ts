import type { APIRoute } from "astro";
import { buildResourceFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildResourceFeed({
    type: "blog",
    title: "Consent Resolve Blog",
    description:
      "Ideas and evidence on consent-first, privacy-safe lead generation for home services.",
    feedPath: "/feeds/blog.xml",
    pagePath: "/resources/blog/",
  });
