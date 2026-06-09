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

- [x] **Chunk 1 — Content model + first guide**
- [x] **Chunk 2 — Hub + type index + nav/footer links**
- [x] **Chunk 3 — Seed guides 2–10**
- [x] **Chunk 4 — Glossary / explainer / blog templates + indexes**
- [x] **Chunk 5 — RSS/XML content feeds** *(platform feeds were deferred to Chunk 6)*
- [x] **Chunk 6 — Social pack generator + UTM + social.json + 7 platform feeds**
- [x] **Chunk 7 — D1 social_queue + /api/social-queue** *(LIVE — table + secret set; seeded 91 rows / 13 resources × 7 platforms)*
- [x] **Chunk 8 — Resource images: composite generator + 65 brand-locked images** *(this commit)*
- [ ] Chunk 9 — Admin previews + AEO/Lighthouse pass + docs

### Backlog (post-build, content expansion — not a spec miss)
The spec supplied written content only for the 10 How-To Guides (all seeded).
The glossary / explainer / blog types each have **1 sample** to prove the
template; they want a real content set authored on-voice (voice-check each):
- **Glossary:** build out core terms (consent, first-party data, TCPA, CCPA,
  CIPA, attribution, speed-to-lead, review velocity, NAP, lead-grade…). Decide
  whether to migrate/merge the existing standalone `/glossary/` page terms into
  the Resource Center glossary.
- **Explainers:** more plain-language pieces (email-grade vs phone-grade
  consent; what TCPA means for a contractor; what an "exclusive" lead is).
- **Blog:** ongoing cadence.

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

---

## Chunk 2 — Hub + type index + nav/footer links ✅

**Files added**
- `src/lib/resources.ts` — single source of truth mapping `resource_type` →
  route segment + labels + blurb (`RESOURCE_TYPES`), plus `resourceHref()`,
  `typeHref()`, and `getResources(type?)` (filters to visible statuses, sorts
  newest first). Reused by cards, indexes, the hub, and later feeds/social.json.
- `src/components/resources/ResourceCard.astro` — links to a resource; shows
  category badge, type tag, title, excerpt, read time.
- `src/components/resources/ResourceGrid.astro` — responsive card grid.
- `src/pages/resources/index.astro` — hub; groups visible resources by type in
  canonical order; emits `ItemList` JSON-LD; positioning headline
  "Turn anonymous visitors into known leads."
- `src/pages/resources/how-to-guides/index.astro` — How-To index; `ItemList`.

**Files changed**
- `src/lib/site.ts` — added "Resources" to `PRIMARY_NAV` (between Industries and
  Pricing) and "Resource Center" to `FOOTER_NAV.company`.

**Decisions**
- The existing standalone `/glossary/` page is unrelated to the Resource
  Center's future `/resources/glossary/` type — no conflict, left as-is.
- Hub/index show only `published | ready_to_publish | scheduled` resources
  (draft/unpublished hidden), via `getResources()`.

**Test (after deploy)**
- "Resources" appears in the top nav and footer (company column).
- `/resources/` renders the hero + a "How-To Guides" section with Guide 1's
  card; card links through to the guide.
- `/resources/how-to-guides/` lists Guide 1; breadcrumbs resolve.
- View source on both: `ItemList` + `BreadcrumbList` JSON-LD present.

**Next:** Chunk 3 — seed guides 2–10 (cross-links between guides go live).

---

## Chunk 3 — Seed guides 2–10 ✅

**Files added** (`src/content/resources/how-to-guides/`)
- `win-google-local-service-ads.md` (Guide 2)
- `get-more-leads-from-website-traffic.md` (Guide 3 — 7 steps)
- `identify-anonymous-website-visitors.md` (Guide 4)
- `stop-losing-jobs-missed-calls.md` (Guide 5)
- `follow-up-with-leads.md` (Guide 6)
- `quote-and-close-more-jobs.md` (Guide 7)
- `get-more-google-reviews.md` (Guide 8)
- `market-to-neighbors-after-every-job.md` (Guide 9)
- `track-where-leads-come-from.md` (Guide 10)

**Method:** transcribed verbatim from the spec into the Guide 1 template shape —
identical frontmatter field order, `published_at`/`updated_at: 2026-06-09`,
`key_takeaways` lifted to frontmatter, `how_to_steps` derived from the numbered
steps, `schema_note`/`social_pack` omitted (social packs come in Chunk 6), the
Key-Takeaways + FAQ-footer lines dropped from the body, bold labels → `## H2`.
Validated structurally (10/10 files: 2 delimiters, 6 H2 sections, required keys,
slug == filename, no stray fields). Step counts: Guide 1 = 8, Guide 3 = 7, the
rest = 6.

**Test (after deploy):** all 10 guide URLs render; the hub + How-To index list
all 10; inter-guide CTA links (e.g. "track where your leads come from") now
resolve; broken-link-sweep clean.

**Next:** Chunk 4 — glossary / explainer / blog templates + indexes.

---

## Chunk 4 — Glossary / explainer / blog templates + indexes ✅

