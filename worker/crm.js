// Gated /crm app shell (Worker-rendered, like /admin). Auth: admin session
// cookie OR ?key=<CRM_KEY>. The client JS reads the key from its own URL and
// calls /api/crm/leads. Slice 1: Leads list + lead detail with editable
// stage/status/value/owner + activity timeline. Other tabs are placeholders.

import { isAuthed, crmSessionEmail } from "./_lib/auth.js";
import { crmKey } from "./api/crm-leads.js";
import { currentUser } from "./_lib/crm-v2.js";

const LOGIN_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Consent Resolve CRM</title>
<body style="margin:0;background:#0a1628;color:#e2e8f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
<div><div style="font-size:20px;font-weight:600;color:#00e5a0">Consent Resolve CRM</div>
<p style="color:#94a3b8;max-width:340px;margin:14px auto 20px">Sign in with your authorized Google account to continue.</p>
<a id="gbtn" href="/api/crm/auth/login" style="display:inline-flex;align-items:center;gap:10px;background:#fff;color:#1f2937;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:8px"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45 24c0-1.6-.1-3.1-.4-4.5H24v9h11.8c-.5 2.7-2 5-4.3 6.6v5.5h7C42.6 36.7 45 30.9 45 24z"/><path fill="#34A853" d="M24 46c5.8 0 10.6-1.9 14.2-5.2l-7-5.5c-1.9 1.3-4.4 2.1-7.2 2.1-5.5 0-10.2-3.7-11.9-8.7H5v5.6C8.6 41.1 15.7 46 24 46z"/><path fill="#FBBC05" d="M12.1 28.7c-.4-1.3-.7-2.7-.7-4.7s.3-3.4.7-4.7v-5.6H5C3.6 16.6 3 20.2 3 24s.6 7.4 2 10.3l7.1-5.6z"/><path fill="#EA4335" d="M24 9.5c3.1 0 5.9 1.1 8.1 3.2l6-6C34.6 3.1 29.8 1 24 1 15.7 1 8.6 5.9 5 13.7l7.1 5.6C13.8 13.2 18.5 9.5 24 9.5z"/></svg>Sign in with Google</a>
<p style="color:#64748b;font-size:12px;margin-top:18px">Admins can also use <a href="/admin" style="color:#64748b">/admin</a>.</p></div>
<script>var b=document.getElementById("gbtn");if(b)b.href="/api/crm/auth/login?next="+encodeURIComponent(location.pathname);</script></body>`;

const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Consent Resolve CRM</title>
<style>
:root{--bg:#0a1628;--surf:#11213b;--surf2:#0d1a30;--line:rgba(255,255,255,.09);--mint:#00e5a0;--ink:#e2e8f0;--mut:#94a3b8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px}
a{color:var(--mint)}
header{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--line)}
.logo{width:22px;height:22px;border-radius:6px;background:var(--mint);color:#04342c;display:flex;align-items:center;justify-content:center;font-weight:800}
nav{display:flex;gap:4px;padding:0 12px;border-bottom:1px solid var(--line)}
nav a{background:none;border:none;border-bottom:2px solid transparent;color:var(--mut);padding:10px 14px;cursor:pointer;font-size:13px;text-decoration:none}
nav a.active{color:#fff;border-bottom-color:var(--mint)}
.wrap{padding:16px 18px;max-width:1100px;margin:0 auto}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
select,input,textarea{background:var(--surf2);border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:7px 9px;font-size:13px}
.gcompose{margin-top:14px;background:#fff;color:#202124;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px -10px rgba(0,0,0,.55);border:1px solid #dadce0}
.gc-hd{padding:10px 16px;border-bottom:1px solid #eceff1;font-size:13px}
.gc-rw{display:flex;gap:10px;padding:3px 0}
.gc-l{width:58px;color:#80868b}
.gc-hd .gc-rw span:last-child{color:#202124}
.gcompose>select{display:block;margin:10px 16px 0;width:calc(100% - 32px);background:#f1f3f4;border:1px solid #dadce0;color:#202124;font-size:13px}
.gc-bd{display:block;width:100%;box-sizing:border-box;border:none;outline:none;background:#fff;color:#202124;padding:14px 16px;font:14px/1.55 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;resize:vertical;min-height:150px;border-radius:0}
.gc-sig{padding:0 16px 12px;color:#80868b;font-size:13px;line-height:1.55}
.gc-uns{font-size:11px;color:#9aa0a6}
.gc-ft{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid #eceff1}
.gc-send{background:#00a86e;color:#fff;border:none;border-radius:20px;padding:9px 26px;font-weight:600;font-size:14px;cursor:pointer}
.gc-send:hover{background:#009160}
.gc-send:disabled{opacity:.6;cursor:default}
.gc-ft .muted{color:#5f6368}
button.btn{background:var(--mint);color:#04342c;border:none;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px}
button.ghost{background:none;border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:8px 14px;cursor:pointer;font-size:13px}
.grid{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:900px){.grid{grid-template-columns:1.3fr 1fr}}
.card{background:var(--surf);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer}
.row:hover,.row.sel{background:var(--surf2)}
.av{width:30px;height:30px;border-radius:50%;background:rgba(0,229,160,.15);color:var(--mint);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
.pill{font-size:11px;padding:2px 8px;border-radius:999px;white-space:nowrap}
.muted{color:var(--mut)}.tiny{font-size:12px}
.detail{padding:16px}
.tl{border-left:1px solid var(--line);margin-left:5px;padding-left:14px}
.tl .it{position:relative;margin-bottom:10px}.tl .it:before{content:"";position:absolute;left:-18px;top:5px;width:7px;height:7px;border-radius:50%;background:var(--mint)}
label.fld{display:block;font-size:11px;color:var(--mut);margin:0 0 3px}
.soon{padding:40px;text-align:center;color:var(--mut)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px}
.tile{background:var(--surf2);border:1px solid var(--line);border-radius:10px;padding:12px}
.tile .l{font-size:12px;color:var(--mut)}.tile .n{font-size:22px;font-weight:700;margin-top:2px}
.track{height:8px;background:var(--surf2);border-radius:999px;overflow:hidden;margin-top:4px}
.fill{height:100%;background:var(--mint)}
.calgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.calcell{border:1px solid var(--line);border-radius:8px;min-height:84px;padding:6px}
.chip{font-size:10.5px;padding:3px 5px;border-radius:4px;color:#fff;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plboard{display:flex;gap:12px;overflow-x:auto;align-items:flex-start;padding-bottom:8px}
.plcol{flex:1 0 175px;min-width:175px;background:var(--surf2);border-radius:10px;padding:8px}
.plcolhead{font-weight:600;font-size:12px;margin-bottom:8px}
.plcard{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:8px;padding:9px;margin-bottom:8px;cursor:pointer}
.plcard:hover{border-color:var(--mint)}
/* Full-screen Gmail-style inbox: list | conversation | customer-intel */
.ibapp{display:flex;height:calc(100dvh - 92px);width:100%}
.ibapp[hidden]{display:none}
.ibcol{overflow-y:auto;height:100%;min-height:0}
.iblist{width:340px;flex:none;border-right:1px solid var(--line)}
.ibthreadcol{flex:1;min-width:0;padding:18px 22px}
.ibintelcol{width:360px;flex:none;border-left:1px solid var(--line);padding:16px;background:var(--surf2)}
.ibtoolbar{display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg);z-index:2}
.ibtoolbar input{flex:1;min-width:0}
.ibtoolbar button.ghost{padding:7px 11px}
.iblist .row{padding:11px 13px}
.iblist .row .ibsub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:1240px){.ibintelcol{width:300px}}
@media(max-width:1040px){.ibintelcol{display:none}}
@media(max-width:820px){.ibapp{flex-direction:column;height:auto}.iblist{width:100%;flex:none;border-right:none;border-bottom:1px solid var(--line);max-height:42vh}.ibthreadcol{flex:none}}
</style></head><body>
<header><div class="logo">✓</div><div style="font-weight:600">Consent Resolve <span class="muted">CRM</span></div><div class="muted tiny" style="margin-left:auto" id="count"></div><div class="muted tiny" id="userBox" style="margin-left:14px"></div></header>
<nav>
<a data-v="inbox" href="/crm/inbox">Inbox</a>
<a data-v="pipeline" href="/crm/pipeline">Pipeline</a>
<a data-v="analytics" href="/crm/analytics">Analytics</a>
<a data-v="roas" href="/crm/roas">Spend</a>
<a data-v="social" href="/crm/social">Social</a>
<a data-v="status" href="/crm/status">Status</a>
<a data-v="settings" href="/crm/settings">Settings</a>
<a data-v="live" href="/crm/live">What's Live</a>
</nav>
<section data-pane="inbox" hidden class="ibapp">
  <div class="ibcol iblist">
    <div class="ibtoolbar">
      <input id="ibSearch" placeholder="Search…" autocomplete="off">
      <select id="ibFilter"><option value="open">Open</option><option value="snoozed">Snoozed</option><option value="archived">Archived</option></select>
      <button class="ghost" id="ibPoll" title="Sync now">↻</button>
    </div>
    <div id="ibList"></div>
  </div>
  <div class="ibcol ibthreadcol" id="ibThread"><div class="soon">Select a conversation</div></div>
  <div class="ibcol ibintelcol" id="ibIntel"><div class="soon" style="padding:24px 12px">Customer intel appears here when you open a conversation.</div></div>
</section>
<div class="wrap">
<section data-pane="live" hidden>
  <div class="bar" style="justify-content:space-between"><div style="font-weight:600;font-size:15px">What's Live <span class="muted tiny" style="font-weight:400">— campaigns in play</span></div><button class="ghost" id="liveRefresh">Refresh</button></div>
  <div id="liveBody"><div class="muted tiny">Loading…</div></div>
</section>
<section data-pane="pipeline" hidden>
  <div class="bar"><div class="muted tiny" id="plMeta"></div><select id="plView" style="margin-left:auto"><option value="bands">Probability bands</option><option value="month">Close month</option></select></div>
  <div id="plBoard" class="plboard"></div>
</section>
<section data-pane="analytics" hidden>
  <div class="bar"><div class="muted tiny" id="anMeta">Loading…</div></div>
  <div class="tiles" id="anTiles"></div>
  <div style="font-weight:600;margin:16px 0 8px">Weighted forecast by close month</div>
  <div class="card" style="padding:14px" id="anForecast"></div>
  <div style="font-weight:600;margin:16px 0 8px">Source / vertical attribution</div>
  <div class="card" id="anAttr"></div>
  <div style="font-weight:600;margin:16px 0 8px">By owner</div>
  <div class="card" id="anOwner"></div>
</section>
<section data-pane="leads" hidden>
  <div class="bar">
    <select id="fInd"><option value="all">All industries</option></select>
    <select id="fSrc"><option value="all">All sources</option><option value="demo">Demo form</option><option value="instantly">Instantly</option><option value="crisp">Crisp</option><option value="apollo">Apollo</option><option value="manual">Manual</option></select>
    <input id="fQ" placeholder="Search" style="flex:1;min-width:120px">
    <button class="btn" id="add">+ Add lead</button>
  </div>
  <div class="grid">
    <div class="card" id="list"></div>
    <div class="card detail" id="detail"><div class="soon">Select a lead</div></div>
  </div>
</section>
<section data-pane="industry" hidden>
  <div class="bar"><select id="indSel"></select></div>
  <div class="tiles" id="indTiles"></div>
  <div class="card" style="padding:16px"><div class="muted tiny" style="margin-bottom:10px">Funnel</div><div id="indFunnel"></div></div>
</section>
<section data-pane="roas" hidden>
  <div class="tiles" id="roasTiles"></div>
  <div class="card" id="metaAdsCard" style="padding:14px;margin-bottom:14px;display:none"></div>
  <div class="card" id="coldEmailCard" style="padding:14px;margin-bottom:14px;display:none"></div>
  <div class="card" id="inboxHealthCard" style="padding:14px;margin-bottom:14px;display:none"></div>
  <div class="bar" style="justify-content:space-between"><div class="muted tiny">Spend by channel</div><button class="ghost" id="addSpend">+ Add spend</button></div>
  <div class="card" style="padding:16px;margin-bottom:14px" id="roasChannels"></div>
  <div class="card" id="spendList"></div>
</section>
<section data-pane="social" hidden>
  <div class="bar"><div class="muted tiny" id="socMeta">Loading…</div><button class="ghost" id="socRefresh" style="margin-left:auto">Refresh</button></div>
  <div style="font-weight:600;margin:8px 0 8px">Channel warm-up grades <span class="muted tiny" style="font-weight:400">— growth trajectory (needs 2+ daily snapshots)</span></div>
  <div id="socChannels" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px"></div>
  <div style="font-weight:600;margin:18px 0 8px">Creative leaderboard</div>
  <div id="socBoard"></div>
  <div style="font-weight:600;margin:18px 0 8px">Promotion queue <span class="muted tiny" style="font-weight:400">— winners flagged to amplify (★ a leaderboard creative)</span></div>
  <div class="card" id="socPromote" style="padding:14px"></div>
  <div style="font-weight:600;margin:18px 0 8px">Google Business Profile</div>
  <div class="card" id="socGbp" style="padding:14px"></div>
  <div class="muted tiny" id="socNote" style="margin-top:12px"></div>
</section>
<section data-pane="status" hidden>
  <div class="bar"><div class="muted tiny" id="stMeta">Loading…</div><button class="ghost" id="stRefresh" style="margin-left:auto">Refresh</button></div>
  <div style="font-weight:600;margin:8px 0 8px">API connections</div>
  <div id="stIntegrations" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px"></div>
  <div style="font-weight:600;margin:18px 0 8px">Google Business Profile <span class="muted tiny" style="font-weight:400">— re-auth + connect</span></div>
  <div class="card" id="stGbp" style="padding:14px"><div class="muted tiny">Loading…</div></div>
  <div style="font-weight:600;margin:18px 0 8px">Google Ads <span class="muted tiny" style="font-weight:400">— API connection</span></div>
  <div class="card" id="stGads" style="padding:14px"><div class="muted tiny">Loading…</div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px">
    <div><div style="font-weight:600;margin-bottom:8px">Last post</div><div class="card" id="stLast" style="padding:14px"></div></div>
    <div><div style="font-weight:600;margin-bottom:8px">Next post</div><div class="card" id="stNext" style="padding:14px"></div></div>
  </div>
  <div style="font-weight:600;margin:18px 0 8px">Pipeline &amp; schedule</div>
  <div id="stPipeline" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px"></div>
</section>
<section data-pane="settings" hidden>
  <div class="card" style="padding:16px;margin-bottom:14px"><div style="font-weight:600;margin-bottom:8px">Gmail — two-way email <span class="muted tiny" style="font-weight:400">— hello@consentresolve.com</span></div><div id="gmailWrap" class="muted tiny">Loading…</div></div>
</section>
</div>
<script>
var CR_ME=__CR_ME__;
var KEY=new URLSearchParams(location.search).get("key")||"";
var ALL=[],SEL=null;
function api(p){var sep=p.indexOf("?")>-1?"&":"?";return fetch(p+(KEY?sep+"key="+encodeURIComponent(KEY):""),{credentials:"same-origin"});}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
var SRC={demo:["rgba(0,229,160,.16)","#7ff0cd"],instantly:["rgba(55,138,221,.18)","#9cc6f3"],crisp:["rgba(127,119,221,.2)","#bcb6f2"],apollo:["rgba(239,159,39,.18)","#f0c27a"],rb2b:["rgba(239,159,39,.18)","#f0c27a"],manual:["rgba(148,163,184,.18)","#cbd5e1"]};
function srcPill(s){var c=SRC[s]||SRC.manual;return '<span class="pill" style="background:'+c[0]+';color:'+c[1]+'">'+esc(s||"manual")+'</span>';}
function stagePill(st,status){if(status==="won")return '<span class="pill" style="background:rgba(0,229,160,.16);color:#7ff0cd">won</span>';if(status==="lost")return '<span class="pill" style="background:rgba(239,75,74,.18);color:#f4a3a3">lost</span>';return '<span class="pill" style="background:rgba(255,255,255,.08);color:#cbd5e1">'+esc(st||"new")+'</span>';}
function money(v){v=Number(v)||0;return v?"$"+v.toLocaleString():"—";}
function initials(n){n=(n||"?").trim();var p=n.split(/\\s+/);return ((p[0]||"")[0]||"?").toUpperCase()+((p[1]||"")[0]||"").toUpperCase();}

function fillIndustries(){var set={};ALL.forEach(function(l){if(l.industry)set[l.industry]=1;});var sel=document.getElementById("fInd");var cur=sel.value;sel.innerHTML='<option value="all">All industries</option>'+Object.keys(set).sort().map(function(i){return '<option value="'+esc(i)+'">'+esc(i)+'</option>';}).join("");sel.value=cur;}
function render(){var q=(document.getElementById("fQ").value||"").toLowerCase();var src=document.getElementById("fSrc").value;var ind=document.getElementById("fInd").value;var rows=ALL.filter(function(l){if(src!=="all"&&l.source!==src)return false;if(ind!=="all"&&l.industry!==ind)return false;if(q&&!((l.name||"")+" "+(l.email||"")+" "+(l.company||"")).toLowerCase().includes(q))return false;return true;});
document.getElementById("count").textContent=rows.length+" leads";
document.getElementById("list").innerHTML=rows.length?rows.map(function(l){return '<div class="row" data-id="'+esc(l.id)+'"><div class="av">'+initials(l.name||l.company)+'</div><div style="flex:1;min-width:0"><div>'+esc(l.name||l.company||"(no name)")+'</div><div class="muted tiny" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(l.company||l.email||"")+'</div></div>'+srcPill(l.source)+stagePill(l.stage,l.status)+'<span style="width:60px;text-align:right">'+money(l.value_usd)+'</span></div>';}).join(""):'<div class="soon">No leads yet.</div>';
[].forEach.call(document.querySelectorAll(".row"),function(r){r.onclick=function(){selPick(r.getAttribute("data-id"));};});}

function selPick(id){[].forEach.call(document.querySelectorAll(".row"),function(r){r.classList.toggle("sel",r.getAttribute("data-id")===id);});
api("/api/crm/leads?id="+encodeURIComponent(id)).then(function(r){return r.json();}).then(function(d){SEL=d.lead;detail(d);});}

function detail(d){var l=d.lead;var rb2b=l.consent_status==="identified";
var tl=[];(d.activity||[]).forEach(function(a){tl.push([a.body||a.type,a.at]);});(d.events||[]).forEach(function(e){tl.push([e.type,e.at]);});
tl.sort(function(a,b){return (b[1]||"").localeCompare(a[1]||"");});
var tlh=tl.length?tl.map(function(t){return '<div class="it"><div>'+esc(t[0])+'</div><div class="muted tiny">'+esc((t[1]||"").replace("T"," ").slice(0,16))+'</div></div>';}).join(""):'<div class="muted tiny">No activity yet.</div>';
document.getElementById("detail").innerHTML=
'<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><div class="av" style="width:40px;height:40px">'+initials(l.name||l.company)+'</div><div style="flex:1;min-width:0"><div style="font-weight:600">'+esc(l.name||l.company||"(no name)")+'</div><div class="muted tiny">'+esc(l.company||"")+(l.email?' · '+esc(l.email):"")+'</div></div>'+srcPill(l.source)+'</div>'+
(rb2b?'<div style="background:rgba(239,159,39,.14);color:#f0c27a;border-radius:8px;padding:9px 11px;font-size:12px;margin-bottom:12px">⚠ Identified visitor — no consent. Retargeting &amp; intel only; cannot be moved into outreach.</div>':"")+
'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">'+
'<div><label class="fld">Stage</label><select id="eStage">'+["new","contacted","qualified","demo","proposal"].map(function(s){return '<option'+(l.stage===s?" selected":"")+'>'+s+'</option>';}).join("")+'</select></div>'+
'<div><label class="fld">Status</label><select id="eStatus">'+["open","won","lost","closed"].map(function(s){return '<option'+(l.status===s?" selected":"")+'>'+s+'</option>';}).join("")+'</select></div>'+
'<div><label class="fld">Value $</label><input id="eVal" type="number" value="'+(Number(l.value_usd)||0)+'"></div>'+
'</div>'+
'<div style="margin-bottom:12px"><label class="fld">Owner</label><input id="eOwner" value="'+esc(l.owner||"")+'" placeholder="Aaron / Tyler"></div>'+
'<div style="margin-bottom:12px"><label class="fld">Add note</label><textarea id="eNote" rows="2" style="width:100%" placeholder="Log a note…"></textarea></div>'+
'<div style="display:flex;gap:8px;margin-bottom:18px"><button class="btn" id="save">Save</button><button class="ghost" id="del" style="border-color:rgba(239,75,74,.45);color:#f4a3a3">Delete</button><span class="muted tiny" id="saveMsg" style="align-self:center"></span></div>'+
'<div class="muted tiny" style="margin-bottom:8px">Activity</div><div class="tl">'+tlh+'</div>'+'<div id="gmailBox" style="margin-top:18px"></div>';
document.getElementById("save").onclick=save;var _del=document.getElementById("del");if(_del)_del.onclick=function(){delLead(l);};loadGmail(l);}
function delLead(l){if(!confirm("Delete this lead? It will be removed from the list."))return;fetch("/api/crm/leads"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({id:l.id,action:"delete"})}).then(function(r){return r.json();}).then(function(res){if(res.error){alert(res.error);return;}document.getElementById("detail").innerHTML='<div class="soon">Lead deleted.</div>';SEL=null;load();});}
function loadGmail(l){var box=document.getElementById("gmailBox");if(!box)return;if(!l.email||l.consent_status==="identified"){box.innerHTML="";return;}box.innerHTML='<div class="muted tiny">Email (Gmail)</div><div class="tiny muted" style="padding:8px 0">Loading…</div>';api("/api/crm/gmail/thread?email="+encodeURIComponent(l.email)).then(function(r){return r.json();}).then(function(d){renderGmail(l,d);}).catch(function(){box.innerHTML="";});}
function renderGmail(l,d){var box=document.getElementById("gmailBox");if(!box)return;if(!d||!d.connected){box.innerHTML='<div class="muted tiny">Email (Gmail)</div><div class="tiny muted" style="padding:8px 0">Connect a Gmail account in Settings to email this lead.</div>';return;}
var msgs=d.messages||[];var thread=msgs.length?msgs.map(function(m){var mine=m.fromMe;return '<div style="margin-bottom:8px;padding:8px 10px;border-radius:8px;background:'+(mine?"rgba(0,229,160,.08)":"var(--surf2)")+'"><div class="tiny muted">'+esc(mine?"You":m.from)+' · '+esc((m.date||"").slice(0,22))+'</div><div class="tiny" style="margin-top:3px">'+esc(m.snippet)+'</div></div>';}).join(""):'<div class="tiny muted" style="padding:6px 0">No email thread yet — start one below.</div>';
var subj=msgs.length?("Re: "+(d.lastSubject||"").replace(/^Re:\\s*/i,"")):"";
box.innerHTML='<div class="muted tiny" style="margin-bottom:6px">Email (Gmail · '+esc(d.account)+')</div>'+thread+'<div style="margin-top:8px"><input id="gSubj" value="'+esc(subj)+'" placeholder="Subject" style="width:100%;margin-bottom:6px"><textarea id="gBody" rows="3" placeholder="Write a reply…" style="width:100%"></textarea><div style="margin-top:8px"><button class="btn" id="gSend">Send</button> <span class="muted tiny" id="gMsg"></span></div></div>';
document.getElementById("gSend").onclick=function(){sendGmail(l,d);};}
function sendGmail(l,d){var body=document.getElementById("gBody").value;if(!body.trim())return;var subj=document.getElementById("gSubj").value;document.getElementById("gMsg").textContent="Sending…";fetch("/api/crm/gmail/send"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({to:l.email,subject:subj,body:body,threadId:d.threadId,account:d.account,leadId:l.id})}).then(function(r){return r.json();}).then(function(res){if(res.error){document.getElementById("gMsg").textContent=res.error;return;}document.getElementById("gMsg").textContent="Sent ✓";load(l.id);});}

function save(){if(!SEL)return;var body={id:SEL.id,stage:document.getElementById("eStage").value,status:document.getElementById("eStatus").value,value_usd:document.getElementById("eVal").value,owner:document.getElementById("eOwner").value};var note=document.getElementById("eNote").value.trim();if(note)body.note=note;
document.getElementById("saveMsg").textContent="Saving…";
api("/api/crm/leads").then(function(){return fetch("/api/crm/leads"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});}).then(function(r){return r.json();}).then(function(res){if(res.error){document.getElementById("saveMsg").textContent=res.message||res.error;return;}document.getElementById("saveMsg").textContent="Saved";load(SEL.id);});}

function add(){var name=prompt("Lead name");if(!name)return;var email=prompt("Email (required)");if(!email)return;var industry=prompt("Industry slug (e.g. hvac)")||"";var company=prompt("Company")||"";
fetch("/api/crm/leads"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({create:true,name:name,email:email,industry:industry,company:company,source:"manual"})}).then(function(r){return r.json();}).then(function(res){if(res.error){alert(res.message||res.error);return;}load(res.id);});}

function load(selId){api("/api/crm/leads").then(function(r){return r.json();}).then(function(d){if(d.error){document.getElementById("list").innerHTML='<div class="soon">'+esc(d.error)+' — append ?key=</div>';return;}ALL=d.leads||[];fillIndustries();render();if(selId)selPick(selId);});}

var ANALYTICS=null,SCORES=null;
function tile(l,n){return '<div class="tile"><div class="l">'+l+'</div><div class="n">'+n+'</div></div>';}
function ensureAnalytics(){if(ANALYTICS){return;}api("/api/crm/analytics").then(function(r){return r.json();}).then(function(d){ANALYTICS=d;renderIndustries();renderRoas();});}
function renderIndustries(){if(!ANALYTICS)return;var inds=ANALYTICS.industries||[];var sel=document.getElementById("indSel");if(!sel.options.length){sel.innerHTML=inds.map(function(x){return '<option>'+esc(x.industry)+'</option>';}).join("");sel.onchange=drawIndustry;}drawIndustry();}
function drawIndustry(){var inds=ANALYTICS.industries||[];var name=document.getElementById("indSel").value||(inds[0]&&inds[0].industry);var x=null;inds.forEach(function(i){if(i.industry===name)x=i;});x=x||inds[0];if(!x){document.getElementById("indTiles").innerHTML='<div class="soon">No data yet.</div>';document.getElementById("indFunnel").innerHTML="";return;}
document.getElementById("indTiles").innerHTML=tile("Cost / lead",x.cpl?"$"+x.cpl:"—")+tile("Cost / booked",x.cac?"$"+x.cac:"—")+tile("Win rate",x.demos?x.winRate+"%":"—")+tile("Revenue",money(x.revenue));
var steps=[["Visits",x.visits],["Leads",x.leads],["Demos",x.demos],["Booked",x.won]];var max=Math.max(1,x.visits,x.leads);
document.getElementById("indFunnel").innerHTML=steps.map(function(s){var pct=Math.round(100*s[1]/max);return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>'+s[0]+'</span><span style="font-weight:700">'+s[1]+'</span></div><div class="track"><div class="fill" style="width:'+Math.max(2,pct)+'%"></div></div></div>';}).join("");}
function renderRoas(){if(!ANALYTICS)return;var t=ANALYTICS.totals||{};document.getElementById("roasTiles").innerHTML=tile("Spend",money(t.spend))+tile("Revenue",money(t.revenue))+tile("ROAS",(t.roas||0)+"×")+tile("Blended CAC",t.cac?"$"+t.cac:"—");
var bc=ANALYTICS.byChannel||{};var keys=Object.keys(bc);var max=1;keys.forEach(function(k){if(bc[k]>max)max=bc[k];});
document.getElementById("roasChannels").innerHTML=keys.length?keys.map(function(k){var pct=Math.round(100*bc[k]/max);return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>'+esc(k)+'</span><span style="font-weight:700">'+money(bc[k])+'</span></div><div class="track"><div class="fill" style="width:'+Math.max(2,pct)+'%"></div></div></div>';}).join(""):'<div class="muted tiny">No spend logged yet — add some with “+ Add spend”.</div>';
api("/api/crm/spend").then(function(r){return r.json();}).then(function(d){var s=d.spend||[];var el=document.getElementById("spendList");el.innerHTML=s.length?s.map(function(r){var synced=(r.channel==="facebook"&&r.note&&r.note.indexOf("meta:")===0);var chl=synced?'Facebook <span class="muted tiny">(Meta API)</span>':esc(r.channel);return '<div class="row" style="cursor:default"><div style="flex:1">'+chl+' <span class="muted">'+esc(r.industry||"")+'</span></div><div class="muted tiny">'+esc((r.period||r.created_at||"").slice(0,10))+'</div><div style="width:70px;text-align:right;font-weight:700">'+money(r.amount_usd)+'</div><button class="ghost spdel" data-id="'+esc(r.id)+'" title="Delete entry" style="margin-left:8px;padding:1px 8px;line-height:1.2">×</button></div>';}).join(""):'<div class="soon">No spend entries.</div>';var dl=el.querySelectorAll(".spdel");for(var i=0;i<dl.length;i++){dl[i].onclick=function(){var id=this.getAttribute("data-id");if(!confirm("Delete this spend entry?"))return;fetch("/api/crm/spend"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({delete:true,id:id})}).then(function(r){return r.json();}).then(function(res){if(res&&res.ok){crmToast("Spend entry deleted",true);ANALYTICS=null;ensureAnalytics();}else{crmToast((res&&res.error)||"Delete failed",false);}});};}});renderMetaAds();renderColdEmail();renderInboxHealth();}
function liveBadge(on){return '<span class="pill" style="background:'+(on?"rgba(0,229,160,.16)":"rgba(148,163,184,.16)")+';color:'+(on?"#7ff0cd":"#94a3b8")+';font-weight:700">'+(on?"● LIVE":"paused")+'</span>';}
function renderLive(){var box=document.getElementById("liveBody");if(!box)return;box.innerHTML='<div class="muted tiny">Loading…</div>';var rb=document.getElementById("liveRefresh");if(rb)rb.onclick=function(){renderLive();};var html="";api("/api/crm/instantly?funnel=1&campaign=db0041db-080e-4d33-9816-4e66ddd9239c&utm=hvac_2026&trade=hvac").then(function(r){return r.json();}).then(function(d){var f=(d&&d.funnel)||{};var ins=f.instantly||{};var on=(f.campaignStatus===1);html+='<div class="card" style="padding:16px;margin-bottom:14px"><div class="muted tiny" style="margin-bottom:8px;letter-spacing:.08em;text-transform:uppercase">Cold Email · Instantly</div><div style="display:flex;align-items:center;gap:10px;padding:4px 0"><span style="flex:1;font-weight:600">'+esc(f.campaignName||"HVAC TX 2026")+'</span>'+liveBadge(on)+'</div><div class="muted tiny" style="margin-top:4px">'+(ins.leads!=null?ins.leads+" leads":"643 leads")+' · '+((ins.replied!=null?ins.replied:(f.repliesInbox||0))+" replied")+' · '+(f.landed||0)+' landed</div></div>';return api("/api/crm/meta/spend");}).then(function(r){return r.json();}).then(function(d){if(d&&d.configured){var camps=(d.status&&d.status.campaigns)||[];var auds=(d.status&&d.status.audiences)||[];var mo=(d.month&&d.month.ok)?d.month.total:0;html+='<div class="card" style="padding:16px;margin-bottom:14px"><div class="muted tiny" style="margin-bottom:8px;letter-spacing:.08em;text-transform:uppercase">Paid Ads · Meta</div>'+(camps.length?camps.map(function(c){var bud=(c.dailyBudget!=null)?money(c.dailyBudget)+"/day":(c.lifetimeBudget!=null?money(c.lifetimeBudget)+" lifetime":"");return '<div style="display:flex;align-items:center;gap:10px;padding:4px 0"><span style="flex:1;font-weight:600">'+esc(c.name)+'</span>'+(bud?'<span class="muted tiny" style="font-weight:600">'+bud+'</span>':"")+liveBadge((c.status||"").indexOf("ACTIVE")>-1)+'</div>';}).join(""):'<div class="muted tiny">No campaigns yet.</div>')+'<div class="muted tiny" style="margin-top:8px">This month: '+money(mo)+(auds.length?' · audiences: '+auds.map(function(a){return esc(a.name)+" ("+(a.count!=null?a.count.toLocaleString():"—")+")";}).join(", "):"")+'</div></div>';}else{html+='<div class="card" style="padding:16px;margin-bottom:14px"><div class="muted tiny" style="letter-spacing:.08em;text-transform:uppercase">Paid Ads · Meta</div><div class="muted tiny" style="margin-top:6px">Set META_ACCESS_TOKEN in Cloudflare to show Meta campaigns.</div></div>';}box.innerHTML=html||'<div class="muted tiny">Nothing live yet.</div>';}).catch(function(){box.innerHTML='<div class="muted tiny">Could not load campaign status.</div>';});}
function renderInboxHealth(){var box=document.getElementById("inboxHealthCard");if(!box)return;api("/api/crm/instantly?health=1").then(function(r){return r.json();}).then(function(d){if(!d||!d.configured||!d.accounts||!d.accounts.length){box.style.display="none";return;}box.style.display="block";var dot=function(h){var c=(h==="ok")?"#34d399":((h==="warn")?"#fbbf24":"#fda4af");return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+c+'"></span>';};var rows=d.accounts.map(function(a){return '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-top:1px solid rgba(148,163,184,.1)">'+dot(a.health)+'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(a.email)+'</span><span class="muted tiny">'+(a.score!=null?("warmup "+a.score):(a.setupPending?"setup pending":"—"))+'</span><span class="muted tiny" style="width:64px;text-align:right">'+a.dailyLimit+'/day</span></div>';}).join("");var warn=d.total-d.healthy;box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div style="font-weight:700">Sending inboxes <span class="muted tiny" style="font-weight:400">· deliverability</span></div><span class="tiny" style="color:'+(warn?"#fbbf24":"#34d399")+'">'+d.healthy+'/'+d.total+' healthy · '+d.dailyCapacity+'/day</span></div>'+rows;}).catch(function(){box.style.display="none";});}
function renderColdEmail(){var box=document.getElementById("coldEmailCard");if(!box)return;api("/api/crm/instantly?funnel=1&campaign=db0041db-080e-4d33-9816-4e66ddd9239c&utm=hvac_2026&trade=hvac").then(function(r){return r.json();}).then(function(d){if(!d||!d.funnel){box.style.display="none";return;}var f=d.funnel;var ins=f.instantly||{};box.style.display="block";var stage=function(label,val,note){return '<div style="flex:1;min-width:74px;text-align:center"><div style="font-size:19px;font-weight:800">'+(val==null?"—":val)+'</div><div class="muted tiny">'+label+'</div>'+(note?'<div class="muted tiny" style="opacity:.65">'+note+'</div>':'')+'</div>';};var arrow='<div style="align-self:center;color:#475569">→</div>';var row=[stage("Leads",ins.leads),arrow,stage("Replied",ins.replied),arrow,stage("Landed",f.landed,"first-party"),arrow,stage("Demos",f.demos,"trade"),arrow,stage("Won",f.won),arrow,stage("Revenue",f.revenueUsd?money(f.revenueUsd):"$0")].join("");var ci=function(l,v){return '<span style="white-space:nowrap"><b style="color:#e2e8f0">'+(v!=null?money(v):"—")+'</b> <span class="muted">'+l+'</span></span>';};var ri=function(l,v){return '<span style="white-space:nowrap"><b style="color:#e2e8f0">'+(v!=null?v+"%":"—")+'</b> <span class="muted">'+l+'</span></span>';};var cp=f.costPer||{};var rt=f.rates||{};var costRow='<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(148,163,184,.15);display:flex;gap:14px;flex-wrap:wrap;font-size:12px;align-items:center">'+ci("cost/reply",cp.reply)+ci("cost/demo",cp.demo)+ci("cost/won",cp.won)+ri("reply rate",rt.reply)+ri("demo rate",rt.demo)+ri("win rate",rt.win)+(f.roas?'<span style="white-space:nowrap"><b style="color:#7ff0cd">'+f.roas+'×</b> <span class="muted">ROAS</span></span>':"")+'</div>'+(!f.spendUsd?'<div class="muted tiny" style="margin-top:6px">Log Instantly spend in the Spend tab (channel instantly) for cost-per-reply/demo/won.</div>':"");box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div style="font-weight:700">Cold Email → Revenue <span class="muted tiny" style="font-weight:400">· HVAC wave</span></div><span class="muted tiny">'+(f.repliesInbox||0)+' replies in inbox</span></div><div style="display:flex;gap:6px;flex-wrap:wrap">'+row+'</div>'+costRow+(!d.configured?'<div class="muted tiny" style="margin-top:8px">Set INSTANTLY_API_KEY in Cloudflare to populate send/reply stats.</div>':'');}).catch(function(){box.style.display="none";});}
function crmToast(msg,ok){var t=document.createElement("div");t.textContent=msg;t.style.cssText="position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600;color:#0a1628;background:"+(ok===false?"#fda4af":"#34d399")+";box-shadow:0 6px 24px rgba(0,0,0,.35);opacity:0;transition:opacity .2s";document.body.appendChild(t);requestAnimationFrame(function(){t.style.opacity="1";});setTimeout(function(){t.style.opacity="0";setTimeout(function(){t.remove();},250);},3200);}
function renderMetaAds(){var box=document.getElementById("metaAdsCard");if(!box)return;api("/api/crm/meta/spend").then(function(r){return r.json();}).then(function(d){if(!d||!d.configured){box.style.display="none";return;}box.style.display="block";var mo=(d.month&&d.month.ok)?d.month:null;var l30=(d.last30&&d.last30.ok)?d.last30:null;var err=(d.month&&d.month.error)?d.month.error:"";var rows=((mo&&mo.rows)||[]).filter(function(x){return x.spend>0;}).sort(function(a,b){return b.spend-a.spend;});var list=rows.length?rows.map(function(x){return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span style="max-width:70%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.campaign)+'</span><span style="font-weight:700">'+money(x.spend)+'</span></div>';}).join(""):'<div class="muted tiny">No active campaigns with spend this month.</div>';var st=d.status||{};var auds=st.audiences||[];var camps=st.campaigns||[];var audHtml=auds.length?'<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(148,163,184,.15)"><div class="muted tiny" style="margin-bottom:4px">Custom audiences (need ~1,000 to deliver)</div>'+auds.map(function(a){var small=(a.count!=null&&a.count<1000);return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="max-width:66%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(a.name)+'</span><span style="font-weight:700;color:'+(small?"#fda4af":"#34d399")+'">'+(a.count!=null?a.count.toLocaleString():"—")+(small?" ⚠ too small":"")+'</span></div>';}).join("")+'</div>':"";var anyAdset=false;for(var ci=0;ci<camps.length;ci++){if(camps[ci].budgetLevel==="adset")anyAdset=true;}var campHtml=camps.length?'<div style="margin-top:8px"><div class="muted tiny" style="margin-bottom:4px">Campaigns · daily budget</div>'+camps.map(function(c){var active=(c.status||"").indexOf("ACTIVE")>-1;var bud=(c.dailyBudget!=null)?money(c.dailyBudget)+"/day":(c.lifetimeBudget!=null?money(c.lifetimeBudget)+" lifetime":"—");var star=(c.budgetLevel==="adset")?'<span class="muted" style="font-weight:400">*</span>':"";return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.name)+'</span><span style="font-weight:700;color:#e2e8f0;white-space:nowrap">'+bud+star+'</span><span style="font-size:11px;width:64px;text-align:right;color:'+(active?"#34d399":"#94a3b8")+'">'+esc((c.status||"").split("_").join(" ").toLowerCase())+'</span></div>';}).join("")+(anyAdset?'<div class="muted tiny" style="margin-top:4px">* budget set at the ad-set level (sum of active ad sets)</div>':"")+'</div>':"";var statusHtml=audHtml+campHtml;box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div style="font-weight:700">Meta Ads <span class="muted tiny" style="font-weight:400">· live from Facebook</span></div><button class="ghost" id="metaSync">Sync to spend log</button></div>'+(err?('<div class="tiny" style="color:#fda4af">Graph API: '+esc(err)+'</div>'):('<div style="display:flex;gap:24px;margin-bottom:10px"><div><div class="muted tiny">This month</div><div style="font-size:20px;font-weight:800">'+money(mo?mo.total:0)+'</div></div><div><div class="muted tiny">Last 30 days</div><div style="font-size:20px;font-weight:800">'+money(l30?l30.total:0)+'</div></div></div>'+list))+statusHtml;var b=document.getElementById("metaSync");if(b)b.onclick=function(){b.textContent="Syncing…";b.disabled=true;fetch("/api/crm/meta/spend"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",credentials:"same-origin"}).then(function(r){return r.json();}).then(function(res){b.disabled=false;b.textContent="Sync to spend log";if(res&&res.ok){crmToast("Synced "+(res.synced||0)+" campaign"+(res.synced===1?"":"s")+" · "+money(res.total||0)+" pulled from Facebook",true);ANALYTICS=null;ensureAnalytics();}else{crmToast((res&&res.error)||"Sync failed",false);}}).catch(function(){b.disabled=false;b.textContent="Sync to spend log";crmToast("Sync failed",false);});};}).catch(function(){box.style.display="none";});}
function doAddSpend(){var amount=prompt("Amount $ (e.g. 500)");if(!amount)return;var channel=prompt("Channel (google/instantly/apollo/crisp/other) — Facebook syncs automatically, don't add it here","google")||"other";var industry=prompt("Industry slug (e.g. hvac), optional","")||"";var period=prompt("Period (YYYY-MM, optional)","")||"";
fetch("/api/crm/spend"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({amount_usd:amount,channel:channel,industry:industry,period:period})}).then(function(r){return r.json();}).then(function(res){if(res.error){alert(res.error);return;}ANALYTICS=null;ensureAnalytics();});}
var CHNAME={youtube:"YouTube",instagram:"Instagram",facebook:"Facebook",x:"X",linkedin:"LinkedIn",tiktok:"TikTok"};
function covPill(c){var m={FULL:["rgba(0,229,160,.16)","#7ff0cd"],PARTIAL:["rgba(239,159,39,.18)","#f0c27a"],MINIMAL:["rgba(136,135,128,.2)","#b9b7ad"]};var x=m[c]||m.MINIMAL;return '<span class="pill" style="background:'+x[0]+';color:'+x[1]+'">'+c+'</span>';}
function gradeColor(g){if(g==="A"||g==="B")return "#00e5a0";if(g==="C")return "#f0c27a";if(g==="D"||g==="F")return "#f08a8a";return "#888780";}
function ensureSocial(){if(SCORES){renderScores();return;}var sm=document.getElementById("socMeta");if(sm)sm.textContent="Loading…";api("/api/crm/social/scores").then(function(r){return r.json();}).then(function(d){SCORES=d;renderScores();}).catch(function(){if(sm)sm.textContent="Failed to load scores.";});}
function renderScores(){var d=SCORES||{};
document.getElementById("socMeta").textContent="As of "+(d.generatedAt||"—")+" · "+(d.totalPosts||0)+" posts, "+(d.gradedPosts||0)+" graded";
document.getElementById("socChannels").innerHTML=(d.channels||[]).map(function(c){
var g=c.grade||"—";
var fol=(c.followers!=null)?(c.followers.toLocaleString()+" followers"+(c.followerDelta?(" · "+(c.followerDelta>0?"+":"")+c.followerDelta):"")):"warm-up: baseline pending";
var cre=c.creativeGrade?("creative "+c.creativeGrade):(c.posts?(c.posts+" posts · warming up"):"no posts yet");
return '<div class="card" style="padding:12px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-weight:600;font-size:13px">'+CHNAME[c.channel]+'</span>'+covPill(c.coverage)+'</div><div style="font-size:30px;font-weight:800;line-height:1.1;color:'+gradeColor(c.grade)+'">'+g+'</div><div class="muted tiny">'+fol+'</div><div class="muted tiny">'+cre+'</div></div>';
}).join("");
var ps=d.posts||[];var hint=(d.gradedPosts?"":'<div class="muted tiny" style="margin-bottom:8px">Below-floor posts shown for visibility — grades appear once a post clears the floor (IG/FB 500 reach; YT/X/LI/TT ~900 views/impr).</div>');
document.getElementById("socBoard").innerHTML=ps.length?(hint+ps.map(function(s,i){
var left=s.graded?'<div style="width:70px"><span style="font-weight:800;color:'+gradeColor(s.grade)+'">'+s.grade+'</span> <span class="muted tiny">'+s.composite+'</span></div>':'<div style="width:70px"><span class="pill" style="background:rgba(136,135,128,.2);color:#b9b7ad">below floor</span></div>';
var tail=s.graded?(covPill(s.coverage)+(s.graduate?'<span class="pill" style="background:rgba(0,229,160,.16);color:#7ff0cd;margin-left:6px">GRADUATE</span>':"")):"";
return '<div class="row" style="cursor:default"><div style="width:22px" class="muted tiny">'+(i+1)+'</div>'+left+'<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(String(s.name))+' <span class="muted tiny">'+(CHNAME[s.platform]||s.platform)+'</span></div>'+tail+'<div style="width:96px;text-align:right" class="muted tiny">'+(s.views||0)+' v · '+(s.likes||0)+' ♥</div>'+(s.graded?'<button class="ghost spromote" data-name="'+esc(String(s.name))+'" data-platform="'+esc(s.platform||"")+'" data-mode="'+(s.graduate?"paid":"organic")+'" title="'+(s.graduate?"Push to a Meta ad":"Re-post more often")+'" style="margin-left:8px;padding:2px 8px">★</button>':'')+'</div>';
}).join("")):'<div class="soon">No posts pulled yet — check channel credentials (IG/Buffer/YouTube) in the metrics Action.</div>';
var pbtns=document.querySelectorAll(".spromote");for(var pi=0;pi<pbtns.length;pi++){pbtns[pi].onclick=function(){var nm=this.getAttribute("data-name");var pf=this.getAttribute("data-platform");var md=this.getAttribute("data-mode");var self=this;self.disabled=true;fetch("/api/crm/social/promote"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({name:nm,platform:pf,mode:md})}).then(function(r){return r.json();}).then(function(res){self.disabled=false;if(res&&res.ok){crmToast(res.already?"Already queued":("Queued for "+(md==="paid"?"paid promotion":"organic re-boost")),true);renderPromoteQueue();}else{crmToast((res&&res.error)||"Failed",false);}});};}
renderPromoteQueue();
var gb=d.gbp||{};document.getElementById("socGbp").innerHTML=gb.available?"":'<div class="muted tiny">'+esc(gb.note||"GBP pending.")+'</div>';
document.getElementById("socNote").textContent=d.note||"";
var rb=document.getElementById("socRefresh");if(rb)rb.onclick=function(){SCORES=null;ensureSocial();};}
function renderPromoteQueue(){var box=document.getElementById("socPromote");if(!box)return;api("/api/crm/social/promote").then(function(r){return r.json();}).then(function(d){var q=(d&&d.queue)||[];if(!q.length){box.innerHTML='<div class="muted tiny">Nothing queued. Hit ★ on a leaderboard creative — graduates queue for a Meta ad, others for organic re-boost.</div>';return;}box.innerHTML=q.map(function(x){var mb=(x.mode==="paid")?'<span class="pill" style="background:rgba(251,191,36,.16);color:#fcd34d">paid → Meta ad</span>':'<span class="pill" style="background:rgba(55,138,221,.18);color:#9cc6f3">organic re-boost</span>';return '<div class="row" style="cursor:default"><div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(x.name)+' <span class="muted tiny">'+esc(x.platform||"")+'</span></div>'+mb+'<button class="ghost sprmdel" data-id="'+esc(x.id)+'" title="Remove" style="margin-left:8px;padding:1px 8px">×</button></div>';}).join("");var dl=box.querySelectorAll(".sprmdel");for(var i=0;i<dl.length;i++){dl[i].onclick=function(){var id=this.getAttribute("data-id");fetch("/api/crm/social/promote"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({remove:true,id:id})}).then(function(r){return r.json();}).then(function(){renderPromoteQueue();});};}}).catch(function(){});}
var STATUS=null;
function stDot(ok){return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:middle;margin-right:7px;background:'+(ok===true?"#00e5a0":ok===false?"#f08a8a":"#888780")+'"></span>';}
function ensureStatus(){renderGbpConnect();renderGadsConnect();if(STATUS){renderStatus();return;}var m=document.getElementById("stMeta");if(m)m.textContent="Loading…";api("/api/crm/status").then(function(r){return r.json();}).then(function(d){STATUS=d;renderStatus();}).catch(function(){if(m)m.textContent="Failed to load status.";});}
function renderGadsConnect(){var box=document.getElementById("stGads");if(!box)return;api("/api/crm/gads/status").then(function(r){return r.json();}).then(function(d){if(!d){box.innerHTML='<div class="muted tiny">unavailable</div>';return;}var pill=function(ok,yes,no){return '<span class="pill" style="background:'+(ok?"rgba(0,229,160,.16)":"rgba(239,159,39,.18)")+';color:'+(ok?"#7ff0cd":"#f0c27a")+'">'+(ok?yes:no)+'</span>';};var cust=(d.customers&&d.customers.length)?('<div class="tiny" style="margin-bottom:8px"><span class="muted">accounts:</span> '+d.customers.map(esc).join(", ")+'</div>'):'';var dataPill=d.dataAccess?pill(d.dataAccess==="ok","data access ✓",(d.dataAccess==="pending"?"awaiting Basic access":"data error")):"";box.innerHTML='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">'+pill(d.has_dev_token,"dev token set","dev token missing")+pill(d.hasToken,"authed","needs connect")+pill(d.connected,"● connected","not connected")+dataPill+'</div>'+(d.accessNote?('<div class="muted tiny" style="margin-bottom:8px">'+esc(d.accessNote)+'</div>'):"")+(d.error?('<div class="tiny" style="color:#fda4af;margin-bottom:8px">'+esc(d.error)+'</div>'):cust)+'<div class="muted tiny" style="margin-bottom:4px">Redirect URI to register on the OAuth client:</div><code style="color:#cbd5e1;font-size:12px;word-break:break-all">'+esc(d.redirect_uri||"")+'</code><div style="margin-top:12px"><a class="btn" href="/api/crm/gads/auth'+(KEY?"?key="+encodeURIComponent(KEY):"")+'">Connect Google Ads</a></div><div class="muted tiny" style="margin-top:10px">Set GOOGLE_ADS_DEVELOPER_TOKEN + GOOGLE_ADS_LOGIN_CUSTOMER_ID in Cloudflare. The green "● connected" confirms the dev token + Basic access are live.</div>';}).catch(function(){box.innerHTML='<div class="muted tiny">unavailable</div>';});}
function renderGbpConnect(){var box=document.getElementById("stGbp");if(!box)return;api("/api/crm/gbp/status").then(function(r){return r.json();}).then(function(d){if(!d){box.innerHTML='<div class="muted tiny">unavailable</div>';return;}var pill=function(ok,yes,no){return '<span class="pill" style="background:'+(ok?"rgba(0,229,160,.16)":"rgba(239,159,39,.18)")+';color:'+(ok?"#7ff0cd":"#f0c27a")+'">'+(ok?yes:no)+'</span>';};box.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+pill(d.connected,"re-auth done","needs re-auth")+pill(!!(d.account_id&&d.location_id),"IDs set","IDs missing")+'</div>'+'<div class="muted tiny" style="margin-bottom:4px">1) Register this redirect URI on the OAuth client (Google Cloud Console → APIs &amp; Services → Credentials):</div><code style="color:#cbd5e1;font-size:12px;word-break:break-all">'+esc(d.redirect_uri||"")+'</code>'+'<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="/api/crm/gbp/auth'+(KEY?"?key="+encodeURIComponent(KEY):"")+'">Connect / re-auth GBP</a><button class="ghost" id="gbpFindIds">Find my account + location IDs</button></div><div id="gbpIds" style="margin-top:10px"></div>';var fb=document.getElementById("gbpFindIds");if(fb)fb.onclick=function(){var rr=document.getElementById("gbpIds");rr.innerHTML='<div class="muted tiny">Looking up…</div>';api("/api/crm/gbp/locations").then(function(x){return x.json();}).then(function(g){if(!g||g.error){rr.innerHTML='<div class="tiny" style="color:#fda4af">'+esc((g&&(g.detail||g.message||g.error))||"lookup failed")+'</div>';return;}var accs=g.accounts||[];if(!accs.length){rr.innerHTML='<div class="muted tiny">No business accounts found for this Google login.</div>';return;}rr.innerHTML=accs.map(function(a){var locs=(a.locations||[]).map(function(l){return '<div style="padding:3px 0"><span class="muted tiny">GBP_LOCATION_ID =</span> <code style="color:#7ff0cd">'+esc(l.location_id)+'</code> <span class="muted tiny">'+esc(l.title||"")+'</span></div>';}).join("")||'<div class="muted tiny">no locations on this account</div>';return '<div class="card" style="padding:10px;margin-bottom:8px"><div style="padding:3px 0"><span class="muted tiny">GBP_ACCOUNT_ID =</span> <code style="color:#7ff0cd">'+esc(a.account_id)+'</code> <span class="muted tiny">'+esc(a.account_name||"")+'</span></div>'+locs+'</div>';}).join("")+'<div class="muted tiny">Set these two values in Cloudflare, then re-test.</div>';});};}).catch(function(){box.innerHTML='<div class="muted tiny">unavailable</div>';});}
function renderStatus(){var d=STATUS||{};document.getElementById("stMeta").textContent="As of "+(d.generatedAt||"—");
document.getElementById("stIntegrations").innerHTML=(d.integrations||[]).map(function(i){return '<div class="card" style="padding:12px"><div style="font-weight:600;font-size:13px">'+stDot(i.connected)+esc(i.label)+'</div><div class="muted tiny" style="margin-top:5px">'+esc(i.detail||"")+'</div></div>';}).join("");
function pc(p,empty){if(!p)return '<div class="muted tiny">'+empty+'</div>';return '<div style="font-weight:600">'+esc(String(p.name||p.platform))+'</div><div class="muted tiny" style="margin-top:4px">'+esc(p.platform||"")+(p.at?(" · "+esc(p.at)):"")+'</div>'+(p.url?('<div class="tiny" style="margin-top:5px"><a href="'+esc(p.url)+'" target="_blank" style="color:#7ff0cd">view →</a></div>'):"");}
document.getElementById("stLast").innerHTML=pc(d.lastPost,"No published posts yet.");
document.getElementById("stNext").innerHTML=pc(d.nextPost,"Nothing queued.");
var pp=d.pipeline||{};function pcard(l,v){return '<div class="card" style="padding:12px"><div class="muted tiny">'+l+'</div><div style="font-weight:600;font-size:13px;margin-top:4px">'+esc(v||"—")+'</div></div>';}
var sp=document.getElementById("stPipeline");if(sp)sp.innerHTML=pcard("Metrics last refreshed",pp.metricsUpdatedAt)+pcard("Next metrics refresh",pp.nextMetricsRefresh)+pcard("Next social drip",pp.nextSocialDrip)+pcard("Apollo sync",pp.apolloSync);
var sr=document.getElementById("stRefresh");if(sr)sr.onclick=function(){STATUS=null;ensureStatus();};}

function ensureSettings(){api("/api/crm/gmail/status").then(function(r){return r.json();}).then(function(d){renderGmailAccounts(d);});}
function loadMerges(){api("/api/crm/merge").then(function(r){return r.json();}).then(function(d){var w=document.getElementById("mergeWrap");if(!w)return;var s=(d&&d.suggestions)||[];if(!s.length){w.innerHTML='No merge suggestions.';return;}
w.innerHTML=s.map(function(x){return '<div class="row" style="cursor:default"><div style="flex:1;min-width:0">'+esc(x.name||"")+' <span class="muted">— anon ('+esc(x.from_source||"")+') → '+esc(x.into_email||"")+'</span></div><button class="ghost" data-from="'+esc(x.from_id)+'" data-into="'+esc(x.into_id)+'">Merge</button></div>';}).join("");
[].forEach.call(w.querySelectorAll("button"),function(b){b.onclick=function(){b.disabled=true;b.textContent="Merging…";fetch("/api/crm/merge",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({from_id:b.getAttribute("data-from"),into_id:b.getAttribute("data-into")})}).then(function(r){return r.json();}).then(function(res){if(res.error){b.disabled=false;b.textContent="Merge";alert(res.error);return;}loadMerges();}).catch(function(){b.disabled=false;b.textContent="Merge";});};});});}
function renderGmailAccounts(d){var w=document.getElementById("gmailWrap");if(!d||d.error){w.textContent="unavailable";return;}
var accts=(d.accounts||[]).map(function(a){return '<div class="row" style="cursor:default"><div style="flex:1">'+esc(a.email)+'</div><span class="pill" style="background:rgba(0,229,160,.16);color:#7ff0cd">connected</span></div>';}).join("")||'<div class="muted tiny">No accounts connected yet.</div>';
var cfg=d.configured?"":'<div style="background:rgba(239,159,39,.14);color:#f0c27a;border-radius:8px;padding:9px 11px;margin-bottom:10px">Set GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET in Cloudflare first (or reuse GOOGLE_*), then redeploy.</div>';
w.innerHTML=cfg+accts+'<div style="margin-top:12px"><button class="btn" id="gConnect"'+(d.configured?"":" disabled")+'>+ Connect Gmail account</button></div><div class="muted tiny" style="margin-top:10px">Authorized redirect URI to register on the OAuth client:<br><code style="color:#cbd5e1">'+esc(d.redirect_uri||"")+'</code></div>';
var gc=document.getElementById("gConnect");if(gc)gc.onclick=function(){location.href="/api/crm/gmail/auth"+(KEY?"?key="+encodeURIComponent(KEY):"");};}

var CONVS=[],CONV=null,_ibInit=false,IBQ="";
function chBadge(ch){var m={email:["rgba(0,229,160,.16)","#7ff0cd","hello@"],instantly:["rgba(55,138,221,.18)","#9cc6f3","Instantly"],crisp:["rgba(127,119,221,.2)","#bcb6f2","Crisp"],meta_lead:["rgba(239,159,39,.18)","#f0c27a","Meta"]};var x=m[ch]||["rgba(148,163,184,.18)","#cbd5e1",ch||"?"];return '<span class="pill" style="background:'+x[0]+';color:'+x[1]+'">'+esc(x[2])+'</span>';}
function ibWhen(s){return s?esc(String(s).replace("T"," ").slice(0,16)):"";}
function ensureInbox(){if(!_ibInit){_ibInit=true;var f=document.getElementById("ibFilter");if(f)f.onchange=loadInbox;var sb=document.getElementById("ibSearch");if(sb)sb.oninput=function(){IBQ=(this.value||"").toLowerCase();renderConvList();};var p=document.getElementById("ibPoll");if(p)p.onclick=function(){var b=this;b.textContent="…";api("/api/crm/inbox?poll=1").then(function(r){return r.json();}).then(function(){b.textContent="↻";loadInbox();}).catch(function(){b.textContent="↻";});};}loadInbox();}
function loadInbox(){var st=document.getElementById("ibFilter");var status=st?st.value:"open";api("/api/crm/inbox?status="+encodeURIComponent(status)).then(function(r){return r.json();}).then(function(d){CONVS=d.conversations||[];renderConvList();});}
function renderConvList(){var el=document.getElementById("ibList");var rows=CONVS.filter(function(c){if(!IBQ)return true;var s=((c.full_name||"")+" "+(c.primary_email||"")+" "+(c.company_name||"")+" "+(c.subject||"")).toLowerCase();return s.indexOf(IBQ)>=0;});if(!rows.length){el.innerHTML='<div class="soon">'+(IBQ?"No matches.":"No conversations.")+'</div>';return;}
el.innerHTML=rows.map(function(c){var who=c.full_name||c.primary_email||c.company_name||"(unknown)";var dot=c.unread?'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00e5a0;margin-right:6px"></span>':"";var sd=c.source_detail||"";var hot=sd.indexOf("fit:hot")>=0;var coldFit=sd.indexOf("fit:cold")>=0;var rowStyle=hot?' style="border-left:3px solid #f97316;background:linear-gradient(90deg,rgba(249,115,22,.10),transparent 55%)"':(coldFit?' style="border-left:3px solid rgba(148,163,184,.35);opacity:.75"':"");var fitTag=hot?'<span style="display:inline-block;background:rgba(249,115,22,.2);color:#fdba74;font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;margin-left:6px;vertical-align:1px">🔥 HOT</span>':"";return '<div class="row" data-id="'+esc(c.id)+'"'+rowStyle+'><div style="flex:1;min-width:0"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+dot+esc(who)+fitTag+'</div><div class="muted tiny" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(c.subject||c.last_message_preview||"")+'</div></div><div style="text-align:right;flex-shrink:0;margin-left:8px">'+chBadge(c.channel)+'<div class="muted tiny" style="margin-top:4px">'+ibWhen(c.last_message_at)+'</div></div></div>';}).join("");
[].forEach.call(el.querySelectorAll(".row"),function(r){r.onclick=function(){openConv(r.getAttribute("data-id"));};});}
function openConv(id){[].forEach.call(document.querySelectorAll("#ibList .row"),function(r){r.classList.toggle("sel",r.getAttribute("data-id")===id);});api("/api/crm/inbox?id="+encodeURIComponent(id)).then(function(r){return r.json();}).then(function(d){renderThread(d);renderIntel(d);});}
var PRES_OTHERS=[];
function presenceBeat(){var v=(CONV&&CONV.id)||null;fetch("/api/crm/presence",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({viewing:v})}).then(function(r){return r.json();}).then(function(d){PRES_OTHERS=(d&&d.others)||[];renderPresence();}).catch(function(){});}
function renderPresence(){var el=document.getElementById("presBox");if(!el)return;if(!CONV){el.textContent="";return;}var here=PRES_OTHERS.filter(function(o){return o.viewing===CONV.id;});el.innerHTML=here.length?('👁 '+here.map(function(o){return esc(o.name||o.email);}).join(", ")+(here.length===1?" is":" are")+" also viewing"):"";}
function openContact360(cid){var box=document.getElementById("ibThread");if(box)box.innerHTML='<div class="muted tiny">Loading history…</div>';api("/api/crm/contact?id="+encodeURIComponent(cid)).then(function(r){return r.json();}).then(renderContact360).catch(function(){if(box)box.innerHTML='<div class="soon">Failed to load history.</div>';});}
function renderContact360(d){var box=document.getElementById("ibThread");if(!box)return;if(!d||d.error){box.innerHTML='<div class="soon">'+esc((d&&d.error)||"Not found")+'</div>';return;}
var ct=d.contact||{},co=d.company||{},st=d.stats||{};var who=ct.full_name||ct.primary_email||"(unknown)";
function tl(l,v){return '<div class="tile"><div class="l">'+l+'</div><div class="n">'+v+'</div></div>';}
var back='<div style="margin-bottom:10px;display:flex;justify-content:space-between"><a href="#" id="c360back" style="color:#7ff0cd;text-decoration:none">← back to conversation</a><a href="#" id="c360merge" data-cid="'+esc(ct.id||"")+'" class="muted tiny" style="text-decoration:none">merge into…</a></div>';
var head='<div style="font-weight:600;font-size:15px">'+esc(who)+'</div><div class="muted tiny" style="margin-bottom:10px">'+esc(ct.primary_email||"")+(ct.phone?(" · "+esc(ct.phone)):"")+(co&&co.name?(" · "+esc(co.name)):"")+'</div>';
var stats='<div class="tiles" style="margin-bottom:6px">'+tl("Conversations",st.conversations||0)+tl("Channels",(st.channels||[]).length)+tl("Deals",st.deals||0)+tl("Speed-to-lead",st.speed_to_lead_hours!=null?(st.speed_to_lead_hours+"h"):"—")+'</div>';
var convs='<div style="font-weight:600;margin:12px 0 6px">Conversations across channels</div>'+((d.conversations||[]).length?d.conversations.map(function(cv){return '<div class="row" data-cid="'+esc(cv.id)+'" style="cursor:pointer"><div style="flex:1;min-width:0"><div class="tiny" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(cv.subject||cv.last_message_preview||"(no subject)")+'</div></div>'+chBadge(cv.channel)+'<span class="muted tiny" style="margin-left:6px">'+ibWhen(cv.last_message_at)+'</span></div>';}).join(""):'<div class="muted tiny">None.</div>');
var deals=(d.deals||[]).length?('<div style="font-weight:600;margin:14px 0 6px">Deals</div>'+d.deals.map(function(dl){return '<div class="row" style="cursor:default"><div style="flex:1;min-width:0">'+esc(dl.title||"(deal)")+'</div><span class="muted tiny">'+money2(dl.value_cents)+' · '+(dl.lead_status==="won"?"WON":((Number(dl.close_probability)||0)+"%"))+'</span></div>';}).join("")):"";
var tlh='<div style="font-weight:600;margin:14px 0 6px">Full timeline</div><div class="tl">'+((d.timeline||[]).length?d.timeline.map(function(e){
if(e.kind==="message"){var mine=e.direction==="out";return '<div style="margin-bottom:8px;padding:8px 10px;border-radius:8px;background:'+(mine?"rgba(0,229,160,.08)":"var(--surf2)")+'"><div class="tiny muted">'+(mine?"Us":esc(who))+' · '+chBadge(e.channel)+' · '+ibWhen(e.at)+'</div><div class="tiny" style="margin-top:3px;white-space:pre-wrap">'+esc((e.text||"").slice(0,400))+'</div></div>';}
if(e.kind==="note"){return '<div style="margin-bottom:8px;padding:8px 10px;border-radius:8px;background:rgba(239,159,39,.08)"><div class="tiny muted">Note · '+esc(e.author||"")+' · '+ibWhen(e.at)+'</div><div class="tiny" style="margin-top:3px;white-space:pre-wrap">'+esc(e.text||"")+'</div></div>';}
if(e.kind==="pageview"){return '<div class="it"><div class="tiny muted">👁 viewed '+esc(e.path||"")+(e.source?(" · "+esc(e.source)):"")+'</div><div class="muted tiny">'+ibWhen(e.at)+'</div></div>';}
return '<div class="it"><div class="tiny">'+esc(e.action||"")+(e.actor?(" · "+esc(e.actor)):"")+'</div><div class="muted tiny">'+ibWhen(e.at)+'</div></div>';
}).join(""):'<div class="muted tiny">No history yet.</div>')+'</div>';
box.innerHTML=back+head+stats+convs+deals+tlh;
var bk=document.getElementById("c360back");if(bk)bk.onclick=function(ev){ev.preventDefault();if(CONV)openConv(CONV.id);};
var mg=document.getElementById("c360merge");if(mg)mg.onclick=function(ev){ev.preventDefault();var em=prompt("Merge THIS contact into another contact — enter the other contact's email:");if(!em)return;fetch("/api/crm/merge",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({from_id:mg.getAttribute("data-cid"),into_email:em.trim()})}).then(function(r){return r.json();}).then(function(res){if(res.error){alert(res.error);return;}if(res.into_id)openContact360(res.into_id);});};
[].forEach.call(box.querySelectorAll(".row[data-cid]"),function(r){r.onclick=function(){openConv(r.getAttribute("data-cid"));};});}
function profilePanel(contact,company){if(!contact)return "";
var enr=null,org=null;try{enr=contact.enrichment?JSON.parse(contact.enrichment):null;}catch(e){}try{org=company&&company.enrichment?JSON.parse(company.enrichment):null;}catch(e){}
var nomatch=enr&&(enr._nomatch||enr._orgonly);if(nomatch)enr=null;
var rows=[];if(contact.title)rows.push(["Title",contact.title]);if(enr&&enr.seniority)rows.push(["Seniority",String(enr.seniority).split("_").join(" ")]);if(contact.phone)rows.push(["Phone",contact.phone]);if(company&&company.name)rows.push(["Company",company.name]);if(company&&company.domain)rows.push(["Domain",company.domain]);
if(org){if(org.industry)rows.push(["Industry",org.industry]);if(org.estimated_num_employees)rows.push(["Employees",String(org.estimated_num_employees)]);if(org.annual_revenue_printed)rows.push(["Revenue",String(org.annual_revenue_printed)]);}
if(enr){var loc=[enr.city,enr.state,enr.country].filter(Boolean).join(", ");if(loc)rows.push(["Location",loc]);if(enr.email_status)rows.push(["Email status",enr.email_status]);if(enr.linkedin_url)rows.push(["LinkedIn",enr.linkedin_url]);}
var intent=(enr&&(enr.show_intent||enr.intent_strength))?'<div style="display:inline-block;background:rgba(239,68,68,.16);color:#fda4af;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;margin-bottom:8px">🔥 Buying intent'+(enr.intent_strength?(" · "+esc(String(enr.intent_strength))):"")+'</div>':"";
var headline=(enr&&enr.headline)?'<div class="muted tiny" style="margin-bottom:6px;white-space:normal">'+esc(enr.headline)+'</div>':"";
var body=rows.length?rows.map(function(r){return '<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0"><span class="muted tiny">'+esc(r[0])+'</span><span class="tiny" style="text-align:right;max-width:62%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r[1])+'</span></div>';}).join(""):'<div class="muted tiny">'+(nomatch?"No Apollo match for this email.":"No profile details yet.")+'</div>';
return '<div class="card" style="padding:12px;margin-bottom:12px"><div class="muted tiny" style="margin-bottom:6px">Profile</div>'+intent+headline+body+'<div style="margin-top:8px"><button class="ghost" id="ibEnrich" data-cid="'+esc(contact.id)+'">'+(enr?"Re-enrich":"Enrich with Apollo")+'</button> <button class="ghost" id="ibSetCo" data-cid="'+esc(contact.id)+'" style="margin-left:6px">Set company</button> <span class="muted tiny" id="ibEnrichMsg"></span></div></div>';}
function demoPanel(dm){if(!dm)return "";var done=(dm.status==="emailed"||dm.status==="enrolled"||dm.status==="consented");var color=done?"#00e5a0":(dm.status==="visited"?"#fbbf24":"#94a3b8");var label=done?"Completed":(dm.status==="visited"?"In progress":"Just submitted");var stamps=[];if(dm.registeredAt)stamps.push("Submitted "+ibWhen(dm.registeredAt));if(dm.visitedAt)stamps.push("Started sample "+ibWhen(dm.visitedAt));if(dm.consentedAt)stamps.push("Accepted consent "+ibWhen(dm.consentedAt));return '<div class="card" style="padding:12px;margin-bottom:12px"><div class="muted tiny" style="margin-bottom:6px">Demo progress · '+esc(label)+'</div><div style="display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;background:'+color+'"></span><span class="tiny" style="font-weight:600">'+esc(dm.detail)+'</span></div>'+(stamps.length?'<div class="muted tiny" style="margin-top:6px">'+esc(stamps.join(" · "))+'</div>':"")+'</div>';}
function fmtDur(s){s=Math.round(s||0);if(s<60)return s+"s";var m=Math.floor(s/60),r=s%60;return m+"m"+(r?(" "+r+"s"):"");}
function itile(l,v){return '<div class="tile" style="padding:9px"><div class="l tiny">'+esc(l)+'</div><div style="font-weight:700;font-size:14px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(v)+'</div></div>';}
function suppressedBadge(s){return '<div style="background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.55);border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="font-weight:700;font-size:13px;color:#fda4af">🚫 Do not contact</div><div class="tiny" style="margin-top:3px">'+esc(s.reason)+(s.source?(" · via "+esc(s.source)):"")+'</div></div>';}
function coldEmailBadge(c){var S={1:"Active in sequence",2:"Sequence done",3:"Unsubscribed"};var label=(c.status<0)?"Bounced":(S[c.status]||("status "+c.status));var eng=[];if(c.opens)eng.push(c.opens+" open"+(c.opens===1?"":"s"));if(c.clicks)eng.push(c.clicks+" click"+(c.clicks===1?"":"s"));if(c.replies)eng.push(c.replies+" repl"+(c.replies===1?"y":"ies"));var engStr=eng.length?eng.join(" · "):"no engagement yet";var hot=(c.replies>0);return '<div style="background:'+(hot?"rgba(0,229,160,.14)":"rgba(55,138,221,.14)")+';border:1px solid '+(hot?"rgba(0,229,160,.4)":"rgba(55,138,221,.4)")+';border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="font-weight:700;font-size:13px;color:'+(hot?"#7ff0cd":"#9cc6f3")+'">✉️ Cold email · '+esc(label)+'</div><div class="tiny" style="margin-top:3px">'+esc(engStr)+'</div></div>';}
function paidBadge(pd){var cost=(pd.costPerLeadUsd!=null)?(" · ~$"+pd.costPerLeadUsd+"/lead"):"";var camp=pd.campaign?(" · "+esc(pd.campaign)):"";var nudge=(pd.costPerLeadUsd==null&&pd.platform)?('<div class="muted tiny" style="margin-top:4px">Log '+esc(pd.platform)+' spend in the Spend tab to show cost/lead.</div>'):"";return '<div style="background:linear-gradient(135deg,rgba(251,191,36,.16),rgba(0,229,160,.1));border:1px solid rgba(251,191,36,.5);border-radius:10px;padding:10px 12px;margin-bottom:12px"><div style="font-weight:700;font-size:13px;color:#fcd34d">💰 Paid ad lead</div><div class="tiny" style="margin-top:3px">'+esc(pd.source)+camp+cost+'</div>'+nudge+'</div>';}
function wiChip(t,bg,col,b){return '<span style="display:inline-block;background:'+bg+';color:'+col+';border:1px solid '+(b||"transparent")+';font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;margin:2px 3px 2px 0;white-space:nowrap">'+esc(t)+'</span>';}
function webIntelCard(w){if(!w)return "";
var FIT={hot:{bg:"linear-gradient(135deg,rgba(249,115,22,.22),rgba(239,68,68,.12))",bd:"rgba(249,115,22,.65)",glow:"0 0 18px rgba(249,115,22,.28)",hd:"#fdba74",label:"🔥 HOT LEAD",sub:"Real site, zero visitor capture — prime for the 98%-leak pitch"},
warm:{bg:"linear-gradient(135deg,rgba(0,229,160,.12),rgba(55,138,221,.08))",bd:"rgba(0,229,160,.45)",glow:"none",hd:"#7ff0cd",label:"🌡 WARM",sub:"Has capture — pitch exclusivity + $7 flat vs what they pay now"},
cold:{bg:"rgba(148,163,184,.1)",bd:"rgba(239,68,68,.45)",glow:"none",hd:"#fda4af",label:"⚠ VERIFY FIRST",sub:"Website unreachable or missing — confirm the business is real"}};
var f=FIT[w.fit]||FIT.warm;var host="";try{host=new URL(w.url).hostname;}catch(e){host=w.url||"";}
var h='<div style="background:'+f.bg+';border:1px solid '+f.bd+';box-shadow:'+f.glow+';border-radius:10px;padding:12px;margin-bottom:12px">';
h+='<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><span style="font-weight:800;font-size:13px;color:'+f.hd+'">'+f.label+'</span><span class="muted tiny">website intel</span></div>';
h+='<div class="tiny" style="margin-top:2px;color:#cbd5e1">'+esc(f.sub)+'</div>';
if(w.url&&w.site==="ok"){h+='<div style="margin-top:8px" class="tiny"><a href="'+esc(w.url)+'" target="_blank" rel="noopener" style="color:#7ff0cd;text-decoration:none;font-weight:600">'+esc(host)+' ↗</a>'+(w.title?'<span class="muted"> — '+esc(w.title.slice(0,70))+'</span>':"")+'</div>';}
if(w.siteCheck){h+='<div class="tiny" style="margin-top:8px;color:#fda4af">'+esc((w.url?host+": ":"")+w.siteCheck)+'</div>';}
if(w.tradeCheck){h+='<div class="tiny" style="margin-top:6px;color:'+(w.tradeCheck.indexOf("✗")>=0?"#fda4af":(w.tradeCheck.indexOf("✓")>=0?"#7ff0cd":"#fcd34d"))+'">'+esc(w.tradeCheck)+'</div>';}
var chips="";
if(w.tradeCheck){var tcv=w.tradeCheck.indexOf("✓")>=0,tcm=w.tradeCheck.indexOf("✗")>=0;chips+=wiChip(tcv?"✓ trade verified":(tcm?"✗ TRADE MISMATCH":"? trade unverified"),tcv?"rgba(0,229,160,.18)":(tcm?"rgba(239,68,68,.22)":"rgba(251,191,36,.15)"),tcv?"#7ff0cd":(tcm?"#fda4af":"#fcd34d"),tcm?"rgba(239,68,68,.6)":"transparent");}
if(w.site==="ok"){chips+=w.capture.length?w.capture.map(function(c){return wiChip("✓ "+c,"rgba(0,229,160,.14)","#7ff0cd");}).join(""):wiChip("✗ no capture","rgba(239,68,68,.16)","#fda4af");
chips+=w.tracking.length?w.tracking.map(function(c){return wiChip(c,"rgba(55,138,221,.16)","#9cc6f3");}).join(""):wiChip("no tracking","rgba(239,68,68,.12)","#fca5a5");
chips+=w.competitors.map(function(c){return wiChip("⚠ "+c,"rgba(251,191,36,.16)","#fcd34d");}).join("");
chips+=w.tools.map(function(c){return wiChip(c,"rgba(127,119,221,.18)","#bcb6f2");}).join("");
if(w.platform)chips+=wiChip(w.platform,"rgba(148,163,184,.16)","#cbd5e1");}
if(chips)h+='<div style="margin-top:8px">'+chips+'</div>';
if(w.phone)h+='<div class="muted tiny" style="margin-top:6px">Phone on site: '+esc(w.phone)+'</div>';
if(w.angle)h+='<div class="tiny" style="margin-top:9px;padding:7px 9px;border-radius:8px;background:rgba(2,6,23,.35);border-left:3px solid '+f.hd+';font-style:italic">'+esc(w.angle)+'</div>';
if(w.adLibrary)h+='<div style="margin-top:9px"><a href="'+esc(w.adLibrary)+'" target="_blank" rel="noopener" class="ghost" style="text-decoration:none;display:inline-block;padding:3px 10px;font-size:12px">Their FB ads ↗</a></div>';
return h+'</div>';}
function renderIntel(d){var box=document.getElementById("ibIntel");if(!box)return;if(!d||!d.conversation){box.innerHTML='<div class="soon" style="padding:24px 12px">Select a conversation</div>';return;}var ct=d.contact||{},co=d.company||{},it=d.intel||{},dm=d.demo,cv=d.conversation;var who=ct.full_name||cv.full_name||ct.primary_email||cv.primary_email||"(unknown)";var penr=null;try{penr=ct.enrichment?JSON.parse(ct.enrichment):null;}catch(e){}var avh=(penr&&penr.photo_url&&!penr._nomatch&&!penr._orgonly)?'<img src="'+esc(penr.photo_url)+'" alt="" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex:none">':('<div class="av" style="width:42px;height:42px;font-size:14px">'+initials(who)+'</div>');var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'+avh+'<div style="min-width:0"><div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(who)+'</div><div class="muted tiny" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(ct.primary_email||cv.primary_email||"")+(co&&co.name?(" · "+esc(co.name)):"")+'</div></div></div>';if(d&&d.suppressed)h+=suppressedBadge(d.suppressed);if(d&&d.webIntel)h+=webIntelCard(d.webIntel);if(d&&d.paid&&d.paid.isPaid)h+=paidBadge(d.paid);if(d&&d.coldEmail)h+=coldEmailBadge(d.coldEmail);h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'+itile("Time on site",it.timeOnSiteSec?fmtDur(it.timeOnSiteSec):"—")+itile("Pages viewed",String(it.pageCount||0))+itile("Came from",it.source||"direct")+itile("First seen",it.firstSeen?ibWhen(it.firstSeen):"—")+'</div>'+demoPanel(dm);if(it.pages&&it.pages.length){h+='<div class="card" style="padding:12px;margin-bottom:12px"><div class="muted tiny" style="margin-bottom:6px">Pages viewed'+(it.campaign?(" · "+esc(it.campaign)):"")+'</div>'+it.pages.map(function(p){var s=p.source||p.ref;return '<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0"><span class="tiny" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:62%">'+esc(p.path||"/")+(s?('<span class="muted"> · '+esc(s)+'</span>'):"")+'</span><span class="muted tiny" style="white-space:nowrap">'+ibWhen(p.at)+'</span></div>';}).join("")+'</div>';}h+=profilePanel(ct,co);if(ct&&ct.id)h+='<div style="text-align:center;margin-top:4px"><a href="#" id="ibIntel360" style="color:#7ff0cd;text-decoration:none">full history & timeline →</a></div>';box.innerHTML=h;var en=document.getElementById("ibEnrich");if(en)en.onclick=function(){var cid=en.getAttribute("data-cid");var mm=document.getElementById("ibEnrichMsg");if(mm)mm.textContent="Enriching…";en.disabled=true;fetch("/api/crm/enrich",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({contact_id:cid})}).then(function(r){return r.json();}).then(function(res){en.disabled=false;if(!mm)return;if(res.error){mm.textContent=res.error+(res.status?(" ("+res.status+")"):"")+(res.detail?(" — "+res.detail):"");return;}mm.textContent=res.matched===false?"No Apollo match":"Enriched ✓";openConv(cv.id);}).catch(function(){en.disabled=false;if(mm)mm.textContent="Failed";});};var sco=document.getElementById("ibSetCo");if(sco)sco.onclick=function(){var cid=sco.getAttribute("data-cid");var nm=prompt("Company name");if(nm===null)return;fetch("/api/crm/contact",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({id:cid,company_name:nm})}).then(function(r){return r.json();}).then(function(){openConv(cv.id);}).catch(function(){});};var fh=document.getElementById("ibIntel360");if(fh)fh.onclick=function(e){e.preventDefault();if(typeof openContact360==="function")openContact360(ct.id);};}
function renderThread(d){var c=d&&d.conversation;var box=document.getElementById("ibThread");if(!c){box.innerHTML='<div class="soon">Not found.</div>';return;}CONV=c;var who=c.full_name||c.primary_email||"(unknown)";var CT=d.contact;
var msgs=(d.messages||[]).map(function(m){var mine=m.direction==="out";return '<div style="margin-bottom:10px;padding:9px 11px;border-radius:9px;background:'+(mine?"rgba(0,229,160,.08)":"var(--surf2)")+'"><div class="tiny muted">'+(mine?"Us":esc(who))+' · '+ibWhen(m.sent_at||m.created_at)+'</div><div class="tiny" style="margin-top:4px;white-space:pre-wrap">'+esc(m.body_text||"")+'</div></div>';}).join("")||'<div class="muted tiny">No messages.</div>';
var head='<div style="margin-bottom:12px"><div style="font-weight:600">'+esc(who)+'</div><div class="muted tiny" style="margin-top:3px">'+chBadge(c.channel)+' '+esc(c.primary_email||"")+(c.company_name?(" · "+esc(c.company_name)):"")+(CT&&CT.id?' · <a href="#" id="ib360" style="color:#7ff0cd;text-decoration:none">full history →</a>':"")+'</div><div class="tiny" id="presBox" style="margin-top:4px;color:#7ff0cd"></div></div>';
var assignSel='<select id="ibAssign" title="Assign to" style="margin-left:auto"><option value="">Unassigned</option>'+(d.users||[]).map(function(u){return '<option value="'+esc(u.id)+'"'+(c.assignee_id===u.id?" selected":"")+'>'+esc(u.name)+'</option>';}).join("")+'</select>';
var actions='<div class="bar" style="margin-bottom:12px">'+(c.status!=="converted"?'<button class="btn" id="ibConvert">Convert to Lead</button>':'<span class="pill" style="background:rgba(0,229,160,.16);color:#7ff0cd;align-self:center">converted</span>')+(c.status!=="snoozed"?'<button class="ghost" id="ibSnooze">Snooze</button>':"")+(c.status!=="archived"?'<button class="ghost" id="ibArchive">Archive</button>':"")+(c.status!=="open"?'<button class="ghost" id="ibOpen">Reopen</button>':"")+assignSel+'<span class="muted tiny" id="ibMsg" style="align-self:center;margin-left:8px"></span></div>';
var notesBlock='<div style="margin-top:16px"><div class="muted tiny" style="margin-bottom:6px">Internal notes</div>'+((d.notes&&d.notes.length)?d.notes.map(function(n){return '<div style="background:rgba(239,159,39,.08);border-radius:8px;padding:8px 10px;margin-bottom:6px"><div class="tiny" style="white-space:pre-wrap">'+esc(n.body)+'</div><div class="tiny muted" style="margin-top:3px">'+esc(n.author||"")+' · '+ibWhen(n.created_at)+'</div></div>';}).join(""):'<div class="muted tiny">No notes yet.</div>')+'<div style="margin-top:6px;display:flex;gap:8px"><input id="ibNote" placeholder="Add a private note…" style="flex:1"><button class="ghost" id="ibNoteBtn">Add</button></div></div>';
var chHint={email:"",instantly:" (via Instantly)",crisp:" (via Crisp chat)",meta_lead:" (via email)",demo_form:" (via email)"};
var isLead=(c.channel==="meta_lead"||c.channel==="demo_form");
var composer;
if(isLead){
composer='<div class="gcompose">'
+'<div class="gc-hd">'
+'<div class="gc-rw"><span class="gc-l">From</span><span>Consent Resolve &lt;hello@consentresolve.com&gt;</span></div>'
+'<div class="gc-rw"><span class="gc-l">To</span><span>'+esc(c.primary_email||who)+'</span></div>'
+'<div class="gc-rw"><span class="gc-l">Subject</span><span>Re: your inquiry with Consent Resolve</span></div>'
+'</div>'
+'<select id="ibTmpl"><option value="">Insert a reply template…</option><option value="0">Warm &amp; personal</option><option value="1">Direct &amp; concise</option><option value="2">Value-led</option><option value="3">Question-first</option></select>'
+'<textarea id="ibReply" class="gc-bd" placeholder="Write your reply…"></textarea>'
+'<div class="gc-sig">--<br>'+esc(CR_ME||"Consent Resolve Team")+'<br>Consent Resolve<br>1907 Gulf Way #1, St Pete Beach, FL 33706<br><span class="gc-uns">You&#39;re getting this because you asked to hear from us at consentresolve.com. Reply UNSUBSCRIBE and we&#39;ll stop.</span></div>'
+'<div class="gc-ft"><button class="gc-send" id="ibSend">Send</button> <span class="muted tiny" id="ibSendMsg">Signature added automatically on send.</span></div>'
+'</div>';
}else{
composer='<div style="margin-top:14px"><textarea id="ibReply" rows="3" placeholder="Reply to '+esc(who)+(chHint[c.channel]||"")+'…" style="width:100%"></textarea><div style="margin-top:8px"><button class="btn" id="ibSend">Send</button> <span class="muted tiny" id="ibSendMsg"></span></div></div>';
}
box.innerHTML=head+actions+'<div class="tl">'+msgs+'</div>'+composer+notesBlock;
var asg=document.getElementById("ibAssign");if(asg)asg.onchange=function(){var mm=document.getElementById("ibMsg");if(mm)mm.textContent="Assigning…";fetch("/api/crm/inbox",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({id:c.id,assignee_id:asg.value||null})}).then(function(r){return r.json();}).then(function(res){if(mm)mm.textContent=res.error?res.error:"Assigned ✓";}).catch(function(){if(mm)mm.textContent="Failed";});};
var nb=document.getElementById("ibNoteBtn");if(nb)nb.onclick=function(){var ni=document.getElementById("ibNote");var t=(ni&&ni.value||"").trim();if(!t)return;nb.disabled=true;fetch("/api/crm/inbox",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({id:c.id,note:t})}).then(function(r){return r.json();}).then(function(res){nb.disabled=false;if(res.error){alert(res.error);return;}openConv(c.id);}).catch(function(){nb.disabled=false;});};
var h360=document.getElementById("ib360");if(h360&&CT)h360.onclick=function(ev){ev.preventDefault();openContact360(CT.id);};
var en=document.getElementById("ibEnrich");if(en)en.onclick=function(){var cid=en.getAttribute("data-cid");var mm=document.getElementById("ibEnrichMsg");mm.textContent="Enriching…";en.disabled=true;fetch("/api/crm/enrich",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({contact_id:cid})}).then(function(r){return r.json();}).then(function(res){en.disabled=false;if(res.error){mm.textContent=res.error;return;}if(res.matched===false){mm.textContent="No Apollo match";return;}mm.textContent="Enriched ✓";openConv(c.id);}).catch(function(){en.disabled=false;mm.textContent="Failed";});};
var sco=document.getElementById("ibSetCo");if(sco)sco.onclick=function(){var cid=sco.getAttribute("data-cid");var nm=prompt("Company name");if(nm===null)return;var mm=document.getElementById("ibEnrichMsg");if(mm)mm.textContent="Saving…";fetch("/api/crm/contact",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({id:cid,company_name:nm})}).then(function(r){return r.json();}).then(function(res){if(res.error){if(mm)mm.textContent=res.error;return;}openConv(c.id);}).catch(function(){if(mm)mm.textContent="Failed";});};
var _fn=((who||"").trim().split(" ")[0])||"there";if(/[@<>]/.test(_fn))_fn="there";
var _tr="";var _sdp=(c.source_detail||"").split("|");for(var _i=0;_i<_sdp.length;_i++){if(_sdp[_i].indexOf("trade:")===0)_tr=_sdp[_i].slice(6);}
var _signup="https://dashboard.consentresolve.com/register";
var _tradeLink=_tr?("https://consentresolve.com/"+_tr+"-leads/"):"https://consentresolve.com/industries/";
var CR_TMPL=[
"Hi {first}, thanks for reaching out — glad Consent Resolve caught your eye. The short version: we turn the homeowners already visiting your website into exclusive, consent-first leads — a real name and email, $7 each, and never resold. Two easy ways forward: see exactly how it works for your trade here — {trade} — or if you're ready to jump in, sign up directly at {signup}. Happy to answer anything first, too.\\n\\nTalk soon,",
"Hi {first}, thanks for the note. In one line: we hand you the people already on your website as exclusive, consent-first leads — $7 each, yours alone. Ready to go? Sign up here: {signup}. Want the details for your trade first? Take a look: {trade}.\\n\\nBest,",
"Hi {first}, appreciate you reaching out. Here's the whole idea: most homeowners who land on your site leave without a trace. We recover the ones who opt in and hand them to you as exclusive leads — real name, real email, $7 flat, never resold. No shared marketplace, no bidding against four other pros. See it for your trade here: {trade}. Or start right now: {signup}.\\n\\nBest,",
"Hi {first}, thanks for reaching out! I put together exactly how this works for your trade — take a look: {trade}. Quick one so I can tailor it: roughly how much traffic does your site get each month? And whenever you're ready to start, you can sign up here: {signup}.\\n\\nTalk soon,"
];
var tsel=document.getElementById("ibTmpl");if(tsel)tsel.onchange=function(){if(tsel.value==="")return;var ta=document.getElementById("ibReply");if(!ta)return;if(ta.value.trim()&&!confirm("Replace your current draft with this template?")){tsel.value="";return;}ta.value=CR_TMPL[+tsel.value].split("{first}").join(_fn).split("{trade}").join(_tradeLink).split("{signup}").join(_signup);ta.focus();tsel.value="";};
var snd=document.getElementById("ibSend");if(snd)snd.onclick=function(){var ta=document.getElementById("ibReply");var t=(ta&&ta.value||"").trim();if(!t)return;var mm=document.getElementById("ibSendMsg");mm.textContent="Sending…";snd.disabled=true;fetch("/api/crm/inbox",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({id:c.id,reply:t})}).then(function(r){return r.json();}).then(function(res){snd.disabled=false;if(res.error){mm.textContent=res.message||res.error;return;}mm.textContent="Sent ✓";openConv(c.id);}).catch(function(){snd.disabled=false;mm.textContent="Failed";});};
var cv=document.getElementById("ibConvert");if(cv)cv.onclick=function(){var mm=document.getElementById("ibMsg");mm.textContent="Converting…";fetch("/api/crm/inbox",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({id:c.id,convert:true})}).then(function(r){return r.json();}).then(function(res){if(res.error){mm.textContent=res.error;return;}mm.textContent="Converted ✓ — see Pipeline";openConv(c.id);}).catch(function(){mm.textContent="Failed";});};
var sn=document.getElementById("ibSnooze");if(sn)sn.onclick=function(){var days=prompt("Snooze for how many days?","3");if(!days)return;setConvStatus(c.id,"snoozed",days);};
var ar=document.getElementById("ibArchive");if(ar)ar.onclick=function(){setConvStatus(c.id,"archived");};
var op=document.getElementById("ibOpen");if(op)op.onclick=function(){setConvStatus(c.id,"open");};
renderPresence();presenceBeat();}
function setConvStatus(id,status,days){var m=document.getElementById("ibMsg");if(m)m.textContent="Saving…";fetch("/api/crm/inbox",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({id:id,status:status,snooze_days:days?Number(days):null})}).then(function(r){return r.json();}).then(function(res){if(res.error){if(m)m.textContent=res.error;return;}document.getElementById("ibThread").innerHTML='<div class="soon">Select a conversation</div>';var iv=document.getElementById("ibIntel");if(iv)iv.innerHTML='<div class="soon" style="padding:24px 12px">Select a conversation</div>';loadInbox();});}
var DEALS=[],DUSERS=[];
function money2(c){var n=(Number(c)||0)/100;return "$"+n.toLocaleString(undefined,{maximumFractionDigits:0});}
function ensurePipeline(){var v=document.getElementById("plView");if(v&&!v._w){v._w=1;v.onchange=renderBoard;}api("/api/crm/deals").then(function(r){return r.json();}).then(function(d){DEALS=d.deals||[];DUSERS=d.users||[];renderBoard();});}
function bandOf(p){p=Number(p)||0;if(p>=100)return 4;if(p>=76)return 3;if(p>=51)return 2;if(p>=26)return 1;return 0;}
function weighted(d){return (Number(d.value_cents)||0)*(d.lead_status==="won"?1:(Number(d.close_probability)||0)/100);}
function renderBoard(){var view=(document.getElementById("plView")||{}).value||"bands";var board=document.getElementById("plBoard");var active=DEALS.filter(function(d){return d.lead_status!=="lost";});
var totalW=0;active.forEach(function(d){if(d.lead_status==="active")totalW+=weighted(d);});
document.getElementById("plMeta").textContent=active.length+" deals · weighted "+money2(totalW);
var cols=[],keys=[];
if(view==="bands"){var labels=["0–25%","26–50%","51–75%","76–99%","Won"];for(var i=0;i<5;i++){cols.push([]);keys.push(labels[i]);}active.forEach(function(d){var idx=d.lead_status==="won"?4:bandOf(d.close_probability);cols[idx].push(d);});}
else{var byM={};active.forEach(function(d){var m=(d.expected_close_date||"").slice(0,7)||"(no date)";(byM[m]=byM[m]||[]).push(d);});Object.keys(byM).sort().forEach(function(m){keys.push(m);cols.push(byM[m]);});if(!keys.length){keys.push("(no deals)");cols.push([]);}}
board.innerHTML=cols.map(function(list,i){var sum=0;list.forEach(function(d){sum+=weighted(d);});var cards=list.map(dealCard).join("")||'<div class="muted tiny" style="padding:8px">—</div>';return '<div class="plcol"><div class="plcolhead">'+esc(keys[i])+' <span class="muted tiny">'+list.length+' · '+money2(sum)+'</span></div>'+cards+'</div>';}).join("")||'<div class="soon">No deals yet — convert a conversation in the Inbox.</div>';
[].forEach.call(board.querySelectorAll(".plcard"),function(el){el.onclick=function(){editDeal(el.getAttribute("data-id"));};el.ondragstart=function(ev){PLDRAG=el.getAttribute("data-id");if(ev.dataTransfer)ev.dataTransfer.effectAllowed="move";};});
if(view==="bands"){[].forEach.call(board.querySelectorAll(".plcol"),function(col,ci){col.ondragover=function(ev){ev.preventDefault();};col.ondrop=function(ev){ev.preventDefault();if(!PLDRAG)return;dropToBand(PLDRAG,ci);PLDRAG=null;};});}}
var PLDRAG=null;
function dropToBand(id,band){var patch={id:id};if(band===4){patch.lead_status="won";}else{patch.lead_status="active";patch.close_probability=[13,38,63,88][band];}fetch("/api/crm/deals",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(patch)}).then(function(r){return r.json();}).then(function(res){if(res.error){alert(res.error);return;}ensurePipeline();});}
function dealCard(d){return '<div class="plcard" draggable="true" data-id="'+esc(d.id)+'"><div style="font-weight:600;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(d.company_name||d.contact_name||d.title||"(deal)")+'</div><div class="muted tiny" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(d.contact_name||d.contact_email||"")+'</div><div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px"><span>'+money2(d.value_cents)+'</span><span class="muted">'+(d.lead_status==="won"?"WON":((Number(d.close_probability)||0)+"%"))+'</span></div><div class="muted tiny" style="margin-top:3px">'+(d.expected_close_date?esc(d.expected_close_date):"no close date")+(d.owner_name?(" · "+esc(d.owner_name)):"")+'</div></div>';}
function editDeal(id){var d=null;for(var i=0;i<DEALS.length;i++)if(DEALS[i].id===id)d=DEALS[i];if(!d)return;
var status=prompt("Status — active / won / lost",d.lead_status||"active");if(status===null)return;status=status.trim().toLowerCase();if(["active","won","lost"].indexOf(status)<0)status="active";
var patch={id:id,lead_status:status};
if(status==="active"){var prob=prompt("Close probability (0-100)",d.close_probability!=null?d.close_probability:"");if(prob!==null&&prob!=="")patch.close_probability=Math.max(0,Math.min(100,Math.round(Number(prob)||0)));
var val=prompt("Deal value in $",d.value_cents?Math.round(d.value_cents/100):"");if(val!==null&&val!=="")patch.value_cents=Math.round((Number(val)||0)*100);
var cd=prompt("Expected close date (YYYY-MM-DD)",d.expected_close_date||"");if(cd!==null)patch.expected_close_date=cd.trim()||null;}
fetch("/api/crm/deals",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(patch)}).then(function(r){return r.json();}).then(function(res){if(res.error){alert(res.error);return;}ensurePipeline();});}
function num(n){return (Number(n)||0).toLocaleString();}
function ensureAna2(){var m=document.getElementById("anMeta");if(m)m.textContent="Loading…";api("/api/crm/analytics2").then(function(r){return r.json();}).then(renderAna2).catch(function(){if(m)m.textContent="Failed to load.";});}
function renderAna2(d){var t=d.totals||{},stl=d.speedToLead||{},f=d.funnel||{};
document.getElementById("anMeta").textContent="As of "+(d.generatedAt||"");
function tl(l,v){return '<div class="tile"><div class="l">'+l+'</div><div class="n">'+v+'</div></div>';}
document.getElementById("anTiles").innerHTML=tl("Weighted pipeline","$"+num(t.weighted_pipeline_usd))+tl("Won","$"+num(t.won_usd))+tl("Speed-to-lead",(stl.avg_hours!=null?stl.avg_hours+"h":"—"))+tl("Funnel",num(f.conversations)+" → "+num(f.leads)+" → "+num(f.won));
var fc=d.forecast||[];var max=1;fc.forEach(function(r){if((r.weighted_usd||0)>max)max=r.weighted_usd;});
document.getElementById("anForecast").innerHTML=fc.length?fc.map(function(r){var pct=Math.round(((r.weighted_usd||0)/max)*100);return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>'+esc(r.month)+'</span><span>$'+num(r.weighted_usd)+' · '+r.deals+' deal'+(r.deals===1?"":"s")+'</span></div><div class="track"><div class="fill" style="width:'+pct+'%"></div></div></div>';}).join(""):'<div class="muted tiny">No dated active deals yet.</div>';
var at=d.attribution||[];
document.getElementById("anAttr").innerHTML=at.length?('<div class="row" style="font-weight:600;cursor:default"><div style="flex:1">Channel · Source</div><div style="width:54px;text-align:right">Conv</div><div style="width:54px;text-align:right">Leads</div><div style="width:46px;text-align:right">Won</div></div>'+at.map(function(r){return '<div class="row" style="cursor:default"><div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.channel||"?")+' · '+esc(r.source||"")+'</div><div style="width:54px;text-align:right">'+num(r.conversations)+'</div><div style="width:54px;text-align:right">'+num(r.leads)+'</div><div style="width:46px;text-align:right">'+num(r.won)+'</div></div>';}).join("")):'<div class="muted tiny" style="padding:10px">No conversations yet.</div>';
var ow=d.byOwner||[];
document.getElementById("anOwner").innerHTML=ow.length?('<div class="row" style="font-weight:600;cursor:default"><div style="flex:1">Owner</div><div style="width:50px;text-align:right">Active</div><div style="width:96px;text-align:right">Weighted</div><div style="width:66px;text-align:right">Win rate</div></div>'+ow.map(function(r){var wl=(r.won||0)+(r.lost||0);var wr=wl>0?Math.round((r.won||0)/wl*100)+"%":"—";return '<div class="row" style="cursor:default"><div style="flex:1">'+esc(r.name)+'</div><div style="width:50px;text-align:right">'+num(r.active_deals)+'</div><div style="width:96px;text-align:right">$'+num(r.weighted_usd)+'</div><div style="width:66px;text-align:right">'+wr+'</div></div>';}).join("")):'<div class="muted tiny" style="padding:10px">No deals yet.</div>';}
document.getElementById("fQ").oninput=render;document.getElementById("fInd").onchange=render;document.getElementById("fSrc").onchange=render;document.getElementById("add").onclick=add;document.getElementById("addSpend").onclick=doAddSpend;
// Standalone pages: the active section comes from the URL path (/crm/<section>);
// nav items are real links that carry the ?key. On load, show that section's pane
// and load only its data.
var SEC=location.pathname.split("/")[2]||"inbox";if(["inbox","live","pipeline","analytics","leads","industry","roas","social","status","settings"].indexOf(SEC)<0)SEC="inbox";
if(new URLSearchParams(location.search).get("connected"))SEC="settings";
[].forEach.call(document.querySelectorAll("nav a"),function(a){var v=a.getAttribute("data-v");a.setAttribute("href","/crm/"+v+location.search);if(v===SEC)a.classList.add("active");else a.classList.remove("active");});
[].forEach.call(document.querySelectorAll("[data-pane]"),function(p){p.hidden=p.getAttribute("data-pane")!==SEC;});
if(SEC==="inbox")ensureInbox();
else if(SEC==="live")renderLive();
else if(SEC==="pipeline")ensurePipeline();
else if(SEC==="analytics")ensureAna2();
else if(SEC==="industry"||SEC==="roas")ensureAnalytics();
else if(SEC==="social")ensureSocial();
else if(SEC==="status")ensureStatus();
else if(SEC==="settings")ensureSettings();
else load();
fetch("/api/crm/auth/me",{credentials:"same-origin"}).then(function(r){return r.json();}).then(function(d){var u=document.getElementById("userBox");if(!u||!d||!d.email)return;var ap=(d.apolloUsed!=null)?(' · <a href="https://app.apollo.io/#/settings/credits/current" target="_blank" rel="noopener" title="Apollo enrichments run via the CRM this month (~1 credit each). Apollo has no balance API — click for your remaining balance." style="color:#7ff0cd;text-decoration:none">Apollo: '+d.apolloUsed+' this mo. ↗</a>'):"";u.innerHTML=esc(d.email)+ap+' · <a href="/api/crm/auth/logout" style="color:#7ff0cd;text-decoration:none">sign out</a>';}).catch(function(){});
setInterval(presenceBeat,20000);presenceBeat();
</script></body></html>`;

export async function handle({ request, env }) {
  const ok = (await isAuthed(request, env)) || (await crmSessionEmail(request, env));
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (!ok) return new Response(LOGIN_HTML, { status: 401, headers });
  // Resolve the signed-in rep's name so the compose signature preview matches the sent email.
  let meName = "";
  try {
    const u = await currentUser(request, env);
    meName = (u && u.name) || "";
    if (!meName) {
      const a = await env.DB.prepare("SELECT name FROM users WHERE role='admin' AND active=1 ORDER BY created_at LIMIT 1").first();
      meName = (a && a.name) || "";
    }
  } catch (_) {}
  return new Response(PAGE_HTML.replace("__CR_ME__", JSON.stringify(meName)), { headers });
}
