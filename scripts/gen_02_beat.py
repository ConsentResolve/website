#!/usr/bin/env python3
"""Insert a deadpan beat into #02 between 'self-esteem' and 'And' — HeyGen won't
pause on punctuation for this voice, so we freeze the frame + add silence at the
word boundary (T), shifting BOTH audio and video by BEAT so lip-sync is preserved.
Also shifts the SRT cues after T. Overwrites the cached src/cap so the composite
picks it up."""
import re, shutil, subprocess
from pathlib import Path
ROOT = Path("/Users/aaronphillips/GIT/consentresolve2"); FF, FP = "/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe"
d = ROOT/"build/shoptalk/02"; src = str(d/"src.mp4"); W, H = 1080, 1920
T, BEAT = 2.37, 0.45  # boundary (cue2 end 2.32 / cue3 start 2.42) + beat length
enc = ["-c:v", "libx264", "-r", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "44100"]
def run(*a): subprocess.run([FF, "-y", "-loglevel", "error", *a], check=True)
run("-i", src, "-t", f"{T}", "-vf", f"scale={W}:{H},fps=30", *enc, str(d/"p1.mp4"))
run("-ss", f"{T}", "-i", src, "-vf", f"scale={W}:{H},fps=30", *enc, str(d/"p2.mp4"))
run("-sseof", "-0.05", "-i", str(d/"p1.mp4"), "-frames:v", "1", str(d/"fr.png"))
run("-loop", "1", "-t", f"{BEAT}", "-i", str(d/"fr.png"), "-f", "lavfi", "-t", f"{BEAT}", "-i", "anullsrc=r=44100:cl=stereo",
    "-vf", f"scale={W}:{H},fps=30,format=yuv420p", *enc, "-shortest", str(d/"freeze.mp4"))
lst = d/"beatlist.txt"; lst.write_text("".join(f"file '{(d/x).resolve()}'\n" for x in ["p1.mp4", "freeze.mp4", "p2.mp4"]))
run("-f", "concat", "-safe", "0", "-i", str(lst), *enc, str(d/"src_beat.mp4"))
def ts(s): h, m, r = s.split(":"); sec, ms = r.split(","); return int(h)*3600+int(m)*60+int(sec)+int(ms)/1000.0
def fmt(t): h = int(t//3600); m = int(t % 3600//60); s = t % 60; return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s-int(s))*1000)):03d}"
out = []
for blk in re.split(r"\n\s*\n", (d/"cap.srt").read_text().strip()):
    L = [x for x in blk.splitlines() if x.strip()]; tl = next((x for x in L if "-->" in x), None)
    if not tl: continue
    a, b = [x.strip() for x in tl.split("-->")]; A, B = ts(a), ts(b)
    if A >= T: A += BEAT; B += BEAT
    elif B > T: B += BEAT
    out.append(f"{L[0]}\n{fmt(A)} --> {fmt(B)}\n" + "\n".join(L[L.index(tl)+1:]))
(d/"cap_beat.srt").write_text("\n\n".join(out)+"\n")
shutil.copy(str(d/"src_beat.mp4"), src); shutil.copy(str(d/"cap_beat.srt"), str(d/"cap.srt"))
print("beat inserted; new dur", subprocess.check_output([FP, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).decode().strip())
