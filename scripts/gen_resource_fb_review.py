#!/usr/bin/env python3
"""Render public/resource-fb.html (noindex) — a chronological review of the
resource-center Facebook drip (social/resource-cards.json) so the schedule can be
eyeballed before CARDS_AUTOPOST is turned on. Shows each post's date, Recraft
image, caption, and link, grouped by month."""
import json, html, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
def esc(s): return html.escape(s or "")
sched = json.loads((ROOT / "social/resource-cards.json").read_text())
brand = json.loads((ROOT / "social/cards.json").read_text()) if (ROOT / "social/cards.json").exists() else {}

rows = sorted(sched.items())
by_month = {}
for date, p in rows:
    m = date[:7]; by_month.setdefault(m, []).append((date, p))

cells = ""
for m in sorted(by_month):
    mname = datetime.date.fromisoformat(m + "-01").strftime("%B %Y")
    items = by_month[m]
    cards = ""
    for date, p in items:
        wd = datetime.date.fromisoformat(date).strftime("%a")
        img = p["images"][0]
        cap = esc(p["caption"]).replace("\n", "<br>")
        cards += (f'<div class="cell"><div class="dt">{date} · {wd}</div>'
                  f'<img class="im" src="{esc(img)}" loading="lazy">'
                  f'<div class="cap">{cap}</div>'
                  f'<a class="lk" href="{esc(p["link"])}" target="_blank" rel="noopener">{esc(p["title"])} →</a></div>')
    cells += f'<h2 class="mo">{esc(mname)} <span>· {len(items)} posts</span></h2><div class="grid">{cards}</div>'

CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 24px 8px;text-align:center}h1{margin:0;font-size:24px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
.wrap{max-width:1200px;margin:0 auto;padding:8px 22px 60px}
h2.mo{margin:30px 0 6px;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#00e5a0;border-top:1px solid #16233a;padding-top:16px}
h2.mo span{color:#64748b;font-weight:500;text-transform:none;letter-spacing:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.cell{background:#0e1d33;border:1px solid #1e293b;border-radius:14px;padding:12px}
.dt{font-size:12px;font-weight:700;letter-spacing:.04em;color:#00e5a0;margin-bottom:8px}
.im{width:100%;border-radius:10px;background:#000;display:block;aspect-ratio:1200/630;object-fit:cover}
.cap{margin-top:10px;font-size:13px;line-height:1.5;color:#cbd5e1}
.lk{display:inline-block;margin-top:10px;font-size:12px;color:#7dd3fc;text-decoration:none}
"""
HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — Resource FB drip review</title>
<style>{CSS}</style></head><body>
<header><h1>Resource Center — Facebook drip ({len(rows)} posts)</h1>
<p>Recraft-illustrated posts, ~3/week (Tue/Thu/Sun) after the brand-card run ends. {rows[0][0]} → {rows[-1][0]}.</p>
<p style="color:#64748b;font-size:12px">Review only — nothing posts until CARDS_AUTOPOST is enabled. Brand cards keep their dates; these fill the open days.</p></header>
<div class="wrap">{cells}</div></body></html>"""
(ROOT / "public/resource-fb.html").write_text(HTML)
print(f"wrote public/resource-fb.html — {len(rows)} posts across {len(by_month)} months")
