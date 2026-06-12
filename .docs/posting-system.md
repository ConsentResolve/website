# Posting System — Consent Resolve (video + written, in harmony)

Two tracks, one funnel. They are not competitors — video buys cold attention you
don't have yet; the written drip converts and compounds it into search presence
and `/demo` clicks. Same Heartbeat-v2 voice and `/demo` CTA across both.

## The two tracks
| | 🎬 Video track (new) | ✍️ Written/link track (live) |
|---|---|---|
| Platforms | TikTok, YouTube Shorts, IG Reels, FB **Reels** | FB **feed**, LinkedIn (co+personal), X, GBP |
| Content | 9:16 video (the ~30s scripts) | resource shares + VoC `/demo` ad posts |
| Job | Top-funnel cold discovery | Mid/bottom: nurture, SEO/AEO, demo clicks |
| Mechanism | Manual / scheduler (Meta Business Suite + TikTok/YT, or Metricool/Buffer) | Cloudflare cron → D1 queue (`worker/`) |
| KPI (first 60d) | 3-sec retention + completion | `/demo` link clicks, impressions |

## The collision we fixed: Facebook
Facebook is in both tracks (feed link posts + Reels). The algorithm suppresses
multiple posts from one account in a session, so the Page can't run a feed post
and a Reel the same day. **Fix:** FB feed cadence set to **every other day**
(`PLATFORM_CADENCE_DAYS.facebook = 2` in `worker/_lib/publish.js`) and scheduled
on the **days FB Reels don't post**. Net ≈ 1 thing/day on the Page, never two.

## Cadence
| Platform | Front-load (wks 1–3) | Steady state | Notes |
|---|---|---|---|
| TikTok | 6–7/wk | 5/wk | Fastest cold-discovery engine — heaviest |
| YouTube Shorts | 5/wk | 4/wk | Search-titled (AEO); evergreen for months |
| Instagram Reels | 4/wk | 3/wk | Weakest cold-start; don't overinvest |
| Facebook Reels | 4/wk | 3/wk | Highest-intent for trades owners; cross-post w/ IG |
| FB feed (written) | every other day | every other day | Alternates days with FB Reels |
| LinkedIn company | every other day | every other day | written; optional native-video cross-post |
| LinkedIn personal | weekly | weekly | written |
| X / GBP | ~daily when live | ~daily | written; currently parked on API approval |

**Rules across both:** ≤2 posts/platform/day · no spoken/visible competitor names
· `/demo` CTA · video length 30–45s · judge video on retention, written on clicks.

## Weekly grid (steady state — alternated so nothing collides)
| Day | TikTok | YT Shorts | IG+FB Reels | FB feed | LinkedIn | X/GBP |
|---|---|---|---|---|---|---|
| Mon | ✅ | ✅ | ✅ | — | co | ✅ |
| Tue | ✅ | ✅ | — | ✅ | personal | ✅ |
| Wed | ✅ | — | ✅ | — | co | ✅ |
| Thu | ✅ | ✅ | — | ✅ | — | ✅ |
| Fri | ✅ | ✅ | ✅ | — | co | ✅ |
| Sat | — | — | — | ✅ | — | ✅ |
| Sun | buffer | — | — | — | — | — |
Front-load weeks 1–3: add Sat IG+FB Reels and Sat/Sun TikTok.

## The repurposing loop (what keeps the tracks unified)
```
1 script → 1 video → 4 video platforms (+ native LinkedIn/X video, free)
          ↘ caption text → FB feed / LinkedIn / X written post
          ↘ links to → the matching resource page (SEO/AEO)
   winning 3-sec hook (by retention) → next week's written ad headline
```
**Harmony principle:** one campaign angle per week flows through *both* tracks —
the same VoC angle airs as Reels/Shorts *and* as the matching written ad,
pointing at the same resource. A stranger who sees the TikTok and later the
LinkedIn post gets one coherent story.

## Pipeline
- Scripts: `scripts/video_scripts.py` (13 angles, ~30s, persona-cast).
- Generate: `ANGLE=invoice,leak python3 scripts/gen_avatar_scenes.py`
- Finish (feed): `python3 scripts/finish_tests.py` → `public/reels/test-<angle>-FINAL.mp4`
- TikTok-safe cut + `.srt`: `python3 scripts/finish_variants.py`
- Casting/looks reference: `.docs/avatar-casting.md`
- 45-day plan: `.docs/content-calendar-45day.md`

## A/B testing (retention beats volume)
Iterate the **first 3 seconds**, not the video count. Cut the same body with a
different opening hook (e.g. the Angi-rage `race` open vs the 97% `leak` open) and
compare 3-sec retention. The back half of the calendar re-runs top angles with a
"B-hook" variant for exactly this.
