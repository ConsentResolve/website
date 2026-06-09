// Per-resource social + SEO + OG + image + UTM payload.
//   /resources/[type]/[slug]/social.json
// This is the contract external automation (Make.com / Zapier / n8n) consumes
// per item. Generated at build time for every resource.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "~/lib/site";
import { RESOURCE_TYPES, resourceHref } from "~/lib/resources";
import { generateSocialPack } from "~/lib/social/generateSocialPack";
import { SOCIAL_SOURCES } from "~/lib/social/buildUtm";

export const getStaticPaths: GetStaticPaths = async () => {
  const all = await getCollection("resources");
  return all.map((entry) => ({
    params: {
      type: RESOURCE_TYPES[entry.data.resource_type].segment,
      slug: entry.data.slug,
    },
    props: { data: entry.data },
  }));
};

export const GET: APIRoute = ({ props }) => {
  const data = (props as { data: import("~/content.config").ResourceData }).data;
  const seg = RESOURCE_TYPES[data.resource_type].segment;
  const url = `${SITE.url}${resourceHref(data)}`;
  const social = generateSocialPack(data);

  const derivedImg = (v: string) => `/images/resources/${seg}/${data.slug}-${v}.png`;
  const images = {
    featured_image: data.images?.featured_image ?? data.featured_image ?? derivedImg("featured"),
    og_image: data.images?.og_image ?? data.featured_image ?? derivedImg("featured"),
    square_social_image: data.images?.square_social_image ?? derivedImg("square"),
    vertical_social_image: data.images?.vertical_social_image ?? derivedImg("vertical"),
    thumbnail: data.images?.thumbnail ?? derivedImg("thumbnail"),
  };
  const abs = (p: string) => (p.startsWith("http") ? p : `${SITE.url}${p}`);

  const payload = {
    resource: {
      title: data.title,
      slug: data.slug,
      resource_type: data.resource_type,
      status: data.status,
      author: data.author,
      excerpt: data.excerpt,
      read_time: data.read_time ?? null,
      published_at: data.published_at?.toISOString() ?? null,
      updated_at: data.updated_at?.toISOString() ?? null,
      industry: data.industry,
      audience: data.audience,
      funnel_stage: data.funnel_stage,
      url,
    },
    seo: {
      seo_title: data.seo_title,
      seo_description: data.seo_description,
      focus_keyword: data.focus_keyword,
      canonical_url: data.canonical_url,
      schema_type: data.schema_type,
    },
    open_graph: {
      title: data.seo_title,
      description: data.seo_description,
      type: "article",
      url,
      image: abs(images.og_image),
    },
    images: Object.fromEntries(Object.entries(images).map(([k, v]) => [k, abs(v)])),
    categories: [data.category],
    tags: data.tags,
    social: Object.fromEntries(
      SOCIAL_SOURCES.map((s) => {
        const v = social[s];
        return [s, { ...v, image_url: v.image_url ? abs(v.image_url) : v.image_url }];
      })
    ),
    utm: Object.fromEntries(SOCIAL_SOURCES.map((s) => [s, social[s].utm_url])),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
