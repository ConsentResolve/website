# Bug: GetEmails & LiveIntent fire before consent (consentresolve.js)

**Owner:** ConsentResolve product team (the codebase that builds `cdn.consentresolve.com/consentresolve.js`)
**Reported from:** consentresolve.com (the marketing site dogfooding the product)
**Severity:** High for a consent-first product — identity/de-anonymization trackers run pre-consent.

## Summary
`consentresolve.js` injects two third-party **identity / de-anonymization scripts** —
**GetEmails** (`ge.js`) and **LiveIntent** (`lc2.js`) — and they **execute before the visitor
gives consent**, regardless of consent state. Every *page-authored* tracker on the site
(Meta Pixel, GA4, Google Ads, RB2B, Leadsy, Microsoft Clarity) is correctly gated; only the two
scripts that `consentresolve.js` itself injects are not.

## Environment
- Site: `https://consentresolve.com` (Astro static)
- CMP: `cdn.consentresolve.com/consentresolve.js`
- init: `ConsentResolve.init({ siteId: '9a7ac777-3ca8-483a-b452-0c4deba31c3c', usercentricsSettingsId: 'NToLbWs-EAo6fS' })`

## Reproduction
1. Open consentresolve.com in a clean/incognito session (or `localStorage.clear()` then reload) so no prior consent exists.
2. Do **not** interact with the consent banner. Confirm `ConsentResolve.getConsentStatus() === false`.
3. In the console:

```js
ConsentResolve.getConsentStatus()   // false  (no consent given)
typeof window.fbq                    // "undefined"  ✅ correctly blocked (page-authored)
typeof window.reb2b                  // "undefined"  ✅ correctly blocked (page-authored)
typeof window.geq                    // "object"     ❌ GetEmails running
typeof window.liQ                    // "object"     ❌ LiveIntent running
[...document.scripts].map(s => s.src).filter(s => /jsstore.*ge\.js|liadm/.test(s))
// → both ge.js and lc2.js are present and have executed
```

## Expected vs. Actual
- **Expected:** with consent `false`, `ge.js` and `lc2.js` do not load/execute (same as Meta/RB2B/etc.).
- **Actual:** they load and run immediately; `geq.identify({ user_id: "9a7ac777:…" })` and `geq.page()` fire pre-consent.

## Root cause
The site has two blocking mechanisms, and these two scripts fall through both:

1. **Manual blocking (active, working).** The CMP only gates `<script>` tags that the page author
   marks with `type="text/plain" data-usercentrics="<Service>"`, flipping them to executable on
   consent. This is why all *page-authored* trackers are gated.
   → `ge.js` / `lc2.js` are injected by `consentresolve.js` **without** these attributes, so the
   manual blocker never sees them.

2. **URL-based auto-blocking (NOT active).** Usercentrics' Smart Data Protector / auto-blocker
   bundle would intercept *any* script by URL pattern, including dynamically-injected ones.
   **Verified it is not loaded** — `document.scripts` contains no `uc-block` / `privacy-proxy` /
   autoblocker bundle; the only CMP script is `consentresolve.js`.

So `consentresolve.js` injects the identity scripts **outside of any consent gate**, and there is
no auto-blocker to catch them.

## The two injected scripts
- **GetEmails:** `https://s3-us-west-2.amazonaws.com/jsstore/a/5N0H0D30/ge.js` + inline `geq.identify(...)` / `geq.page()`
- **LiveIntent:** `https://b-code.liadm.com/lc2.js`

## Recommended fix (in `consentresolve.js`, in order of preference)
1. **Reuse the manual-block mechanism (smallest change).** Inject these tags as
   `<script type="text/plain" data-usercentrics="GetEmails">…</script>` (and `data-usercentrics="LiveIntent"`).
   The CMP already gates tags with these attributes, and matching DPS for `GetEmails` and
   `LiveIntent` now exist in the config — so they'd be gated automatically, no new infrastructure.
2. **Defer injection behind a consent check.** Only inject `ge.js` / `lc2.js` after the relevant
   (Marketing) consent category is granted — hook the consent state the CMP already exposes
   (`getConsentStatus()` / a consent-change event). Do not inject on denial; tear down on withdrawal.
3. **Load the Usercentrics auto-blocker bundle** so URL-based blocking catches them. Heavier; since
   the product is itself the injector, option 1 or 2 is cleaner and more reliable.

## Verification after fix
Re-run the repro: with consent `false`, `window.geq` and `window.liQ` must be `undefined` and
neither script present in `document.scripts`; after Accept All, both should load and run.

---
_Note: a site-side interim guard ("Path C") was discussed but not implemented — fixing this in
`consentresolve.js` (option 1 or 2) is the correct layer._
