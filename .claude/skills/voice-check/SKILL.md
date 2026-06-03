---
name: voice-check
description: Lint Consent Resolve content against the locked brand voice — banned words, preferred phrases, NAP consistency, pricing canon, reading-level target. Use BEFORE every commit that touches user-facing copy, or when the user asks "is this on-voice", "scan for banned words", "did anything drift from the voice canon".
---

# voice-check

Single source of truth for the Consent Resolve brand voice is **`/style-guide/voice/`** — file at `src/pages/style-guide/voice.astro`. This skill enforces it across the repo.

## When to invoke

- Pre-commit, when changes touch any `src/data/*.ts`, `src/pages/**/*.astro`, `src/components/**/*.astro`, `src/pages/llms.txt.ts`.
- When the user says "voice check", "is this on voice", "lint for banned words", "did anything drift".
- After a content drop from a brief or markdown deck.

## What to scan for

Run `grep -inE` (case-insensitive, with line numbers) across the codebase. Default scope: `src/data/` and `src/pages/` (excluding `src/pages/style-guide/voice.astro` itself — it's the rulebook). Optional: extend to `src/components/sections/`.

### Banned words (regex alternation)

```
(?<!style-guide/voice)\b(free|free trial|free forever|no card to start|no credit card|instant|zero setup|streamline|supercharge|next-level|world-class|elevate|frictionless|leverage|synergy|disrupt|game-changer|holistic|revolutionize|robust|seamless|best-in-class|solution(?! \()|ecosystem)\b
```

**Exceptions** allowed:
- `"no charge"` — preferred replacement for `"free"`. Allowed.
- In quotes attributing to a person, in comments, or as variable names. Manually inspect each hit.
- The word `solution` is allowed in product/integration names (e.g. "ServiceTitan Solutions") but flagged in marketing copy.

### Pricing canon

- `\$10` and `10 leads for \$10` and `your first 10 leads` → MUST not appear in production pages. (The starter promo was deprecated in favor of flat $7.)
- Every pricing mention should resolve to `$7 per lead`, `flat $7`, or `$7 a lead`.

### Numeric canon

- `\b95%\b` and `\b95 out of 100\b` → MUST be `98%` / `98 out of 100`. (Canon: 98% per WordStream.)
- Thumbtack CPL: must say `~$46` (not $48, $35, $40).
- Angi CPL: `~$50` (not $35).
- HomeAdvisor CPL: `~$50`.
- LSA blended CPL: `~$53` or `~$53 blended`.
- Pros sharing a Thumbtack lead: `4–5` (not 4–6).

### FTC line

When mentioning the HomeAdvisor FTC action, copy MUST say "settled" or "ordered to pay up to $7.2M to settle charges" — NEVER "fined", "penalty", "guilty", or "scam".

### NAP consistency

Every appearance of any address fragment must match exactly:
- `1907 Gulf Way #1`
- `St Pete Beach, FL 33706`
- `(727) 202-5996` or `+1-727-202-5996`
- `hello@consentresolve.com`

Single source of truth: `src/lib/site.ts` `SITE.address` + `SITE.phone` + `SITE.email`.

### Positioning language

- We are a `consent-first visitor-identification layer`. NOT a `platform`. NOT `inbound`. NOT `network`.
- LSA is a `complement`, never a competitor.
- Thumbtack, Angi, HomeAdvisor are `shared-lead resellers`, never `platforms`.

## How to report

Output a flat list grouped by severity:

```
CRITICAL: src/data/features.ts:288 — "Free install help" (banned word "free")
HIGH:     src/pages/index.astro:18  — "10 leads for $10 to start" (deprecated pricing)
MEDIUM:   src/data/stats.ts:184     — "FTC penalty" (use "FTC settlement")
LOW:      src/components/sections/RiskVsConsent.astro:12 — "best-in-class" (banned)
```

When `--fix` flag is set by the user, propose specific replacement strings for each finding without applying them; only apply edits after the user confirms each batch.

## Anti-patterns

- Do not flag style-guide/voice.astro itself — it defines the rules.
- Do not flag the `banned[]` and `preferred[]` arrays in voice.astro (they're metadata about the rules, not violations of them).
- Do not auto-replace anything. Always report findings first.
