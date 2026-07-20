---
name: ad-launch-checklist
description: Pre-flight gate for ANY Meta ad launch, unpause, budget increase, or creative swap on Consent Resolve. Verifies conversion tracking actually fires, the landing URL resolves, lead ads point at the qualified form, and placements exclude the money pits. Use whenever the user says "launch the ad", "turn on the campaign", "unpause", "scale the budget", "new creative", "check the ads before we go live", or any variant. Run it BEFORE spending — an ad that launches without tracking is unmeasurable money.
---

# ad-launch-checklist

We once spent **$771 on a Traffic campaign that fired only `PageView`** — 2,829 landing-page
views and no way to tell whether a single one converted. Separately, **$747 went to Facebook
Reels at an $83 CPL** while Feed produced leads at $16, and 42 leads closed at **zero** because
the form let people answer "Facebook" and "N/a get one" for their website.

Every item below exists because it already cost real money. Run all seven. Report PASS/FAIL per
item and **refuse to call it ready if any FAIL** — say plainly which one and what it will cost.

## 1. Tracking helper is present

`window.crTrack` is the single call site for every ad-measurable action (defined in
`src/layouts/BaseLayout.astro`).

```bash
grep -c "window.crTrack=function" src/layouts/BaseLayout.astro   # expect 1
grep -rho "crTrack(['\"][A-Za-z]*['\"]" src/components/ | sort | uniq -c
```

Expected events: `ViewContent` (story opened), `StoryComplete` (reached the CTA card),
`Contact` (call / sms / chat), `StartSignup` (Get Started), `DemoOpen` (sticky bar),
`Lead` (on-site demo form, in `DemoForm.astro` — fires with an `eventID` for CAPI dedup).

## 2. Events actually fire (do not trust grep alone)

Build, serve `dist/`, open the page, stub the pixel, exercise the funnel, read what
*would* have been sent:

```js
var cap=[]; window.fbq=function(){cap.push([].slice.call(arguments))};
crOpenStory(); for(var i=0;i<7;i++) crStoryGo(i);
document.querySelector('.mcr-cta-secondary').click();
cap.map(c=>c[0]+':'+c[1]);
```

PASS = `track:ViewContent`, `trackCustom:StoryComplete`, `track:Contact`, `trackCustom:StartSignup`.

**Gotcha:** the pixel is consent-gated (`data-usercentrics="Facebook Pixel"`), so it no-ops
before consent. That undercounts conversions **on purpose** — consent-first is the product.
Never "fix" it by un-gating the pixel.

## 3. Landing URL resolves, in production

Not localhost. The deployed URL, with the exact params the ad will use.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://consentresolve.com/how-it-works/?story=1"
curl -s "https://consentresolve.com/how-it-works/?story=1" | grep -c "story=1"
```

Expect `200` and a non-zero grep. A deploy lag between push and Workers Builds is the usual
cause of a dead ad URL — check the build finished, not just that you pushed.

## 4. Lead ads point at the QUALIFIED form

Old form `973794715704465` asked for "Business website **or Facebook Page URL**" and produced
~40% unusable leads. The qualified form is **`952314797820630`** (asks "Do you have a business
website?" first).

```python
# for each ad: creative.object_story_spec.link_data|video_data.call_to_action.value.lead_gen_form_id
```

Any active lead ad on the old form is a FAIL. Meta forms are immutable once they have leads —
you must clone the creative onto the new form and reassign the ad (this puts the ad back into
`PENDING_REVIEW`, which is normal).

## 5. Placements exclude the money pits

```
publisher_platforms: ["facebook","instagram"]
facebook_positions:  ["feed","marketplace"]
instagram_positions: ["stream"]
```

No `facebook_reels`, `facebook_reels_overlay`, `instream_video`, `facebook_stories`, or
`audience_network`. Those returned $83 CPL or zero.

**Always MERGE into the existing targeting object** — writing a bare targeting dict wipes
geo/age/interests and Meta rejects it with `error_subcode 1885364`.

## 6. Objective can actually use the tracking

A campaign with objective `OUTCOME_TRAFFIC` optimizes for clicks and will **not** optimize
toward `Contact`/`StartSignup` no matter how good the pixel is. If the goal is conversions,
the campaign objective and the ad set's `promoted_object` / `optimization_goal` have to match
the event. Say so explicitly rather than implying a traffic campaign is conversion-tracked.

## 7. UTMs present and honest

Every ad link carries `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`. The
`utm_content` should identify the creative, so CRM attribution can name the winner.

Also check the ad's **promise matches its destination**. A creative that says "See a 2-min demo"
must not open an Instant Form — that mismatch is a real contributor to leads not remembering
they opted in, which is how callbacks hit a gatekeeper.

## Report format

```
PASS  1. crTrack helper present (6 call sites)
PASS  2. Events fire: ViewContent, StoryComplete, Contact×3, StartSignup
FAIL  3. Landing URL — https://…/?story=1 returned 404 (deploy not finished)
PASS  4. Lead ads on qualified form 952314797820630 (10/10)
FAIL  5. adset 1203… still includes facebook_reels — $83 CPL placement
...
VERDICT: NOT READY — 2 blockers. Fixing #3 needs a completed Workers build; #5 is a
targeting merge. Estimated waste if launched as-is: ~$50/day into Reels.
```

## Anti-patterns

- Do **not** grep for `fbq(` and call tracking "verified" — grep proves the code exists, not
  that it runs. Exercise the funnel.
- Do **not** report a screenshot as proof an animation or event worked. Both headless Chrome
  (`--virtual-time-budget`) and the in-app browser **freeze the animation clock**; force-finish
  with the Web Animations API or read state directly instead.
- Do **not** batch dozens of Meta writes without pause — the ad account rate-limits
  (`code 17`, "Ad Account Has Too Many API Calls") and leaves changes half-applied.
- Do **not** launch a budget increase on an ad whose leads have never been quality-checked.
  Volume amplifies whatever the funnel already does, including producing unclosable leads.
