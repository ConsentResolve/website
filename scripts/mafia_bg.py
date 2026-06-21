#!/usr/bin/env python3
"""Backgrounds + van via OpenAI gpt-image-1 (Recraft ran out of credits mid-run — the
4 characters are already Recraft; backgrounds use the same flat-cartoon style prompt so
they sit together). Petunia's opaque cutout is fixed locally with a PIL flood-fill.
Idempotent. Logged as a Recraft->OpenAI fallback in the run log.
  python3 scripts/mafia_bg.py
"""
import os, json, base64, urllib.request, urllib.error
from pathlib import Path
from PIL import Image, ImageDraw
from mafia_lib import ART, log

KEY = os.environ["OPENAI_API_KEY"]
STYLE = ("flat 1960s mid-century limited-animation cartoon, bold thick black ink outlines, "
         "limited flat color palette, grainy litho paper texture, retro halftone shading, "
         "simple geometric shapes, no text, no lettering, no words")

def openai_image(prompt, out, size="1536x1024", transparent=False):
    body = {"model": "gpt-image-1", "prompt": f"{prompt}. {STYLE}", "size": size, "n": 1, "quality": "medium"}
    if transparent: body["background"] = "transparent"; body["output_format"] = "png"
    for attempt in range(2):
        try:
            req = urllib.request.Request("https://api.openai.com/v1/images/generations",
                data=json.dumps(body).encode(), headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
            r = json.loads(urllib.request.urlopen(req, timeout=240).read())
            Path(out).write_bytes(base64.b64decode(r["data"][0]["b64_json"]))
            return True
        except urllib.error.HTTPError as e:
            log(f"openai img FAIL ({attempt}) {os.path.basename(out)}: {e.read().decode()[:160]}")
        except Exception as e:
            log(f"openai img FAIL ({attempt}) {os.path.basename(out)}: {str(e)[:120]}")
    return False

BGS = {
 "bg_alley": "a dark smoky city back-alley at night with a big blank glowing neon sign frame, wet cobblestone puddles, fire escapes, moody teal and magenta neon glow, no characters, wide establishing shot",
 "bg_backroom": "a dim 1960s mafia back-room office, a giant ornate wooden desk, venetian blinds casting noir stripes, a green bankers lamp, smoky amber light, no characters, wide shot",
 "bg_porch": "a cozy suburban house porch with a yellow door and flower boxes, a wide empty street out front with lots of room, sunny afternoon, no characters, wide shot",
 "bg_greendoor": "a plain humble bright green wooden door set in an old brick alley wall, a small blank wooden sign above it, soft hopeful daylight, no characters, centered composition",
 "bg_sunlit": "a bright sunny peaceful backyard meadow with blue sky, fluffy clouds, little birds and flowers, warm and suspiciously cheerful, no characters, wide shot",
}

def cut_petunia():
    src = ART / "petunia.png"
    im = Image.open(src).convert("RGB")
    w, h = im.size
    key = (255, 0, 255)
    # flood-fill the flat background from all four corners to a key color, then key it out
    for seed in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]:
        ImageDraw.floodfill(im, seed, key, thresh=55)
    im = im.convert("RGBA")
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][:3] == key: px[x, y] = (0, 0, 0, 0)
    im.save(src)
    a = im.getextrema()[3]
    log(f"petunia PIL flood-cut -> alpha {a}")

def main():
    log("BG: Recraft out of credits -> generating backgrounds + van via OpenAI gpt-image-1 (flagged)")
    for k, p in BGS.items():
        if (ART / f"{k}.png").exists(): log(f"  skip {k} (exists)"); continue
        ok = openai_image(p, str(ART / f"{k}.png"), size="1536x1024")
        log(f"  {'ok' if ok else 'PLACEHOLDER'} {k}")
    if not (ART / "van.png").exists() or Image.open(ART / "van.png").convert("RGBA").getextrema()[3][0] == 255:
        ok = openai_image("a tiny cute boxy plumber work van seen from the side, bright teal, a round emblem on the door, comic speed lines",
                          str(ART / "van.png"), size="1024x1024", transparent=True)
        log(f"  {'ok' if ok else 'PLACEHOLDER'} van (transparent)")
    cut_petunia()
    log("BG: done")

if __name__ == "__main__":
    main()
