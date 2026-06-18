#!/usr/bin/env python3
"""Deployed review gallery + catalog for the full sprint (locked style).
Sections: reframed UGC · leak experiments · non-UGC hook matrix · Leah set ·
brand music library · Originals (Jun 11–13 era) for review/prune. Plays from R2.
Every video card has a per-video note box and a Delete button that queues the
reel for deletion (server-persisted via /api/queue) and hides it on the page.
"""
import json, html
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from reel_hooks import UGC, NONUGC
from originals import ORIG_GROUPS

R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/sprint"
ARCH = [("stat", "Stat / pattern-interrupt"), ("confession", "Confession / rage"), ("contrarian", "Contrarian / reframe")]
def esc(s): return html.escape(s)
# Reels hard-deleted after review — omitted from the gallery + catalog entirely.
_DELFILE = ROOT / "social/deleted.json"
DELETED = set(json.loads(_DELFILE.read_text())) if _DELFILE.exists() else set()
PERSONA = {a: p for a, p, h in UGC}
FB = ('<button class="fbtn">＋ Add note</button>'
      '<div class="fb" hidden><textarea class="fbi" placeholder="What would make this video better?"></textarea>'
      '<button class="fsave">Save note</button> <span class="fok"></span></div>')
# Delete control + the collapsed "queued for deletion" bar (shown when .queued).
DEL = ('<div class="acts"><button class="del">🗑 Delete</button></div>'
       '<div class="qbar">🗑 Queued for deletion · <button class="undo">Undo</button></div>')

def vcell(name, ar, url, hook=""):
    """One video card: label, video, optional hook line, note box, delete control."""
    hk = f'<div class="hk">{esc(hook)}</div>' if hook else ""
    return (f'<div class="cell" data-name="{esc(name)}"><div class="ar">{esc(ar)}</div>'
            f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
            f'{hk}{FB}{DEL}</div>')

catalog = []
# Gallery-only caption overrides for the reframed leak experiments (does NOT touch
# reel_hooks, which still drives generation).
LEAK_LABELS = {
    "stat": "Visual disruption — '98 of 100 · GONE' cold-open → warm CR breakdown",
    "confession": "Verbal pattern interrupt — 'Your website isn't broken…'",
    "contrarian": "⚡ HAIL MARY — kinetic, no avatar: 98 visitors vanish, 2 survive",
}
def trio(angle, hooks, who, prefix=""):
    cells = ""
    for arch, label in ARCH:
        name = f"{prefix}{angle}-{arch}"; url = f"{R2}/{name}.mp4"; hook = hooks[arch]
        if name in DELETED: continue
        if angle == "leak" and not prefix: hook = LEAK_LABELS.get(arch, hook)
        catalog.append({"name": name, "angle": angle, "arch": arch, "persona": who, "hook": hook, "url": url})
        cells += vcell(name, label, url, hook)
    return f'<div class="angle"><div class="ah">{esc(angle)} <span>· {esc(who)}</span></div><div class="trio">{cells}</div></div>'

leak_hooks = next(h for a, _p, h in UGC if a == "leak")
# Hail Mary (contrarian) removed; leak experiments = stat + confession only
lk = ""
for arch, label in [("stat", "Stat / pattern-interrupt"), ("confession", "Confession / rage")]:
    name = f"leak-{arch}"; url = f"{R2}/{name}.mp4"; hook = LEAK_LABELS.get(arch, leak_hooks[arch])
    if name in DELETED: continue
    catalog.append({"name": name, "angle": "leak", "arch": arch, "persona": "Tyler", "hook": hook, "url": url})
    lk += vcell(name, label, url, hook)
leak_row = f'<div class="angle"><div class="ah">leak <span>· 2 hook mechanisms</span></div><div class="trio">{lk}</div></div>'
# Non-UGC (brand-animated) — 4 angles x 3 hooks, paths social/sprint/nonugc-<angle>-<arch>.mp4
non_rows = "".join(trio(a, h, "brand-animated", prefix="nonugc-") for a, h in NONUGC)

LEAH = [("roofing", "Front desk · the 98% leak"), ("speed", "Front desk · speed-to-lead"),
        ("ghost", "Kitchen · done chasing dead numbers"), ("consent", "Home office · consent-first vs creepy"),
        ("cost", "Car · the per-booked-job math")]