**Files added**
- `src/lib/seo.ts` (changed): `definedTermSchema()` (glossary, with
  `DefinedTermSet`) and `articleSchema({type})` (Article for explainers,
  BlogPosting for blog; author + publisher → canonical Org `@id`).
- Detail routes (all reuse `ResourceLayout`; section order lives in the body):
  - `src/pages/resources/glossary/[slug].astro` — DefinedTerm + FAQPage
  - `src/pages/resources/plain-language-explainers/[slug].astro` — Article + FAQPage
  - `src/pages/resources/blog/[slug].astro` — BlogPosting + FAQPage
- Index pages: `glossary/index.astro`, `plain-language-explainers/index.astro`,
  `blog/index.astro` (each emits `ItemList`).
- One on-voice sample per type:
  - `glossary/website-visitor-identification.md`
  - `plain-language-explainers/what-consent-first-means.md`
  - `blog/paying-for-traffic-throwing-it-away.md`

**Voice check:** ran on all 3 originals. One fix — "higher-leverage" →
"higher-return" (banned word "leverage"). The `cold-call` mentions are
intentional (describing the bad practice we warn against). No pricing/NAP/
numeric-canon drift; warm-inbound + email-first preserved.

**Test (after deploy):** `/resources/` now shows all four type sections; each
new index lists its sample; each sample renders with the right schema
(`DefinedTerm` / `Article` / `BlogPosting` + `FAQPage`); in-body markdown
cross-links resolve.

**Next:** Chunk 5 — RSS/XML feeds (`@astrojs/rss`).

---

## Chunk 5 — RSS/XML content feeds ✅

**Decision:** hand-rolled RSS 2.0 (no `@astrojs/rss` dependency) to match the
repo's existing endpoint style (`src/pages/llms.txt.ts`) and avoid adding a
package we can't verify locally (no Node toolchain on this machine).

**Files added**
- `src/lib/feeds.ts` — `rssXml()` (valid RSS 2.0 + `atom:self`), `feedResponse()`,
  and `buildResourceFeed({type?, ...})` (sources `getResources`, maps category +
  tags to `<category>`, pubDate from published/updated).
- Endpoints (build-time, prerendered):
  - `src/pages/feeds/resources.xml.ts` (all types)
  - `src/pages/feeds/how-to-guides.xml.ts`
  - `src/pages/feeds/glossary.xml.ts`
  - `src/pages/feeds/plain-language-explainers.xml.ts`
  - `src/pages/feeds/blog.xml.ts`

**Files changed**
- `astro.config.mjs` — sitemap filter now also excludes `/feeds/`.

**Deferred to Chunk 6:** the 7 **platform** feeds (linkedin/facebook/x/threads/
pinterest/email/google-business-profile) read each resource's `social_pack`,
which only exists for Guide 1 until the `generateSocialPack` service is built.
Building them now would ship 6 near-empty feeds — so they ship alongside the
generator in Chunk 6.

**Test (after deploy):** `curl` each `/feeds/*.xml` → valid RSS, correct item
counts (resources=13, how-to-guides=10, glossary=1, explainers=1, blog=1).

**Next:** Chunk 6 — social-pack generator + UTM builder + `social.json` endpoint
+ the 7 platform feeds.

---

## Chunk 6 — Social pack generator + UTM + social.json + platform feeds ✅

**Files added**
- `src/lib/social/buildUtm.ts` — `buildUtm()` (the only UTM source) + the 7
  `SOCIAL_SOURCES`. Email → `utm_medium=email`, all others `social`;
  campaign `resource_center`, content = slug.
