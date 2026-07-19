// Resource Center shared helpers — single source of truth for the mapping
// between a resource's `resource_type`, its route segment, and its human label.
// Used by cards, indexes, the hub, breadcrumbs, and (later) feeds + social.json.
import { getCollection, type CollectionEntry } from "astro:content";

// NOTE: glossary is NOT a collection type — it's a standalone single page at
// /resources/glossary/ (src/data/glossary.ts). It's intentionally absent here.
export type ResourceType =
  | "how-to-guide"
  | "plain-language-explainer"
  | "blog";

export type ResourceEntry = CollectionEntry<"resources">;

interface TypeMeta {
  /** URL segment under /resources/ */
  segment: string;
  /** Plural label, e.g. "How-To Guides" (used in nav, index titles, crumbs). */
  label: string;
  /** Singular label, e.g. "How-To Guide" (used as a card tag). */
  singular: string;
  /** One-line description for the type index hero. */
  blurb: string;
}

export const RESOURCE_TYPES: Record<ResourceType, TypeMeta> = {
  "how-to-guide": {
    segment: "how-to-guides",
    label: "How-To Guides",
    singular: "How-To Guide",
    blurb:
      "Step-by-step playbooks for getting found, capturing leads, and booking more jobs — built for home-service contractors.",
  },
  "plain-language-explainer": {
    segment: "plain-language-explainers",
    label: "Straight Answers",
    singular: "Straight Answer",
    blurb:
      "Plain answers to the marketing and compliance questions contractors actually ask — no jargon.",
  },
  blog: {
    segment: "blog",
    label: "Blog",
    singular: "Article",
    blurb:
      "Ideas and evidence on consent-first, privacy-safe lead generation for home services.",
  },
};

export const RESOURCE_TYPE_ORDER: ResourceType[] = [
  "how-to-guide",
  "plain-language-explainer",
  "blog",
];

/** Detail-page path for a resource entry, e.g. /resources/how-to-guides/slug/ */
export function resourceHref(data: { resource_type: ResourceType; slug: string }): string {
  return `/resources/${RESOURCE_TYPES[data.resource_type].segment}/${data.slug}/`;
}

/** Type-index path, e.g. /resources/how-to-guides/ */
export function typeHref(type: ResourceType): string {
  return `/resources/${RESOURCE_TYPES[type].segment}/`;
}

/** Generated image path for a resource, e.g.
 *  /images/resources/how-to-guides/<slug>-featured.png
 *  variant: featured | og | square | vertical | thumbnail */
export function resourceImage(
  data: { resource_type: ResourceType; slug: string },
  variant: "featured" | "og" | "square" | "vertical" | "thumbnail" = "featured"
): string {
  // og/featured/thumbnail ship as compressed local JPG (web-facing). The large
  // square/vertical social variants live in R2, served same-origin via /cdn/*.
  const social = variant === "square" || variant === "vertical";
  const base = social ? "/cdn/images/resources" : "/images/resources";
  const ext = social ? "png" : "jpg";
  return `${base}/${RESOURCE_TYPES[data.resource_type].segment}/${data.slug}-${variant}.${ext}`;
}

/** Trades we've generated themed social-image variants for. Add a slug here
 *  after running `generate-resource-images.py --trade <slug>` for all resources.
 *  The canonical page og:image stays generic; these feed trade-targeted social pushes. */
export const RESOURCE_TRADES = ["plumber"] as const;
export type ResourceTrade = (typeof RESOURCE_TRADES)[number];

export const IMAGE_VARIANTS = ["featured", "og", "square", "vertical", "thumbnail"] as const;

/** Trade-themed image path, e.g.
 *  /images/resources/how-to-guides/<slug>-plumber-featured.png */
export function tradeImage(
  data: { resource_type: ResourceType; slug: string },
  trade: string,
  variant: (typeof IMAGE_VARIANTS)[number] = "featured"
): string {
  const social = variant === "square" || variant === "vertical";
  const base = social ? "/cdn/images/resources" : "/images/resources";
  const ext = social ? "png" : "jpg";
  return `${base}/${RESOURCE_TYPES[data.resource_type].segment}/${data.slug}-${trade}-${variant}.${ext}`;
}

/** Resources that should appear publicly (published + ready_to_publish). */
const VISIBLE = new Set(["published", "ready_to_publish", "scheduled"]);

/** All publicly-visible resources, newest first, optionally filtered by type. */
export async function getResources(type?: ResourceType): Promise<ResourceEntry[]> {
  const all = await getCollection("resources");
  return all
    .filter((e) => VISIBLE.has(e.data.status))
    .filter((e) => (type ? e.data.resource_type === type : true))
    .sort((a, b) => {
      const da = (a.data.updated_at || a.data.published_at)?.getTime() ?? 0;
      const db = (b.data.updated_at || b.data.published_at)?.getTime() ?? 0;
      return db - da;
    });
}

/**
 * Blog posts for a hub page's "From the blog" rail, by `cluster` (a trade or
 * feature slug). Cluster-matched posts come first (so every cluster post earns
 * an inbound link from its hub); remaining slots are filled with evergreen
 * fallbacks so a hub with few/no cluster posts still shows `n` relevant reads.
 */
const EVERGREEN_FALLBACK = [
  "get-more-leads-no-extra-spend",
  "see-whos-on-your-site-right-now-without-a-single-form-fill",
  "capturing-the-98-who-will-never-fill-out-your-form",
  "more-traffic-wrong-goal",
];
export async function getBlogPostsByCluster(
  cluster: string,
  n = 3
): Promise<ResourceEntry[]> {
  const blog = await getResources("blog");
  const matched = blog.filter((e) => e.data.cluster === cluster);
  const picked: ResourceEntry[] = [...matched];
  if (picked.length < n) {
    const have = new Set(picked.map((e) => e.data.slug));
    for (const slug of EVERGREEN_FALLBACK) {
      if (picked.length >= n) break;
      const post = blog.find((e) => e.data.slug === slug && !have.has(slug));
      if (post) {
        picked.push(post);
        have.add(slug);
      }
    }
  }
  return picked.slice(0, n);
}