leah_cells = ""
for slug, desc in LEAH:
    if f"leah-{slug}" in DELETED: continue
    url = f"{R2}/leah-{slug}.mp4"; catalog.append({"name": f"leah-{slug}", "persona": "leah", "hook": desc, "url": url})
    leah_cells += vcell(f"leah-{slug}", slug, url, desc)
leah_row = f'<div class="angle"><div class="ah">leah <span>· office manager (her own scripts)</span></div><div class="trio">{leah_cells}</div></div>'

# Brand music library (20 tracks) — review/select, leave notes per track (no delete)
RM = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/music"
MUSIC_INST = [("CR1.mp3","CR1 (default)"),("inst-fp1.mp3","fp1"),("inst-money.mp3","money"),("inst-1920s.mp3","1920s"),
  ("inst-jingle.mp3","jingle"),("inst-solveit.mp3","solve it"),("int-new1.mp3","new 1"),("inst-new2.mp3","new 2"),
  ("inst-new3.mp3","new 3"),("inst-new4.mp3","new 4"),("inst-new5.mp3","new 5"),("inst-new6.mp3","new 6")]
MUSIC_VOC = [("voc-cr1c.mp3","CR1 vocal c"),("voc-cr1d.mp3","CR1 vocal d"),("voc-hiphop.mp3","hip-hop"),
  ("voc-sparks.mp3","sparks"),("pop-cr.mp3","pop"),("voc-jingle.mp3","jingle"),("voc-oneroof.mp3","one roof"),("voc-solveit.mp3","solve it")]
def mcells(items):
    s = ""
    for f, lbl in items:
        s += (f'<div class="mcell" data-name="music-{f.replace(".mp3","")}"><div class="ml">{esc(lbl)}</div>'
              f'<audio class="ma" src="{RM}/{f}" controls preload="none"></audio>{FB}</div>')
    return s
music_row = (f'<div class="mgrp"><div class="mh">Instrumentals — no vocals ({len(MUSIC_INST)})</div><div class="mgrid">{mcells(MUSIC_INST)}</div></div>'
             f'<div class="mgrp"><div class="mh">Songs — with vocals ({len(MUSIC_VOC)})</div><div class="mgrid">{mcells(MUSIC_VOC)}</div></div>')

# Reframed (new style) — the rest re-cut to CR voice + warm delivery + end-card
REFRAMED = [("invoice","Jason · truck · lead-spend math"),("race","Jason · roof · the footrace"),
 ("ftc","Aaron · office · $7.2M fine"),("robot","Jason · garage · billed for your own customer"),
 ("ghost","Jason · driveway · 30 ghosts"),("math","Tyler · the $100 vs $7 math"),
 ("credit","Aaron · no refunds, only credit"),("creepy","Tyler · consent-first vs creepy"),
 ("twice","Jason · sold twice"),("policy","Aaron · their dashboard, their rules"),
 ("ownership","Aaron · stop renting your leads")]
ref_cells = ""
for a, desc in REFRAMED:
    name = f"{a}-new"; url = f"{R2}/{name}.mp4"
    if name in DELETED: continue
    catalog.append({"name": name, "angle": a, "persona": "reframed", "hook": desc, "url": url})
    ref_cells += vcell(name, a, url, desc)
ref_row = f'<div class="trio">{ref_cells}</div>'

# Originals (Jun 11–13 era) — UGC + persona/look tests + non-UGC music + experiments.
# Play from social/sprint/orig/<basename>.mp4. data-name = orig-<basename>.
orig_count = 0
orig_html = ""
for title, sub, items in ORIG_GROUPS:
    cells = ""
    for base, label in items:
        name = f"orig-{base}"; url = f"{R2}/orig/{base}.mp4"
        if name in DELETED: continue
        catalog.append({"name": name, "group": "original", "section": title, "hook": label, "url": url})
        cells += vcell(name, label, url)
        orig_count += 1
    orig_html += (f'<div class="angle"><div class="ah">{esc(title)} <span>· {esc(sub)} ({len(items)})</span></div>'
                  f'<div class="ogrid">{cells}</div></div>')

# Experimental reels — round one survivors (asset-driven, casual-excited). Play from social/exp/.
EXP_R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/exp"
EXP_KEEP = [("03", "Isn't This Illegal · Jason"), ("04", "Bad Tinder Date · Tyler"),
            ("05", "Confession Booth · Tyler"), ("06", "10-Minute Speedrun · Aaron"),
            ("08", "The Price Is Wrong · Aaron"), ("09", "Two Truths and a Lie · Jason"),
            ("13", "Start at the Win · Aaron")]
