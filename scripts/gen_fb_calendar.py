#!/usr/bin/env python3
"""public/fb-calendar.html (noindex) — a real month-grid calendar of ALL Facebook
activity: Reels + Stories (from social/schedule.json), Posts/Carousels/Stories
(social/cards.json), and the resource-center Post drip (social/resource-cards.json).
Text-only cells; hovering an entry shows a quick modal preview (type, caption, and
the image where there is one). Pure review surface — reflects the schedule, posts
nothing."""
import json, html, calendar as cal, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
def esc(s): return html.escape(str(s or ""), quote=True)
def load(n):
    p = ROOT / "social" / n
    return json.loads(p.read_text()) if p.exists() else {}

sched, cards, rcards = load("schedule.json"), load("cards.json"), load("resource-cards.json")
TYPES = {  # type -> (icon, css class)
    "Reel": ("🎬", "reel"), "Story": ("📖", "story"), "Post": ("🖼", "post"), "Carousel": ("🎠", "carousel"),
}
events = {}  # date -> [ {type,label,caption,img,link} ]
def add(date, typ, label, caption, img="", link=""):
    events.setdefault(date, []).append({"type": typ, "label": label, "caption": caption, "img": img, "link": link})

# 1) Reels / Stories from the organic video schedule (FB-targeted only)
for date, items in sched.items():
    for it in items:
        if "fb" not in (it.get("platforms") or []): continue
        typ = "Story" if it.get("story") else "Reel"
        add(date, typ, it.get("name", "reel"), it.get("caption", ""))
# 2) Brand cards (photo / carousel / story)
for date, it in cards.items():
    fmt = it.get("format", "photo"); typ = {"photo": "Post", "carousel": "Carousel", "story": "Story"}.get(fmt, "Post")
    cap = it.get("caption", "") or "Story reshare"
    label = (it.get("caption", "")[:38] or "Story").strip() or "Story"
    add(date, typ, label, cap, (it.get("images") or [""])[0], it.get("link", ""))
# 3) Resource-center post drip
for date, it in rcards.items():
    add(date, "Post", it.get("title", "Resource post"), it.get("caption", ""), (it.get("images") or [""])[0], it.get("link", ""))

# ── render month grids ───────────────────────────────────────────────────────
dates = sorted(events)
first = datetime.date.fromisoformat(dates[0]).replace(day=1)
last = datetime.date.fromisoformat(dates[-1]).replace(day=1)
c = cal.Calendar(firstweekday=6)  # Sunday-first
WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

def ev_html(e):
    icon, klass = TYPES.get(e["type"], ("•", "post"))
    return (f'<a class="ev ev-{klass}" data-type="{esc(e["type"])}" data-label="{esc(e["label"])}" '
            f'data-cap="{esc(e["caption"])}" data-img="{esc(e["img"])}" data-link="{esc(e["link"])}">'
            f'{icon} {esc(e["label"][:26])}</a>')

months_html = ""
m = first
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
            cells += f"<div class='cell'><div class='dn'>{day}</div>{evs}</div>"
    months_html += (f"<section class='month'><h2>{m.strftime('%B %Y')} "
                    f"<span>· {sum(1 for d in events if d.startswith(m.strftime('%Y-%m')))} active days</span></h2>"
                    f"<div class='grid'><div class='wdrow'>{head}</div>{cells}</div></section>")
    m = (m.replace(day=28) + datetime.timedelta(days=7)).replace(day=1)

total = sum(len(v) for v in events.values())
by_type = {t: sum(1 for v in events.values() for e in v if e["type"] == t) for t in TYPES}
legend = " ".join(f"<span class='lg lg-{TYPES[t][1]}'>{TYPES[t][0]} {t} ({by_type[t]})</span>" for t in TYPES)

CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:24px 22px 10px;text-align:center}h1{margin:0;font-size:23px}header p{color:#94a3b8;margin:6px 0 0;font-size:13px}
.legend{margin:10px 0 0;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;font-size:12px}
.lg{padding:3px 9px;border-radius:20px;border:1px solid #1e293b}
.lg-reel{color:#7dd3fc;border-color:#1e3a4a}.lg-story{color:#f0abfc;border-color:#3a1e3a}.lg-post{color:#00e5a0;border-color:#15402f}.lg-carousel{color:#fbbf24;border-color:#3a2e15}
.wrap{max-width:1100px;margin:0 auto;padding:6px 18px 60px}
.month{margin:26px 0}.month h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;color:#fff;margin:0 0 10px;border-top:1px solid #16233a;padding-top:14px}
.month h2 span{color:#64748b;font-weight:500;text-transform:none;letter-spacing:0;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.wdrow{display:contents}.wd{text-align:center;font-size:11px;color:#64748b;padding:4px 0;text-transform:uppercase;letter-spacing:.08em}
.cell{min-height:92px;background:#0e1d33;border:1px solid #16233a;border-radius:8px;padding:5px 5px 7px}
.cell.out{background:transparent;border:none}
.dn{font-size:11px;color:#64748b;margin-bottom:4px}
.ev{display:block;font-size:11px;line-height:1.3;padding:3px 6px;margin:3px 0;border-radius:5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none;border:1px solid transparent}
.ev-reel{background:#0c2230;color:#7dd3fc}.ev-story{background:#241026;color:#f0abfc}.ev-post{background:#06281f;color:#00e5a0}.ev-carousel{background:#2a2110;color:#fbbf24}
.ev:hover{border-color:currentColor}
#pv{display:none;position:absolute;z-index:50;width:320px;max-width:88vw;background:#0e1d33;border:1px solid #29384f;border-radius:12px;padding:13px;box-shadow:0 18px 50px rgba(0,0,0,.6);pointer-events:none}
#pv .t{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px}
#pv .h{font-size:14px;font-weight:700;color:#fff;margin-bottom:8px}
#pv img{width:100%;border-radius:8px;display:block;margin-bottom:8px;background:#000}
#pv .c{font-size:12.5px;line-height:1.5;color:#cbd5e1;white-space:pre-wrap}
@media(max-width:680px){.cell{min-height:64px}.ev{font-size:10px}}
"""
JS = """
const pv=document.getElementById('pv');
function show(e){
  const d=e.dataset;
  pv.innerHTML='<div class="t">'+d.type+' · '+e.closest('.cell').querySelector('.dn').textContent+'</div>'
    +'<div class="h">'+d.label+'</div>'
    +(d.img?'<img loading="lazy" src="'+d.img+'">':'')
    +'<div class="c">'+(d.cap||'(no caption)')+(d.link?'\\n\\n🔗 '+d.link:'')+'</div>';
  pv.style.display='block';
  const r=e.getBoundingClientRect(), pw=320;
  let left=r.left+window.scrollX; if(left+pw>window.scrollX+document.documentElement.clientWidth-10) left=window.scrollX+document.documentElement.clientWidth-pw-10;
  pv.style.left=Math.max(window.scrollX+8,left)+'px';
  let top=r.bottom+window.scrollY+6; pv.style.top=top+'px';
}
document.querySelectorAll('.ev').forEach(e=>{
  e.addEventListener('mouseenter',()=>show(e));
  e.addEventListener('mouseleave',()=>{pv.style.display='none';});
});
"""
HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — Facebook activity calendar</title>
<style>{CSS}</style></head><body>
<header><h1>Facebook activity calendar</h1>
<p>{total} scheduled items · {dates[0]} → {dates[-1]} · hover any entry for a preview</p>
<div class="legend">{legend}</div></header>
<div class="wrap">{months_html}</div>
<div id="pv"></div>
<script>{JS}</script></body></html>"""
(ROOT / "public/fb-calendar.html").write_text(HTML)
print(f"wrote public/fb-calendar.html — {total} items, {dates[0]}→{dates[-1]}, types={by_type}")
