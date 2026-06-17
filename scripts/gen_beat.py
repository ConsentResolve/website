#!/usr/bin/env python3
"""Generalized deadpan-beat insertion (the #02 fix, for the whole library).

For each reel: find the punchline's first caption cue, measure the silence before
it, and if it's under THRESH, freeze the last setup frame + inject silence so the
gap reaches TARGET — shifting BOTH audio and video (lip-sync preserved) and the SRT
cues after the boundary. Overwrites the cached build/shoptalk/<id>/src.mp4 + cap.srt
so the composite picks it up. Idempotent: a reel already at/above THRESH is skipped,
so re-running (or running 'all') never double-inserts.

Usage: python3 scripts/gen_beat.py all   |   ... 09 19 20   (specific ids)"""
import re, sys, shutil, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/"scripts"))
from shop_talk_lines import LINES, BY_ID, DELETED
FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
W, H = 1080, 1920
TARGET, THRESH = 0.50, 0.30  # desired beat; only fix reels currently under THRESH
ENC = ["-c:v", "libx264", "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "44100"]

def ts(s): h, m, r = s.split(":"); sec, ms = r.split(","); return int(h)*3600+int(m)*60+int(sec)+int(ms)/1000.0
def fmt(t): h = int(t//3600); m = int(t % 3600//60); s = t % 60; return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s-int(s))*1000)):03d}"
def run(*a): subprocess.run([FF, "-y", "-loglevel", "error", *a], check=True)

def parse_cues(srt):
    cues = []
    for blk in re.split(r"\n\s*\n", srt.read_text().strip()):
        L = [x for x in blk.splitlines() if x.strip()]; tl = next((x for x in L if "-->" in x), None)
        if not tl: continue
        a, b = [x.strip() for x in tl.split("-->")]; txt = " ".join(L[L.index(tl)+1:]).strip()
        if txt: cues.append((ts(a), ts(b), txt))
    return cues

def punch_idx(cues, text):
    """First cue index of the punchline (final sentence) — mirrors gen_shoptalk."""
    sents = re.split(r"(?<=[.!?])\s+", text.strip())
    if len(sents) < 2: return None
    np_words = len(" ".join(sents[:-1]).split()); cum = 0
    for i, (a, b, txt) in enumerate(cues):
        if cum >= np_words and np_words > 0: return i
        cum += len(txt.split())
    return None

def beat(rid):
    if rid in DELETED: return f"{rid}: skip (cut)"
    d = ROOT/f"build/shoptalk/{rid}"; src, srt = d/"src.mp4", d/"cap.srt"
    if not src.exists() or not srt.exists(): return f"{rid}: skip (no cached render)"
    cues = parse_cues(srt); pidx = punch_idx(cues, BY_ID[rid]["text"])
    if pidx is None or pidx == 0: return f"{rid}: skip (single-sentence, no boundary)"
    gap = cues[pidx][0] - cues[pidx-1][1]
    if gap >= THRESH: return f"{rid}: skip (already {gap:.2f}s)"
    BEAT = round(TARGET - gap, 2)
    T = cues[pidx-1][1] + gap*0.5  # mid-gap → mouth at rest
    run("-i", str(src), "-t", f"{T}", "-vf", f"scale={W}:{H},fps=30", *ENC, str(d/"_p1.mp4"))
    run("-ss", f"{T}", "-i", str(src), "-vf", f"scale={W}:{H},fps=30", *ENC, str(d/"_p2.mp4"))
    run("-sseof", "-0.05", "-i", str(d/"_p1.mp4"), "-frames:v", "1", str(d/"_fr.png"))
    run("-loop", "1", "-t", f"{BEAT}", "-i", str(d/"_fr.png"), "-f", "lavfi", "-t", f"{BEAT}", "-i", "anullsrc=r=44100:cl=stereo",
        "-vf", f"scale={W}:{H},fps=30,format=yuv420p", *ENC, "-shortest", str(d/"_freeze.mp4"))
    lst = d/"_beatlist.txt"; lst.write_text("".join(f"file '{(d/x).resolve()}'\n" for x in ["_p1.mp4", "_freeze.mp4", "_p2.mp4"]))
    run("-f", "concat", "-safe", "0", "-i", str(lst), *ENC, str(d/"_src_beat.mp4"))
    out = []
    for blk in re.split(r"\n\s*\n", srt.read_text().strip()):
        L = [x for x in blk.splitlines() if x.strip()]; tl = next((x for x in L if "-->" in x), None)
        if not tl: continue
        a, b = [x.strip() for x in tl.split("-->")]; A, B = ts(a), ts(b)
        if A >= T: A += BEAT; B += BEAT
        elif B > T: B += BEAT
        out.append(f"{L[0]}\n{fmt(A)} --> {fmt(B)}\n" + "\n".join(L[L.index(tl)+1:]))
    (d/"cap.srt").write_text("\n\n".join(out)+"\n")
    shutil.copy(str(d/"_src_beat.mp4"), str(src))
    for f in ["_p1.mp4", "_p2.mp4", "_fr.png", "_freeze.mp4", "_src_beat.mp4", "_beatlist.txt"]: (d/f).unlink(missing_ok=True)
    return f"{rid}: BEAT +{BEAT:.2f}s at {T:.2f}s ({gap:.2f}->{gap+BEAT:.2f}s)  <== fixed"

if __name__ == "__main__":
    arg = sys.argv[1:] or ["all"]
    ids = [l["id"] for l in LINES] if arg == ["all"] else arg
    fixed = []
    for rid in ids:
        r = beat(rid); print(r, flush=True)
        if "fixed" in r: fixed.append(rid)
    print(f"\n=== beat: {len(fixed)} fixed -> {' '.join(fixed)}", flush=True)
