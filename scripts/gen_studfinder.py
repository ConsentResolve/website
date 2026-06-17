#!/usr/bin/env python3
"""Re-render 02_studfinder with real beats: the '...' didn't pause for this voice,
so use separate sentences (periods) which DO pause. Same settings otherwise."""
import json, time, urllib.request, urllib.error
KEY = open("/tmp/heygen_key.txt").read().strip()
CREATE = "https://api.heygen.com/v2/video/generate"
STATUS = "https://api.heygen.com/v1/video_status.get?video_id="
VOICE = "41c46ea57c0a4dd29e3acd1de0765c05"
MOTION = ("Face stays neutral and still. Eyes fixed on camera. No smile, no eyebrow movement. "
          "Hands rest down, no gestures. Slow occasional blink.")
AVATAR = "ec564e1e4d0942c19cbba4fe23940d19"
SCRIPT = "I bought a stud finder. I took it to a bar. It kept pointing at me. It's broken."

body = {
    "callback_id": "02_studfinder_lookA_v2", "title": "02_studfinder_lookA_v2",
    "dimension": {"width": 720, "height": 1280},
    "video_inputs": [{
        "character": {"type": "avatar", "avatar_id": AVATAR, "avatar_style": "normal",
                      "motion_prompt": MOTION, "expressiveness": "low"},
        "voice": {"type": "text", "voice_id": VOICE, "input_text": SCRIPT, "speed": 0.9},
        "background": {"type": "color", "value": "#EAE3D6"},
    }],
}
req = urllib.request.Request(CREATE, data=json.dumps(body).encode(), method="POST",
    headers={"x-api-key": KEY, "Content-Type": "application/json"})
resp = json.load(urllib.request.urlopen(req, timeout=120))
vid = (resp.get("data") or {}).get("video_id") or resp.get("video_id")
print("video_id:", vid, flush=True)
url = None
for _ in range(90):
    st = json.load(urllib.request.urlopen(urllib.request.Request(STATUS+vid, headers={"x-api-key": KEY}), timeout=60)).get("data") or {}
    if st.get("status") == "completed": url = st.get("video_url"); break
    if st.get("status") == "failed": url = "FAILED: "+str(st.get("error")); break
    time.sleep(8)
print("02_studfinder_lookA (re-rendered with sentence pauses)\n", url, flush=True)
