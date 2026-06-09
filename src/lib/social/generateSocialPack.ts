// Reusable Social Pack generator.
//
// Takes a resource's frontmatter data and returns a complete social_pack: one
// variant per platform (linkedin, facebook, x, threads, pinterest,
// google_business_profile, email), each with title/caption/hook/cta/hashtags/
// image_url/alt_text/utm_url.
//
// Generation is DETERMINISTIC (templated from title/excerpt/focus_keyword/
// seo_description/tags), so the same content always yields the same pack — good
// for caching, diffing, and a no-surprises automation contract. Where a
// resource ALREADY ships an authored variant (e.g. Guide 1), the authored
// copy wins; only the utm_url is always (re)built via buildUtm so tracking
// links are never hand-maintained.
import type { ResourceData } from "~/content.config";
import { RESOURCE_TYPES } from "~/lib/resources";
import { buildUtm, SOCIAL_SOURCES, type SocialSource } from "./buildUtm";

export interface SocialVariant {
  title?: string;
  caption: string;
  hook?: string;
  cta?: string;
  hashtags: string[];
  image_url: string;
  alt_text: string;
  utm_url: string;
}

export type SocialPack = Record<SocialSource, SocialVariant>;

type ImgVariant = "featured" | "square" | "vertical";

interface PlatformCfg {
  img: ImgVariant;
  cta: string;
  tags: number; // how many hashtags to derive when none authored
}

const PLATFORM_CFG: Record<SocialSource, PlatformCfg> = {
  linkedin: { img: "square", cta: "Read the full guide →", tags: 4 },
  facebook: { img: "featured", cta: "Read it here 👇", tags: 2 },
  x: { img: "square", cta: "Full guide →", tags: 2 },
  threads: { img: "square", cta: "Link in the guide.", tags: 0 },
  pinterest: { img: "vertical", cta: "Save this guide", tags: 3 },
  google_business_profile: { img: "featured", cta: "Read the guide", tags: 0 },
  email: { img: "featured", cta: "Read the full guide", tags: 0 },
};

function toHashtag(s: string): string {
  return s
    .split(/[^a-z0-9]+/i)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join("");
}

function topHashtags(data: ResourceData, n: number): string[] {
  if (n <= 0) return [];
  const out: string[] = [];
  for (const t of data.tags) {
    const h = toHashtag(t);
    if (h && !out.includes(h)) out.push(h);
    if (out.length >= n) break;
  }
  return out;
}

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, "").trimEnd() + "…";
}

function imagePath(data: ResourceData, v: ImgVariant): string {
  const seg = RESOURCE_TYPES[data.resource_type].segment;
  return `/images/resources/${seg}/${data.slug}-${v}.png`;
}

function defaultTitle(source: SocialSource, data: ResourceData): string | undefined {
  switch (source) {
    case "linkedin":
      return data.title;
    case "pinterest":
      return `${data.title} (Home-Service Contractor Guide)`;
    case "google_business_profile":
      return `New guide: ${data.title}`;
    case "email":
      return data.seo_title || data.title;
    default:
      return undefined; // facebook, x, threads lead with the hook, no title
  }
}

function defaultCaption(source: SocialSource, data: ResourceData, hook: string): string {
  switch (source) {
    case "pinterest":
      return data.seo_description;
    case "x":
      return truncate(hook, 240);
    case "google_business_profile":
      return truncate(data.excerpt, 1500);
    default:
      return data.excerpt;
  }
}

/** Generate (or merge authored + generate) the full 7-platform social pack. */
export function generateSocialPack(data: ResourceData): SocialPack {
  const pack = {} as SocialPack;
  const authoredAll = data.social_pack ?? {};

  for (const source of SOCIAL_SOURCES) {
    const cfg = PLATFORM_CFG[source];
    const authored = (authoredAll as Record<string, Partial<SocialVariant>>)[source] ?? {};
    const hook = authored.hook ?? firstSentence(data.excerpt);

    pack[source] = {
      title: authored.title ?? defaultTitle(source, data),
      hook,
      caption: authored.caption ?? defaultCaption(source, data, hook),
      cta: authored.cta ?? cfg.cta,
      hashtags: authored.hashtags ?? topHashtags(data, cfg.tags),
      image_url: authored.image_url ?? imagePath(data, cfg.img),
      alt_text: authored.alt_text ?? `${data.title} — guide cover`,
      // Always (re)built — never trust a hand-written UTM.
      utm_url: buildUtm({ canonicalUrl: data.canonical_url, source, slug: data.slug }),
    };
  }

  return pack;
}
