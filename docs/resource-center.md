# Resource Center & Content Distribution Engine

The Resource Center is the SEO/AEO content hub at `/resources/` plus a social
distribution engine (per-platform packs, feeds, a D1 queue, and an authenticated
admin). This doc covers how to extend and operate it.

> **Architecture note.** The marketing site is a static Astro build served by
> Cloudflare's `ASSETS` binding; a Worker (`worker/index.js`) handles `/api/*`
> and `/admin*`. Resource **content** lives in an Astro **content collection**
> (`src/content/resources/`) — markdown edited via the repo/PR flow. The only
> runtime-mutable store is **D1** (`social_queue`). So the admin manages the
> queue + previews; it does not edit articles at runtime.

---

## Content model

`src/content.config.ts` defines the `resources` collection (Zod schema). Four
types, each a subfolder of `src/content/resources/`:

| Type | Folder | Route | Schema |
|---|---|---|---|
| `how-to-guide` | `how-to-guides/` | `/resources/how-to-guides/<slug>/` | HowTo + FAQPage |
| `glossary` | `glossary/` | `/resources/glossary/<slug>/` | DefinedTerm + FAQPage |
| `plain-language-explainer` | `plain-language-explainers/` | `/resources/plain-language-explainers/<slug>/` | Article + FAQPage |
| `blog` | `blog/` | `/resources/blog/<slug>/` | BlogPosting + FAQPage |

`src/lib/resources.ts` is the single source of truth mapping
`resource_type → { segment, label, singular, blurb }`, plus `resourceHref()`,
`typeHref()`, `resourceImage()`, and `getResources(type?)` (visible-status
filter + newest-first).

### Add a new resource (content)

1. Create `src/content/resources/<type-folder>/<slug>.md`. `slug` in frontmatter
   **must** equal the filename. Fill the frontmatter per the Zod schema
   (`title, slug, resource_type, status, excerpt, seo_*, focus_keyword,
   canonical_url, category, funnel_stage, schema_type, primary_cta, faq_items`).
   Optional: `key_takeaways`, `compliance_note`, `how_to_steps` (powers HowTo
   JSON-LD), `tags`, `secondary_cta`.
2. Body: write the sections as `## H2` headings in the type's canonical order
   (see `src/layouts/ResourceLayout.astro` header comment). Omit the Key
   Takeaways section (use the `key_takeaways` field instead — it renders as the
   AEO box top + bottom).
