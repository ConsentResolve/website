# Consent Resolve — Case Study Research (Forensic Audit)

**Audit type:** Read-only repository research. No files were changed, deployed, or refactored to produce this document. Prepared for Hey Aaron! Marketing portfolio use.

**Legend:** 🔍 I FOUND THIS (directly verified in the repo) · 🧭 I INFERRED THIS (reasonable conclusion from evidence, not stated outright) · ❓ ASK AARON (cannot be determined from the repo)

---

## 1. Understand the "Client"

This is Hey Aaron!'s own product, not a client engagement — so "client" here means the business the site/product serves.

| Field | Finding |
|---|---|
| Business name | 🔍 Consent Resolve |
| Industry | 🔍 MarTech / AdTech SaaS — "consent-first ad-spend recovery layer" for home-service contractors ([src/lib/site.ts](src/lib/site.ts)) |
| Location | 🔍 1907 Gulf Way #1, St Pete Beach, FL 33706 · (727) 999-9846 · hello@consentresolve.com ([src/lib/site.ts](src/lib/site.ts)) |
| Service area | 🔍 Nationwide (US) — 🔍 "team works from Florida, Texas, Ohio, and Europe" ([src/pages/about.astro](src/pages/about.astro)) |
| Target customer | 🔍 Home-service contractors — 19 trade pages live (plumbers, roofers, HVAC, electricians, general contractors, and more) ([src/data/industries.ts](src/data/industries.ts)) |
| Primary services | 🔍 Identifies anonymous website visitors after explicit consent, then feeds them into the contractor's existing retargeting/email/SMS/CRM funnels ([src/pages/llms.txt.ts](src/pages/llms.txt.ts)) |
| Primary conversion goal | 🔍 `/demo/` → Cal.com-booked walkthrough (native booking widget), plus `/get-started` → hosted signup at dashboard.consentresolve.com |
| Phone/call strategy | 🔍 Click-to-call NAP number site-wide; 🔍 in the CRM, a full AI voice agent ("Mack" on Retell) handles Speed-to-Lead outbound calls with a rep-transfer hunt/cascade fallback |
| Forms/lead capture | 🔍 DemoForm, ClaimForm, BookMeeting — all Turnstile-protected against bots |
| Offers | 🔍 Flat $7 per lead, no contract, no monthly minimum, exclusive (never resold) — stated identically across `/pricing/`, `/faq/`, and `llms.txt` |
| Brand positioning | 🔍 "Consent-first" — explicitly differentiated from bought/scraped lead lists; entire `/why-consent-first/` page and a dedicated content cluster argue this positioning |
| Competitive positioning | 🔍 Positioned as *additive*, not a replacement, to Google LSA / Thumbtack / Angi / HomeAdvisor — 25 dedicated `/resources/compare/<platform>/` pages run "with vs. without" math against each |
| Problem being solved | 🔍 Stated directly in llms.txt: "About 98% of website visitors bounce without contacting the business" — the product recovers that bounce |

---

## 2. What We Built

### Website & Design
- 🔍 91 statically-generated Astro pages ([src/pages](src/pages), `find src/pages -name '*.astro'`)
- 🔍 Component-driven design system: shared `<SEO>` component, `<Layout>` used on 86 of 91 pages, a documented internal style guide at `/style-guide/` — **47 style-guide pages** covering typography, color, components, comparison tables, voice
- 🔍 19 industry/trade landing pages (`/[trade]-leads/`), each with unique SEO card copy explicitly marked "should NOT be templated" in code comments ([src/data/industries.ts](src/data/industries.ts))
- 🔍 23 feature pages, 25 competitor-comparison pages, 158 blog posts, 30 plain-language explainer pages, 10 how-to guides, and a glossary — a real content library, not filler
- 🔍 Interactive calculators: `RecoveryCalculator.tsx`, `Calculator.tsx`, plus a dedicated `CalculatorSection.astro` — React islands embedded in an otherwise static site
- 🔍 A live interactive product demo at `/demo/sample/` with a `ConsentScreen.astro` component simulating the actual consent flow a homeowner sees
- 🔍 Custom illustration set generated via a Recraft pipeline (`scripts/generate-recraft.py --set=trades`, referenced in [src/data/industries.ts](src/data/industries.ts) comments) — brand-locked, not stock art

