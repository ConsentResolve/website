#!/usr/bin/env python3
"""Leah's own office-manager angle set, rendered in the LOCKED UGC style
(scripts/ugc_reel.sh). Her POV: front desk / follow-up / books at a home-service
company. Voice = Real Leah. Each angle uses a different Leah look.
Usage: python3 scripts/gen_leah_angles.py [angle ...]   (default: all)
"""
import os, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
KEY = open("/tmp/heygen_key.txt").read().strip()
VOICE = "1d92f4e36247492d9ad806b59fd3434a"        # Real Leah
CUE = "Friendly, warm, conversational office manager. Light nods, eyebrow lifts on emphasis, an easy smile that comes and goes."

# angle -> (look_id, script)
ANGLES = {
  "speed": ("de4dc68d9cb249219aa96287c458bae4",   # front desk
    "Front-desk reality: the faster you reach someone, the more likely they book. But the leads we used to buy were half stale before they ever hit my inbox. Four other companies already called. Meanwhile, about 98 out of 100 people on our own website were leaving without a trace, the ones actually looking at us right then. Now we catch those visitors while they are still warm, with a real email and what they came in for. I reach out while they still remember us. That is the whole game."),
  "ghost": ("d83a225562764506a47f334a1a2b249d",   # kitchen
    "I used to spend my mornings calling leads that went nowhere. Wrong numbers, no answers, people who never heard of us. We paid for every one. The thing is, the people already on our own website actually wanted the work, and about 98 out of 100 of them were slipping away anonymous. Now those visitors come back to me as real people who opted in, with an email and a reason they reached out. I am not chasing ghosts anymore. I am following up with people who are expecting to hear from us."),
  "consent": ("6d3166f5a77545b1ab06a110a189c225", # home office
    "We tried one of those tools that tells you who visited your site. It felt invasive, honestly a little creepy, and I did not love reaching out to people who never asked to hear from us. This is different. Everyone we get has actually opted in. They raised their hand. So when I follow up by email, they are expecting it. About 98 out of 100 visitors used to leave with no way to reach them. Now the ones who want to hear from us, do. Consent-first just feels like the right way to run it."),
  "cost": ("62380983788d4b278868a6ca3db6fe0d",    # car
    "I handle the books and the follow-up, so I see exactly what a lead costs us. Shared leads add up fast, and most never turn into anything. When you do the math per booked job, it is rough. Meanwhile about 98 out of 100 people on our own website leave without a trace, traffic we already paid to bring in. Recovering those costs a fraction, and they are exclusive to us. Seven dollars for someone who actually opted in beats a hundred for a name four other companies are also calling."),
}
want = sys.argv[1:] or list(ANGLES)
for a in want:
    look, script = ANGLES[a]; name = f"leah-{a}"
    out = str(ROOT / f"public/reels/test-{name}-tiktok.mp4")
    env = dict(os.environ, HEYGEN_API_KEY=KEY, CHAR_TYPE="talking_photo",
               AVATAR_ID=look, VOICE_ID=VOICE, SCRIPT_TEXT=script,
               TITLE=name, OUT=out, MOTION_PROMPT=CUE)
    print(f">>> {name}", flush=True)
    r = subprocess.run(["bash", str(ROOT / "scripts/ugc_reel.sh")], env=env)
    if r.returncode == 0 and os.path.exists(out):
        subprocess.run(["/usr/bin/python3", str(ROOT / "scripts/r2_upload.py"),
                        out, f"social/sprint/{name}.mp4", "video/mp4"])
        print(f"<<< {name} uploaded", flush=True)
    else:
        print(f"!!! {name} FAILED", flush=True)
print("=== leah angles done ===", flush=True)
