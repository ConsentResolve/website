---
name: broken-link-sweep
description: Crawl every internal link in the Consent Resolve repo (Nav, Footer, in-content) and verify each one resolves to an actual page file. Catches the "linked but missing" class of bug that left /privacy-policy/ /terms/ /gdpr/ /ccpa/ /blog/ as 404s for weeks. Use after adding new nav items, before push, when the user asks "are there broken links", "footer 404s", "link audit".
---

# broken-link-sweep

## What to verify

For every internal href in the repo, confirm a matching page file exists in `src/pages/`.

## How to scan

1. **Collect every href** referenced in the codebase:
   ```bash
   grep -rhoE 'href="(/[^"]*)"' src/ public/ | sed 's/href="//' | sed 's/"//' | sort -u
   ```
2. **Collect every page route** Astro will generate:
   ```bash
   find src/pages -name '*.astro' -o -name '*.ts' -o -name '*.mdx' | sed 's|src/pages||' | sed 's|/index\.astro|/|' | sed 's|\.astro|/|' | sed 's|\.ts||' | sort -u
   ```
   Include dynamic routes by expanding them against their data source:
   - `[slug].astro` → 17 industry routes via `INDUSTRIES` in `src/data/industries.ts`
   - `features/[slug].astro` → 17 feature routes via `ALL_FEATURES` in `src/data/features.ts`
   - `compare/[platform].astro` → 4 compare routes via `COMPARE_PAGES` in `src/data/compare.ts`
3. **Diff**. Any href present in (1) but not in (2) is a broken link.

## Known good routes (canonical list)

```
/
/how-it-works/
/pricing/
/sample-lead/
/about/
/contact/
/faq/
/get-started/
/stats/
/glossary/
/blog/
/industries/
/<trade>-leads/ (17 trades — see src/data/industries.ts INDUSTRIES[*].slug)
/compare/
/compare/<platform>/ (4 — see src/data/compare.ts COMPARE_PAGES[*].slug)
/features/
/features/<slug>/ (17 — see src/data/features.ts ALL_FEATURES[*].slug)
/privacy-policy/
/terms/
/cookie-policy/
/gdpr/
/ccpa/
/llms.txt
/style-guide/ (and ~30 subpages — noindex, not counted)
/404
```

## Common drift

- Footer adds a new link to `src/lib/site.ts` `FOOTER_NAV` but no page file exists.
- Nav adds a new link to `PRIMARY_NAV` but no page file exists.
- A blog post is referenced from CTA copy but `/blog/<slug>/` doesn't exist yet.
- A compare page is referenced from cross-link prose but slug is misspelled.

## Report format

```
BROKEN  /resources/         — referenced from: src/lib/site.ts:29 (PRIMARY_NAV); no page in src/pages/.
BROKEN  /demo/              — referenced from: src/components/sections/CompareSection.astro:45; no page.
OK      /privacy-policy/    — file at src/pages/privacy-policy.astro
EXTRA   src/pages/v1/foo.astro — file exists but no link points to it (possibly orphan).
```

## External links

Also worth a sanity check (separate pass):

```bash
grep -rhoE 'href="(https?://[^"]*)"' src/ public/ | sed 's/href="//' | sed 's/"//' | sort -u
```

Report any external URLs that look suspicious (typos, dead domains). Don't auto-fetch — that adds latency and risks rate limits. Surface for manual review.