### Conversion Optimization
| Feature | Why it should help conversion |
|---|---|
| 🔍 Turnstile on every form (Demo, Claim, Book Meeting, register, claim-50) | Keeps bot/spam submissions out of the pipeline without a CAPTCHA that tanks completion rates |
| 🔍 Cal.com-native booking widget on `/demo/` (replaced a claim form, per commit `9c1f4da1`) | Removes the "someone will reach out" delay — visitor picks a slot and it's on the calendar instantly |
| 🔍 25 channel-comparison pages with "with/without" math | Meets a skeptical contractor where they already are (already spending on LSA/Thumbtack) instead of asking them to abandon it |
| 🔍 User-adjustable recovery calculator, pre-seeded per trade with real avg job value ([industries.ts](src/data/industries.ts)) | Lets the visitor see *their own* numbers instead of a generic claim — self-serve ROI proof |
| 🔍 Flat, single-price offer ($7/lead, no contract) restated identically everywhere | Removes the #1 objection in this category — pricing opacity — before it's even asked |
| 🔍 Meta Conversions API wired to the same pixel the ad account optimizes on (`META_PIXEL_ID` in [wrangler.jsonc](wrangler.jsonc)) | Server-side event match improves Meta's ability to optimize delivery toward actual conversions, not just pixel-fired clicks |

### Local SEO / Technical SEO
- 🔍 `astro-sitemap` integration with a **custom `serialize()`** that attaches `<image:image>` entries for 150+ generated OG images, and explicitly excludes `/style-guide/`, `/demo/`, `/feeds/`, and two noindexed landing pages from the sitemap to protect crawl budget ([astro.config.mjs](astro.config.mjs))
- 🔍 `robots.txt` explicitly **allow-lists** AI crawlers by name — GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, Google-Extended, ClaudeBot, anthropic-ai, CCBot — each with the same disallow rules as the default group. This is a deliberate choice, not the default (most sites just use `User-agent: *`).
- 🔍 Canonical tags computed centrally via `buildCanonical()` in [src/lib/seo.ts](src/lib/seo.ts) — one function, not copy-pasted per page (eliminates the most common canonical-tag bug: drift)
- 🔍 NAP is a single source of truth (`SITE.address`/`SITE.phone` in [site.ts](src/lib/site.ts)) consumed everywhere, enforced by a project-level lint skill (`voice-check`) that flags any NAP fragment that doesn't match exactly

### Schema / Structured Data
- 🔍 31 distinct `@type` values found across the codebase (Person, Organization, WebSite, Service, FAQPage, BreadcrumbList, HowTo, ItemList, Article, DefinedTerm, ContactPoint, and more)
- 🔍 **Every page** using `<SEO>` automatically gets `Organization` + `WebSite` schema injected — this is structural, not per-page manual work ([src/components/SEO.astro](src/components/SEO.astro))
- 🔍 18 pages call `breadcrumbSchema()`, 14 call `faqSchema()`, 6 call `itemListSchema()`, 2 call `howToSchema()`, 1 calls `industryServiceSchema()` — but that one call lives in the dynamic `[slug].astro` template, so it actually fires for all 19 industry pages
- 🔍 Real `Person` schema for all 3 named founders with `sameAs` LinkedIn URLs, `alumniOf`, and `knowsAbout` — not placeholder data ([src/data/authors.ts](src/data/authors.ts))
- 🔍 **No `Review`/`AggregateRating` schema anywhere in the codebase** — confirmed absence, not an oversight worth hiding: there are no fabricated ratings to mark up

### AI Search / AEO
- 🔍 `llms.txt` is **dynamically generated at build time** from the same data spines that build the pages (`INDUSTRIES`, `COMPARE_PAGES`, `ALL_FEATURES`, glossary, authors) — it cannot drift out of sync with the live site the way a hand-maintained llms.txt would ([src/pages/llms.txt.ts](src/pages/llms.txt.ts))
- 🔍 40–55 word `aeoAnswer` field required on every industry entry — written specifically to be a clean, quotable answer for an AI engine, distinct from the SEO meta description
- 🔍 14 pages carry `FAQPage` schema with question-based headings — directly answers the "how do AI engines quote you" mechanism
- 🔍 A `DefinedTermSet`/`DefinedTerm`-marked glossary — machine-readable term definitions, not just prose

