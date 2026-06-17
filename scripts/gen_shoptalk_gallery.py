#!/usr/bin/env python3
"""public/shop-talk.html (noindex) — review gallery for the SHOP TALK with AA-Ron
library. Grouped by category, cover-poster thumbnails, per-video note box + Delete
(server-persisted via /api/feedback + /api/queue, same as the sprint page). Only
lists reels whose file exists in public/reels/."""
import html
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/"scripts"))
from shop_talk_lines import LINES, DELETED
R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/shoptalk"
def esc(s): return html.escape(s)
CATS = [("trade", "Trade & home"), ("mktg", "Marketing, lead-gen & privacy"), ("anec", "First-person anecdotes")]
FB = ('<button class="fbtn">＋ Add note</button>'
      '<div class="fb" hidden><textarea class="fbi" placeholder="Notes on this one?"></textarea>'
      '<button class="fsave">Save</button> <span class="fok"></span></div>')
DEL = ('<div class="acts"><button class="del">🗑 Delete</button></div>'
       '<div class="qbar">🗑 Queued · <button class="undo">Undo</button></div>')

present = [l for l in LINES if l["id"] not in DELETED and (ROOT/f"public/reels/shoptalk-{l['id']}.mp4").exists()]
sections = ""
for key, label in CATS:
    items = [l for l in present if l["cat"] == key]
    if not items: continue
    cells = ""
    for l in items:
        n = f"shoptalk-{l['id']}"
        cells += (f'<div class="cell" data-name="{n}"><div class="ar">#{l["id"]}</div>'
                  f'<video class="v" src="{R2}/{n}.mp4?v=4" poster="{R2}/{n}-cover.png?v=4" controls preload="none" playsinline></video>'
                  f'<div class="hk">{esc(l["text"])}</div>{FB}{DEL}</div>')
    sections += f'<h2 class="sec">{esc(label)} ({len(items)})</h2><div class="grid">{cells}</div>'

CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 22px 8px;text-align:center}h1{margin:0;font-size:23px}header p{color:#94a3b8;margin:6px 0 0;font-size:13px}
#rev{background:#0e1d33;color:#f5f8fa;border:1px solid #1e293b;border-radius:8px;padding:8px 13px;font-size:14px;margin-top:10px;width:320px;max-width:90%}
h2.sec{margin:30px 22px 4px;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#00e5a0;border-top:1px solid #16233a;padding-top:16px;max-width:1180px;margin-left:auto;margin-right:auto}
.grid{max-width:1180px;margin:0 auto;padding:6px 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.cell{background:#0e1d33;border:1px solid #1e293b;border-radius:14px;padding:12px}
.ar{font-size:11px;font-weight:700;letter-spacing:.08em;color:#00e5a0;margin-bottom:8px}
.v{width:100%;aspect-ratio:9/16;border-radius:10px;background:#000;display:block}
.hk{margin-top:8px;font-size:13px;line-height:1.45;color:#cbd5e1}
.fbtn{margin-top:8px;background:#16233a;color:#cbd5e1;border:1px solid #1e293b;border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer}
.fb{margin-top:8px}.fbi{width:100%;min-height:56px;background:#0a1628;color:#f5f8fa;border:1px solid #1e293b;border-radius:8px;padding:8px;font-size:13px;font-family:inherit}
.fsave{margin-top:6px;background:#00e5a0;color:#06281f;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}.fok{color:#00e5a0;font-size:12px;margin-left:6px}
.acts{margin-top:8px}.del{background:#2a1620;color:#ff8d8d;border:1px solid #4a2230;border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer}
.qbar{display:none;margin-top:6px;align-items:center;gap:8px;color:#ff8d8d;font-size:13px}.undo{background:#16233a;color:#cbd5e1;border:1px solid #1e293b;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer}
.cell.queued{opacity:.5;border-style:dashed}.cell.queued .v,.cell.queued .hk,.cell.queued .fbtn,.cell.queued .fb,.cell.queued .acts,.cell.queued .ar{display:none}.cell.queued .qbar{display:flex}"""
JS = """
const rev=document.getElementById('rev');try{if(localStorage.crRev)rev.value=localStorage.crRev;}catch(e){}
rev&&rev.addEventListener('input',()=>{try{localStorage.crRev=rev.value;}catch(e){}});
document.querySelectorAll('.fbtn').forEach(b=>b.onclick=()=>{const f=b.nextElementSibling;f.hidden=!f.hidden;});
document.querySelectorAll('.fsave').forEach(b=>b.onclick=async()=>{const c=b.closest('.cell'),ta=c.querySelector('.fbi'),ok=c.querySelector('.fok');const note=ta.value.trim();if(!note){ok.textContent='write something';return;}b.disabled=true;try{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({video:c.dataset.name,note,author:(rev&&rev.value)||''})});if(!r.ok)throw 0;ok.textContent='saved ✓';ta.value='';}catch(e){ok.textContent='failed';}b.disabled=false;});
function q(n,a){return fetch('/api/queue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,action:a,author:(rev&&rev.value)||''})});}
document.querySelectorAll('.del').forEach(b=>b.onclick=async()=>{const c=b.closest('.cell');b.disabled=true;try{await q(c.dataset.name,'delete');c.classList.add('queued');}catch(e){alert('try again');}b.disabled=false;});
document.querySelectorAll('.undo').forEach(b=>b.onclick=async()=>{const c=b.closest('.cell');try{await q(c.dataset.name,'restore');c.classList.remove('queued');}catch(e){}});
(async()=>{try{const j=await(await fetch('/api/queue')).json();(j.queued||[]).forEach(n=>{const c=document.querySelector('[data-name="'+(window.CSS&&CSS.escape?CSS.escape(n):n)+'"]');if(c)c.classList.add('queued');});}catch(e){}})();
"""
HTML = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<meta name="robots" content="noindex,nofollow"><title>SHOP TALK with AA-Ron — review</title><style>{CSS}</style></head><body>'
        f'<header><h1>SHOP TALK with AA-Ron — {len(present)} reels</h1>'
        f'<p>Deadpan trade humor · cover + hook + bit + outro · pick your openers. Tap ＋ Add note or 🗑 Delete (both persist).</p>'
        f'<p><input id="rev" placeholder="Your name (so notes are attributed)"></p></header>'
        f'{sections}<div id="pv"></div><script>{JS}</script></body></html>')
(ROOT/"public/shop-talk.html").write_text(HTML)
print(f"wrote public/shop-talk.html — {len(present)} reels", flush=True)
