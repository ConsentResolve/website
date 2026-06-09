# Resource Center — Build Progress

Tracking the chunked build of the Consent Resolve Resource Center & Content
Distribution Engine (spec: `consent-resolve-resource-center.md`). Each chunk is
independently testable on the deployed site.

## Key architecture decision (deviation from spec assumption)

The spec assumed Astro content collections. The existing site instead uses
**TypeScript "data spines"** (`src/data/*.ts`) for *programmatic* pages
(industries, features, compare) — there were **no content collections** in the
repo. We resolved the tension this way:

- **Long-form Markdown resources** (the 10 How-To Guides + future glossary,
  explainers, blog) live in a **new Astro content collection**
  (`src/content.config.ts` → `src/content/resources/`). This is the right tool
  for ~1,000-word prose documents and is the spec's own assumption — stuffing
  bodies into `.ts` template literals would be fragile.
- **Everything else is reused, not forked:** `BaseLayout`/`PageLayout`, the
  `src/lib/seo.ts` schema helpers (`howToSchema`, `faqSchema`,
  `breadcrumbSchema`, …), the `FAQ`/`Badge`/`Breadcrumbs` components, Tailwind v4
  tokens in `global.css`, and the `@astrojs/sitemap` config.

Positioning lock preserved throughout: warm-inbound (homeowner → contractor,
never cold outbound), email-first leads, flat **$7/lead** (no $10 offer),
contractor-only, consent-first, no fabricated testimonials.

---

## Chunk status

- [x] **Chunk 1 — Content model + first guide** *(this commit)*
- [ ] Chunk 2 — Hub + type index + nav/footer links
- [ ] Chunk 3 — Seed guides 2–10
- [ ] Chunk 4 — Glossary / explainer / blog templates + indexes
- [ ] Chunk 5 — RSS/XML feeds
- [ ] Chunk 6 — Social pack generator + UTM + social.json endpoint
- [ ] Chunk 7 — D1 social_queue + /api/social-queue
- [ ] Chunk 8 — Image provider abstraction + 5 variants/guide
- [ ] Chunk 9 — Admin previews + AEO/Lighthouse pass + docs

---

## Chunk 1 — Content model + first guide ✅

**Files added**
- `src/content.config.ts` — `resources` collection (glob loader) + full Zod
  schema mapping 1:1 to the spec data model (core, SEO, classification, schema
  type, FAQ, CTAs, `social_pack`, `images`). Added two pragmatic fields:
  `key_takeaways` and `compliance_note` (rendered as reusable callout
  components instead of being buried in prose), and `how_to_steps` (powers the
  `HowTo` JSON-LD, kept in sync with the body).
- `src/layouts/ResourceLayout.astro` — shared chrome for all four resource
  types: server-rendered SEO meta + JSON-LD (via `BaseLayout`/`SEO`),
  breadcrumbs, article hero, Key-Takeaways box (top + bottom), rendered
  Markdown body (`.rc-prose` styling), Compliance callout, FAQ accordion, CTA
  band. Type-specific section ORDER lives in each Markdown body, so the layout
  stays universal.
- `src/components/resources/KeyTakeaways.astro` — AEO summary box.
- `src/components/resources/ComplianceNote.astro` — consent-first callout.
- `src/pages/resources/how-to-guides/[slug].astro` — How-To detail route;
  `getStaticPaths` over the collection filtered to `how-to-guide`; emits
  `HowTo` + `FAQPage` schema.
- `src/content/resources/how-to-guides/rank-google-map-pack-home-services.md`
  — **Guide 1**, the template guide, seeded verbatim including the fully-worked
  7-platform `social_pack` (the generation template for guides 2–10).

**Decisions**
- Breadcrumb JSON-LD is emitted by the reused `Breadcrumbs.astro` component, so
  the route does NOT also push `breadcrumbSchema` into the `schema` prop (avoids
  duplicate nodes).
- The "Key Takeaways" section was lifted out of the Markdown body into the
  `key_takeaways` frontmatter field so it renders as the AEO box near the top
  AND bottom (per spec). "Compliance Considerations" stays in the body prose for
  Guide 1 to preserve the spec's section order; `ComplianceNote` is wired and
  ready for use in later chunks/types.

**Test (after deploy)**
- Visit `https://consentresolve.com/resources/how-to-guides/rank-google-map-pack-home-services/`
- Confirm: hero + all sections render, Key-Takeaways boxes top & bottom, FAQ
  accordion works, CTAs point to `/` and the (not-yet-built) tracking guide.
- View source: `HowTo`, `FAQPage`, and `BreadcrumbList` JSON-LD present.
- Note: page is intentionally **unlinked** from nav until Chunk 2.

**Next:** Chunk 2 — `/resources/` hub + `/resources/how-to-guides/` index,
`ResourceCard`/`ResourceGrid`, and nav/footer links.
