#!/usr/bin/env python3
"""Generate public/calendar.html — a deployed, phone-frame content-calendar
preview of social/schedule.json. Pulls the real reels from R2 (public URLs).
Static (no build deps); regenerate whenever the schedule changes:
    python3 scripts/gen_calendar.py
Served at https://consentresolve.com/calendar.html (noindex).
"""
import json, datetime, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHED = json.loads((ROOT / "social/schedule.json").read_text())
R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"
PLAT = {"tk": ("TikTok", "#69C9D0"), "ig": ("Instagram", "#E1306C"), "fb": ("Facebook", "#1877F2"),
        "yt": ("YouTube", "#FF0000"), "li": ("LinkedIn", "#0A66C2")}

def vurl(angle, kind):
    return f"{R2}/social/nonugc/{angle}.mp4" if kind == "nonugc" else f"{R2}/social/{angle}.mp4"

cards = []
for date in sorted(SCHED):
    d = datetime.date.fromisoformat(date)
    label = d.strftime("%a · %b %-d")
    for it in SCHED[date]:
        angle, kind = it["angle"], it.get("kind", "ugc")
        plats = it["platforms"] + (["ig-story"] if it.get("story") else [])
        chips = "".join(
            f'<span class="chip" style="--c:{PLAT[p][1]}">{PLAT[p][0]}</span>'
            for p in it["platforms"] if p in PLAT)
        if it.get("story"): chips += '<span class="chip" style="--c:#E1306C">IG Story</span>'
        kindbadge = f'<span class="kind {kind}">{"non-UGC" if kind=="nonugc" else "UGC"}</span>'
        cap = html.escape(it["caption"]).replace("\n", "<br>")
        platattr = " ".join(it["platforms"])
        cards.append(f"""
        <div class="card" data-plat="{platattr}">
          <div class="meta"><div class="date">{label}</div>{kindbadge}</div>
          <div class="phone"><video src="{vurl(angle,kind)}" preload="metadata" controls playsinline></video></div>
          <div class="chips">{chips}</div>
          <div class="angle">{angle}</div>
          <div class="cap">{cap}</div>
        </div>""")

filters = "".join(f'<button class="f" data-f="{k}">{v[0]}</button>' for k, v in PLAT.items())
HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — Content Calendar</title>
<style>
:root{{--navy:#0a1628;--navy2:#0d1b2a;--mint:#00e5a0;--paper:#f5f8fa;--slate:#94a3b8;}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--navy);color:var(--paper);font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}}
header{{padding:28px 24px 8px;text-align:center}}
header h1{{margin:0;font-size:26px}}header p{{color:var(--slate);margin:6px 0 0;font-size:14px}}
.filters{{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:16px}}
.f{{background:var(--navy2);color:var(--paper);border:1px solid #1e293b;border-radius:999px;padding:7px 14px;font-size:13px;cursor:pointer}}
.f.active{{background:var(--mint);color:var(--navy);border-color:var(--mint);font-weight:700}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px;padding:8px 24px 60px;max-width:1400px;margin:0 auto}}
.card{{background:var(--navy2);border:1px solid #16233a;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:10px}}
.meta{{display:flex;justify-content:space-between;align-items:center}}
.date{{font-weight:700;font-size:14px}}
.kind{{font-size:11px;padding:3px 9px;border-radius:999px;font-weight:700}}
.kind.nonugc{{background:rgba(0,229,160,.15);color:var(--mint)}}.kind.ugc{{background:rgba(148,163,184,.18);color:var(--slate)}}
.phone{{width:100%;max-width:230px;aspect-ratio:9/16;margin:0 auto;border-radius:26px;border:7px solid #14233c;background:#000;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.4)}}
.phone video{{width:100%;height:100%;object-fit:cover;display:block}}
.chips{{display:flex;gap:6px;flex-wrap:wrap}}
.chip{{font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--c);color:var(--c)}}
.angle{{font-size:12px;color:var(--slate);text-transform:uppercase;letter-spacing:.08em}}
.cap{{font-size:13px;line-height:1.45;color:#dbe4ea}}
</style></head><body>
<header><h1>Consent Resolve — 45-Day Content Calendar</h1>
<p>{len(cards)} scheduled posts · live preview from R2 · click any reel to play</p></header>
<div class="filters"><button class="f active" data-f="all">All</button>{filters}</div>
<div class="grid">{''.join(cards)}</div>
<script>
const btns=[...document.querySelectorAll('.f')],cards=[...document.querySelectorAll('.card')];
btns.forEach(b=>b.onclick=()=>{{btns.forEach(x=>x.classList.remove('active'));b.classList.add('active');
const f=b.dataset.f;cards.forEach(c=>c.style.display=(f==='all'||c.dataset.plat.split(' ').includes(f))?'':'none');}});
</script></body></html>"""

out = ROOT / "public/calendar.html"
out.write_text(HTML)
print(f"wrote {out} — {len(cards)} posts")
