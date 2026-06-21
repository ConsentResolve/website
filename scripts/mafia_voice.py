#!/usr/bin/env python3
"""Generate all VO clips via HeyGen (exact phonetic VO text — misspellings kept) and
write a timing map. Idempotent: skips clips already rendered. Per the brief, retry once
then keep going (placeholder-silent clip) so the overnight run never halts.
  python3 scripts/mafia_voice.py
"""
import json, subprocess
from mafia_lib import VO, FF, heygen_tts, dur, log, script

# Sal least exaggerated, Mrs. Petunia sweet/clean → slightly calmer speeds for tonal contrast.
SPEED = {"SAL": 1.0, "MRS. PETUNIA": 0.98, "NARRATOR": 1.02, "DON ANGELO": 1.03, "VINNIE": 1.05}

def silent(out, seconds=1.2):
    subprocess.run([FF, "-y", "-loglevel", "error", "-f", "lavfi", "-i",
        f"anullsrc=r=44100:cl=stereo", "-t", f"{seconds}", str(out)], check=True)

def main():
    sc = script(); timing = []
    lines = [li for s in sc["scenes"] for li in s["lines"]]
    log(f"VOICE: generating {len(lines)} VO clips")
    for li in lines:
        n = li["n"]; ch = li["character"]; wav = VO / f"line_{n:02d}_{ch.split()[0].lower().strip('.')}.wav"
        if wav.exists() and dur(wav) > 0.3:
            log(f"  [{n:02d}] skip (exists) {ch}")
        else:
            ok = heygen_tts(li["voice_id"], li["vo"], str(wav), speed=SPEED.get(ch, 1.0))
            if not ok:
                silent(wav); log(f"  [{n:02d}] PLACEHOLDER silent {ch} — flagged")
            else:
                log(f"  [{n:02d}] ok {ch} {dur(wav):.2f}s")
        timing.append({"n": n, "scene": li["scene"], "character": ch, "cc": li["cc"],
                       "action": li.get("action", ""), "wav": str(wav), "dur": round(dur(wav), 3)})
    (VO.parent / "timing.json").write_text(json.dumps(timing, indent=2))
    total = sum(t["dur"] for t in timing)
    log(f"VOICE: done — {len(timing)} clips, {total:.1f}s total VO (~{total/60:.1f} min)")

if __name__ == "__main__":
    main()
