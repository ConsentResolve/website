#!/usr/bin/env python3
"""Render ONE short VERTICAL (9:16, 720x1280) Tyler clip for the FIRST card of the
mobile "Meet Consent Resolve" swipe deck (MobileProductStory.astro).

Same Real-Tyler look/voice as the /industries/ hub clip, but reframed vertical so it
fills the dating-app profile card, and re-scripted for a cold visitor who just tapped
"Demo" on a phone — it sets up the swipe deck instead of pointing at a trade selector.

  python3 scripts/gen_meet_intro.py

Uploads to R2 as social/sprint/meet-intro-vertical.mp4 and writes a poster frame to
public/reels/meet-intro-poster.jpg. Afterwards set INTRO_VIDEO in
src/components/sections/MobileProductStory.astro to the public URL.
"""
import json, subprocess, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from cr_secrets import secret

KEY = secret("heygen")
LOOK = "ef74e672158e4b87a445ffaeb3ad92fc"    # Tyler — same look as the hub clip
VOICE = "92071a8742744d17bc92a02baab2941f"   # Real Tyler (no emotion)

# ~12s. Deliberately just hook -> problem -> fix -> swipe. The price ($7 a lead, never
# resold) is NOT spoken because the profile bio sits directly under this video and already
# says it. Ends on a dating-app joke because the deck this opens is skinned like one.
SCRIPT = ("I'm Tyler. Ninety-eight of every hundred people who land on your site leave without a word. "
          "You paid to get them there. Consent Resolve fixes that. "
          "Keep swiping — I'm not a catfish.")

# Vertical framing matters: gestures must stay inside a narrow 9:16 frame or they clip.
MOTION = ("Warm, direct, a little playful — a founder who respects your time, talking straight to "
          "camera on a phone screen. Head-and-shoulders, centered in a tall vertical frame. A small "
          "dismissive shrug on 'leave without a word'. Ends with a grin on the catfish line. Punchy "
          "and quick — this is a twelve-second read, no wasted beats. Natural hand gestures kept "
          "close to the body so they stay inside the narrow vertical frame — never reaching outside it.")


def api(url, body=None):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode() if body else None,
        headers={"X-Api-Key": KEY, "Content-Type": "application/json"},
        method="POST" if body else "GET",
    )
    return json.load(urllib.request.urlopen(req, timeout=60))


body = {"caption": False, "video_inputs": [{
    "character": {"type": "talking_photo", "talking_photo_id": LOOK, "use_avatar_iv_model": True,
                  "talking_style": "expressive", "super_resolution": True, "expressiveness": "high",
                  "custom_motion_prompt": MOTION},
    "voice": {"type": "text", "voice_id": VOICE, "input_text": SCRIPT, "speed": 0.98},
}], "dimension": {"width": 720, "height": 1280}}

vid = (api("https://api.heygen.com/v2/video/generate", body).get("data") or {}).get("video_id")
print("video_id", vid, flush=True)
if not vid:
    sys.exit("no video_id returned")

vurl = None
for _ in range(90):  # ~15 min max
    st = api(f"https://api.heygen.com/v1/video_status.get?video_id={vid}").get("data") or {}
    s = st.get("status")
    if s == "completed":
        vurl = st.get("video_url"); break
    if s == "failed":
        sys.exit("HeyGen render failed: " + json.dumps(st)[:200])
    time.sleep(10)
if not vurl:
    sys.exit("timeout waiting for render")

out = str(ROOT / "public/reels/meet-intro-vertical.mp4")
Path(out).parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["curl", "-sSL", vurl, "-o", out], check=True)
print("downloaded", out, flush=True)

# HeyGen ignores the 9:16 canvas for this landscape-native look: it letterboxes the
# 16:9 avatar into 720x1280 with big WHITE bars (cropdetect misses them — it only
# looks for black). Measure the content box by row variance and crop the bars off.
# We deliberately do NOT upscale to a true 9:16: the card's photo area is near-square,
# so CSS object-fit:cover downscales this crop and stays sharp.
from PIL import Image
probe = str(ROOT / "build/meet-probe.jpg")
Path(probe).parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", out,
                "-frames:v", "1", probe], check=True)
im = Image.open(probe).convert("RGB"); W, H = im.size; px = im.load()
top = bot = None
for y in range(H):
    vals = [sum(px[x, y]) / 3 for x in range(0, W, 8)]
    if max(vals) - min(vals) > 25:          # flat white bars have ~no variance
        if top is None: top = y
        bot = y
if top is None:
    top, bot = 0, H - 1
top += 2; bot -= 2                            # inset past any soft edge row
ch = (bot - top + 1) // 2 * 2                 # even height for h264
print(f"letterbox crop -> {W}x{ch} at y={top}", flush=True)

cropped = str(ROOT / "public/reels/meet-intro.mp4")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", out,
                "-vf", f"crop={W}:{ch}:0:{top}", "-c:v", "libx264", "-crf", "20",
                "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "copy",
                # faststart so the tap-to-unmute seek can't stall (the hub clip has moov last)
                "-movflags", "+faststart", cropped], check=True)

# public/reels/ is gitignored (it holds mp4s), so the poster lives beside the hub's
# in public/team/ — it must be committed or the <video> poster 404s in production.
poster = str(ROOT / "public/team/meet-intro-poster.jpg")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "0.6", "-i", cropped,
                "-frames:v", "1", "-q:v", "4", poster], check=True)
print("poster", poster, flush=True)

subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), cropped,
                "social/sprint/meet-intro.mp4", "video/mp4"], check=True)
print("done -> social/sprint/meet-intro.mp4", flush=True)
