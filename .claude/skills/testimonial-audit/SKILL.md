---
name: testimonial-audit
description: Find every customer quote/testimonial in the Consent Resolve repo and verify it's a real, verifiable testimonial — not a fabricated placeholder. Publishing fabricated testimonials violates FTC rules. Use before every push that touches user-facing copy, when the user asks "are there any fake testimonials shipping", "audit quotes", "ftc check".
---

# testimonial-audit

## Background

Until further notice, Consent Resolve ships **with no testimonials in production**. The data spine still carries optional `quote` fields (e.g. in `src/data/features.ts`) so real quotes can be plugged in later, but nothing renders them.

This skill exists because: (a) FTC rules prohibit fabricated testimonials, and (b) it's easy to forget a sample quote in a feature card and ship it accidentally.

## What to scan

Search for quote-shaped markup:

```bash
grep -rn --include='*.astro' --include='*.tsx' --include='*.ts' \
  -E 'testimonial|quote|isSample|<blockquote|figcaption' \
  src/
```

Then categorize each hit:

1. **Component primitives** (`src/components/ui/Blockquote.astro`, `src/components/ui/Testimonial.astro`, `src/components/sections/Testimonials.astro` if reintroduced). Allowed to exist as primitives. NOT allowed to be imported from any production page.
2. **Style guide** (`src/pages/style-guide/blockquote.astro`, `/style-guide/testimonials.astro`). Style guide is `noindex` — allowed.
3. **Data spine fields** (`feature.quote` in `src/data/features.ts`). Allowed to exist as data. Must NOT be rendered by any template.
4. **Rendered in production** (any `src/pages/*.astro` or `src/components/sections/*.astro` not listed above). NOT allowed unless every quote is verifiably real.

## Verification rules

For any quote rendered in production:

- The `name`, `shop`, and `city` must match a real customer.
- The text must be the customer's own words, captured in writing (email, signed form, recorded call).
- The customer must have given written permission to use the quote in marketing.
- The quote may not be edited beyond minor copyediting; substantive edits must be re-approved by the customer.
- An `isSample: true` flag (if the data spine carries it) means the quote is a placeholder and must NOT render.

## How to report

For every quote found, output:

```
PROD       src/pages/features/[slug].astro:151 — quote block for "exclusive-leads" feature renders feature.quote even when isSample:true
SAMPLE     src/data/features.ts:75       — feature.quote.isSample = true ("Dale R., Dale's Roofing, Tyler TX")
PRIMITIVE  src/components/ui/Testimonial.astro — primitive only; verify no production imports
STYLE-GUIDE src/pages/style-guide/testimonials.astro — noindexed, ok
```

## Fix recommendations

When the audit finds sample quotes rendering in production, propose:
1. Delete the quote section from the template, OR
2. Gate the render behind `!feature.quote.isSample` (won't help if all quotes are samples — pulls them all), OR
3. Replace with the real quote and flip `isSample: false` once approval is recorded.

When the user has real testimonials to add, walk through each one and verify the four criteria above before applying.

## Cross-check

Before declaring a clean audit, also verify:
- The homepage does NOT import `~/components/sections/Testimonials.astro`.
- No page imports `~/components/ui/Testimonial.astro` (that primitive is style-guide only until real quotes arrive).
- The features/[slug].astro template does NOT render `<blockquote>` or `<figure>` for `feature.quote`.
