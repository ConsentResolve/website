#!/usr/bin/env python3
"""Render ONE short LANDSCAPE (16:9, 1280x720) Tyler hub clip for /industries/:
"pick your trade" + he points toward the on-screen trades. Matches the trade-page
videos' orientation. Short + clean (raw HeyGen, no karaoke), uploaded to R2 as
social/sprint/hub-next-wide.mp4.  Run: python3 scripts/gen_hub_landscape.py
"""
import json, subprocess, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from cr_secrets import secret

KEY = secret("heygen")
LOOK = "62fc3b77a45442148e3aac4eb799153a"    # Tyler — LANDSCAPE look (as used on the trade landing pages)
VOICE = "92071a8742744d17bc92a02baab2941f"   # Real Tyler (no emotion)

# Short + sweet (~42 words ≈ ~14s). "customers" avoids the lead->leed pronunciation quirk.
SCRIPT = ("You made it here, nice. Now do this. Pick your trade, right over here. "
          "Roofing, plumbing, heating and air, whatever you run. Tap it, and I'll show you "
          "the customers already hiding on your own website. Takes about two minutes.")

MOTION = ("Warm, direct, and energetic. Talks straight to camera, then near the end he turns "
          "his head and points with his hand to his right, toward on-screen menu options, "
          "inviting the viewer to pick their trade. Natural, confident hand gestures.")


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
