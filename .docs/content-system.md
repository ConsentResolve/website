# Content System — Consent Resolve (locked)

One brand voice + look across everything (navy #0a1628 / mint #00e5a0, logo,
Heartbeat-v2 voice). Two video types. Per-platform language/optimization layered
on top of the same core asset.

## Two video types
| | **Non-UGC** (no people) | **UGC** (avatar) |
|---|---|---|
| Style | Locked brand reel — `scripts/brand_reel.py` (red 98/100 + dot-grid → lead-identified card → $7/exclusive → /demo pill), Suno music | Avatar IV presenters (Jason/Tyler/Aaron) in trade settings — `gen_avatar_scenes.py` + de-AI finish |
| Origin | The original posts / first Reels (Suno songs + instrumentals) | Added later |
| Best for | LinkedIn (founder), brand-forward variety, "proof/explainer" beats | TikTok / IG / YT cold discovery (a face out-performs there) |
| Audio | One mode per angle: **VO** (matched cloned voice + ducked bed), **instrumental**, or **with-lyrics** Suno | Cloned-voice VO |

**Every non-UGC reel is built to convert muted:** a ≤3s hook (big number/grid
on-screen instantly), a muted-legible visual story, brisk pacing (~23–25s). Audio
mode is assigned per angle in `render_nonugc.py` (`MODES`): VO=leak/ftc/ownership,
instrumental=invoice/math/robot, with-lyrics=twice/ghost. VO narration is
re-scripted to Heartbeat-v2 in `vo_reel.py` and spoken in that angle's matched
avatar voice (leak=Jason, ftc=Tyler, ownership=Aaron).

Both share: navy/mint, the logo, Heartbeat-v2 copy ($7, exclusive, consent-first,
/demo, "the big lead sites", no trial language, no exclamation).

## Per-platform optimization (same core video, tuned wrapper)
| Platform | Type | Aspect | Length | Caption style | Hashtags | CTA |
|---|---|---|---|---|---|---|
| TikTok | UGC-first | 9:16 | 21–34s | hook line 1, native/casual | 3–5 niche | "link in bio" |
| IG Reels | UGC + non-UGC | 9:16 | 20–34s | hook + 1 value line | 4–6 niche | link in bio |
| YT Shorts | both | 9:16 | ≤60s | **search-optimized title** + keyword desc | #Shorts | channel link |
| FB Reels | both | 9:16 | 20–40s | owner-audience, plain | 0–2 | link |
| LinkedIn (personal) | **non-UGC only** | 4:5 | 20–40s | founder commentary IS the post | 0–2 | soft, in comment |
| FB feed · LI company · X · GBP | written | — | — | resource share / VoC ad | 0–2 | /demo |

Rule of thumb: **UGC drives cold discovery (TikTok/IG/YT); non-UGC carries LinkedIn + variety.** Never put avatar UGC on the personal LinkedIn feed.

## 45-day mix (target)
- ~4 videos/week (front-load 6): **~60% UGC / 40% non-UGC**.
- UGC = the 13 VoC angles (produced). Non-UGC = locked brand reels per angle (to build).
- Stories: auto-reshare + branded slides. Personal LinkedIn: founder posts + non-UGC clips (manual).

## Builders (source of truth)
- Non-UGC: `scripts/render_nonugc.py` (mode router) → `brand_reel.py` (visual engine,
  `DURS`/`VO`/`MUSIC` env) and `vo_reel.py` (cloned-voice VO over a ducked bed)
- UGC: `scripts/gen_avatar_scenes.py` → `finish_tests.py` / `finish_variants.py`
- Written-post preview: `scripts/gen_posts_preview.py` → `public/posts.html` (noindex)
- Schedule/scheduler: `scripts/gen_schedule.py`, `run_scheduler.py`, `.github/workflows/social-scheduler.yml`
- Hosting: `scripts/r2_upload.py` (R2 `cr-social`)
- Voice/casting: `.docs/voice-social.md`, `.docs/avatar-casting.md`, `.docs/linkedin-personal-voice.md`

## Open inputs needed from Aaron (to complete 45 days)
See chat — music variety, lead-card authenticity (FTC), CPL canon numbers,
content-mix sign-off, founder anecdotes, dashboard screenshot, claims confirm.
