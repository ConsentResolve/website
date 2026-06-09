import type { APIRoute } from "astro";
import { buildPlatformFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildPlatformFeed({ source: "email", feedPath: "/feeds/email.xml" });
