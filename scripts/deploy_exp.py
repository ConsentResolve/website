#!/usr/bin/env python3
"""Render all 16 experimental reels (gen_exp_reel), upload each to R2, build the
noindex review gallery public/exp-reels.html, commit + push. Reel 10's HeyGen
render is cached; the rest render fresh (~few min each)."""
import subprocess, sys, html
from pathlib import Path
ROOT = Path("/Users/aaronphillips/GIT/consentresolve2"); sys.path.insert(0, str(ROOT/"scripts"))
from reels_16 import REELS, CAST
PY = "/usr/bin/python3"
R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/exp"
def esc(s): return html.escape(str(s))
META = {  # format · risk (from the brief)
 "01":("Educational","med"),"02":("Promotional","low"),"03":("Objection-killer","med"),"04":("Funny","high"),
 "05":("Funny / absurd","high"),"06":("Edu / promo","med"),"07":("Educational","med"),"08":("Promo / funny","high"),
 "09":("Edu / funny","med"),"10":("Educational","low"),"11":("Promo / emotional","med"),"12":("Funny","med"),
 "13":("Promotional","med"),"14":("Trust / ASMR","high"),"15":("Edu / contrarian","high"),"16":("Funny / promo","high")}

ok, fail = [], []
for reel in REELS:
    print(f"=== render {reel} ===", flush=True)
    subprocess.run([PY, "scripts/gen_exp_reel.py", reel], cwd=str(ROOT))
    out = ROOT/f"public/reels/exp-{reel}.mp4"
    if out.exists() and out.stat().st_size > 200000:
        subprocess.run([PY, "scripts/r2_upload.py", str(out), f"social/exp/exp-{reel}.mp4", "video/mp4"], cwd=str(ROOT))
        ok.append(reel)
    else:
        fail.append(reel); print(f"!!! {reel} FAILED", flush=True)
print(f"RENDERED ok={len(ok)}/{len(REELS)} fails={fail}", flush=True)

cells = ""
for reel in REELS:
    if reel not in ok: continue
    title = REELS[reel]["title"]; persona = CAST[REELS[reel]["avatar"]][2]
    fmt, risk = META.get(reel, ("", ""))
    url = f"{R2}/exp-{reel}.mp4?v=2"
    cells += (f'<div class="cell"><div class="hd">#{reel} · {esc(title)}</div>'
              f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
              f'<div class="mt">{esc(persona)} · {esc(fmt)} · <span class="r r-{risk}">{esc(risk)} risk</span></div></div>')
CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 22px 8px;text-align:center}h1{margin:0;font-size:23px}header p{color:#94a3b8;margin:6px 0 0;font-size:13px}
.wrap{max-width:1180px;margin:0 auto;padding:10px 20px 60px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
.cell{background:#0e1d33;border:1px solid #1e293b;border-radius:14px;padding:12px}
.hd{font-size:14px;font-weight:700;color:#fff;margin-bottom:8px}
.v{width:100%;aspect-ratio:9/16;border-radius:10px;background:#000;display:block}
.mt{margin-top:8px;font-size:12px;color:#94a3b8}
.r{font-weight:700}.r-low{color:#00e5a0}.r-med{color:#fbbf24}.r-high{color:#ff8d8d}"""
doc = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       f'<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — 16 experimental reels</title><style>{CSS}</style></head><body>'
       f'<header><h1>16 experimental reels — round one</h1><p>Brand-style assets · Avatar IV · float · karaoke · -14 LUFS · /demo. Varied swings — ship all, read the data.</p></header>'
       f'<div class="wrap">{cells}</div></body></html>')
(ROOT/"public/exp-reels.html").write_text(doc)
print("wrote public/exp-reels.html", flush=True)
subprocess.run(["git", "add", "public/exp-reels.html", "scripts/deploy_exp.py"], cwd=str(ROOT))
subprocess.run(["git", "commit", "-q", "-m", f"Experimental reels: render+upload all 16, review gallery (exp-reels.html)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"], cwd=str(ROOT))
p = subprocess.run(["git", "push", "origin", "main"], cwd=str(ROOT), capture_output=True, text=True)
print("PUSH:", (p.stdout+p.stderr).strip()[-160:], flush=True)
print("=== deploy_exp done ===", flush=True)
