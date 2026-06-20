# TikTok Content Posting API — application & audit packet

Goal: post Consent Resolve's own short-form marketing videos directly to our **own**
official TikTok Business account, replacing the Buffer dependency. This is the packet to
submit at developers.tiktok.com (create app → add Content Posting API → request audit).

## Scopes to request
- `video.publish` — Content Posting API (Direct Post to our own account)
- `user.info.basic` — identify the authorizing account

## Posting mode
**Direct Post** to a single, first-party account (our own brand account). We are **not**
posting on behalf of third-party users — only Consent Resolve's own content to Consent
Resolve's own TikTok. (This narrows the audit scope and avoids the multi-user UX requirements.)

## Use-case description (paste into the application)
> Consent Resolve is a B2B software company serving home-service contractors. We produce
> our own short-form brand videos — short, dry trade-humor clips and educational explainers —
> and publish them to our own official TikTok Business account on a scheduled cadence
> (roughly 1–3 posts/day). We use the Content Posting API's Direct Post flow to publish this
> first-party brand content to our own account only. No third-party user content is posted,
> no user data is collected or resold, and posting is initiated by our own internal scheduler
> after our team approves each clip. Videos are AI-assisted (synthetic presenter), which we
> disclose via the API's AI-generated-content flag and on-screen where required.

## Compliance answers the audit checks
- **No third-party watermarks/logos/promo text baked into the video.** We will submit a
  **clean TikTok variant** of each reel — no SHOP TALK badge, no @handle, no burned-in
  captions/CTA. (Branding/handle/CTA live in the caption + profile instead.)
- **AI-generated content disclosure:** our presenter is synthetic → we set the AI-generated
  flag on every post (and add the on-screen AI label TikTok requires for synthetic media).
- **Commercial content:** toggle "branded content"/"brand promotion" as applicable in the
  post payload; include the required commercial disclosure.
- **Account scope:** posts go only to our own verified Business account.
- **Cadence:** ~1–3/day, well under TikTok's ~15/day per-creator ceiling.

## Audit demo notes (what to show the reviewer)
1. Internal scheduler selects an approved clip + caption.
2. App calls Content Posting API (Direct Post), AI flag = true, to our own account.
3. Clip appears on our profile; no third-party watermark; AI label present.
Until the audit passes, posts are forced to `SELF_ONLY` (private) — expect ~days–weeks.

## Our build steps once approved (engineering)
- Add TikTok OAuth (video.publish) → store token/refresh in D1 `social_tokens` (same pattern as X/Google).
- New poster `post_tiktok_native.py`: query creator info → Direct Post the clean-variant video by URL.
- Swap the scheduler's `tk` branch from `post_buffer.py` → `post_tiktok_native.py`; retire Buffer.
- Render a watermark-free TikTok variant of each reel (drop badge/handle/captions).

## Demo-video runbook (what to screen-record for the audit)
Code is built: `scripts/tiktok_oauth.py` + `scripts/post_tiktok_native.py` (FILE_UPLOAD, no domain
verification needed). You need the app created first (for the client key/secret). Then:

1. **Create the app** at developers.tiktok.com → copy **client key + secret** → save locally as
   `/tmp/tiktok_app.json` `{"client_key":"…","client_secret":"…"}` (or export the env vars).
   In the app's **Login Kit settings, add a Redirect URI** you control (e.g. `https://consentresolve.com/`).
2. **Get the authorize URL** → `python3 scripts/tiktok_oauth.py url https://consentresolve.com/`
   → open it, **log into the Consent Resolve TikTok**, approve `user.info.basic` + `video.publish`.
   *(Start the screen recording here.)*
3. The browser redirects with `?code=…` — copy it → `python3 scripts/tiktok_oauth.py exchange <code> https://consentresolve.com/`
   (saves `/tmp/tiktok_token.json`).
4. **Post a sandbox test** → `python3 scripts/post_tiktok_native.py "<a clean test reel URL>" "test caption"`.
   It prints creator info → publish_id → status. Open the TikTok app and show the post (SELF_ONLY in sandbox).
   *(Stop recording.)*
5. That recording (authorize → post → it appears) is the demo video. Upload it on the submission.

Notes: sandbox posts are `SELF_ONLY` until the audit passes — that's expected and fine for the demo.
Use the clean (no-watermark) reel variant so the same asset passes the content-policy review.
