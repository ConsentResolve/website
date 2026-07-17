// Gated /seo dashboard (Worker-rendered, like /crm). Auth: admin session OR CRM
// Google session OR ?key=<CRM_KEY>. Tabs: Overview / Queries / Pages / Indexing.
// Data comes from /api/seo/* (Search Console + GA4 + IndexNow).
import { isAuthed, crmSessionEmail } from "./_lib/auth.js";
import { crmKey } from "./api/crm-leads.js";

const LOGIN_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Consent Resolve — SEO</title>
<body style="margin:0;background:#0a1628;color:#e2e8f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
<div><div style="font-size:20px;font-weight:600;color:#00e5a0">Consent Resolve — SEO</div>
<p style="color:#94a3b8;max-width:340px;margin:14px auto 20px">Sign in with your authorized Google account to continue.</p>
<a id="gbtn" href="/api/crm/auth/login" style="display:inline-flex;align-items:center;gap:10px;background:#fff;color:#1f2937;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:8px">Sign in with Google</a></div>
<script>var b=document.getElementById("gbtn");if(b)b.href="/api/crm/auth/login?next="+encodeURIComponent(location.pathname);</script></body>`;

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Consent Resolve — SEO</title><style>
:root{--bg:#0a1628;--surf:#11213b;--surf2:#0d1a30;--line:rgba(255,255,255,.09);--mint:#00e5a0;--ink:#e2e8f0;--mut:#94a3b8;--up:#34d399;--dn:#fb7185}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px}
a{color:var(--mint)}
header{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--line)}
.logo{width:22px;height:22px;border-radius:6px;background:var(--mint);color:#04342c;display:flex;align-items:center;justify-content:center;font-weight:800}
header .sp{flex:1}.muted{color:var(--mut)}
nav{display:flex;gap:4px;padding:0 12px;border-bottom:1px solid var(--line)}
nav button{background:none;border:none;border-bottom:2px solid transparent;color:var(--mut);padding:10px 14px;cursor:pointer;font-size:13px}
nav button.active{color:#fff;border-bottom-color:var(--mint)}
.wrap{padding:18px;max-width:1080px;margin:0 auto}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.tile{background:var(--surf);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.tile .k{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.tile .v{font-size:26px;font-weight:800;margin-top:6px}
.tile .d{font-size:12px;margin-top:4px}.up{color:var(--up)}.dn{color:var(--dn)}
table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
th{color:var(--mut);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.banner{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#fcd34d;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;line-height:1.5}
.btn{background:var(--mint);color:#04342c;border:none;border-radius:8px;font-weight:700;padding:10px 16px;cursor:pointer}
.btn:disabled{opacity:.5}
.card{background:var(--surf);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:14px}
h3{margin:0 0 6px;font-size:15px}
.spark{margin-top:14px}
</style></head><body>
<header><div class="logo">CR</div><b>SEO Performance</b><span class="muted" style="font-size:12px">Search Console · GA4 · IndexNow</span><span class="sp"></span><span class="muted" id="me" style="font-size:12px"></span> <a href="/crm" style="font-size:12px">CRM →</a></header>
<nav><button data-t="overview" class="active">Overview</button><button data-t="queries">Queries</button><button data-t="pages">Pages</button><button data-t="indexing">Indexing</button></nav>
<div class="wrap" id="view">Loading…</div>
<script>
var KEY=new URLSearchParams(location.search).get("key");
function api(p,opt){opt=opt||{};var u="/api/seo/"+p+(KEY?("?key="+encodeURIComponent(KEY)):"");return fetch(u,opt).then(function(r){return r.json();});}
var V=document.getElementById("view");
function n(x){return (x==null?0:x).toLocaleString();}
function pct(x){return ((x||0)*100).toFixed(1)+"%";}
function delta(cur,prev,inv){var d=(cur||0)-(prev||0);var up=inv?d<0:d>0;var s=(d>0?"+":"")+(Math.round(d*100)/100);return '<span class="'+(up?"up":(d?"dn":"muted"))+'">'+s+'</span>';}
function tile(k,v,d){return '<div class="tile"><div class="k">'+k+'</div><div class="v">'+v+'</div>'+(d?'<div class="d">'+d+'</div>':'')+'</div>';}
function spark(trend){if(!trend||!trend.length)return "";var w=640,h=70,mx=Math.max.apply(null,trend.map(function(t){return t.clicks;}))||1;var pts=trend.map(function(t,i){return (i/(trend.length-1)*w)+","+(h-(t.clicks/mx*h));}).join(" ");return '<svg class="spark" viewBox="0 0 '+w+' '+h+'" width="100%" height="70" preserveAspectRatio="none"><polyline fill="none" stroke="#00e5a0" stroke-width="2" points="'+pts+'"/></svg>';}
function cfgBanner(what){return '<div class="banner"><b>'+what+' not connected.</b> Add the service-account secrets and grant read access, then this fills in. See the setup note I left you.</div>';}

function overview(){V.innerHTML="Loading…";api("overview").then(function(d){
  var h="";
  if(!d.gscConfigured) h+=cfgBanner("Search Console");
  if(d.gsc){var g=d.gsc,p=g.prev||{};
    h+='<div class="tiles">'+
      tile("Clicks (28d)",n(g.clicks),delta(g.clicks,p.clicks))+
      tile("Impressions",n(g.impressions),delta(g.impressions,p.impressions))+
      tile("CTR",pct(g.ctr),delta(g.ctr*100,p.ctr*100)+"pt")+
      tile("Avg position",(g.position||0).toFixed(1),delta(g.position,p.position,true))+
    '</div>';
    h+='<div class="card"><h3>Clicks — last 28 days</h3>'+spark(g.trend)+'</div>';
  } else if(d.gscError){h+='<div class="banner">Search Console error: '+d.gscError+'</div>';}
  if(!d.ga4Configured) h+=cfgBanner("GA4");
  if(d.ga4){var c=d.ga4.cur||{},pv=d.ga4.prev||{};
    h+='<div class="tiles" style="margin-top:12px">'+
      tile("Sessions (28d)",n(c.sessions),delta(c.sessions,pv.sessions))+
      tile("Users",n(c.users),delta(c.users,pv.users))+
      tile("Key events",n(c.keyEvents),delta(c.keyEvents,pv.keyEvents))+
    '</div>';
  } else if(d.ga4Error){h+='<div class="banner">GA4 error: '+d.ga4Error+'</div>';}
  V.innerHTML=h||'<div class="banner">Nothing connected yet.</div>';
});}

function queries(){V.innerHTML="Loading…";api("queries").then(function(d){
  if(!d.gscConfigured){V.innerHTML=cfgBanner("Search Console");return;}
  var rows=(d.rows||[]).map(function(r){return '<tr><td>'+r.q+'</td><td class="n">'+n(r.clicks)+'</td><td class="n">'+n(r.impressions)+'</td><td class="n">'+pct(r.ctr)+'</td><td class="n">'+(r.position||0).toFixed(1)+'</td></tr>';}).join("");
  V.innerHTML='<table><thead><tr><th>Query</th><th class="n">Clicks</th><th class="n">Impr</th><th class="n">CTR</th><th class="n">Pos</th></tr></thead><tbody>'+(rows||'<tr><td colspan=5 class="muted">No data yet.</td></tr>')+'</tbody></table>';
});}

function pages(){V.innerHTML="Loading…";api("pages").then(function(d){
  if(!d.gscConfigured){V.innerHTML=cfgBanner("Search Console");return;}
  function mv(list,cls){return (list||[]).map(function(r){return '<tr><td>'+r.page.replace("https://consentresolve.com","")+'</td><td class="n '+cls+'">'+(r.delta>0?"+":"")+n(r.delta)+'</td></tr>';}).join("");}
  var top=(d.rows||[]).map(function(r){return '<tr><td>'+r.page.replace("https://consentresolve.com","")+'</td><td class="n">'+n(r.clicks)+'</td><td class="n">'+n(r.impressions)+'</td><td class="n">'+(r.position||0).toFixed(1)+'</td></tr>';}).join("");
  V.innerHTML='<div class="card"><h3>Top pages (28d)</h3><table><thead><tr><th>Page</th><th class="n">Clicks</th><th class="n">Impr</th><th class="n">Pos</th></tr></thead><tbody>'+(top||'<tr><td colspan=4 class="muted">No data.</td></tr>')+'</tbody></table></div>'+
  '<div class="card"><h3>Biggest gainers</h3><table><tbody>'+mv(d.gainers,"up")+'</tbody></table></div>'+
  '<div class="card"><h3>Biggest drops</h3><table><tbody>'+mv(d.losers,"dn")+'</tbody></table></div>';
});}

function indexing(){V.innerHTML=
  '<div class="card"><h3>IndexNow</h3><p class="muted" style="line-height:1.5">Instantly notify Bing, Yandex &amp; other IndexNow engines of your live URLs (pulled from the sitemap). Runs automatically every day at 15:00 UTC; Google ignores IndexNow but crawls the sitemap on its own.</p>'+
  '<button class="btn" id="inbtn">Submit all URLs now</button> <span id="inres" class="muted"></span></div>'+
  '<div class="card"><h3>Weekly digest</h3><p class="muted" style="line-height:1.5">A GSC clicks / impressions / top-queries / movers email goes out automatically every <b>Monday 15:00 UTC</b> (to <code>SEO_DIGEST_TO</code>, else <code>QUOTE_TO</code>, else hello@). Send one now to test.</p>'+
  '<button class="btn" id="dgbtn">Email me the digest now</button> <span id="dgres" class="muted"></span></div>';
  document.getElementById("inbtn").onclick=function(){var b=this,r=document.getElementById("inres");b.disabled=true;r.textContent="Submitting…";
    api("indexnow",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}).then(function(d){b.disabled=false;
      r.innerHTML=d.ok?('<span class="up">✓ Submitted '+d.submitted+' URLs (HTTP '+d.status+')</span>'):('<span class="dn">'+(d.error||("HTTP "+d.status))+'</span>');});};
  document.getElementById("dgbtn").onclick=function(){var b=this,r=document.getElementById("dgres");b.disabled=true;r.textContent="Sending…";
    api("digest").then(function(d){b.disabled=false;
      r.innerHTML=d.ok?('<span class="up">✓ Sent to '+d.to+'</span>'):('<span class="dn">'+(d.error||("HTTP "+d.status))+'</span>');});};
}

var tabs={overview:overview,queries:queries,pages:pages,indexing:indexing};
document.querySelectorAll("nav button").forEach(function(b){b.onclick=function(){document.querySelectorAll("nav button").forEach(function(x){x.classList.remove("active");});b.classList.add("active");tabs[b.getAttribute("data-t")]();};});
fetch("/api/crm/auth/me").then(function(r){return r.json();}).then(function(m){if(m&&m.email)document.getElementById("me").textContent=m.email;}).catch(function(){});
overview();
</script></body></html>`;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const keyed = url.searchParams.get("key") && url.searchParams.get("key") === crmKey(env);
  const ok = keyed || (await isAuthed(request, env)) || (await crmSessionEmail(request, env));
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (!ok) return new Response(LOGIN_HTML, { status: 401, headers });
  return new Response(PAGE, { headers });
}
