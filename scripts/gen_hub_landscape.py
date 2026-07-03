#!/usr/bin/env python3
"""Render ONE short LANDSCAPE (16:9, 1280x720) Tyler hub clip for /industries/.
New "what to do next" script: Tyler introduces, then looks/points toward the on-screen
trade selector, holds a beat, and invites the viewer to tap their trade. Full-bleed
avatar (no white bars). Raw HeyGen (no karaoke). Uploaded to R2 as
social/sprint/hub-next-wide.mp4.  Run: python3 scripts/gen_hub_landscape.py
"""
import json, subprocess, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from cr_secrets import secret

KEY = secret("heygen")
LOOK = "ef74e672158e4b87a445ffaeb3ad92fc"    # Tyler — LANDSCAPE look (user-selected)
VOICE = "92071a8742744d17bc92a02baab2941f"   # Real Tyler (no emotion)

# "leeds" spelling keeps the sales-lead pronunciation correct (HeyGen quirk). Caption is off,
# so the odd spelling is never seen. The ellipsis after "right over there" holds a short beat
# where the on-page flashing arrow slams in over the trade selector.
SCRIPT = ("I'm Tyler. You're busy, so let's skip the fluff. You're a few clicks away from seeing "
          "how Consent Resolve turns your website visitors into actual booked jobs. And because a "
          "roofer's leeds don't look anything like a plumber's, we built this demo around your trade. "
          "Right over there... Yeah, that thing. Hard to miss. Tap your trade and I'll get you squared "
          "away. Take your time, I'll be here. Literally can't go anywhere.")

MOTION = ("Warm, direct, a little playful — like a founder who respects your time. Talks straight to "
          "camera. On 'right over there' he turns his head and gestures with an open hand toward his "
          "left (the viewer's right side), as if pointing out an on-screen menu sitting beside him, and "
          "holds a brief knowing look in that direction. Returns to camera with a slight grin for the "
          "final lines. Natural, confident hand gestures, never stiff.")


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
}], "dimension": {"width": 1280, "height": 720}}

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

out = str(ROOT / "public/reels/hub-next-wide.mp4")
Path(out).parent.mkdir(parents=True, exist_ok=True)
subprocess.run(["curl", "-sSL", vurl, "-o", out], check=True)
print("downloaded", out, flush=True)
subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"), out,
                "social/sprint/hub-next-wide.mp4", "video/mp4"], check=True)
print("done -> social/sprint/hub-next-wide.mp4", flush=True)
