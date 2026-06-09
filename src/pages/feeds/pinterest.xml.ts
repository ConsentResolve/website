import type { APIRoute } from "astro";
import { buildPlatformFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildPlatformFeed({ source: "pinterest", feedPath: "/feeds/pinterest.xml" });
