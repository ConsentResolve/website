// Hand-rolled RSS 2.0 builder for the Resource Center feeds. We render the XML
// directly (rather than pulling in @astrojs/rss) to match the repo's existing
// endpoint style (see src/pages/llms.txt.ts) and avoid a new dependency.
import { SITE } from "./site";

export interface FeedItem {
  title: string;
  link: string; // absolute URL
  description: string;
  pubDate?: Date;
  guid?: string; // defaults to link
  categories?: string[];
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string)
  );
}

function rfc822(d?: Date): string {
  return (d ?? new Date(0)).toUTCString();
}

/** Build a valid RSS 2.0 document string. */
export function rssXml(opts: {
  title: string;
  description: string;
  /** Absolute URL of the page this feed represents. */
  link: string;
  /** Absolute URL of this feed itself (for atom:self). */
  feedUrl: string;
  items: FeedItem[];
}): string {
  const lastBuild = opts.items
    .map((i) => i.pubDate?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  const itemXml = opts.items
    .map((i) => {
      const guid = i.guid ?? i.link;
      const cats = (i.categories ?? [])
        .map((c) => `      <category>${esc(c)}</category>`)
        .join("\n");
      return `    <item>
      <title>${esc(i.title)}</title>
      <link>${esc(i.link)}</link>
      <guid isPermaLink="true">${esc(guid)}</guid>
      <description>${esc(i.description)}</description>
      <pubDate>${rfc822(i.pubDate)}</pubDate>${cats ? "\n" + cats : ""}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(opts.title)}</title>
    <link>${esc(opts.link)}</link>
    <atom:link href="${esc(opts.feedUrl)}" rel="self" type="application/rss+xml" />
    <description>${esc(opts.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(lastBuild ? new Date(lastBuild) : undefined)}</lastBuildDate>
    <generator>Consent Resolve Resource Center</generator>
${itemXml}
  </channel>
</rss>
`;
}

export function feedResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export const FEED_SITE = SITE;

// ── Resource feed builder ───────────────────────────────────────────────────
import { getResources, resourceHref, type ResourceType } from "./resources";

/** Build a content RSS feed for one resource type, or all when type omitted. */
export async function buildResourceFeed(opts: {
  type?: ResourceType;
  title: string;
  description: string;
  /** Feed path under the site root, e.g. "/feeds/how-to-guides.xml". */
  feedPath: string;
  /** Page this feed represents, e.g. "/resources/how-to-guides/". */
  pagePath: string;
}): Promise<Response> {
  const entries = await getResources(opts.type);
  const items: FeedItem[] = entries.map((e) => ({
    title: e.data.title,
    link: `${SITE.url}${resourceHref(e.data)}`,
    description: e.data.excerpt,
    pubDate: e.data.published_at || e.data.updated_at,
    categories: [e.data.category, ...e.data.tags],
  }));
  const xml = rssXml({
    title: opts.title,
    description: opts.description,
    link: `${SITE.url}${opts.pagePath}`,
    feedUrl: `${SITE.url}${opts.feedPath}`,
    items,
  });
  return feedResponse(xml);
}

// ── Platform social feeds ───────────────────────────────────────────────────
// One feed per platform exposing that platform's social_pack variant for every
// resource. Automation (Make/Zapier/n8n) can poll a single platform feed and
// post each item. The <link> is the platform's UTM-tagged URL.
import { generateSocialPack } from "./social/generateSocialPack";
import type { SocialSource } from "./social/buildUtm";

const PLATFORM_LABEL: Record<SocialSource, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  threads: "Threads",
  pinterest: "Pinterest",
  email: "Email",
  google_business_profile: "Google Business Profile",
};

export async function buildPlatformFeed(opts: {
  source: SocialSource;
  feedPath: string;
}): Promise<Response> {
  const entries = await getResources();
  const label = PLATFORM_LABEL[opts.source];
  const items: FeedItem[] = entries.map((e) => {
    const v = generateSocialPack(e.data)[opts.source];
    const desc = [v.caption, v.cta, (v.hashtags ?? []).map((h) => `#${h}`).join(" ")]
      .filter(Boolean)
      .join("\n\n");
    return {
      title: v.title ?? v.hook ?? e.data.title,
      link: v.utm_url,
      description: desc,
      pubDate: e.data.published_at || e.data.updated_at,
      guid: `${e.data.canonical_url}#${opts.source}`,
      categories: v.hashtags,
    };
  });
  const xml = rssXml({
    title: `Consent Resolve — ${label} queue`,
    description: `Ready-to-post ${label} updates generated from the Consent Resolve Resource Center.`,
    link: `${SITE.url}/resources/`,
    feedUrl: `${SITE.url}${opts.feedPath}`,
    items,
  });
  return feedResponse(xml);
}
