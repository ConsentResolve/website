---
name: recraft-batch
description: Wrapper around the existing Recraft + HSL-recolor pipeline for generating brand-locked illustrations. Use when adding new feature/industry/HIW illustrations, when an existing one needs to be regenerated with a tweaked prompt, when the user asks "generate an illustration", "regenerate the X icon", "new HIW illustration".
---

# recraft-batch

## Pipeline

Two scripts in `scripts/`:

1. **`scripts/generate-recraft.py`** — calls the Recraft API with the custom Brand Style ID `214dccd1-dca3-43e6-b005-c664e1b33338`. Reads API key from `~/.config/recraft/key` (chmod 600). Generates SVG illustrations.
2. **`scripts/recolor-illustrations.py`** — HSL-bucket post-processor. Snaps every color in the SVG to one of the four locked brand palette values (#0A1628, #1E293B, #00E5A0, #F8FAFC).

## Subject sets

Edit `scripts/generate-recraft.py` to add subjects to one of the two `SUBJECTS` arrays:

- `SUBJECTS` — original 9 feature illustrations in `public/illustrations/style/`
- `HIW_SUBJECTS` — 4 HowItWorks node illustrations in `public/illustrations/hiw/`

Each subject is a tuple: `(NN, slug, feature-name, subject-description)`. The subject description must be under ~200 characters or the total prompt (with STYLE_BASE) overflows Recraft's 1000-char limit.

## How to invoke

```bash
# Regenerate all 4 HIW illustrations
python3 scripts/generate-recraft.py --set=hiw \
  --style-id=214dccd1-dca3-43e6-b005-c664e1b33338

# Just one
python3 scripts/generate-recraft.py --set=hiw --only=01 \
  --style-id=214dccd1-dca3-43e6-b005-c664e1b33338

# Recolor to brand palette
python3 scripts/recolor-illustrations.py --in-dir=public/illustrations/hiw

# Recolor just one
python3 scripts/recolor-illustrations.py --in-dir=public/illustrations/hiw --only=01

# Dry run (no API call)
python3 scripts/generate-recraft.py --set=hiw --dry-run
```

## Style brief

The STYLE_BASE prompt enforces:
- Minimalist hand-drawn vector illustration of a single subject, centered with generous negative space.
- Hand-inked marker style: thick, slightly rough, organic outlines.
- Flat color fills.
- One flat, hard-edged offset drop shadow per major shape (no blur, no gradient).
- Rounded, friendly, organic forms with soft corners.
- Completely flat shading — no gradients, no directional lighting, no texture, no 3D.
- Straight-on 2D perspective.
- Transparent background.
- **NO eyes, NO surveillance camera, NO spying imagery, NO lettering, NO numbers.**

When proposing a new subject, keep it short and concrete:

> "a phone handset on the left connected by a single curved arc to two clasped hands forming a handshake on the right, with a small checkmark badge floating just above the handshake"

## When to invoke

User intent:
- "add an illustration for the X feature"
- "regenerate the Y illustration with a different subject"
- "create a new HIW illustration"
- "the Z illustration is too busy / too sparse, retune it"

Workflow:
1. Confirm the slot (existing slug or new) and subject phrasing.
2. Edit `scripts/generate-recraft.py` to add/update the SUBJECTS entry.
3. Run `--dry-run` once to verify the prompt fits.
4. Run live with `--only=NN` to generate just the changed one.
5. Run recolor on the same `--only` index.
6. Verify the output file in `public/illustrations/...`.
7. If the result is wrong, retune the subject string and rerun.
8. If wiring it into a new place, update the consumer (e.g. component imports) too.

## Failure modes

- `HTTP 400 prompt length should be in [1, 1000]` — subject too long; shorten.
- Color drift after generation — recolor catches most; if a hue lands outside the L/S buckets, edit `recolor-illustrations.py` thresholds.
- Image looks "AI generic" — usually because the subject was too vague. Be specific about shape, layout, and props.