exp_cells = ""
for num, label in EXP_KEEP:
    name = f"exp-{num}"; url = f"{EXP_R2}/{name}.mp4"
    catalog.append({"name": name, "group": "experimental", "hook": label, "url": url})
    exp_cells += vcell(name, label, url)
exp_row = f'<div class="angle"><div class="ah">experimental <span>· round one ({len(EXP_KEEP)})</span></div><div class="ogrid">{exp_cells}</div></div>'

# SHOP TALK with AA-Ron — deadpan trade comedy series (cover + cold-open hook + bit + outro).
# Plays from social/shoptalk/; same names so notes/delete route through the shared APIs.
from shop_talk_lines import LINES as ST_LINES, DELETED as ST_DELETED
ST_R2 = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev/social/shoptalk"
st_present = [l for l in ST_LINES if l["id"] not in ST_DELETED and (ROOT / f"public/reels/shoptalk-{l['id']}.mp4").exists()]
st_cells = ""
for l in st_present:
    name = f"shoptalk-{l['id']}"; url = f"{ST_R2}/{name}.mp4"
    catalog.append({"name": name, "group": "shoptalk", "hook": l["text"], "url": url})
    st_cells += vcell(name, f"#{l['id']}", url, l["text"])
st_row = f'<div class="angle"><div class="ah">SHOP TALK with AA-Ron <span>· deadpan trade comedy ({len(st_present)})</span></div><div class="ogrid">{st_cells}</div></div>'

(ROOT / "social/sprint-catalog.json").write_text(json.dumps(catalog, indent=2))

CSS = """
*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 24px 6px;text-align:center}h1{margin:0;font-size:24px}header p{color:#94a3b8;margin:6px 0 0;font-size:14px}
.wrap{max-width:1200px;margin:0 auto;padding:8px 22px 50px}
h2.sec{margin:34px 0 4px;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#00e5a0;border-top:1px solid #16233a;padding-top:18px}
.angle{margin:18px 0}
.ah{font-size:15px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#fff;margin-bottom:12px}
.ah span{color:#64748b;font-weight:500;text-transform:none}
.trio,.ogrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.cell{background:#0e1d33;border:1px solid #1e293b;border-radius:14px;padding:12px}
.ar{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#00e5a0;margin-bottom:8px}
.v{width:100%;aspect-ratio:9/16;border-radius:10px;background:#000;display:block}
.hk{margin-top:8px;font-size:13px;line-height:1.45;color:#cbd5e1}
.fbtn{margin-top:8px;background:#16233a;color:#cbd5e1;border:1px solid #1e293b;border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer}
.fb{margin-top:8px}.fbi{width:100%;min-height:62px;background:#0a1628;color:#f5f8fa;border:1px solid #1e293b;border-radius:8px;padding:8px;font-size:13px;font-family:inherit;resize:vertical}
.fsave{margin-top:6px;background:#00e5a0;color:#06281f;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}
.fok{color:#00e5a0;font-size:12px;margin-left:6px}
.acts{margin-top:8px}
.del{background:#2a1620;color:#ff8d8d;border:1px solid #4a2230;border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer}
.del:hover{background:#3a1d2a}
.qbar{display:none;margin-top:6px;align-items:center;gap:8px;color:#ff8d8d;font-size:13px}
.undo{background:#16233a;color:#cbd5e1;border:1px solid #1e293b;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer}
.cell.queued{opacity:.5;border-style:dashed;border-color:#4a2230}
.cell.queued .v,.cell.queued .hk,.cell.queued .fbtn,.cell.queued .fb,.cell.queued .acts,.cell.queued .ar{display:none}
.cell.queued .qbar{display:flex}
#rev{background:#0e1d33;color:#f5f8fa;border:1px solid #1e293b;border-radius:8px;padding:8px 13px;font-size:14px;margin-top:10px;width:320px;max-width:90%}
.mgrp{margin:14px 0}.mh{font-size:14px;font-weight:700;color:#fff;margin-bottom:8px}
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.mcell{background:#0e1d33;border:1px solid #1e293b;border-radius:12px;padding:12px}
.ml{font-weight:700;font-size:14px;color:#fff;margin-bottom:8px}.ma{width:100%}
"""
reels_total = len(catalog)
HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — sprint review</title>
<style>{CSS}</style></head><body>
<header><h1>Sprint review — {reels_total} reels</h1>
<p>Locked style (Avatar IV · real voices · float · karaoke captions · -14 LUFS). Pick the winners worth scaling on paid.</p>
<p style="margin-top:4px"><input id="rev" placeholder="Your name (so notes are attributed)"></p>
<p class="note" style="color:#64748b;font-size:12px">Tap <b>＋ Add note</b> for feedback, or <b>🗑 Delete</b> to queue a reel for removal — it disappears here and I delete it from storage when you give the word. Both persist.</p></header>
<div class="wrap">
  <h2 class="sec">🎬 SHOP TALK with AA-Ron — comedy series ({len(st_present)})</h2>{st_row}
  <h2 class="sec">⭐ Reframed — new style ({len(REFRAMED)}) · CR voice + warm delivery + end-card</h2>{ref_row}
  <h2 class="sec">Leak experiments — 2 hook mechanisms</h2>{leak_row}
  <h2 class="sec">Non-UGC (brand-animated) — 4 angles × 3 ({len(NONUGC)*3})</h2>{non_rows}
  <h2 class="sec">Leah — office-manager set ({len(LEAH)})</h2>{leah_row}
  <h2 class="sec">🧪 Experimental reels — round one ({len(EXP_KEEP)}) · asset-driven, casual-excited</h2>{exp_row}
  <h2 class="sec">📼 Originals — Jun 11–13 era ({orig_count}) · review &amp; prune</h2>{orig_html}
  <h2 class="sec">🎵 Brand music library — {len(MUSIC_INST)+len(MUSIC_VOC)} tracks</h2>{music_row}
