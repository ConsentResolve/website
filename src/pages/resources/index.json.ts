// Build-time machine index of every resource — consumed by the authenticated
// /admin dashboard (served by the Worker, which reads this via ASSETS) and handy
// for any external tooling. Public metadata only.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "~/lib/site";
import { RESOURCE_TYPES, resourceHref, resourceImage } from "~/lib/resources";
import { SOCIAL_SOURCES } from "~/lib/social/buildUtm";

export const GET: APIRoute = async () => {
  const all = await getCollection("resources");
  const items = all
    .map((e) => {
      const d = e.data;
      const path = resourceHref(d);
      return {
        slug: d.slug,
        resource_type: d.resource_type,
        type_segment: RESOURCE_TYPES[d.resource_type].segment,
        title: d.title,
        category: d.category,
        status: d.status,
        funnel_stage: d.funnel_stage,
        url: `${SITE.url}${path}`,
        social_json: `${SITE.url}${path}social.json`,
        og_image: `${SITE.url}${resourceImage(d, "og")}`,
        thumbnail: `${SITE.url}${resourceImage(d, "thumbnail")}`,
        platforms: SOCIAL_SOURCES,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return new Response(JSON.stringify({ count: items.length, items }, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
};
