import type { APIRoute } from "astro";
import { buildResourceFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildResourceFeed({
    type: "how-to-guide",
    title: "Consent Resolve How-To Guides",
    description:
      "Step-by-step playbooks for getting found, capturing leads, and booking more jobs — built for home-service contractors.",
    feedPath: "/feeds/how-to-guides.xml",
    pagePath: "/resources/how-to-guides/",
  });
