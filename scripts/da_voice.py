#!/usr/bin/env python3
"""Generate the shared VO clips once (HeyGen) for the $2,000 Lead Disaster. Idempotent."""
import json
from da_lib import VO, DA, tts, dur, log
from da_script import SCENES, VOICES

def main():
    timing = {}
    speak = [s for s in SCENES if s.get("vo")]
    log(f"VOICE: {len(speak)} clips")
    for s in speak:
        wav = VO / f"{s['id']}.wav"
        if wav.exists() and dur(wav) > 0.3:
            log(f"  skip {s['id']}")
        elif tts(VOICES[s["voice"]], s["vo"], str(wav), speed=1.0):
            log(f"  ok {s['id']} ({s['voice']}) {dur(wav):.1f}s")
        else:
            log(f"  FAIL {s['id']}")
        if wav.exists(): timing[s["id"]] = round(dur(wav), 3)
    (DA / "timing.json").write_text(json.dumps(timing, indent=2))
    log(f"VOICE: done — {sum(timing.values()):.1f}s of VO")

if __name__ == "__main__":
    main()
