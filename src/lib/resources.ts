// Resource Center shared helpers — single source of truth for the mapping
// between a resource's `resource_type`, its route segment, and its human label.
// Used by cards, indexes, the hub, breadcrumbs, and (later) feeds + social.json.
import { getCollection, type CollectionEntry } from "astro:content";

export type ResourceType =
  | "how-to-guide"
  | "glossary"
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
  glossary: {
    segment: "glossary",
    label: "Glossary",
    singular: "Glossary Term",
    blurb:
      "Plain-English definitions for visitor identification, consent, attribution, and first-party data.",
  },
  "plain-language-explainer": {
    segment: "plain-language-explainers",
    label: "Plain-Language Explainers",
    singular: "Explainer",
    blurb:
      "The confusing parts of privacy-first marketing, explained simply and tied back to what it means for your business.",
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
  "glossary",
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