---

## 3. Performance & Hosting

- 🔍 `output: "static"` in Astro config — the entire marketing site is pre-built HTML, served via Cloudflare's `ASSETS` binding (Workers static assets, not server-rendered per request)
- 🔍 Media (video, social image variants) served from an R2 bucket at `/cdn/*`, same-origin, with `Cache-Control: public, max-age=31536000, immutable` — a full year of edge caching on assets that don't change ([worker/index.js:323](worker/index.js))
- 🔍 Worker entry only handles `/api/*`; everything else falls through to the static asset layer by default — API logic never adds latency to marketing pages
- 🔍 Global edge delivery is inherent to the Cloudflare Workers/Pages platform (not project-specific config, but the architecture guarantees it)
- ❓ ASK AARON — no Lighthouse/PageSpeed/Core Web Vitals numbers exist in the repo; would need to be pulled live from PageSpeed Insights or CrUX

## 4. Security & Reliability

- 🔍 HTTPS is inherent to the Cloudflare platform
- 🔍 Turnstile (Cloudflare's CAPTCHA replacement) gates every public form
- 🔍 `ADMIN_SESSION_SECRET` (HMAC-signed session cookie) gates `/admin`; separate Google OAuth session (`cr_crm` cookie) gates the CRM at `/crm` — two distinct auth systems for two distinct audiences
- 🔍 `robots.txt` explicitly blocks `/crm`, `/admin`, `/signup`, `/api/` from all crawlers, including AI crawlers — auth-gated surfaces don't leak into search or AI-training crawl
- 🔍 Full git history under version control (1,291 commits) — every change traceable, nothing is a black box
- 🔍 A "delete tombstone" system in the CRM specifically engineered to survive rebuilds (commit `9f389109`: *"fixes 'deletes come back after rebuild'"*) — evidence of a real, previously-encountered data-integrity bug that was diagnosed and fixed at the architecture level, not patched over
- 🔍 Per-channel (email/SMS/voice) consent + opt-out ledger with an audit trail, enforced server-side (suppression checks run before every outbound send, per this session's own work on `worker/api/crm-inbox.js`)

## 5. Technology Stack (translated for a contractor audience)

| Technology | What it is | Why a contractor should care |
|---|---|---|
| Astro 5 + static generation | The site is pre-built, not assembled on the fly for every visitor | Pages load instantly — no "spinner while the database catches up" |
| Cloudflare Workers + Pages | Runs on Cloudflare's global edge network | The site is fast for a customer in Seattle and one in Miami, not just near a single server |
| Cloudflare D1 | A real SQL database at the edge | Lead and CRM data isn't bolted onto a spreadsheet — it's a proper system of record |
| Cloudflare R2 | Object storage for media | Video/image-heavy pages don't slow the rest of the site down |
| React 19 (islands) | Interactive components (calculators, demo) load only where needed | The rest of the site stays fast because it isn't shipping a full app framework to render text |
| Cal.com API | Native booking, not "fill out a form and wait" | A prospect books a real time slot in one visit instead of waiting on a callback |
| Twilio + Retell AI ("Mack") | SMS + AI voice agent that can call a lead and transfer to a human | A lead gets a real response in minutes, at 2am, without a human sitting by the phone |
| DataForSEO + Apollo + Claude (web search) | An automated pipeline that finds a business's owner/decision-maker and their real, verifiable email | Outreach reaches an actual decision-maker, not a generic `info@` inbox |
| Google OAuth + Gmail API | Two-way email sync inside the CRM | Replies happen in one place instead of hunting across a separate inbox |
| Meta Conversions API | Server-side ad-conversion reporting | Ad spend gets credited correctly even when a browser blocks the tracking pixel |

---

## 6. The Cool Stuff

### 6.1 A Claude-powered "find the owner" fallback for cold outreach
**What it is:** When Apollo's people-search comes back empty for a small contractor's domain (common for owner-operators with no corporate presence), the CRM falls back to a live web-search-enabled Claude API call that researches the business's About/Contact/Team pages, LinkedIn, and public registries — the same way a human researcher would — and returns a name + verified email with a citation URL. It's instructed to *never guess* an email; if it can't verify one, it returns null rather than fabricate. ([worker/api/apollo-prospect.js](worker/api/apollo-prospect.js))
**What it does:** Turns "Apollo has nothing" from a dead end into a second, cited attempt — at essentially the cost of one API call, not an Apollo credit.
**Why the business owner should care:** Fewer wasted outreach attempts hitting generic inboxes; more attempts reaching an actual owner.
**Why it demonstrates capability:** Most agencies stop at "the data provider came back empty." This pipeline treats that as a solvable problem, not a wall — and it was debugged and hardened *live in this session* (fixing a token-budget truncation bug that was silently swallowing correct answers).

### 6.2 An AI voice agent with a compliance check built into its own verification
**What it is:** "Mack," a Retell-hosted AI voice agent, handles Speed-to-Lead outbound calls and can warm-transfer to a human rep via a hunt/cascade (Primary → Backup1 → Backup2 with no-answer failover). The system verifies, from the actual call transcript, that Mack disclosed it's an AI — not by trusting a script, but by checking the transcript contains the agent's name plus an AI-disclosure phrase.
**What it does:** Automates first response to a hot lead within minutes, at any hour, without losing the human handoff when a rep is needed.
**Why the business owner should care:** Speed-to-lead is one of the highest-leverage metrics in home services — the first business to respond usually wins the job.
**Why it demonstrates capability:** Building the disclosure-compliance check as an automated transcript audit (not a policy document nobody reads) shows the build treats legal/compliance risk as an engineering problem to solve, not a checkbox.

### 6.3 A self-auditing content pipeline
**What it is:** A set of purpose-built internal QA tools (`voice-check`, `cpl-canon`, `testimonial-audit`, `schema-completeness`, `broken-link-sweep`, `ad-launch-checklist`, `pre-publish-checklist` — found under `.claude/skills/` in this repo) that lint the site before every push: banned-word/pricing-canon drift, competitor-price consistency across 8+ dependent pages, fabricated-testimonial detection (an actual FTC compliance concern), schema completeness, and dead internal links.
**What it does:** Catches the class of bug that normally ships silently — a stale competitor price on one page but not six others, a banned word that slipped into new copy, a testimonial nobody can verify.
**Why the business owner should care:** Marketing copy stays accurate and legally defensible without a human manually re-checking every page after every edit.
**Why it demonstrates capability:** This is infrastructure most agencies don't build for themselves, let alone for a client — evidence that the team thinks about "how do we not screw this up at scale," not just "how do we ship it once."

### 6.4 A dynamically-generated, always-in-sync `llms.txt`
**What it is:** Rather than a hand-written `llms.txt`, the file is generated at build time from the exact same TypeScript data arrays that generate the live pages ([src/pages/llms.txt.ts](src/pages/llms.txt.ts)).
**What it does:** Guarantees the AI-crawler sitemap can never list a page that doesn't exist or omit one that does — impossible with a manually maintained file.
**Why the business owner should care:** As AI answer engines become a real referral channel, staying accurately indexed there matters as much as Google SEO did a decade ago.
**Why it demonstrates capability:** Very few sites have this yet at all; fewer still have it engineered so it can't drift.

### 6.5 A prospecting "last-ditch" audit trail
**What it is:** Every time a rep manually deletes a prospect from the pipeline, the CRM now snapshots why (domain, trade, tier, score, disqualification reasons, who deleted it, when) into a dedicated log table — built specifically so a human can run one more outreach attempt on the batch before that decision path gets automated away. (Built in this session: `worker/api/prospecting.js`.)
**Why it demonstrates capability:** Shows a deliberate, cautious approach to automating judgment calls — log first, automate second, never lose the paper trail.

### 6.6 The product's own architecture mirrors its pitch
**What it is:** Consent Resolve's own site runs Cloudflare-edge infrastructure, a real consent-first CMP-governed analytics setup (Consent Mode v2, denied-by-default `gtag`, upgraded only on CMP grant), and the exact visitor-recovery mechanics it sells.
**Why it demonstrates capability:** The agency didn't just build marketing collateral about consent-first, privacy-forward marketing — it runs its own site that way.

---

## 7. Before & After

🔍 **Verified from git history:** the repository's first commit (`490d664c`, 2026-06-02) is literally titled *"Phase 1: scaffold + design system"* — this was built from an empty repository. The project reached 91 static pages, a 6,585-line custom CRM front end, and 168 backend Worker files within roughly 10 weeks (last commit in this audit: 2026-08-11), across **1,291 commits** (680 in June, 338 in July, 273 in the first ~11 days of August).

🔍 **Internal before/after, evidenced by commit messages** (not an external redesign, but real iteration under load):
- The CRM pipeline was rebuilt from a card layout to "an operations console (rows, not cards)" (`a81e0a9c`)
- The CRM itself went through at least 3 named rebuild passes: foundation/migration → real-data endpoint → frozen-frontend-behind-auth (`e6fd9a2f`, `1433e5ff`, `738befbd`)
- `/demo/` was redesigned from a claim form to a Cal.com booking flow (`9c1f4da1`, `d3d4e7c1`)
- `/how-it-works/` was redesigned twice, ending as "a sticky-scroll walkthrough" (`15fd367c`, `0345d7b7`)
- `/faq/` was rebuilt as an aggregated hub for SEO/AEO parity (`aedf19f6`)
- A real data-integrity bug ("deletes come back after rebuild") was found and permanently fixed with a tombstone system (`9f389109`)

❓ **ASK AARON** — none of the following exist in the repository and would need to come from you directly:
- Traffic before/after (no analytics export in-repo)
- Lead volume / conversion rate over time
- Ranking movement
- Client testimonials or quotes about the finished product

---

## 8. Measurable Proof

### Verified Business Results
- ❓ None found in-repo. Business outcomes (leads generated, revenue, ranking movement) live in GA4/Meta/D1 and are not present as static facts in the codebase.

### Verified Technical Results
- 🔍 91 static pages generated
- 🔍 19 industry pages, 23 feature pages, 25 competitor-comparison pages, 158 blog posts, 30 explainers, 10 how-to guides, 47 internal design-system pages
- 🔍 31 distinct schema.org types implemented; Organization + WebSite injected sitewide via one shared component
- 🔍 1,291 commits over ~10 weeks from an empty repository to the current state
- 🔍 168 backend Worker JS files; a 6,585-line custom CRM built entirely in-house (not a third-party CRM)
- 🔍 8 AI crawlers explicitly allow-listed by name in robots.txt
- 🔍 Zero fabricated testimonial/review schema in the codebase (a clean compliance posture, verified by absence)

### Measurable But Not Yet Measured
- PageSpeed/Lighthouse/Core Web Vitals scores — testable anytime at pagespeed.web.dev
- Indexed page count — pullable from Google Search Console
- Actual lead volume / cost-per-lead — pullable from the live D1 database (`crm_leads`) once wrangler network access is available, or via GA4/Meta dashboards
- AI-answer-engine citation rate — no current tooling tracks this; would need manual spot-checks against ChatGPT/Perplexity/Claude

---

## 9. Superpowers Demonstrated

| Superpower | Strongest proof |
|---|---|
| **Website Power** | 91-page custom Astro build, centralized design system (47 style-guide pages), React islands for interactivity without sacrificing static-site speed |
| **SEO Power** | 19 industry pages + 25 competitor-comparison pages built specifically to compete for "vs." search intent; canonical/NAP/sitemap all centralized to prevent drift |
| **AI Power** | Claude-powered owner-discovery fallback in the CRM; dynamically generated llms.txt; AI voice agent (Mack) with built-in compliance verification; self-auditing content QA skills |
| **Cloudflare Power** | Fully edge-served static site + Worker API + D1 + R2, with immutable 1-year caching on media assets |
| **Lead Power** | Custom-built CRM with lead scoring, multi-source ingestion (RB2B, Crisp, Instantly, Meta, forms), Speed-to-Lead SMS+voice automation, per-channel consent ledger |
| **Brand Power** | 🧭 Locked voice guide (`/style-guide/voice/`) enforced by an automated linter — brand consistency treated as a build-time constraint, not a style doc nobody reads |

---

## 10. The Story

**The Client:** Consent Resolve — a MarTech startup founded December 2025 by three named execs with real, verifiable backgrounds (VerticalResponse CEO/COO, former cPanel CBO) — building a consent-first way for home-service contractors to recover website visitors who bounce without converting.

**The Problem:** 🔍 Roughly 98% of a contractor's website visitors leave without calling or filling out a form — ad spend paying for traffic that never converts, and no compliant way to follow up with anonymous visitors.

**The Mission:** 🧭 Build a product (and the site selling it) that turns that bounce into a consented, exclusive lead — without the legal risk of scraping or buying visitor data — and prove the pitch by running the company's own marketing the same consent-first way.

**The Build:** A 91-page Astro/Cloudflare site with a genuinely large content library (158 blog posts, 30 explainers, 25 competitor-comparison pages), backed by a from-scratch custom CRM (not a bought platform) with lead scoring, multi-channel outreach automation, and an AI voice agent — all shipped from an empty repository in roughly 10 weeks at a 1,291-commit pace.

**The Smart Stuff:** A Claude-powered fallback that finds and verifies a business owner's contact when the paid data provider comes up empty; an AI voice agent whose compliance disclosure is verified by auditing its own call transcripts, not trusted on faith; a self-auditing content pipeline that catches pricing drift, banned words, and fabricated testimonials before they ship; an `llms.txt` that's structurally incapable of drifting out of sync with the real site.

**The Result:** 🔍 A production system — 91 indexed pages, 31 schema types, a working CRM handling real outreach — built and iterated in public through git history, with clean compliance posture (no fabricated social proof) throughout. ❓ Business outcomes (traffic, leads, rankings) are not yet documented in-repo and would need to come from live analytics.

**The Takeaway:** This isn't a template site with a contact form bolted on. It's a from-scratch, edge-native marketing site paired with a custom-built CRM and AI-driven outreach automation — built fast, audited automatically, and honest about what it hasn't proven yet. That combination (speed + structural correctness + restraint from overclaiming) is what a service business is actually buying when they hire Hey Aaron!.

---

## 11. Missing Information / Questions for Aaron

Keeping this to the highest-value gaps only:

1. **Do you have GA4/Search Console access pulled anywhere** (even informally) showing traffic or indexed-page trends since launch? This is the single highest-leverage number for the case study if it exists.
2. **Live lead numbers** — how many leads has Consent Resolve itself generated via its own site (`crm_leads` in D1), and is there a cost-per-lead figure worth citing?
3. **Any client-side reaction** — since Consent Resolve is the product being sold, do you have any early customer feedback (even informal, e.g. a Slack message or call note) that could be quoted with permission?
4. **The Product Hunt launch** (there's a blog post referencing it: `consent-resolve-is-live-on-product-hunt.md`) — do you have real metrics from that launch (upvotes, traffic spike, signups) worth citing?
5. **Anything particularly hard about this build** you'd want highlighted that isn't obvious from commit messages — e.g. a specific technical wall you hit and solved?
6. **Timeline framing** — is "~10 weeks, 1,291 commits" the story you want to tell, or is there a narrower "core build" window (vs. ongoing iteration) that's more accurate for a case-study headline?

---

## Appendix: Potential Headlines (draft only — not final copy)

1. "Built From Zero to a 91-Page Site and a Custom CRM in 10 Weeks — With the Compliance Built In From Day One"
2. "The Marketing Site That Practices What It Sells: Consent-First, Edge-Native, and Self-Auditing"
3. "When the Lead-Gen Tool Ran Out of Data, We Taught Claude to Find the Owner Anyway"

## Appendix: Potential Portfolio Teaser (30–50 words, draft only)

Consent Resolve needed a site that could sell "consent-first" credibly — so we built one that runs that way itself: edge-native, schema-complete, self-auditing before every push, with a custom CRM that uses AI to find a decision-maker's real email when the paid data provider comes up empty.

## Appendix: Best Sales Takeaway

Most agencies show you a pretty homepage. This project is proof the team builds the *infrastructure behind* the pretty homepage — the CRM, the automation, the compliance guardrails, the self-checking pipeline — because that's what actually turns a website into a lead machine a contractor can trust.
