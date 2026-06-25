# Title Strategy — consentresolve.com

A deterministic system for rewriting `<title>`, `og:title`, and `twitter:title` across every page. Built to satisfy three jobs at once: **readable in social shares**, **SEO-optimized**, **AEO-optimized**. Grounded in the locked voice at `/style-guide/voice/`.

---

## 1. The core decision: stop using one string for three jobs

Right now every page sets `title`, `og:title`, and `twitter:title` to the **same value**, and that value carries a doubled brand suffix (e.g. `Voice · Consent Resolve Style Guide`). That's the root problem. These fields serve different masters:

| Field | Read by | Optimize for |
|---|---|---|
| `<title>` | Google SERP, browser tab | Keyword front-loaded, entity-clear, brand suffix |
| `og:title` / `twitter:title` | Facebook, LinkedIn, X, iMessage, Slack unfurls | Human, benefit-led, scannable; brand suffix optional (the share card already shows `og:site_name` = "Consent Resolve") |

**Rule: generate two strings per page.** A `<title>` for search, and an `og:title` (reused for `twitter:title`) for shares. They may match when a page's best search string is also its best social string — but the model must consciously decide that, not default to it.

---

## 2. Global rules (apply to every page)

### Length budgets (hard gates)
- `<title>`: **target 50–55 characters, hard cap 60.** Google truncates around 600px. Put the keyword/entity in the **first 40 characters**.
- `og:title`: **target ≤ 55 characters, hard cap 88.** Facebook/LinkedIn feed views truncate near 60. Front-load the hook.
- Never let truncation cut mid-word on the part that carries meaning.

### Brand suffix
- Single suffix only: ` · Consent Resolve` (middle dot, spaces around it). **Never** doubled, never `· Consent Resolve Style Guide`.
- `<title>`: include the suffix unless the page name already contains "Consent Resolve."
- `og:title`: **drop the suffix by default** — `og:site_name` already supplies brand attribution in the unfurl, and the space is better spent on the hook. Add it back only when the brand name itself is the hook (homepage, About, vs-competitor pages).

### Voice constraints (from Block A + banned list)
Titles are copy. They obey the voice:
- **6th–7th grade. Under ~12 words.** One idea.
- **Numerals always:** `10 minutes`, `98%`, `17 trades`. They scan faster and earn clicks.
- **Money is the through-line.** Tie to booked jobs, calls, or dollars kept wherever the page allows.
- **No price in titles.** Keep `$7` and any dollar figure out of every `<title>` and `og:title`. The money through-line stays through `yours alone`, `never resold`, `no contract`, `flat rate` — the number itself lives on the page, not the title.
- **Lead with opportunity, not fear.** Compliance/legal is never the title hook.
- **Banned in titles** (subset of the full list — never use): `free`, `free trial`, `instant`, `seamless`, `solution(s)`, `robust`, `empower`, `streamline`, `supercharge`, `next-level`, `world-class`, `cutting-edge`, `game-changer`, `revolutionize`, `elevate`, `frictionless`, `zero setup`. If a draft title contains one, regenerate.
- **Reach for these instead:** `book the job`, `win the job`, `real names and consented emails`, `yours alone`, `never resold`, `the homeowner`, `your shop`.
- **Never say "free." Never say "instant."** Use `live in about 10 minutes` for setup.

### Positioning locks (don't let a title break these)
- Consent Resolve **complements** the contractor's ads/SEO/Google LSA; it **replaces** shared-lead resellers (Thumbtack, Angi, HomeAdvisor). A title may position against Thumbtack/Angi/HomeAdvisor. A title must **never** frame Google LSA as a competitor.
- It's a **consent-first visitor-identification layer**, not a shared-lead platform. Don't write titles that imply bought/shared leads.
- Warm **inbound** only — never imply the contractor cold-calls a recovered visitor.

---

## 3. Per-page-type formulas

For each page, detect its type, derive the **primary keyword/entity** (usually from the H1 or URL slug), then apply the formula. `T:` = `<title>`, `OG:` = `og:title`/`twitter:title`.

