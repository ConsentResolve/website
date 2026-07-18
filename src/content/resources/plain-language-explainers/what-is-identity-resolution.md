---
title: "What Is Identity Resolution?"
slug: "what-is-identity-resolution"
resource_type: "plain-language-explainer"
status: "published"
author: "Aaron Phillips"
hide_byline: true
published_at: 2026-06-09
updated_at: 2026-06-09
read_time: "6 min"
og_hook: "Matching a click to a real person is either confident or it's a guess."
excerpt: "Identity resolution connects scattered signals to a single real person. Here's how deterministic and probabilistic matching differ, and why the consent behind it matters most."
seo_title: "What Is Identity Resolution?"
seo_description: "Identity resolution connects scattered signals to a single real person. Here's how deterministic and probabilistic matching differ"
focus_keyword: "what is identity resolution"
canonical_url: "https://consentresolve.com/resources/plain-language-explainers/what-is-identity-resolution/"
category: "Visitor Identification"
tags: ["identity resolution", "visitor identification", "deterministic matching", "probabilistic matching", "consent"]
funnel_stage: "convert"
schema_type: "Article"
tldr: "Identity resolution is the process of connecting scattered pieces of information — a visit, an email, a device — to figure out they all belong to the same real person. It can be done confidently (deterministic) or by educated guess (probabilistic), and the consent behind it matters more than the method."
key_takeaways: "Identity resolution links separate signals to a single real person. Deterministic matching uses solid shared identifiers and is high-confidence; probabilistic matching uses statistical guesses and is lower-confidence. For contractors, the safer leads come from deterministic matches built on consent. A service that resolves everyone using probabilistic guessing without consent is the risky approach to avoid."
glossary_slug: "identity-resolution"
related:
  - label: "Glossary: Identity Resolution"
    url: "/resources/glossary/#identity-resolution"
  - label: "What Is Website Visitor Identification?"
    url: "/resources/plain-language-explainers/what-is-website-visitor-identification/"
  - label: "What Is a Good Match Rate?"
    url: "/resources/plain-language-explainers/what-is-a-good-match-rate/"
  - label: "What Is First-Party Data?"
    url: "/resources/plain-language-explainers/what-is-first-party-data/"
  - label: "How consent-first works"
    url: "/how-it-works/"
primary_cta:
  label: "See how consented leads work →"
  url: "https://consentresolve.com/"
faq_items:
  - question: "What does identity resolution actually do?"
    answer: "It takes separate signals — a website visit, an email address, a device — and works out that they belong to the same person, so a business can recognize a returning visitor or connect a visit to a known contact."
  - question: "What's the difference between deterministic and probabilistic matching?"
    answer: "Deterministic matching links records using solid shared identifiers, like a confirmed email, so it's high-confidence. Probabilistic matching uses statistical clues, like device and location patterns, to make an educated guess, so it's lower-confidence and more error-prone."
  - question: "Which type of matching is safer for contractors?"
    answer: "Deterministic matching built on consent. It gives you confident, accurate matches of people who agreed to be identified, instead of guesses about strangers who never did."
  - question: "Can identity resolution be done without consent?"
    answer: "Technically yes — probabilistic methods can try to resolve anyone. But resolving identities of people who never agreed to be identified is the risky, scrape-everyone approach that raises privacy-law problems."
sources:
  - label: "WordStream — website conversion benchmarks (~2% of visitors convert)"
    url: "https://www.wordstream.com/blog/conversion-rate-benchmarks"
  - label: "BigSur AI — conversion-rate optimization statistics"
    url: "https://bigsur.ai/blog/cro-statistics"
---

## What it is

Identity resolution is the process of connecting scattered pieces of information to figure out they all belong to the same real person. Online, a single person leaves a trail of disconnected signals — a visit from a phone, another from a laptop, an email they once typed into a form, a session with no name attached. Identity resolution stitches those pieces together so a business can say "these all point to one person."

For a contractor, the everyday version is recognizing that the anonymous visit you got today is the same homeowner who filled out a form last week. That recognition is identity resolution doing its job: turning a pile of separate clues into one identifiable contact.

Like visitor identification, it comes in a safe form and a risky form. The safe form resolves people who agreed to be identified, using solid evidence. The risky form tries to resolve everyone, often by guessing. The technology is similar; the consent — and the confidence — is what separates them.

## How it works

There are two main approaches, and the difference comes down to confidence.

**Deterministic matching** links records using solid, shared identifiers — most often a confirmed email address or login. If the same verified email shows up in two places, you can be confident it's the same person. It's like matching two documents because they share the same signature. High confidence, low error rate, but it only works when you have a real shared identifier to anchor on.

**Probabilistic matching** makes an educated guess. It looks at clues — device type, location, browsing patterns, timing — and estimates the odds that two activities belong to the same person. It's like deciding two letters were written by the same person because the handwriting looks similar. It can fill in gaps where you don't have a hard identifier, but it's lower-confidence and gets things wrong more often.

Here's how they stack up:

| | Deterministic matching | Probabilistic matching |
|---|---|---|
| **Based on** | Solid shared identifiers (e.g. confirmed email) | Statistical clues (device, location, patterns) |
| **Confidence** | High | Lower — it's an estimate |
| **Error rate** | Low | Higher; can mismatch people |
| **Needs a real identifier?** | Yes | No |
| **Fit with consent** | Pairs naturally with opt-in records | Often used to resolve people who never opted in |

Many large data platforms blend both. The trouble starts when probabilistic guessing is used to resolve people who never agreed to be identified — which is how a service ends up "identifying" visitors it has no real basis to name.

## Why it matters for contractors

You don't need to run an identity-resolution platform to care about how this works. You just need to know what's behind the leads you're handed, because it determines whether they're trustworthy.

A lead built on deterministic matching with consent is solid: this is a real, identified person who agreed to be contacted, matched on real evidence. You can follow up with confidence. A lead built on probabilistic guessing without consent is shaky on two fronts. It might be the wrong person — you call about a roof and reach someone who never visited your site — and it's the kind of identification that draws privacy complaints, because nobody agreed to it.

The practical lesson: a confident match of someone who said yes is worth far more than a guessed match of someone who didn't. Quality of the match beats quantity every time, and the quality lives in the method.

## Common mistakes

- **Assuming every match is accurate.** Probabilistic matches are guesses. Treating a guess as a fact leads to wrong-number calls and wasted follow-up.
- **Chasing volume over confidence.** A service that resolves more identities by leaning on probabilistic guessing isn't giving you more good leads — just more uncertain ones.
- **Ignoring the consent layer.** Resolving who someone is doesn't grant permission to contact them. Identity and consent are separate; you need both.
- **Not asking how matches are made.** If a provider can't tell you whether leads are deterministic or probabilistic — and whether consent is attached — you can't judge the quality.

## How it relates to consent

Identity resolution answers "who is this?" Consent answers "am I allowed to contact them, and how?" You need both, and a good service keeps them tied together.

The safest combination is deterministic matching anchored on a consent record: the person is identified on solid evidence, and that same evidence shows they agreed to be contacted. That's a lead you can act on without second-guessing it. The risky combination is probabilistic resolution with no consent — guessing at strangers' identities and reaching out anyway.

A consent-first service is built around the safe combination on purpose. ConsentResolve surfaces visitors who were confidently matched and who agreed to be identified and contacted — leads that are exclusive to you, never resold, at a flat $7 each. The aim isn't to resolve everyone who passes through. It's to hand you confident matches of people who already said yes.
