#!/usr/bin/env python3
"""Synthesize the mob music bed + simple SFX with ffmpeg (no licensed audio on hand —
flagged in the run log). Sparse walking upright-bass loop + brass stab, phone ring,
screech, newsreel sting, soft chime. All written to mafia/sfx/.
  python3 scripts/mafia_audio.py
"""
import subprocess, math
from mafia_lib import SFX, FF, log

def ff(args): subprocess.run([FF, "-y", "-loglevel", "error", *args], check=True)

# walking-bass note frequencies (a lazy minor-ish walk), ~0.5s each, looped
def music_bed(out, seconds=200):
    notes = [55.0, 65.4, 73.4, 82.4, 61.7, 73.4, 49.0, 55.0]  # A1..A1 walk
    seg = 0.5
    parts = []
    for i, f in enumerate(notes):
        parts.append(f"sine=frequency={f}:duration={seg}")
    # build one bar then loop via aloop; use concat of short sines
    inputs = sum([["-f", "lavfi", "-t", f"{seg}", "-i", f"sine=frequency={f}:sample_rate=44100"] for f in notes], [])
    n = len(notes)
    fc = "".join(f"[{i}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1[bar];" \
         "[bar]aloop=loop=-1:size=2e9,atrim=0:%d,asetpts=N/SR/TB," \
         "tremolo=f=2:d=0.3,volume=0.5,lowpass=f=300[a]" % seconds
    ff([*inputs, "-filter_complex", fc, "-map", "[a]", "-ac", "2", "-ar", "44100", str(out)])

def brass_stab(out):
    ff(["-f", "lavfi", "-t", "0.7", "-i", "sine=frequency=233:sample_rate=44100",
        "-f", "lavfi", "-t", "0.7", "-i", "sine=frequency=349:sample_rate=44100",
        "-filter_complex", "[0:a][1:a]amix=inputs=2,afade=t=out:st=0.25:d=0.45,volume=2.2[a]",
        "-map", "[a]", "-ac", "2", str(out)])

def phone_ring(out):
    # two-tone ring x2
    ff(["-f", "lavfi", "-t", "2.0", "-i",
        "sine=frequency=440:sample_rate=44100",
        "-af", "tremolo=f=20:d=0.9,volume=0.7,afade=t=in:d=0.05", "-ac", "2", str(out)])

def screech(out):
    ff(["-f", "lavfi", "-t", "0.6", "-i", "anoisesrc=color=white:sample_rate=44100",
        "-af", "highpass=f=1500,volume=0.5,afade=t=out:st=0.3:d=0.3", "-ac", "2", str(out)])

def newsreel(out):
    ff(["-f", "lavfi", "-t", "1.2", "-i", "sine=frequency=523:sample_rate=44100",
        "-af", "vibrato=f=6:d=0.5,volume=0.6,afade=t=out:st=0.8:d=0.4", "-ac", "2", str(out)])

def chime(out):
    ff(["-f", "lavfi", "-t", "1.4", "-i", "sine=frequency=880:sample_rate=44100",
        "-af", "volume=0.4,afade=t=out:st=0.2:d=1.1", "-ac", "2", str(out)])

def main():
    log("AUDIO: synthesizing music bed + SFX (placeholder synth — flagged)")
    music_bed(SFX / "bed.wav"); log("  bed.wav")
    brass_stab(SFX / "stab.wav"); log("  stab.wav")
    phone_ring(SFX / "ring.wav"); log("  ring.wav")
    screech(SFX / "screech.wav"); log("  screech.wav")
    newsreel(SFX / "newsreel.wav"); log("  newsreel.wav")
    chime(SFX / "chime.wav"); log("  chime.wav")
    log("AUDIO: done")

if __name__ == "__main__":
    main()
