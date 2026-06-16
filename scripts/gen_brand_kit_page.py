#!/usr/bin/env python3
"""Deployed brand-assets page (noindex): preview + view/download every FB/IG
brand graphic (cover, profile, pinned, highlight cover set) from R2.
Output: public/brand-kit.html"""
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/brand"

SECTIONS = [
 ("Page graphics", [
   ("Cover photo", "fb-cover.png", "1640×624 · FB cover"),
   ("Profile picture", "fb-profile.png", "500×500 · circle-safe"),
   ("Pinned / featured", "fb-pinned.png", "1200×630 · the 98% hook"),
 ]),
 ("Highlight cover set", [
   ("See the demo", "fb-highlight-demo.png", "1080×1920 · ▶"),
   ("How it works", "fb-highlight-how.png", "1080×1920 · 1·2·3"),
   ("$7 a lead", "fb-highlight-pricing.png", "1080×1920 · $7"),
   ("The proof", "fb-highlight-proof.png", "1080×1920 · $7.2M"),
   ("Own your traffic", "fb-highlight-own.png", "1080×1920 · ✓"),
 ]),
]

def card(title, file, note, tall):
    url = f"{R2}/{file}"
    ar = "9/16" if tall else "auto"
    return (f'<div class="c"><div class="t">{title}</div><div class="n">{note}</div>'
            f'<a href="{url}" target="_blank" rel="noopener"><img src="{url}" style="aspect-ratio:{ar}"></a>'
            f'<div class="row"><a class="btn" href="{url}" download="{file}">Download</a>'
            f'<a class="btn ghost" href="{url}" target="_blank" rel="noopener">Open</a></div></div>')

body = ""
for sec, items in SECTIONS:
    tall = sec.startswith("Highlight")
    cells = "".join(card(t, f, n, tall) for t, f, n in items)
    body += f'<h2>{sec}</h2><div class="grid {"tall" if tall else ""}">{cells}</div>'

CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 24px 4px;text-align:center}h1{margin:0;font-size:24px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
.wrap{max-width:1100px;margin:0 auto;padding:8px 22px 60px}
h2{margin:30px 0 10px;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#00e5a0;border-top:1px solid #16233a;padding-top:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.grid.tall{grid-template-columns:repeat(auto-fill,minmax(180px,1fr))}
.c{background:#0e1d33;border:1px solid #1e293b;border-radius:14px;padding:12px}
.t{font-weight:700;font-size:14px;color:#fff}.n{color:#64748b;font-size:12px;margin:2px 0 8px}
.c img{width:100%;border-radius:9px;background:#000;display:block;object-fit:cover}
.row{display:flex;gap:8px;margin-top:10px}
.btn{flex:1;text-align:center;background:#00e5a0;color:#06281f;text-decoration:none;border-radius:8px;padding:8px 10px;font-size:13px;font-weight:700}
.btn.ghost{background:#16233a;color:#cbd5e1}
.tip{color:#64748b;font-size:12px;margin-top:10px}"""

HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — brand assets</title>
<style>{CSS}</style></head><body>
<header><h1>Brand assets — Facebook / Instagram</h1>
<p>On-brand with the reels. Tap a thumbnail to open full size, or Download.</p></header>
<div class="wrap">{body}
<p class="tip">If Download opens the image instead of saving (cross-origin), right-click → Save image, or long-press on mobile → Save.</p>
</div></body></html>"""
out = ROOT / "public/brand-kit.html"; out.write_text(HTML)
print("wrote", out)
