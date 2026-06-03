---
name: schema-completeness
description: Verify every Consent Resolve page emits the JSON-LD schemas it should. Spots missing BreadcrumbList, FAQPage, Service, ItemList, Person, etc. Use when adding a new page, before a launch, or when the user asks "is the schema complete", "verify structured data", "what schemas are missing".
---

# schema-completeness

## Expected schemas per page type

Every page automatically gets `Organization` + `WebSite` from `src/components/SEO.astro`. Page-specific schemas come from each page's `schema={[...]}` prop.

| Page type                    | Required additional schemas                                                                          |
|------------------------------|------------------------------------------------------------------------------------------------------|
| `/`                          | `BreadcrumbList` (implicit), `SoftwareApplication` (with Offer)                                      |
| `/how-it-works/`             | `BreadcrumbList`, `HowTo` (4 steps)                                                                  |
| `/pricing/`                  | `BreadcrumbList`, `FAQPage` if FAQs render                                                           |
| `/about/`                    | `BreadcrumbList`, one `Person` per founder w/ `sameAs`                                               |
| `/contact/`                  | `BreadcrumbList`                                                                                     |
| `/sample-lead/`              | `BreadcrumbList`                                                                                     |
| `/stats/`                    | `BreadcrumbList`                                                                                     |
| `/faq/`                      | `BreadcrumbList`, `FAQPage`                                                                          |
| `/glossary/`                 | `BreadcrumbList`, `DefinedTermSet`                                                                   |
| `/get-started/`              | `BreadcrumbList`                                                                                     |
| `/blog/`                     | `BreadcrumbList`                                                                                     |
| `/industries/` (hub)         | `BreadcrumbList`, `CollectionPage`, `ItemList` (17 trades)                                           |
| `/<trade>-leads/` (17 pages) | `BreadcrumbList`, `Service` + `Offer` ($7), `FAQPage`                                                |
| `/compare/` (hub)            | `BreadcrumbList`, `ItemList` (4 platforms)                                                           |
| `/compare/<platform>/` (4)   | `BreadcrumbList`, `FAQPage` if FAQs                                                                  |
| `/features/` (hub)           | `BreadcrumbList`, `ItemList` (17 features)                                                           |
| `/features/<slug>/` (17)     | `BreadcrumbList`, `FAQPage`                                                                          |
| `/privacy-policy/`, `/terms/`, `/cookie-policy/`, `/gdpr/`, `/ccpa/` | `BreadcrumbList`                                                |
| `/style-guide/*`             | (noindexed — no schemas required)                                                                    |

## How to verify

For each page in `src/pages/`:

1. Read the page's frontmatter.
2. Find the `const schemas = [...]` array.
3. Cross-check against the expected list above.
4. Report any missing or extra schemas.

Helpers live in `src/lib/seo.ts`:

- `organizationSchema` (auto)
- `websiteSchema` (auto)
- `softwareApplicationSchema`
- `breadcrumbSchema(items)`
- `serviceSchema(opts)` (generic)
- `industryServiceSchema(opts)` (industry pages)
- `faqSchema(qa[])`
- `personSchema(p)`
- `howToSchema(opts)`
- `itemListSchema(opts)`

## Validation

After identifying gaps, propose the exact import + `schemas` array additions per page. Don't apply changes without confirmation; just produce the diff.

Optional cross-check: hit Google's Rich Results Test (https://search.google.com/test/rich-results) on a few key URLs once deployed and verify no validation errors.

## Common drift

- A new industry/feature/compare page is added but the `schemas` array on the template is stale relative to the data spine. Verify the [slug].astro generators still emit per-page schemas correctly.
- FAQs added to an existing page but `faqSchema()` not added to the schemas array → no rich result.
- A founder added to `src/data/team.ts` but `/about/` doesn't iterate them for `personSchema()`.
- /compare/<platform>/ FAQs in `comparisonRows` are not emitted as FAQPage even though the data has Q&A-shaped content.

## Last verified

After a clean audit, append `last-audit: YYYY-MM-DD` to this skill's frontmatter (manually) so the next run can spot the gap window.
