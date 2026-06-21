#!/usr/bin/env python3
"""Generate the 7 VO clips (HeyGen, voice f365d990…) + timing.json. Idempotent."""
import json, subprocess
from tt_lib import VO, TT, FF, heygen_tts, dur, log
from tt_script import SEGMENTS

def silent(out, s=1.0):
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", f"{s}", str(out)], check=True)

def main():
    log(f"VOICE: {len(SEGMENTS)} clips")
    timing = []
    for s in SEGMENTS:
        wav = VO / f"{s['id']}.wav"
        if wav.exists() and dur(wav) > 0.4:
            log(f"  skip {s['id']} (exists)")
        elif heygen_tts(s["vo"], str(wav)):
            log(f"  ok {s['id']} {dur(wav):.1f}s")
        else:
            silent(wav); log(f"  PLACEHOLDER {s['id']} (flagged)")
        timing.append({"id": s["id"], "scene": s["scene"], "vo": s["vo"], "wav": str(wav), "dur": round(dur(wav), 3)})
    (TT / "timing.json").write_text(json.dumps(timing, indent=2))
    total = sum(t["dur"] for t in timing)
    log(f"VOICE: done — {total:.1f}s (~{total/60:.1f} min)")

if __name__ == "__main__":
    main()
