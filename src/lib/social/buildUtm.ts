// Reusable UTM builder — the ONLY place social/email tracking URLs are made.
// Format (per spec):
//   {canonical}?utm_source={source}&utm_medium=social&utm_campaign=resource_center&utm_content={slug}
// Email uses utm_medium=email. Never hand-write a UTM string elsewhere.

export type SocialSource =
  | "linkedin"
  | "facebook"
  | "x"
  | "threads"
  | "pinterest"
  | "email"
  | "google_business_profile";

export const SOCIAL_SOURCES: SocialSource[] = [
  "linkedin",
  "facebook",
  "x",
  "threads",
  "pinterest",
  "google_business_profile",
  "email",
];

export function buildUtm(opts: {
  canonicalUrl: string;
  source: SocialSource;
  slug: string;
  campaign?: string;
}): string {
  const medium = opts.source === "email" ? "email" : "social";
  const u = new URL(opts.canonicalUrl);
  // Insertion order is preserved by URLSearchParams, so the emitted string
  // matches the documented source/medium/campaign/content order.
  u.searchParams.set("utm_source", opts.source);
  u.searchParams.set("utm_medium", medium);
  u.searchParams.set("utm_campaign", opts.campaign ?? "resource_center");
  u.searchParams.set("utm_content", opts.slug);
  return u.toString();
}
