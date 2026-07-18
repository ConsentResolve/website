---
name: cpl-canon
description: Single source of truth for competitor cost-per-lead (CPL) numbers across the Consent Resolve site. Lints for drift, surfaces every page that needs to update when a benchmark changes. Use when adding a new comparison page, updating a stat, or when the user asks "are our competitor numbers consistent", "did the CPL drift again", "update Thumbtack price across the site".
---

# cpl-canon

The competitor-pricing landscape changes. When it does, the same number lives in 6+ places: the /stats/ page, the /compare/<platform>/ page, the homepage CompareSection, the /pricing/ comparison row, the industry pages, the /compare/ hub matrix, the style guide. This skill keeps them in lockstep.

## Canon

Authoritative source of competitor CPLs: **`src/data/stats.ts` → `STAT_SECTIONS[lead-trap].stats`**. Every other surface MUST agree with that table.

Current canonical numbers (as of June 2026 — verify against `/stats/` before changing anything):

| Platform     | Loaded CPL  | Range          | Source                              |
|--------------|-------------|----------------|-------------------------------------|
| Thumbtack    | ~$46        | $25–$75        | HomeServiceDirect                   |
| Angi         | ~$50        | $15–$100+      | HouseCall Pro                       |
| HomeAdvisor  | ~$50        | $15–$100+      | HouseCall Pro (Angi-owned)          |
| Google LSA   | $53 blended | $39–$162       | SearchLight Digital (888 contractors) |
| Consent Resolve | $7        | flat           | self                                |

## When to invoke

- User says: "are the CPL numbers consistent", "find every Thumbtack price", "update Angi to $X across the site", "cpl audit", "compare/ hub looks stale".
- Before adding a new comparison page.
- After any /stats/ data update.

## What to scan

```
grep -rn --include='*.astro' --include='*.tsx' --include='*.ts' \
  -E '\$(15|20|25|30|35|40|45|46|48|50|53|55|60|65|75|100|120)(\s|/|"|,|\b)' \
  src/ public/
```

Then check each hit against the canon. Common drift sites:
1. `src/data/stats.ts` — authoritative.
2. `src/data/compare.ts` — `channelCpl` per platform (blended) **and** `TRADE_CPL_BENCHMARKS` (the shared 17-trade per-trade CPL *ranges*, low/high). The old per-page `trades[]` single-point array was removed July 2026 in favor of this one shared range table.
3. `src/pages/compare/index.astro` — `matrixRows` `Cost per lead`.
4. `src/components/sections/CompareSection.astro` — homepage card prices.
5. `src/pages/pricing.astro` — comparison-row tiles.
6. `src/pages/[slug].astro` — the "How Consent Resolve compares for {trade}" block reads `getTradeCpl()` from compare.ts (no hardcoded CPL — leave it alone unless the benchmark table changes).
7. `src/pages/style-guide/comparison-tables.astro` — `price` props (style-guide, fix anyway).
8. `src/components/sections/ProblemStats.astro` — Thumbtack callout.
9. `src/pages/llms.txt.ts` — canonical-numbers block.

## How to update

If the user wants to change a CPL:
1. Update `src/data/stats.ts` first (the authoritative table). Update its `source` if the citation changed.
2. Sweep the 8 dependent surfaces above. Read each, propose the diff, await confirmation, then apply.
3. Update `/llms.txt` canonical-numbers block last so AI crawlers see the new number with its source.

## Per-trade CPL benchmark (`TRADE_CPL_BENCHMARKS` in `src/data/compare.ts`)

The single source of truth for per-trade competitor CPL is `TRADE_CPL_BENCHMARKS` — one shared array of `{ slug, trade, low, high }` for all 17 trades, rendered on every `/resources/compare/<platform>/` page (as a linked pill strip) and on every `/{trade}-leads/` page (via `getTradeCpl()`). The range belongs to the **trade, not the platform** — Thumbtack/Angi/HomeAdvisor overlap on it, so it is intentionally the same across those pages.

These are **ranges** (low–high), not single points — marketplaces price each lead by job value, metro, and competition, so a single number would be false precision. Sources: **Auto-Respond** (Thumbtack by-trade, 2026) for the trades it breaks out, **Ryn Digital** for pest control, and the general documented $8–$150 marketplace band for the niche trades, anchored to job size. All summarized on `/stats/` (§lead-trap). The former `industries.ts` `competitorCpl` field was removed June 2026; do not reintroduce it.

Pipeline On removed — do not reintroduce; the "78% first responder" speed-to-lead stat is sourced to Vendasta.

## Verify

Run `node -e` (or in a Bash tool) over the data spines to assert no surface disagrees with the canon — e.g.:

```bash
grep -rn '\\$46\\|\\$50\\|\\$53' src/ | wc -l
```

Should return a non-zero count concentrated in the eight files listed above. Any hit outside that list is suspicious.
