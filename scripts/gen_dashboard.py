#!/usr/bin/env python3
"""public/dashboard.html (noindex) — campaign progress + delivery + engagement.
Plan/coverage is baked from social/schedule.json + cards.json at build time;
live DELIVERY (social/post-log.json) and ENGAGEMENT (social/metrics.json) are
fetched from R2 client-side, so the page updates as the runners + metrics fetcher
feed it. Ranks top reels by views → FB ad candidates. Pure read surface."""
import json, datetime
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
PUB = "https://pub-27fc71b9070247178d8756a59bef0b33.r2.dev"
def load(n):
    p = ROOT / "social" / n
    return json.loads(p.read_text()) if p.exists() else {}
sched, cards = load("schedule.json"), load("cards.json")
cat = load("sprint-catalog.json"); lib = len(cat) if isinstance(cat, list) else 0

START, END = datetime.date(2026, 6, 18), datetime.date(2026, 8, 1)
# Bake planned counts
plat = {"tk": 0, "yt": 0, "ig": 0, "fb": 0}
stories = 0; reels_scheduled = set()
for d, items in sched.items():
    for it in items:
        reels_scheduled.add(it.get("name"))
        for p in it.get("platforms", []):
            if p in plat: plat[p] += 1
        if it.get("story"): stories += 1
card_types = {"photo": 0, "carousel": 0, "story": 0}
for d, v in cards.items():
    for it in (v if isinstance(v, list) else [v]):
        card_types[it.get("format", "photo")] = card_types.get(it.get("format", "photo"), 0) + 1
PLAN = {"start": START.isoformat(), "end": END.isoformat(), "days": (END - START).days + 1,
        "platforms": plat, "stories": stories, "reels_scheduled": len(reels_scheduled),
        "library": lib, "cards": card_types, "logUrl": f"{PUB}/social/post-log.json", "metricsUrl": f"{PUB}/social/metrics.json"}

CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:26px 22px 6px;text-align:center}h1{margin:0;font-size:24px}header p{color:#94a3b8;margin:6px 0 0;font-size:13px}
.wrap{max-width:1080px;margin:0 auto;padding:10px 20px 60px}
.bar{height:14px;background:#0e1d33;border:1px solid #1e293b;border-radius:8px;overflow:hidden;margin:14px 0 4px}
.bar>i{display:block;height:100%;background:linear-gradient(90deg,#00e5a0,#00f5b0)}
h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#00e5a0;border-top:1px solid #16233a;padding-top:16px;margin:30px 0 10px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.stat{background:#0e1d33;border:1px solid #1e293b;border-radius:12px;padding:14px}
.stat .n{font-size:26px;font-weight:800;color:#fff}.stat .l{font-size:12px;color:#94a3b8;margin-top:3px}
.stat .s{font-size:11px;color:#64748b;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:7px 9px;border-bottom:1px solid #16233a}
th{color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.pill{font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px;color:#06121f}
.ok{background:#00e5a0}.fail{background:#ff8d8d}.muted{color:#64748b}
.lk{display:inline-block;margin:5px 8px 0 0;background:#16233a;color:#cbd5e1;border:1px solid #1e293b;border-radius:8px;padding:6px 12px;font-size:12px;text-decoration:none}
.empty{color:#64748b;font-size:13px;padding:14px;background:#0e1d33;border:1px dashed #29384f;border-radius:12px}
a{color:#7dd3fc}
"""
JS = """
const P=%PLAN%;
const $=s=>document.querySelector(s);
// progress
(function(){const start=new Date(P.start+'T00:00:00Z'),end=new Date(P.end+'T00:00:00Z'),now=new Date();
 const day=Math.min(P.days,Math.max(1,Math.floor((now-start)/864e5)+1));
 const pct=Math.min(100,Math.max(0,Math.round((now-start)/(end-start)*100)));
 $('#prog').textContent='Day '+day+' of '+P.days; $('#bar').style.width=pct+'%'; $('#pctx').textContent=pct+'% through the 45-day launch';})();
// plan stats
$('#plan').innerHTML=[['Reels scheduled',P.reels_scheduled,'of '+P.library+' in library'],
 ['TikTok',P.platforms.tk,'reel posts'],['YouTube',P.platforms.yt,'shorts'],['Instagram',P.platforms.ig,'reels + '+P.stories+' stories'],
 ['Facebook',P.platforms.fb,'reels'],['FB cards',(P.cards.photo||0)+(P.cards.carousel||0),'photo+carousel'],['FB stories',P.cards.story||0,'card stories']]
 .map(([l,n,s])=>`<div class="stat"><div class="n">${n}</div><div class="l">${l}</div><div class="s">${s}</div></div>`).join('');
function tally(rows){const t={};rows.forEach(r=>{const k=r.platform||'?';t[k]=t[k]||{ok:0,fail:0};t[k][r.status==='ok'?'ok':'fail']++;});return t;}
// delivery
fetch(P.logUrl+'?t='+Date.now()).then(r=>r.ok?r.json():[]).then(log=>{
  if(!Array.isArray(log)||!log.length){$('#deliv').innerHTML='<div class="empty">No posts logged yet — this fills in after the first successful run.</div>';return;}
  const t=tally(log);
  $('#deliv').innerHTML='<div class="cards">'+Object.entries(t).map(([k,v])=>`<div class="stat"><div class="n">${v.ok}<span class="muted" style="font-size:14px"> / ${v.ok+v.fail}</span></div><div class="l">${k.toUpperCase()} delivered</div>${v.fail?`<div class="s" style="color:#ff8d8d">${v.fail} failed</div>`:''}</div>`).join('')+'</div>';
  const recent=log.slice(-25).reverse();
  $('#recent').innerHTML='<table><tr><th>When</th><th>Reel</th><th>Platform</th><th>Type</th><th>Status</th><th>Link</th></tr>'+
    recent.map(r=>`<tr><td class="muted">${(r.ts||'').replace('T',' ').replace('Z','')}</td><td>${r.name||''}</td><td>${(r.platform||'').toUpperCase()}</td><td class="muted">${r.ptype||''}</td><td><span class="pill ${r.status==='ok'?'ok':'fail'}">${r.status||''}</span></td><td>${r.url?`<a href="${r.url}" target="_blank">view</a>`:'<span class="muted">—</span>'}</td></tr>`).join('')+'</table>';
});
// engagement / ad candidates
fetch(P.metricsUrl+'?t='+Date.now()).then(r=>r.ok?r.json():[]).then(m=>{
  if(!Array.isArray(m)||!m.length){$('#winners').innerHTML='<div class="empty">Engagement fills in once posts accrue + the metrics fetcher runs (≈1–2 weeks for meaningful signal). It will rank reels by views and flag FB ad candidates here.</div>';return;}
  m.sort((a,b)=>(b.views||0)-(a.views||0));
  $('#winners').innerHTML='<table><tr><th>#</th><th>Reel</th><th>Platform</th><th>Views</th><th>Likes</th><th>Eng. rate</th><th>Ad?</th></tr>'+
    m.slice(0,15).map((r,i)=>{const er=r.views?((r.likes||0)/r.views*100).toFixed(1)+'%':'—';const cand=(r.views||0)>=500&&parseFloat(er)>=2;return `<tr><td>${i+1}</td><td>${r.name||''}</td><td>${(r.platform||'').toUpperCase()}</td><td>${r.views??'—'}</td><td>${r.likes??'—'}</td><td>${er}</td><td>${cand?'<span class="pill ok">boost</span>':'<span class="muted">—</span>'}</td></tr>`;}).join('')+'</table>';
});
"""
HTML = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Consent Resolve — campaign dashboard</title><style>{CSS}</style></head><body>
<header><h1>Campaign dashboard</h1><p id="pctx">launch progress</p>
<div class="wrap" style="padding-top:0"><div id="prog" style="font-weight:700;color:#fff"></div><div class="bar"><i id="bar"></i></div></div></header>
<div class="wrap">
  <h2>Plan &amp; coverage</h2><div id="plan" class="cards"></div>
  <h2>Delivery — what actually posted</h2><div id="deliv"></div><div id="recent" style="margin-top:12px"></div>
  <h2>Top performers → FB ad candidates</h2><div id="winners"></div>
  <h2>Native analytics</h2>
  <a class="lk" href="https://www.facebook.com/latest/insights" target="_blank">Facebook insights</a>
  <a class="lk" href="https://www.instagram.com/" target="_blank">Instagram insights</a>
  <a class="lk" href="https://studio.youtube.com/" target="_blank">YouTube Studio</a>
  <a class="lk" href="https://www.tiktok.com/" target="_blank">TikTok analytics</a>
  <a class="lk" href="/fb-calendar" target="_blank">Social calendar</a>
</div>
<script>{JS.replace('%PLAN%', json.dumps(PLAN))}</script></body></html>"""
(ROOT / "public/dashboard.html").write_text(HTML)
print(f"wrote public/dashboard.html — plan baked ({PLAN['reels_scheduled']} reels scheduled, {sum(plat.values())} reel-posts); delivery+engagement load live from R2")
