#!/usr/bin/env python3
"""Deployed review gallery + catalog for the full sprint (locked style).
Sections: UGC hook matrix (10 angles x 3) · non-UGC hook matrix (4 x 3) ·
Leah office-manager set · persona showcase. Plays from R2.
"""
import json, html
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from reel_hooks import UGC, NONUGC

R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/sprint"
ARCH = [("stat", "Stat / pattern-interrupt"), ("confession", "Confession / rage"), ("contrarian", "Contrarian / reframe")]
def esc(s): return html.escape(s)
PERSONA = {a: p for a, p, h in UGC}

catalog = []
def trio(angle, hooks, who, prefix=""):
    cells = ""
    for arch, label in ARCH:
        name = f"{prefix}{angle}-{arch}"; url = f"{R2}/{name}.mp4"; hook = hooks[arch]
        catalog.append({"name": name, "angle": angle, "arch": arch, "persona": who, "hook": hook, "url": url})
        cells += (f'<div class="cell"><div class="ar">{label}</div>'
                  f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
                  f'<div class="hk">{esc(hook)}</div></div>')
    return f'<div class="angle"><div class="ah">{esc(angle)} <span>· {esc(who)}</span></div><div class="trio">{cells}</div></div>'

ugc_rows = "".join(trio(a, h, PERSONA[a]) for a, _p, h in UGC)
non_rows = "".join(trio(a, h, "brand-animated", prefix="nonugc-") for a, h in NONUGC)

LEAH = [("roofing", "Front desk · the 98% leak"), ("speed", "Front desk · speed-to-lead"),
        ("ghost", "Kitchen · done chasing dead numbers"), ("consent", "Home office · consent-first vs creepy"),
        ("cost", "Car · the per-booked-job math")]
leah_cells = ""
for slug, desc in LEAH:
    url = f"{R2}/leah-{slug}.mp4"; catalog.append({"name": f"leah-{slug}", "persona": "leah", "hook": desc, "url": url})
    leah_cells += (f'<div class="cell"><div class="ar">{esc(slug)}</div>'
                   f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
                   f'<div class="hk">{esc(desc)}</div></div>')
leah_row = f'<div class="angle"><div class="ah">leah <span>· office manager (her own scripts)</span></div><div class="trio">{leah_cells}</div></div>'

SHOW = [("realjason-styled", "Jason · truck · lead-spend math"), ("realtyler-styled", "Tyler · lawn · the 98%"),
        ("realaaron-styled", "Aaron · office · $7.2M FTC")]
show_cells = ""
for slug, desc in SHOW:
    url = f"{R2}/{slug}.mp4"; catalog.append({"name": slug, "persona": slug.split('-')[0], "hook": desc, "url": url})
    show_cells += (f'<div class="cell"><div class="ar">{esc(slug.replace("real","").replace("-styled",""))}</div>'
                   f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
                   f'<div class="hk">{esc(desc)}</div></div>')
show_row = f'<div class="angle"><div class="ah">showcase <span>· full single-take pieces</span></div><div class="trio">{show_cells}</div></div>'

(ROOT / "social/sprint-catalog.json").write_text(json.dumps(catalog, indent=2))

CSS = """
*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 24px 6px;text-align:center}h1{margin:0;font-size:24px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
.wrap{max-width:1200px;margin:0 auto;padding:8px 22px 50px}
h2.sec{margin:34px 0 4px;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#00e5a0;border-top:1px solid #16233a;padding-top:18px}
.angle{margin:18px 0}
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
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — sprint review</title>
<style>{CSS}</style></head><body>
<header><h1>Sprint review — {len(catalog)} reels</h1>
<p>Locked style (Avatar IV · real voices · float · karaoke captions · -14 LUFS). Pick the winners worth scaling on paid.</p></header>
<div class="wrap">
  <h2 class="sec">UGC hook matrix — 10 angles × 3 ({len(UGC)*3})</h2>{ugc_rows}
  <h2 class="sec">Non-UGC hook matrix — 4 angles × 3 ({len(NONUGC)*3})</h2>{non_rows}
  <h2 class="sec">Leah — office-manager set ({len(LEAH)})</h2>{leah_row}
  <h2 class="sec">Showcase — full single-take ({len(SHOW)})</h2>{show_row}
</div></body></html>"""
(ROOT / "public/sprint.html").write_text(HTML)
print(f"wrote public/sprint.html + sprint-catalog.json — {len(catalog)} reels")
