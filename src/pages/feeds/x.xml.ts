import type { APIRoute } from "astro";
import { buildPlatformFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildPlatformFeed({ source: "x", feedPath: "/feeds/x.xml" });
