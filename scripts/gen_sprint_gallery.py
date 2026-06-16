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
FB = ('<button class="fbtn">＋ Add note</button>'
      '<div class="fb" hidden><textarea class="fbi" placeholder="What would make this video better?"></textarea>'
      '<button class="fsave">Save note</button> <span class="fok"></span></div>')

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
        if angle == "leak" and not prefix: hook = LEAK_LABELS.get(arch, hook)
        catalog.append({"name": name, "angle": angle, "arch": arch, "persona": who, "hook": hook, "url": url})
        cells += (f'<div class="cell" data-name="{name}"><div class="ar">{label}</div>'
                  f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
                  f'<div class="hk">{esc(hook)}</div>{FB}</div>')
    return f'<div class="angle"><div class="ah">{esc(angle)} <span>· {esc(who)}</span></div><div class="trio">{cells}</div></div>'

leak_hooks = next(h for a, _p, h in UGC if a == "leak")
# Hail Mary (contrarian) removed; leak experiments = stat + confession only
lk = ""
for arch, label in [("stat", "Stat / pattern-interrupt"), ("confession", "Confession / rage")]:
    name = f"leak-{arch}"; url = f"{R2}/{name}.mp4"; hook = LEAK_LABELS.get(arch, leak_hooks[arch])
    catalog.append({"name": name, "angle": "leak", "arch": arch, "persona": "Tyler", "hook": hook, "url": url})
    lk += (f'<div class="cell" data-name="{name}"><div class="ar">{label}</div>'
           f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
           f'<div class="hk">{esc(hook)}</div>{FB}</div>')
leak_row = f'<div class="angle"><div class="ah">leak <span>· 2 hook mechanisms</span></div><div class="trio">{lk}</div></div>'

LEAH = [("roofing", "Front desk · the 98% leak"), ("speed", "Front desk · speed-to-lead"),
        ("ghost", "Kitchen · done chasing dead numbers"), ("consent", "Home office · consent-first vs creepy"),
        ("cost", "Car · the per-booked-job math")]
leah_cells = ""
for slug, desc in LEAH:
    url = f"{R2}/leah-{slug}.mp4"; catalog.append({"name": f"leah-{slug}", "persona": "leah", "hook": desc, "url": url})
    leah_cells += (f'<div class="cell" data-name="leah-{slug}"><div class="ar">{esc(slug)}</div>'
                   f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
                   f'<div class="hk">{esc(desc)}</div>{FB}</div>')
leah_row = f'<div class="angle"><div class="ah">leah <span>· office manager (her own scripts)</span></div><div class="trio">{leah_cells}</div></div>'

# Reframed (new style) — the rest re-cut to CR voice + warm delivery + end-card
REFRAMED = [("invoice","Jason · truck · lead-spend math"),("race","Jason · roof · the footrace"),
 ("ftc","Aaron · office · $7.2M fine"),("robot","Jason · garage · billed for your own customer"),
 ("ghost","Jason · driveway · 30 ghosts"),("math","Tyler · the $100 vs $7 math"),
 ("credit","Aaron · no refunds, only credit"),("creepy","Tyler · consent-first vs creepy"),
 ("twice","Jason · sold twice"),("policy","Aaron · their dashboard, their rules"),
 ("ownership","Aaron · stop renting your leads"),("contrarian","Tyler · not broken, by design")]
ref_cells = ""
for a, desc in REFRAMED:
    name = f"{a}-new"; url = f"{R2}/{name}.mp4"
    catalog.append({"name": name, "angle": a, "persona": "reframed", "hook": desc, "url": url})
    ref_cells += (f'<div class="cell" data-name="{name}"><div class="ar">{esc(a)}</div>'
                  f'<video class="v" src="{url}" controls preload="none" playsinline></video>'
                  f'<div class="hk">{esc(desc)}</div>{FB}</div>')
ref_row = f'<div class="trio">{ref_cells}</div>'

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
.fbtn{margin-top:8px;background:#16233a;color:#cbd5e1;border:1px solid #1e293b;border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer}
.fb{margin-top:8px}.fbi{width:100%;min-height:62px;background:#0a1628;color:#f5f8fa;border:1px solid #1e293b;border-radius:8px;padding:8px;font-size:13px;font-family:inherit;resize:vertical}
.fsave{margin-top:6px;background:#00e5a0;color:#06281f;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}
.fok{color:#00e5a0;font-size:12px;margin-left:6px}
#rev{background:#0e1d33;color:#f5f8fa;border:1px solid #1e293b;border-radius:8px;padding:8px 13px;font-size:14px;margin-top:10px;width:320px;max-width:90%}
"""
HTML = f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Consent Resolve — sprint review</title>
<style>{CSS}</style></head><body>
<header><h1>Sprint review — {len(catalog)} reels</h1>
<p>Locked style (Avatar IV · real voices · float · karaoke captions · -14 LUFS). Pick the winners worth scaling on paid.</p>
<p style="margin-top:4px"><input id="rev" placeholder="Your name (so notes are attributed)"></p>
<p class="note" style="color:#64748b;font-size:12px">Tap <b>＋ Add note</b> under any video to leave specific feedback — it's saved and I'll batch the fixes.</p></header>
<div class="wrap">
  <h2 class="sec">⭐ Reframed — new style ({len(REFRAMED)}) · CR voice + warm delivery + end-card</h2>{ref_row}
  <h2 class="sec">Leak experiments — 2 hook mechanisms</h2>{leak_row}
  <h2 class="sec">Leah — office-manager set ({len(LEAH)})</h2>{leah_row}
</div>
<script>
const rev=document.getElementById('rev');
try{{if(localStorage.crRev)rev.value=localStorage.crRev;}}catch(e){{}}
rev&&rev.addEventListener('input',()=>{{try{{localStorage.crRev=rev.value;}}catch(e){{}}}});
document.querySelectorAll('.fbtn').forEach(b=>b.onclick=()=>{{const f=b.nextElementSibling;f.hidden=!f.hidden;if(!f.hidden)f.querySelector('.fbi').focus();}});
document.querySelectorAll('.fsave').forEach(b=>b.onclick=async()=>{{
  const cell=b.closest('.cell'),ta=cell.querySelector('.fbi'),ok=cell.querySelector('.fok');
  const note=ta.value.trim(); if(!note){{ok.textContent='write something first';return;}}
  b.disabled=true; ok.textContent='saving…';
  try{{
    const r=await fetch('/api/feedback',{{method:'POST',headers:{{'Content-Type':'application/json'}},
      body:JSON.stringify({{video:cell.dataset.name,note,author:(rev&&rev.value)||''}})}});
    if(!r.ok)throw 0; ok.textContent='saved ✓'; ta.value='';
  }}catch(e){{ok.textContent='failed — try again';}}
  b.disabled=false;
}});
</script>
</body></html>"""
(ROOT / "public/sprint.html").write_text(HTML)
print(f"wrote public/sprint.html + sprint-catalog.json — {len(catalog)} reels")
