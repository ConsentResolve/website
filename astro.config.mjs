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
        !page.includes("/feeds/"),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  build: { format: "directory" },
});