### Homepage `/`
- `T:` `Consent Resolve · Identify Site Visitors, Win the Job`
- `OG:` `98% of your site visitors leave without a name. Fix that.`

### Industry / "[trade] leads" pages (`/plumber-leads/`, `/roofing-leads/`, `/hvac-leads/`, `/electrician-leads/`, `/general-contractor-leads/`)
- Keyword = `[Trade] Leads` — front-loaded, it's the search term.
- `T:` `[Trade] Leads That Are Yours Alone · Consent Resolve`
- `OG:` `[Trade] leads that call you back — yours alone, never resold`
- Example (plumber): `T:` `Plumber Leads That Are Yours Alone · Consent Resolve` / `OG:` `Plumber leads that call you back — yours alone, never resold`

### Feature pages (`/features/`, individual features)
- Keyword = the feature's outcome, not its mechanism.
- `T:` `[Outcome] · Consent Resolve` (e.g. `Real Names & Consented Emails · Consent Resolve`)
- `OG:` benefit line, e.g. `See who's shopping your site — only after they consent`

### How It Works `/how-it-works/`
- `T:` `How Consent Resolve Works — Live in 10 Minutes`
- `OG:` `Paste one line of code. The homeowner comes back and calls.`

### Pricing `/pricing/`
- `T:` `Pricing — Exclusive Leads, Yours Alone · Consent Resolve`
- `OG:` `One flat rate per lead. Exclusive. No contract.`

### Channel comparison pages (`/resources/compare/...`)
- **Complement framing** for own-channel pages (e.g. `+ Google LSA`):
  - `T:` `Google LSA + Consent Resolve: Win the Visitors LSA Sends`
  - `OG:` `Keep your LSA. Recover the homeowners who leave without calling.`
- **Replace framing** for reseller pages (Thumbtack / Angi / HomeAdvisor):
  - `T:` `Consent Resolve vs Thumbtack: Leads That Are Yours Alone`
  - `OG:` `Thumbtack resells the same lead. Yours come back to you alone.`

### Straight Answers / plain-language explainers (`/resources/plain-language-explainers/...`) — **AEO priority**
- Title **mirrors the natural-language query verbatim** — this is what gets cited.
- `T:` `What Is [Term]? · Consent Resolve`
- `OG:` `[Term], explained in plain English for contractors`
- Example: `T:` `What Is Visitor Identification? · Consent Resolve`

### Glossary terms (`/resources/glossary/...`) — **AEO priority**
- `T:` `[Term] — Definition for Contractors · Consent Resolve`
- `OG:` `What "[Term]" actually means for your shop`

### How-To Guides (`/resources/how-to-guides/...`)
- `T:` `How to [Do the Thing] · Consent Resolve`
- `OG:` action-and-payoff, e.g. `Set up visitor recovery in 10 minutes — step by step`

### Blog posts (`/resources/blog/...`)
- `T:` `[Specific claim or number] · Consent Resolve`
- `OG:` the most clickable, numeral-led line in the post.

### Resource hub / index pages (`/resources/`, `/industries/`)
- `T:` `[Hub Name] · Consent Resolve`
- `OG:` one-line description of what's inside.

### Legal / utility (`/privacy-policy/`, `/terms/`, etc.)
- `T:` `[Page Name] · Consent Resolve` — keep it boring and exact. No marketing voice.
- `OG:` same as `T:` minus suffix.

### noindex pages (style guide, internal)
- SEO doesn't matter (they're `noindex,follow`), but they still get shared internally in Slack — so give them a clean single-suffix `OG:`.
- `T:` `[Component] · Consent Resolve Style Guide` (single suffix — fix the current double).
- `OG:` same.

---

## 4. AEO alignment (the part most title rewrites miss)

A title earns AI-engine citations when the **title, the H1, and the on-page citable answer all point at the same query.** For every page that carries an `AEO Answer` block (the 40–55 word citable paragraph):

