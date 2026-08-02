import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://consentresolve.com",
  output: "static",
  trailingSlash: "always",
  integrations: [
    react(),
    sitemap({
      // Exclude internal style-guide routes from sitemap. They're also
      // noindexed via StyleGuideLayout — this keeps them out of crawler
      // discovery and preserves crawl budget for marketing pages.
      filter: (page) =>
        !page.includes("/style-guide/") &&
        !page.includes("/demo/") &&
        !page.includes("/feeds/") &&
        !page.includes("/lead-math") && // noindex landing — keep it out of the sitemap
        !page.includes("/agency-partners") && // unlinked agency reseller page — noindex, direct-URL only
        !page.includes("/better-together"), // "Better Together" rewards landing — noindex, direct-URL only
      // Image sitemap: attach each Resource Center page's social card so the
      // 150+ generated images are discoverable. Adds <image:image> entries.
      serialize(item) {
        const m = item.url.match(
          /\/resources\/(blog|how-to-guides|plain-language-explainers)\/([^/]+)\/$/
        );
        if (m) {
          item.img = [
            { url: `https://consentresolve.com/images/resources/${m[1]}/${m[2]}-og.jpg` },
          ];
        }
        return item;
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  build: { format: "directory" },
});