- `src/lib/social/generateSocialPack.ts` — `generateSocialPack(data)` returns
  all 7 platform variants. Deterministic templating from title/excerpt/
  seo_description/tags with per-platform rules (LinkedIn 4 hashtags + square,
  Facebook featured + soft CTA, X ≤240 hook, Threads no hashtags, Pinterest
  vertical + keyword desc, GBP ≤1500 local + no hashtags, Email subject/preview/
  body). **Authored variants win** (Guide 1's hand-written pack is preserved);
  `utm_url` is ALWAYS rebuilt via `buildUtm` (never trust a hand-written UTM).
- `src/pages/resources/[type]/[slug]/social.json.ts` — per-item payload:
  resource meta, SEO, Open Graph, all image variants (absolute URLs), categories,
  tags, the 7 social variants, and a flat `utm` map. `getStaticPaths` over every
  resource (type = route segment).
- `src/lib/feeds.ts` (changed): `buildPlatformFeed({source})` — one RSS feed per
  platform; `<link>` is the platform's UTM URL, `<description>` = caption + CTA +
  hashtags.
- 7 platform feed endpoints: `/feeds/{linkedin,facebook,x,threads,pinterest,
  email,google-business-profile}.xml`.

**Routing note:** `resources/[type]/[slug]/social.json.ts` coexists with the
static `resources/how-to-guides/[slug].astro` — the `.json` leaf segment means
no collision with the detail pages.

**Test (after deploy):**
- `curl .../resources/how-to-guides/rank-google-map-pack-home-services/social.json`
  → 7 platforms, each with utm_url; LinkedIn keeps Guide 1's authored copy.
- `curl .../resources/how-to-guides/win-google-local-service-ads/social.json`
  → fully generated pack (Guide 2 had no authored social_pack).
- Each `/feeds/<platform>.xml` → valid RSS, 13 items, `<link>` carries
  `utm_source=<platform>`.

**Next:** Chunk 7 — D1 `social_queue` + `/api/social-queue` (needs a Cloudflare
secret `X-CR-Automation-Key` + a D1 migration; the one chunk with a dashboard
step).

---

## Chunk 7 — D1 social_queue + /api/social-queue ✅ (code) — needs 2 dashboard steps

**Files added**
- `worker/social-queue.sql` — `social_queue` table (one row per
  resource_slug+platform; status ready_to_publish | scheduled | published;
  post_url/post_id/published_at/payload) + indexes.
- `worker/api/social-queue.js` — `onRequestGet` (returns `{published, scheduled,
  ready_to_publish}`), `onRequestPost` (action `enqueue` = upsert rows; action
  `callback` = update status/post_url/post_id/published_at), `onRequestOptions`.
  Auth: `X-CR-Automation-Key` must equal env `CR_AUTOMATION_KEY`; **fails closed**
  (503 if the secret isn't set, 401 if it doesn't match).
- `scripts/seed-social-queue.py` — reads `/feeds/resources.xml` → each
  `social.json` → POSTs enqueue for all 7 platforms. Idempotent; also the
  reference for what Make/Zapier/n8n send.

**Files changed**
- `worker/index.js` — registered `/api/social-queue` route.
- `wrangler.jsonc` — documented the `CR_AUTOMATION_KEY` secret.

**USER dashboard steps (required before this endpoint works):**
1. Apply the migration to D1 (binding `DB`):
   `npx wrangler d1 execute consentresolve-demo --remote --file=worker/social-queue.sql`
   (or paste the SQL into the dashboard D1 console).
2. Add a Cloudflare secret `CR_AUTOMATION_KEY` = any long random string
   (Workers & Pages → the project → Settings → Variables & Secrets, **encrypted**).

**Test (after both steps + deploy):**
```
KEY=...; B=https://consentresolve.com
# empty queue
curl -s -H "X-CR-Automation-Key: $KEY" $B/api/social-queue
# seed all 13 resources x 7 platforms
CR_AUTOMATION_KEY=$KEY python3 scripts/seed-social-queue.py
# now ready_to_publish is populated
curl -s -H "X-CR-Automation-Key: $KEY" $B/api/social-queue | python3 -m json.tool | head
# simulate an automation callback
curl -s -X POST -H "X-CR-Automation-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"action":"callback","resource_slug":"rank-google-map-pack-home-services","platform":"linkedin","status":"published","post_url":"https://linkedin.com/post/123"}' \
  $B/api/social-queue
# that row now appears under "published"
```
Without the secret the endpoint returns 503 (`queue_unconfigured`); wrong key → 401.

**Next:** Chunk 8 — image provider abstraction + 5 image variants per guide.

---

## Chunk 8 — Resource images (composite generator) ✅

**Approach (user-chosen):** composite of a **Recraft illustration + branded
template card** (navy gradient, mint eyebrow + rule, Bricolage title in the real
brand font, "Consent Resolve" wordmark), with the art **locked to brand colors**.

**Files added**
- `scripts/generate-resource-images.py` — for each resource: fetch a Recraft
  `digital_illustration` (brand palette + strict two-color prompt), **`brandify()`**
  post-process (numpy: dark→navy, chromatic→mint, light neutrals kept) so a stray
  red pin / multicolor can never ship, then Pillow composes 5 variants with an
  **auto-fitting** title (shrinks to fit above the wordmark). Illustrations are
  cached under `scripts/.cache` so layout tweaks don't re-bill Recraft.
  Brand fonts auto-download to `scripts/.fonts` (Bricolage + Hanken from Google
  Fonts), system fallback.
- **65 PNGs** under `public/images/resources/<type>/<slug>-{featured,og,square,
  vertical,thumbnail}.png` (13 resources × 5).
- `.gitignore` — ignores `scripts/.fonts/` and `scripts/.cache/`.

**Files changed**
- `src/lib/resources.ts` — `resourceImage(data, variant)` path helper.
- `src/layouts/ResourceLayout.astro` — `og:image` falls back to the derived
  `-og.png` (so all 13 get a real OG image, not just Guide 1).
- `src/components/resources/ResourceCard.astro` — cards now show the `-thumbnail`
  (600×400) image on top.

**Sizes:** featured/og 1200×630, square 1080×1080, vertical 1080×1350,
thumbnail 600×400. Prototype reviewed → "tighten to brand palette" applied
(brandify); square/vertical title-overflow fixed via auto-fit.

**Test (after deploy):** OG image resolves on every guide
(`…/social.json` `open_graph.image` 200); hub/index cards show thumbnails;
the Guide 1 social_pack image paths now 200.

**Next:** Chunk 9 — admin previews + AEO/Lighthouse pass + docs.
