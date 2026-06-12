#!/usr/bin/env python3
"""A/B one Tyler scene: v3 Cinematic engine vs proven Avatar IV (v2).
Submits both, prints raw responses. Poll/download handled separately."""
import json, urllib.request, urllib.error, sys

KEY = open("/tmp/heygen_key.txt").read().strip()
TYLER_LOOK = "972e62f23f724b688c740e5b8d307822"
TYLER_VOICE = "0c76e4a9be91456da07c3c9e1160db1e"
TEXT = "Look— ninety-eight out of a hundred people hit your website... and just leave."

def api(url, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data,
        headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=120)
        return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# --- Avatar IV (proven v2 shape) ---
iv_body = {"caption": False, "video_inputs": [{
    "character": {"type": "talking_photo", "talking_photo_id": TYLER_LOOK,
                  "use_avatar_iv_model": True, "talking_style": "expressive", "super_resolution": True},
    "voice": {"type": "text", "voice_id": TYLER_VOICE, "input_text": TEXT, "speed": 1.05, "emotion": "Friendly"},
}], "dimension": {"width": 1080, "height": 1920}}
print("=== Avatar IV (v2/video/generate) ===")
print(api("https://api.heygen.com/v2/video/generate", iv_body))

# --- Cinematic (v3 best-guess) ---
cin_body = {"type": "avatar", "avatar_id": TYLER_LOOK,
            "engine": {"type": "cinematic"},
            "script": TEXT, "voice_id": TYLER_VOICE,
            "dimensions": {"width": 1080, "height": 1920}}
print("\n=== Cinematic (v3/videos) ===")
print(api("https://api.heygen.com/v3/videos", cin_body))
