# Recraft API — ad image generation

Recraft is the only image backend. This file is grounded in the **proven** repo pattern — see
`scripts/da_lib.py` (`recraft()`) and `scripts/gen_exp_assets.py` for the canonical, working
calls. The bundled `scripts/recraft_ad.py` wraps this for ad use; prefer it over hand-rolling.

## Auth, endpoint, and the Cloudflare gotcha

- **Endpoint:** `https://external.api.recraft.ai/v1/images/generations` (OpenAI-SDK-compatible)
- **Auth:** `Authorization: Bearer <key>`. Key lives at `~/.config/recraft/key` (read it, don't
  hardcode).
- **Cloudflare 1010 ban:** Recraft's edge blocks Python's default TLS fingerprint. `gen_exp_assets.py`
  routes through **curl** for exactly this reason. `scripts/recraft_ad.py` does the same. If you
  see a 1010 / "browser integrity" error, that's the cause — use the curl path, don't retry raw.

## The two visual tracks

**Track A — illustrated / on-brand line-art (the locked brand style).**
When `style_id` is set, Recraft ignores `style`, `substyle`, and `colors` and renders in that
saved brand. Ours:
```
BRAND_STYLE_ID = "214dccd1-dca3-43e6-b005-c664e1b33338"
```
This is a **vector line-art** style (white fills, navy outlines, mint accent) — the same one
behind every site illustration, so illustrated ads feel unmistakably Consent Resolve. It returns
**SVG**, which must be rasterized to PNG (the repo uses `qlmanage`/Quick Look; see `da_lib.py`).
Best for concept/doodle ads, diagrams (the "98% leave" visual), and icon-driven hooks.

**Track B — photoreal raster (Recraft v4.1).**
For a contractor at a laptop, a truck in a driveway, a rooftop at golden hour. There is **no
raster brand style saved yet**, so drive brand two ways:
- (a) Explicit palette + style prompt: navy (#0A1628-ish), mint accent, clean, trustworthy,
  natural light, no stock-photo cheese. Pass `style: "realistic_image"` and a `colors` array.
- (b) **Create a raster brand style once** and reuse its id (recommended if you'll run many raster
  ads) — see "Creating a raster brand style" below.

Proven request body shape (`da_lib.py`), model `recraftv3`:
```json
{
  "model": "recraftv3",
  "size": "1024x1024",
  "response_format": "url",
  "style_id": "214dccd1-dca3-43e6-b005-c664e1b33338",
  "prompt": "Subject: ..., centered.\n\n<style base notes>"
}
```
> **v4.1 note:** the user wants Recraft **v4.1**. The repo's proven `model` value is `recraftv3`.
> Recraft's current raster model identifier and the exact `text_layout` schema evolve — before a
> big batch, confirm the live `model` string and text-layout field names against Recraft's docs
> (or a single test call), then lock them into `scripts/recraft_ad.py`. Structure below is correct;
> only the exact `model`/field strings may need a one-line update.

## Ad sizes (VERIFIED — Recraft rejects arbitrary WxH)

Recraft only accepts specific sizes — `1080x1350` returns *"Image size not supported"*. Use the
supported equivalents (the bundled script's `SIZE_MAP` does this automatically):
- 4:5 portrait (**primary**) → **`1024x1280`** (maps from Meta's 1080x1350)
- square → **`1024x1024`** (from 1080x1080)
- story / reels → **`1024x1820`** (from 1080x1920)

Then upscale to Meta's exact pixel sizes in post if you want (Meta accepts these ratios as-is).

## Placing headline + CTA text (VERIFIED — do it in post, not in Recraft)

We tried Recraft's `text_layout` and it was **rejected** (bbox typing error). Don't fight it — the
reliable pattern (and what the rest of the repo does for text) is to generate a **clean image**
and add the headline + CTA as a **PIL overlay afterward**. This is also better creatively: you get
crisp, on-brand type in the right font instead of the model's guess, and you can A/B the text
without regenerating the image.

So: leave the image text-free; pass `--headline`/`--cta` for the caller to overlay (the script
carries them through but does NOT send them to Recraft). Keep on-image text short (a hook + a CTA),
high-contrast, top and bottom bands, and clear of Meta's ~20%-text-heavy zone — busy text-walls
suppress delivery.

## Creating a raster brand style (one-time, if going heavy on photoreal)

Recraft builds a style from reference images. Rough steps (verify against current docs):
1. Gather 3–5 on-brand references (site hero art, brand palette swatches, a clean contractor
   photo in our tone).
2. `POST /v1/styles` with `style: "realistic_image"` and the reference images (multipart).
3. Save the returned `id` here and in `scripts/recraft_ad.py` as `RASTER_BRAND_STYLE_ID` so every
   photoreal ad inherits it.
Until that exists, use Track B option (a) (palette + style prompt).

## Using the bundled script

```
python3 scripts/recraft_ad.py \
  --prompt "Contractor at a laptop seeing new leads arrive, warm natural light" \
  --track raster \
  --size 1080x1350 \
  --headline "98% leave without a trace" \
  --cta "Get them back — $7 a lead" \
  --out working/batches/hvac-20260702/wastedspend_4x5.png
```
`--track brand` uses the line-art `style_id` (SVG→PNG); `--track raster` uses the photoreal path.
The script reads the key from `~/.config/recraft/key`, curl-routes the request, downloads the
result URL, and rasterizes SVG output. Read its `--help` for all flags.