</div>
<script>
const rev=document.getElementById('rev');
try{{if(localStorage.crRev)rev.value=localStorage.crRev;}}catch(e){{}}
rev&&rev.addEventListener('input',()=>{{try{{localStorage.crRev=rev.value;}}catch(e){{}}}});
document.querySelectorAll('.fbtn').forEach(b=>b.onclick=()=>{{const f=b.nextElementSibling;f.hidden=!f.hidden;if(!f.hidden)f.querySelector('.fbi').focus();}});
document.querySelectorAll('.fsave').forEach(b=>b.onclick=async()=>{{
  const cell=b.closest('.cell, .mcell'),ta=cell.querySelector('.fbi'),ok=cell.querySelector('.fok');
  const note=ta.value.trim(); if(!note){{ok.textContent='write something first';return;}}
  b.disabled=true; ok.textContent='saving…';
  try{{
    const r=await fetch('/api/feedback',{{method:'POST',headers:{{'Content-Type':'application/json'}},
      body:JSON.stringify({{video:cell.dataset.name,note,author:(rev&&rev.value)||''}})}});
    if(!r.ok)throw 0; ok.textContent='saved ✓'; ta.value='';
  }}catch(e){{ok.textContent='failed — try again';}}
  b.disabled=false;
}});
// Delete queue (server-persisted via /api/queue). Delete hides the card; Undo restores it.
function queueReq(name,action){{return fetch('/api/queue',{{method:'POST',headers:{{'Content-Type':'application/json'}},
  body:JSON.stringify({{name,action,author:(rev&&rev.value)||''}})}});}}
function mark(cell,on){{cell.classList.toggle('queued',on);}}
document.querySelectorAll('.del').forEach(b=>b.onclick=async()=>{{
  const cell=b.closest('.cell'); b.disabled=true;
  try{{const r=await queueReq(cell.dataset.name,'delete'); if(!r.ok)throw 0; mark(cell,true);}}
  catch(e){{alert('Could not queue — try again');}} b.disabled=false;
}});
document.querySelectorAll('.undo').forEach(b=>b.onclick=async()=>{{
  const cell=b.closest('.cell');
  try{{await queueReq(cell.dataset.name,'restore'); mark(cell,false);}}catch(e){{}}
}});
// On load, hide anything already queued.
(async()=>{{try{{const r=await fetch('/api/queue'); const j=await r.json();
  (j.queued||[]).forEach(n=>{{const c=document.querySelector('[data-name="'+(window.CSS&&CSS.escape?CSS.escape(n):n)+'"]'); if(c)mark(c,true);}});
}}catch(e){{}}}})();
</script>
</body></html>"""
HTML = HTML.replace('.mp4"', '.mp4?v=7"')   # cache-buster so the browser fetches the current cuts
(ROOT / "public/sprint.html").write_text(HTML)
print(f"wrote public/sprint.html + sprint-catalog.json — {reels_total} reels ({orig_count} originals)")
