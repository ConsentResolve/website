#!/usr/bin/env python3
"""public/fb-calendar.html (noindex) — SOCIAL activity calendar across ALL platforms
(TikTok · YouTube · Instagram · Facebook · X · Google Business). Month grid, text
cells with per-entry platform chips, hover preview, and a platform FILTER BAR at the
top. Sources: social/schedule.json (reels + stories, per-platform), social/cards.json
(FB brand cards), social/resource-cards.json (resource drip → FB/X/Google). Pure
review surface — reflects the schedule, posts nothing."""
import json, html, calendar as cal, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
def esc(s): return html.escape(str(s or ""), quote=True)
def load(n):
    p = ROOT / "social" / n
    return json.loads(p.read_text()) if p.exists() else {}

sched, cards, rcards = load("schedule.json"), load("cards.json"), load("resource-cards.json")
# platform key -> (label, accent color, 2-letter chip)
PLAT = {
    "tk": ("TikTok", "#fe2c55", "TT"), "yt": ("YouTube", "#ff4e45", "YT"),
    "ig": ("Instagram", "#e1306c", "IG"), "fb": ("Facebook", "#1877f2", "FB"),
    "x": ("X", "#9fb3c8", "X"), "gbp": ("Google", "#34a853", "GB"),
}
TYPES = {"Reel": "🎬", "Story": "📖", "Post": "🖼", "Carousel": "🎠"}

events = {}  # date -> [ {type,label,caption,plats,img,link} ]
def add(date, typ, label, caption, plats, img="", link=""):
    events.setdefault(date, []).append({"type": typ, "label": label, "caption": caption,
        "plats": [p for p in plats if p in PLAT], "img": img, "link": link})

# 1) Reels / Stories — every platform the reel targets
for date, items in sched.items():
    for it in items:
        typ = "Story" if it.get("story") else "Reel"
        add(date, typ, it.get("name", "reel"), it.get("caption", ""), list(it.get("platforms") or []))
# 2) Brand cards → Facebook
for date, it in cards.items():
    fmt = it.get("format", "photo"); typ = {"photo": "Post", "carousel": "Carousel", "story": "Story"}.get(fmt, "Post")
    label = (it.get("caption", "")[:38] or "Story").strip() or "Story"
    add(date, typ, label, it.get("caption", "") or "Story reshare", ["fb"], (it.get("images") or [""])[0], it.get("link", ""))
# 3) Resource-center drip → Facebook + X + Google (written track)
for date, it in rcards.items():
    add(date, "Post", it.get("title", "Resource post"), it.get("caption", ""), ["fb", "x", "gbp"], (it.get("images") or [""])[0], it.get("link", ""))

dates = sorted(events)
total = sum(len(v) for v in events.values())
plat_counts = {k: 0 for k in PLAT}
for v in events.values():
    for e in v:
        for p in e["plats"]:
            plat_counts[p] += 1

def chips(plats):
    return "".join(f'<span class="pc" style="--c:{PLAT[p][1]}">{PLAT[p][2]}</span>' for p in plats)
def ev_html(e):
    icon = TYPES.get(e["type"], "•")
    return (f'<a class="ev" data-plats="{" ".join(e["plats"])}" data-type="{esc(e["type"])}" '
            f'data-label="{esc(e["label"])}" data-cap="{esc(e["caption"])}" data-img="{esc(e["img"])}" data-link="{esc(e["link"])}">'
            f'<span class="evl">{icon} {esc(e["label"][:22])}</span><span class="pcs">{chips(e["plats"])}</span></a>')

first = datetime.date.fromisoformat(dates[0]).replace(day=1)
last = datetime.date.fromisoformat(dates[-1]).replace(day=1)
c = cal.Calendar(firstweekday=6); WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
months_html, m = "", first
while m <= last:
    weeks = c.monthdayscalendar(m.year, m.month)
    head = "".join(f"<div class='wd'>{w}</div>" for w in WD)
    cells = ""
    for week in weeks:
        for day in week:
            if day == 0:
                cells += "<div class='cell out'></div>"; continue
            ds = f"{m.year:04d}-{m.month:02d}-{day:02d}"
            evs = "".join(ev_html(e) for e in events.get(ds, []))
            cells += f"<div class='cell' data-date='{ds}'><div class='dn'>{day}</div>{evs}</div>"
    months_html += (f"<section class='month' data-mo='{m.strftime('%Y-%m')}'>"
                    f"<h2>{m.strftime('%B %Y')}</h2>"
                    f"<div class='grid'><div class='wdrow'>{head}</div>{cells}</div></section>")
    m = (m.replace(day=28) + datetime.timedelta(days=7)).replace(day=1)

fbtns = f'<button class="fl active" data-f="all">All ({total})</button>'
fbtns += "".join(f'<button class="fl" data-f="{k}" style="--c:{PLAT[k][1]}">{PLAT[k][0]} ({plat_counts[k]})</button>' for k in PLAT)

CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:22px 22px 6px;text-align:center}h1{margin:0;font-size:23px}header p{color:#94a3b8;margin:6px 0 0;font-size:13px}
.filters{position:sticky;top:0;z-index:40;background:#0a1628;border-bottom:1px solid #16233a;padding:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.fl{background:#0e1d33;color:#cbd5e1;border:1px solid #1e293b;border-radius:20px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer}
.fl:hover{border-color:#33455e}
.fl.active{background:var(--c,#00e5a0);color:#06121f;border-color:transparent}
.wrap{max-width:1120px;margin:0 auto;padding:6px 18px 60px}
.month{margin:24px 0}.month h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:#fff;margin:0 0 10px;border-top:1px solid #16233a;padding-top:14px}
.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.wdrow{display:contents}.wd{text-align:center;font-size:11px;color:#64748b;padding:4px 0;text-transform:uppercase;letter-spacing:.08em}
.cell{min-height:92px;background:#0e1d33;border:1px solid #16233a;border-radius:8px;padding:5px 5px 7px}
.cell.out{background:transparent;border:none}.cell.empty{opacity:.35}
.dn{font-size:11px;color:#64748b;margin-bottom:4px}
.ev{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:11px;line-height:1.3;padding:3px 6px;margin:3px 0;border-radius:5px;cursor:pointer;text-decoration:none;border:1px solid #1e2c40;background:#0c1a2c;color:#cbd5e1}
.ev:hover{border-color:#33455e}
.evl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcs{display:flex;gap:2px;flex-shrink:0}
.pc{font-size:8.5px;font-weight:800;letter-spacing:.02em;color:#06121f;background:var(--c);border-radius:3px;padding:1px 3px;line-height:1.25}
#pv{display:none;position:absolute;z-index:50;width:320px;max-width:88vw;background:#0e1d33;border:1px solid #29384f;border-radius:12px;padding:13px;box-shadow:0 18px 50px rgba(0,0,0,.6);pointer-events:none}
#pv .t{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px}
#pv .h{font-size:14px;font-weight:700;color:#fff;margin-bottom:8px}
#pv img{width:100%;border-radius:8px;display:block;margin-bottom:8px;background:#000}
#pv .c{font-size:12.5px;line-height:1.5;color:#cbd5e1;white-space:pre-wrap}
@media(max-width:680px){.cell{min-height:64px}.ev{font-size:10px}.pc{display:none}}
"""
JS = """
const pv=document.getElementById('pv'), evs=[...document.querySelectorAll('.ev')];
function show(e){const d=e.dataset;
  pv.innerHTML='<div class="t">'+d.type+' · '+e.closest('.cell').querySelector('.dn').textContent+'</div>'
    +'<div class="h">'+d.label+'</div>'+(d.img?'<img loading="lazy" src="'+d.img+'">':'')
    +'<div class="c">'+(d.cap||'(no caption)')+(d.link?'\\n\\n🔗 '+d.link:'')+'</div>';
  pv.style.display='block';
  const r=e.getBoundingClientRect(),pw=320; let left=r.left+scrollX;
  if(left+pw>scrollX+document.documentElement.clientWidth-10) left=scrollX+document.documentElement.clientWidth-pw-10;
  pv.style.left=Math.max(scrollX+8,left)+'px'; pv.style.top=(r.bottom+scrollY+6)+'px';}
evs.forEach(e=>{e.addEventListener('mouseenter',()=>show(e));e.addEventListener('mouseleave',()=>pv.style.display='none');});
document.querySelectorAll('.fl').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.fl').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  const f=b.dataset.f;
  evs.forEach(e=>{e.style.display=(f==='all'||e.dataset.plats.split(' ').includes(f))?'':'none';});
  document.querySelectorAll('.cell[data-date]').forEach(c=>{
    c.classList.toggle('empty', ![...c.querySelectorAll('.ev')].some(e=>e.style.display!=='none'));});
  document.querySelectorAll('.month').forEach(mo=>{
    mo.style.display=[...mo.querySelectorAll('.ev')].some(e=>e.style.display!=='none')?'':'none';});
});
"""
HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — social activity calendar</title>
<style>{CSS}</style></head><body>
<header><h1>Social activity calendar</h1>
<p>{total} scheduled items · {dates[0]} → {dates[-1]} · filter by platform, hover any entry for a preview</p></header>
<div class="filters">{fbtns}</div>
<div class="wrap">{months_html}</div>
<div id="pv"></div>
<script>{JS}</script></body></html>"""
(ROOT / "public/fb-calendar.html").write_text(HTML)
print(f"wrote public/fb-calendar.html — {total} items across all platforms, {dates[0]}→{dates[-1]}")
print("per-platform:", plat_counts)