1. The `<title>` must contain the **entity or question** that answer responds to.
2. Phrase explainer/glossary titles as the **exact question a contractor would type or ask** ("What is X?", "How much does X cost?", "Is X legal?").
3. Keep the entity unambiguous: pair bare terms with context — `Visitor Identification for Home-Service Sites`, not just `Visitor Identification` — so the engine binds the title to the right topic.
4. Don't let the `og:title` and `<title>` answer *different* questions; the engine reads both.

---

## 5. Pre-write validation checklist (run before writing any title)

Claude Code must pass **every** check or regenerate:

- [ ] `<title>` ≤ 60 chars; `og:title` ≤ 88 chars (target 55).
- [ ] Keyword/entity in first 40 chars of `<title>`.
- [ ] Contains zero banned words.
- [ ] Numerals used for any number (`10 minutes`, not "ten minutes").
- [ ] No price or dollar figure (`$7`, etc.) anywhere in `<title>` or `og:title`.
- [ ] No legal/fear hook in the title; opportunity-led.
- [ ] Brand suffix is single ` · Consent Resolve` (or intentionally dropped on `og:title`).
- [ ] Google LSA never framed as a competitor.
- [ ] No implication of shared/resold leads or contractor cold-calling.
- [ ] `og:title` and `twitter:title` are identical to each other.
- [ ] For AEO pages: `<title>` matches the question the on-page answer block resolves.
- [ ] Reads naturally to a plumber in a truck. If it sounds like a software company, rewrite.

---

## 6. Astro implementation notes

- Titles almost certainly flow through a shared SEO/head component or base layout. Update it to accept **two inputs**: `title` (SEO) and `ogTitle` (social). 
- **Fallback logic:** if a page sets no `ogTitle`, derive it from `title` by stripping the ` · Consent Resolve` suffix — so unconverted pages degrade gracefully instead of breaking.
- Set `twitter:title` = `ogTitle` in the component, never as a third hand-authored field.
- Keep page-level overrides in frontmatter (`title:` / `ogTitle:`) so writers can tune a single page without touching the component.
- After the change, spot-check unfurls with the Facebook Sharing Debugger and the LinkedIn Post Inspector, and re-scrape so caches refresh.

---

## 7. Worked examples (calibration)

**`/hvac-leads/`**
- `T:` `HVAC Leads That Are Yours Alone · Consent Resolve` (49)
- `OG:` `HVAC leads that call you back — yours alone, never resold` (57)

**`/resources/compare/google-local-service-ads/`**
- `T:` `Google LSA + Consent Resolve: Win the Visitors It Sends` (55)
- `OG:` `Keep your LSA. Recover the homeowners who leave without calling.` (63)

**`/resources/plain-language-explainers/what-is-visitor-identification/`**
- `T:` `What Is Visitor Identification? · Consent Resolve` (49)
- `OG:` `Visitor identification, explained in plain English` (50)

**`/pricing/`**
- `T:` `Pricing — Exclusive Leads, Yours Alone · Consent Resolve` (56)
- `OG:` `One flat rate per lead. Exclusive. No contract.` (47)

---

## 8. Prompt to paste into Claude Code

> Rewrite the `<title>`, `og:title`, and `twitter:title` for the pages I point you at, following `title-strategy.md` in this repo. For each page:
> 1. Detect the page type and derive the primary keyword/entity from the H1 and slug.
> 2. Apply the matching formula in §3 to produce a separate `<title>` and `og:title`.
> 3. Set `twitter:title` = `og:title`.
> 4. Run the §5 validation checklist; regenerate anything that fails.
> 5. Show me a before/after table (URL, old title, new `<title>`, new `og:title`, char counts) before writing any files.
>
> Update the shared SEO/head component first so it accepts a separate `ogTitle` with the §6 fallback, then apply page-level overrides in frontmatter. Don't restate the voice rules — they're locked in `/style-guide/voice/`. Start with the homepage, the five industry pages, and `/pricing/`, then stop for my review.
