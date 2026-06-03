---
name: pre-publish-checklist
description: Pre-deploy gate. Runs voice-check, cpl-canon, testimonial-audit, schema-completeness, and broken-link-sweep in sequence on the current diff (or whole repo). Surfaces every blocker before push. Use before committing user-facing changes, before deploying a release, when the user asks "is this ready to ship", "pre-flight check", "publish gate".
---

# pre-publish-checklist

## What this skill does

Sequentially invokes the four content/structure-quality skills and reports a single consolidated punch list. Use it as the last step before pushing user-facing changes to `main`.

## Order of operations

1. **voice-check** — banned words, pricing canon, 98% number, NAP, positioning.
2. **cpl-canon** — competitor numbers consistent with `src/data/stats.ts` table.
3. **testimonial-audit** — no fabricated testimonials rendering in production.
4. **schema-completeness** — required JSON-LD present on every page type.
5. **broken-link-sweep** — every internal href resolves to a real page.

## Optional pre-checks

Before the five quality checks, do a quick build sanity check:

- Confirm no `[PLACEHOLDER]` or `[CONFIRM ...]` markers remain in production templates.
- Confirm no `console.log` or `debugger` left in committed code.
- Confirm no API keys or secret patterns leaked (search for `sk-`, `Bearer `, etc.).

```bash
grep -rn '\[PLACEHOLDER\]\|\[CONFIRM\|console\.log\|debugger\|sk-[a-zA-Z0-9]\{20,\}\|Bearer ' src/ public/ 2>/dev/null | grep -v node_modules
```

## Report format

```
== Pre-publish checklist ==
Scope: 24 changed files since last push.

CRITICAL (3)
  voice-check:        src/data/features.ts:288 — "Free install help" → "No-charge"
  testimonial-audit:  src/pages/features/[slug].astro:151 — sample quote rendering
  broken-link-sweep:  /resources/ — linked from PRIMARY_NAV, no page exists

HIGH (5)
  cpl-canon:          src/pages/compare/index.astro:22 — Thumbtack ~$48 (canon: ~$46)
  schema-completeness: src/pages/about.astro — missing Person schema for founders
  ...

MEDIUM (2)
  voice-check:        src/data/team.ts:88 — quoted "free" (acceptable, flag for review)
  ...

LOW (1)
  schema-completeness: /compare/<platform>/ — FAQPage schema could be added

== Summary ==
3 blockers · 5 high · 2 medium · 1 low
Recommendation: BLOCK push until critical + high are resolved.
```

## How to react to findings

- **Critical / High** → must be resolved before push (or explicitly waived by the user).
- **Medium / Low** → file as cleanup tasks. Don't block.

When `--fix` is requested by the user, propose explicit replacement diffs per finding, await batch confirmation, then apply. Do not auto-apply.

## Cadence

- Manually invoked before significant pushes.
- Could be wired as a git pre-push hook later (out of scope for this skill).
- For tiny commits (typo fix, single-property tweak) — fine to skip.