3. `status` controls visibility: `published | ready_to_publish | scheduled` show
   on hubs/indexes/feeds; `draft | unpublished` hide. (This is the "publish /
   unpublish / schedule" lever — a content edit, committed to git.)
4. Generate images (below). Push to `main`; Cloudflare builds and deploys.

### Add a new resource TYPE

1. Add it to the `resource_type` enum in `src/content.config.ts`.
2. Add an entry to `RESOURCE_TYPES` + `RESOURCE_TYPE_ORDER` in
   `src/lib/resources.ts`.
3. Create the detail route `src/pages/resources/<segment>/[slug].astro` (copy an
   existing one; pick the schema generator in `src/lib/seo.ts`) and the index
   `src/pages/resources/<segment>/index.astro`.
4. Add a feed endpoint `src/pages/feeds/<segment>.xml.ts` (copy an existing one).
5. The hub, llms.txt, and social engine pick it up automatically.

---

## SEO / AEO

- Server-rendered meta + JSON-LD via `BaseLayout`/`SEO` and the generators in
  `src/lib/seo.ts` (`howToSchema`, `faqSchema`, `definedTermSchema`,
  `articleSchema`, `itemListSchema`, `breadcrumbSchema`). `FAQPage` is emitted
  whenever `faq_items` exist.
- AEO blocks: `KeyTakeaways` (top + bottom), `ComplianceNote`, self-contained FAQ
  answers, one H1 + logical H2/H3, internal cross-links between guides/glossary.
- `llms.txt` includes a Resource Center section (auto-generated from the
  collection) so AI crawlers get the full index.

---

## Images

`scripts/generate-resource-images.py` — composite of a **Recraft illustration**
(brand palette) + a **branded template card** (navy gradient, mint eyebrow,
Bricolage title, "Consent Resolve" wordmark). `brandify()` hard-locks the art to
mint/navy/white. Five variants per resource at deterministic paths:

```
public/images/resources/<type-seg>/<slug>-{featured,og,square,vertical,thumbnail}.png
  featured/og 1200x630 · square 1080x1080 · vertical 1080x1350 · thumbnail 600x400
```

```bash
# one resource, all 5 sizes
python3 scripts/generate-resource-images.py --only <slug>
# everything
python3 scripts/generate-resource-images.py
# refetch the Recraft illustration (otherwise cached in scripts/.cache)
python3 scripts/generate-resource-images.py --only <slug> --regen-illustration
```

Requires a Recraft key at `~/.config/recraft/key`. Brand fonts auto-download to
`scripts/.fonts`. Add a new slug's illustration subject to the `SUBJECTS` dict.

### Image provider abstraction

The provider seam is `fetch_background()` (Recraft today). To swap providers
(OpenAI, or a manual/uploaded background), replace that function's body —
everything downstream (`render_ink`, compositing, sizes) is provider-agnostic.

### Hook-led cards (two-layer)

Images are **Layer A** (AI background art — text-free, logo-free, rendered as
mint "ink" on transparent) + **Layer B** (deterministic: navy frame, eyebrow,
the `og_hook` with numbers highlighted mint, headline/CTA, and the real logo
from `public/brand/`). The AI never renders text or the logo. `og_hook` is
required frontmatter (max 80 chars) and is what prints large on the OG image —
NOT the title.

### Trade theming

`--trade <slug>` swaps the right-side motif to a trade (plumber, roofing, hvac,
electrician, …) and adds a `FOR <TRADE>` eyebrow tag; the motif is cached once
per trade and reused across every resource:

```bash
python3 scripts/generate-resource-images.py --trade plumber          # all resources, all 5
python3 scripts/generate-resource-images.py --only <slug> --trade roofing --variant featured
```

Files are named `<slug>-<trade>-<variant>.png`. The **canonical page
`og:image` stays generic** (one URL serves all audiences); trade variants feed
**trade-targeted social pushes** and are exposed per item in `social.json`
under `trade_images.<trade>.<variant>`. To make a trade first-class, add its
slug to `RESOURCE_TRADES` in `src/lib/resources.ts` (drives `social.json`).
Trade label/motif live in `TRADE_LABEL`/`TRADE_MOTIF` in the generator.

---

## Social distribution engine

### Per-platform packs

`src/lib/social/generateSocialPack.ts` returns one variant per platform
(`linkedin, facebook, x, threads, pinterest, google_business_profile, email`)
with `title/caption/hook/cta/hashtags/image_url/alt_text/utm_url`. Authored
variants in a resource's `social_pack` frontmatter win; everything else is
generated deterministically. **UTMs are always built by
`src/lib/social/buildUtm.ts`** — never hand-write one.

To change a platform's voice/sizing, edit `PLATFORM_CFG` + the
`defaultTitle/defaultCaption` helpers. To add a platform: add it to
`SOCIAL_SOURCES` (`buildUtm.ts`) and `PLATFORM_CFG`, then add a feed endpoint.

### Per-item contract: `social.json`

`/resources/<type>/<slug>/social.json` returns resource meta, SEO, Open Graph,
all image variants (absolute URLs), categories, tags, the 7 social variants, and
a flat `utm` map. This is what external automation consumes per item.

### Feeds

- Content feeds: `/feeds/{resources,how-to-guides,glossary,plain-language-explainers,blog}.xml`
- Platform feeds: `/feeds/{linkedin,facebook,x,threads,pinterest,email,google-business-profile}.xml`
  — each item's `<link>` is the platform's UTM URL; `<description>` is caption +
  CTA + hashtags.

Built by `src/lib/feeds.ts` (`buildResourceFeed`, `buildPlatformFeed`).

### Queue API: `/api/social-queue`

D1 table `social_queue` (migration: `worker/social-queue.sql`). Auth: header
`X-CR-Automation-Key: <CR_AUTOMATION_KEY>` (Cloudflare secret); fails closed.

- `GET` → `{ published, scheduled, ready_to_publish }`.
- `POST { action:"enqueue", resource_slug, resource_type, items:[{platform, payload}] }`
  → upsert one ready row per platform.
- `POST { action:"callback", resource_slug, platform, status, post_url?, post_id?, published_at? }`
  → update a row after posting.

`scripts/seed-social-queue.py` reads the feeds + each `social.json` and enqueues
everything (idempotent) — and is the reference for what automation sends.

### Connecting Make.com / Zapier / n8n

1. **Trigger:** poll `GET /api/social-queue` (or a platform feed
   `/feeds/<platform>.xml`) on a schedule. Send the `X-CR-Automation-Key` header.
2. **Route:** for each item in `ready_to_publish`, branch by `platform` and post
   using that platform's module (LinkedIn, Facebook Pages, X, etc.). Use the
   variant's `caption`, `hashtags`, `image_url`, and post the `utm_url` as the link.
3. **Callback:** after posting, `POST` back
   `{ "action":"callback", "resource_slug":"…", "platform":"linkedin",
   "status":"published", "post_url":"https://…" }` with the same auth header so
   the row moves to `published`.

**Sample Make scenario:** Schedule (every 30 min) → HTTP GET
`/api/social-queue` (header `X-CR-Automation-Key`) → Iterator over
`ready_to_publish` → Router by `{{platform}}` → [platform post module] → HTTP
POST `/api/social-queue` callback with `status=published` + `post_url`.

---

## Admin (`/admin`)

Worker-rendered, session-cookie auth (`worker/_lib/auth.js`). Secrets:
`ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` (long random). Until both are set,
`/admin` returns a 503 "not configured" page.

Capabilities: preview each resource's OG card + 7 platform posts + links;
**Generate pack** (enqueue all 7 → D1); **Enqueue ALL**; per-platform set status
(ready/scheduled/published) + record the live post URL. All actions are
cookie-authed and call the same `worker/_lib/queue.js` as the API.

**Optional hardening:** put **Cloudflare Access** in front of `/admin*` for SSO +
a second gate. The cookie auth stands on its own, but Access adds defense in depth.

---

## Cloudflare setup checklist

| Secret | Used by |
|---|---|
| `CR_AUTOMATION_KEY` | `/api/social-queue` header auth |
| `ADMIN_PASSWORD` | `/admin` login |
| `ADMIN_SESSION_SECRET` | `/admin` session cookie HMAC |

D1: apply `worker/social-queue.sql` to the `DB` database once
(`npx wrangler d1 execute consentresolve-demo --remote --file=worker/social-queue.sql`
or paste the statements into the dashboard D1 console).
