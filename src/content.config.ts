// Resource Center content collection.
//
// DEVIATION (noted in PROGRESS.md): the rest of the site uses TypeScript "data
// spines" in src/data/*.ts for programmatic pages. The Resource Center is
// long-form Markdown documents (10 How-To Guides + glossary/explainers/blog),
// which is exactly what Astro content collections are built for — so resources
// live here as Markdown files rather than as template-literal strings in a .ts
// file. All layouts, SEO helpers, components, and styling are still reused.
import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const socialVariant = z
  .object({
    title: z.string().optional(),
    caption: z.string().optional(),
    hook: z.string().optional(),
    cta: z.string().optional(),
    hashtags: z.array(z.string()).default([]),
    image_url: z.string().optional(),
    alt_text: z.string().optional(),
    utm_url: z.string().optional(),
  })
  .partial();

const faqItem = z.object({ question: z.string(), answer: z.string() });
const ctaItem = z.object({ label: z.string(), url: z.string() });
const howToStep = z.object({ name: z.string(), text: z.string() });

const resourceSchema = z.object({
  // Core
  title: z.string(),
  slug: z.string(),
  resource_type: z.enum([
    "how-to-guide",
    "glossary",
    "plain-language-explainer",
    "blog",
  ]),
  status: z
    .enum(["draft", "ready_to_publish", "scheduled", "published", "unpublished"])
    .default("draft"),
  author: z.string().default("Consent Resolve Team"),
  featured_image: z.string().optional(),
  excerpt: z.string(),
  published_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  read_time: z.string().optional(),

  // ── Image system (hook-led cards) ──────────────────────────────────────────
  // og_hook is the scroll-stopping line printed large on the OG/featured image —
  // NOT the title (the platform shows the title/description under the unfurl).
  // Required: the scroll-stopping line printed large on the OG/featured image.
  // The build fails if a resource omits it (per the image-system spec).
  og_hook: z.string().max(80),
  social_headline: z.string().optional(), // square/vertical; defaults to title
  cta_text: z.string().default("Read the guide →"),
  logo_variant: z.enum(["light", "dark", "mark"]).default("light"),

  // SEO
  seo_title: z.string(),
  seo_description: z.string(),
  focus_keyword: z.string(),
  canonical_url: z.string().url(),

  // Classification
  category: z.string(),
  tags: z.array(z.string()).default([]),
  industry: z.string().default("home-services"),
  audience: z.string().default("home-service-contractors"),
  funnel_stage: z.enum(["get-found", "capture", "convert", "retain-expand"]),

  // Schema
  schema_type: z.enum([
    "HowTo",
    "DefinedTerm",
    "FAQPage",
    "Article",
    "BlogPosting",
  ]),

  // FAQ
  faq_items: z.array(faqItem).default([]),

  // CTAs
  primary_cta: ctaItem,
  secondary_cta: ctaItem.optional(),

  // Extracted callouts rendered as reusable components (not duplicated in body)
  key_takeaways: z.string().optional(),
  compliance_note: z.string().optional(),

  // HowTo step list — powers HowTo JSON-LD (kept in sync with the body prose)
  how_to_steps: z.array(howToStep).default([]),

  // Social pack (generated; seed example provided for guide #1)
  social_pack: z
    .object({
      linkedin: socialVariant.optional(),
      facebook: socialVariant.optional(),
      x: socialVariant.optional(),
      threads: socialVariant.optional(),
      pinterest: socialVariant.optional(),
      google_business_profile: socialVariant.optional(),
      email: socialVariant.optional(),
    })
    .partial()
    .optional(),

  // Image variants (generated)
  images: z
    .object({
      featured_image: z.string().optional(), // 1200x630
      og_image: z.string().optional(), // 1200x630
      square_social_image: z.string().optional(), // 1080x1080
      vertical_social_image: z.string().optional(), // 1080x1350
      thumbnail: z.string().optional(), // 600x400
    })
    .partial()
    .optional(),
});

export type ResourceData = z.infer<typeof resourceSchema>;

const resources = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/resources" }),
  schema: resourceSchema,
});

export const collections = { resources };
