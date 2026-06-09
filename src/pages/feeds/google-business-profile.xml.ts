import type { APIRoute } from "astro";
import { buildPlatformFeed } from "~/lib/feeds";

export const GET: APIRoute = () =>
  buildPlatformFeed({ source: "google_business_profile", feedPath: "/feeds/google-business-profile.xml" });
