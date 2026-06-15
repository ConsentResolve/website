#!/usr/bin/env python3
"""Deployed review gallery + catalog for the UGC hook-test sprint.

Reads the approved hooks (reel_hooks.UGC) and the per-angle casting
(video_scripts.job_for), points at the reels on R2 (social/sprint/<angle>-<arch>.mp4),
and writes:
  - public/sprint.html (noindex) — every angle's 3 hook variants, playable
  - social/sprint-catalog.json  — {name, angle, arch, persona, hook, url} for the
    3-sec-retention read-out after the sprint runs
"""
import json, html
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from reel_hooks import UGC
from video_scripts import job_for

R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/sprint"
ARCH = [("stat", "Stat / pattern-interrupt"), ("confession", "Confession / rage"), ("contrarian", "Contrarian / reframe")]
def esc(s): return html.escape(s)
def persona(angle):
    try: return job_for(angle)["look"].split("_")[0].title()
    except Exception: return ""

catalog, rows = [], ""
for angle, _p, hooks in UGC:
    who = persona(angle)
    cells = ""
    for arch, label in ARCH:
        name = f"{angle}-{arch}"; url = f"{R2}/{name}.mp4"; hook = hooks[arch]
        catalog.append({"name": name, "angle": angle, "arch": arch, "persona": who, "hook": hook, "url": url})
        cells += (f'<div class="cell"><div class="ar">{label}</div>'
                  f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
                  f'<div class="hk">{esc(hook)}</div></div>')
    rows += f'<div class="angle"><div class="ah">{esc(angle)} <span>· {esc(who)}</span></div><div class="trio">{cells}</div></div>'

(ROOT / "social/sprint-catalog.json").write_text(json.dumps(catalog, indent=2))

CSS = """
*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 24px 6px;text-align:center}h1{margin:0;font-size:24px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
.wrap{max-width:1200px;margin:0 auto;padding:8px 22px 50px}
.angle{margin:22px 0;border-top:1px solid #16233a;padding-top:16px}
.ah{font-size:15px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;margin-bottom:12px}
.ah span{color:#64748b;font-weight:500;text-transform:none}
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
@media(max-width:760px){.trio{grid-template-columns:1fr}}
.cell{background:#0e1d33;border:1px solid #1e293b;border-radius:14px;padding:12px}
.ar{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#00e5a0;margin-bottom:8px}
.v{width:100%;aspect-ratio:9/16;border-radius:10px;background:#000;display:block}
.hk{margin-top:8px;font-size:13px;line-height:1.45;color:#cbd5e1}
"""
HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — UGC hook sprint</title>
<style>{CSS}</style></head><body>
<header><h1>UGC hook sprint — {len(catalog)} reels</h1>
<p>10 angles × 3 hook variants (same body). Pick the openers worth scaling + promoting.</p></header>
<div class="wrap">{rows}</div></body></html>"""
(ROOT / "public/sprint.html").write_text(HTML)
print(f"wrote public/sprint.html + social/sprint-catalog.json — {len(catalog)} reels")
