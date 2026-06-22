#!/usr/bin/env python3
"""public/dashboard.html (noindex) — campaign PERFORMANCE dashboard.
Headline funnel: Views (social, metrics.json) → Clicks (/demo landings) → Demos
(registered) → Signups (opted-in). Clicks/Demos/Signups come from the worker
/api/analytics (D1, same-origin, key-gated); Views + per-reel engagement from R2
metrics.json; delivery from R2 post-log.json. Plan/coverage baked from the schedule.
Supporting analytics surface what's working (by platform, trade, source, top reels)."""
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
plat = {"tk": 0, "yt": 0, "ig": 0, "fb": 0}; reels = set()
for items in sched.values():
    for it in items:
        reels.add(it.get("name"))
        for p in it.get("platforms", []):
            if p in plat: plat[p] += 1
CFG = {"start": START.isoformat(), "end": END.isoformat(), "days": (END - START).days + 1,
       "platforms": plat, "reels_scheduled": len(reels), "library": lib,
       "analyticsUrl": "/api/analytics?key=fixme", "metricsUrl": f"{PUB}/social/metrics.json", "logUrl": f"{PUB}/social/post-log.json"}

CSS = """*{box-sizing:border-box}body{margin:0;background:#0a1628;color:#f5f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
header{padding:24px 22px 4px;text-align:center}h1{margin:0;font-size:24px}header p{color:#94a3b8;margin:6px 0 0;font-size:13px}
.wrap{max-width:1080px;margin:0 auto;padding:8px 20px 60px}
.bar{height:12px;background:#0e1d33;border:1px solid #1e293b;border-radius:8px;overflow:hidden;margin:12px 0 2px}.bar>i{display:block;height:100%;background:linear-gradient(90deg,#00e5a0,#00f5b0)}
h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#00e5a0;border-top:1px solid #16233a;padding-top:16px;margin:30px 0 10px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:680px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:#0e1d33;border:1px solid #1e293b;border-radius:14px;padding:16px}
.kpi .n{font-size:32px;font-weight:800;color:#fff;line-height:1}.kpi .l{font-size:12px;color:#94a3b8;margin-top:6px;text-transform:uppercase;letter-spacing:.06em}
.kpi .r{font-size:11px;color:#00e5a0;margin-top:6px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.stat{background:#0e1d33;border:1px solid #1e293b;border-radius:12px;padding:13px}.stat .n{font-size:22px;font-weight:800;color:#fff}.stat .l{font-size:12px;color:#94a3b8;margin-top:3px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:7px 9px;border-bottom:1px solid #16233a}th{color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase}
.pill{font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px;color:#06121f}.ok{background:#00e5a0}.fail{background:#ff8d8d}.muted{color:#64748b}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media(max-width:680px){.two{grid-template-columns:1fr}}
.empty{color:#64748b;font-size:13px;padding:14px;background:#0e1d33;border:1px dashed #29384f;border-radius:12px}
.lk{display:inline-block;margin:5px 8px 0 0;background:#16233a;color:#cbd5e1;border:1px solid #1e293b;border-radius:8px;padding:6px 12px;font-size:12px;text-decoration:none}a{color:#7dd3fc}
"""
JS = """
const C=%CFG%, $=s=>document.querySelector(s), n=v=>(v==null?'—':(+v).toLocaleString());
(function(){const s=new Date(C.start+'T00:00:00Z'),e=new Date(C.end+'T00:00:00Z'),now=new Date();
 const day=Math.min(C.days,Math.max(1,Math.floor((now-s)/864e5)+1)),pct=Math.min(100,Math.max(0,Math.round((now-s)/(e-s)*100)));
 $('#prog').textContent='Day '+day+' of '+C.days+' · '+C.reels_scheduled+' reels scheduled';$('#bar').style.width=pct+'%';})();
const pf=(x,y)=>(y?Math.round(x/y*1000)/10+'%':'—');
fetch(C.analyticsUrl+'&t='+Date.now()).then(r=>r.ok?r.json():null).catch(()=>null).then(a=>{
  const m=Array.isArray(a&&a.metrics)?a.metrics:[], log=Array.isArray(a&&a.delivery)?a.delivery:[];
  const views=m.reduce((s,r)=>s+(+r.views||0),0);
  const clicks=a?a.totals.clicks:0, demos=a?a.totals.demos:0, signups=a?a.totals.signups:0;
  // headline funnel
  $('#kpis').innerHTML=[['Views',views,'social (FB/IG/YT/TikTok/X)'],['Clicks',clicks,'→ '+pf(clicks,views)+' click-thru'],
    ['Demos',demos,'→ '+pf(demos,clicks)+' of clicks'],['Signups',signups,'→ '+pf(signups,demos)+' of demos']]
    .map(([l,v,r])=>`<div class="kpi"><div class="n">${n(v)}</div><div class="l">${l}</div><div class="r">${r}</div></div>`).join('');
  if(!a){$('#funnelnote').innerHTML='<div class="empty">Clicks/Demos/Signups load from /api/analytics — showing 0 until the worker deploys + the first visitor lands. Views populate as the metrics fetcher runs.</div>';}
  // views by platform — always show every platform (0 until views accrue)
  const PLAT={fb:'Facebook',ig:'Instagram',yt:'YouTube',tk:'TikTok',x:'X',li:'LinkedIn'};
  const bp={fb:0,ig:0,yt:0,tk:0,x:0,li:0};m.forEach(r=>{if(r.platform in bp)bp[r.platform]+=(+r.views||0);});
  $('#byplat').innerHTML='<div class="cards">'+Object.keys(PLAT).map(k=>`<div class="stat"><div class="n">${n(bp[k])}</div><div class="l">${PLAT[k]} views</div></div>`).join('')+'</div>';
  // top reels → ad candidates
  m.sort((x,y)=>(y.views||0)-(x.views||0));
  $('#top').innerHTML=m.length?'<table><tr><th>#</th><th>Reel</th><th>Platform</th><th>Views</th><th>Likes</th><th>Eng.</th><th>Ad?</th></tr>'+
    m.slice(0,15).map((r,i)=>{const er=r.views?(r.likes||0)/r.views*100:0;const cand=(r.views||0)>=500&&er>=2;return `<tr><td>${i+1}</td><td>${r.name||''}</td><td>${(r.platform||'').toUpperCase()}</td><td>${n(r.views)}</td><td>${n(r.likes)}</td><td>${r.views?er.toFixed(1)+'%':'—'}</td><td>${cand?'<span class="pill ok">boost</span>':'<span class="muted">—</span>'}</td></tr>`;}).join('')+'</table>':'<div class="empty">Engagement fills in as views accrue (~1–2 weeks for real signal).</div>';
  // breakdowns
  const tbl=(rows,h)=>rows&&rows.length?'<table><tr><th>'+h+'</th><th>#</th></tr>'+rows.map(r=>`<tr><td>${r.k}</td><td>${n(r.c)}</td></tr>`).join('')+'</table>':'<div class="empty">No data yet.</div>';
  // macro-channel grouping (UTM convention) — the integrated-GTM view
  const CHGROUP=(s)=>{s=(s||'').toLowerCase();
    if(/instantly|cold|outreach|email/.test(s))return'Outreach';
    if(/retarget|remarket|pixel/.test(s))return'Retargeting';
    if(/linkedin|(^|[^a-z])x([^a-z]|$)|twitter|facebook|(^|[^a-z])fb|instagram|(^|[^a-z])ig|youtube|(^|[^a-z])yt|tiktok|(^|[^a-z])tk|gbp|google_business|social/.test(s))return'Social';
    if(!s||/direct/.test(s))return'Direct';return'Other';};
  const grp=(rows)=>{const g={Outreach:0,Social:0,Retargeting:0,Direct:0,Other:0};(rows||[]).forEach(r=>{g[CHGROUP(r.k)]+=(+r.c||0);});return g;};
  const gd=grp(a&&a.demos_by_source);
  $('#bychannel').innerHTML='<div class="cards">'+['Outreach','Social','Retargeting','Direct'].map(k=>`<div class="stat"><div class="n">${n(gd[k])}</div><div class="l">${k} demos</div></div>`).join('')+'</div>';
  // Outreach — Instantly cold-email campaign analytics
  const inst=Array.isArray(a&&a.instantly)?a.instantly:[];
  $('#instantly').innerHTML=inst.length?'<table><tr><th>Campaign</th><th>Leads</th><th>Sent</th><th>Opens</th><th>Replies</th><th>Interested</th></tr>'+inst.map(c=>`<tr><td>${c.name}</td><td>${n(c.leads)}</td><td>${n(c.sent)}</td><td>${n(c.opens)} <span class="muted">${pf(c.opens,c.sent)}</span></td><td>${n(c.replies)} <span class="muted">${pf(c.replies,c.sent)}</span></td><td>${n(c.interested)}</td></tr>`).join('')+'</table>':'<div class="empty">No Instantly campaigns yet — fills in once a wave launches.</div>';
  $('#bysource').innerHTML=tbl(a&&a.by_source,'Clicks by source');
  $('#bysrcd').innerHTML=tbl(a&&a.demos_by_source,'Demos by source');
  $('#bytrade').innerHTML=tbl(a&&a.by_trade,'Demos by trade');
  // per-wave view (utm_campaign, e.g. hvac_2026) — one industry at a time
  $('#bycampaign').innerHTML=tbl(a&&a.by_campaign,'Clicks by wave');
  $('#bysignuptrade').innerHTML=tbl(a&&a.signups_by_trade,'Signups by trade');
  // delivery
  if(log.length){const t={};log.forEach(r=>{const k=r.platform||'?';t[k]=t[k]||{ok:0,n:0};t[k].n++;if(r.status==='ok')t[k].ok++;});
    $('#deliv').innerHTML='<div class="cards">'+Object.entries(t).map(([k,v])=>`<div class="stat"><div class="n">${v.ok}<span class="muted" style="font-size:13px">/${v.n}</span></div><div class="l">${k.toUpperCase()} delivered</div></div>`).join('')+'</div>';
    const probs=log.filter(r=>r.status!=='ok'||r.note).slice(-20).reverse();
    $('#issues').innerHTML=probs.length?'<table><tr><th>When</th><th>Platform</th><th>Reel</th><th>Status</th><th>Detail / response</th></tr>'+probs.map(r=>`<tr><td class="muted">${(r.ts||'').replace('T',' ').replace('Z','')}</td><td>${(r.platform||'').toUpperCase()}</td><td>${r.name||''}</td><td><span class="pill ${r.status==='ok'?'ok':'fail'}">${r.status}</span></td><td class="muted">${r.note||''}</td></tr>`).join('')+'</table>':'';
  }
  else $('#deliv').innerHTML='<div class="empty">No posts delivered yet — fills after the first successful run.</div>';
});
"""
HTML = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Consent Resolve — performance dashboard</title><style>{CSS}</style></head><body>
<header><h1>Performance dashboard</h1><p>Views → Clicks → Demos → Signups · updates live as data flows</p></header>
<div class="wrap">
  <div id="prog" style="font-weight:700;color:#fff"></div><div class="bar"><i id="bar"></i></div>
  <h2>Funnel</h2><div id="kpis" class="kpis"></div><div id="funnelnote" style="margin-top:10px"></div>
  <h2>Views by platform</h2><div id="byplat"></div>
  <h2>Top performers → FB ad candidates</h2><div id="top"></div>
  <h2>Outreach — Instantly (cold email)</h2><div id="instantly"></div>
  <h2>Demos by channel — the integrated funnel</h2>
  <div id="bychannel"></div>
  <h2>By wave (industry campaign) — one at a time</h2>
  <div class="two"><div id="bycampaign"></div><div id="bysignuptrade"></div></div>
  <h2>Attribution — what's driving the funnel</h2>
  <div class="two"><div id="bysource"></div><div id="bysrcd"></div></div>
  <div style="margin-top:14px" id="bytrade"></div>
  <h2>Delivery</h2><div id="deliv"></div><div id="issues" style="margin-top:12px"></div>
  <h2>Native analytics</h2>
  <a class="lk" href="https://www.facebook.com/latest/insights" target="_blank">Facebook</a>
  <a class="lk" href="https://www.instagram.com/" target="_blank">Instagram</a>
  <a class="lk" href="https://studio.youtube.com/" target="_blank">YouTube Studio</a>
  <a class="lk" href="https://www.tiktok.com/tiktokstudio" target="_blank">TikTok Studio</a>
  <a class="lk" href="https://analytics.x.com/" target="_blank">X Analytics</a>
  <a class="lk" href="https://www.linkedin.com/company/consent-resolve/admin/analytics/visitors/" target="_blank">LinkedIn Analytics</a>
  <a class="lk" href="/fb-calendar" target="_blank">Social calendar</a>
</div>
<script>{JS.replace('%CFG%', json.dumps(CFG))}</script></body></html>"""
(ROOT / "public/dashboard.html").write_text(HTML)
print(f"wrote public/dashboard.html — funnel dashboard ({CFG['reels_scheduled']} reels scheduled); KPIs load from /api/analytics + metrics.json + post-log.json")
