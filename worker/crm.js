// Gated /crm app shell (Worker-rendered, like /admin). Auth: admin session
// cookie OR ?key=<CRM_KEY>. The client JS reads the key from its own URL and
// calls /api/crm/leads. Slice 1: Leads list + lead detail with editable
// stage/status/value/owner + activity timeline. Other tabs are placeholders.

import { isAuthed } from "./_lib/auth.js";
import { crmKey } from "./api/crm-leads.js";

const LOGIN_HTML = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Consent Resolve CRM</title>
<body style="margin:0;background:#0a1628;color:#e2e8f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">
<div><div style="font-size:20px;font-weight:600;color:#00e5a0">Consent Resolve CRM</div>
<p style="color:#94a3b8;max-width:340px;margin:14px auto">Sign in at <a href="/admin" style="color:#00e5a0">/admin</a>, or open this page with <code style="color:#cbd5e1">?key=</code> appended.</p></div></body>`;

const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Consent Resolve CRM</title>
<style>
:root{--bg:#0a1628;--surf:#11213b;--surf2:#0d1a30;--line:rgba(255,255,255,.09);--mint:#00e5a0;--ink:#e2e8f0;--mut:#94a3b8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px}
a{color:var(--mint)}
header{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--line)}
.logo{width:22px;height:22px;border-radius:6px;background:var(--mint);color:#04342c;display:flex;align-items:center;justify-content:center;font-weight:800}
nav{display:flex;gap:4px;padding:0 12px;border-bottom:1px solid var(--line)}
nav button{background:none;border:none;border-bottom:2px solid transparent;color:var(--mut);padding:10px 14px;cursor:pointer;font-size:13px}
nav button.active{color:#fff;border-bottom-color:var(--mint)}
.wrap{padding:16px 18px;max-width:1100px;margin:0 auto}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
select,input,textarea{background:var(--surf2);border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:7px 9px;font-size:13px}
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
</style></head><body>
<header><div class="logo">✓</div><div style="font-weight:600">Consent Resolve <span class="muted">CRM</span></div><div class="muted tiny" style="margin-left:auto" id="count"></div></header>
<nav>
<button class="active" data-v="leads">Leads</button>
<button data-v="industry">Industries</button>
<button data-v="roas">ROAS</button>
<button data-v="social">Social</button>
<button data-v="settings">Settings</button>
</nav>
<div class="wrap">
<section data-pane="leads">
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
  <div class="bar" style="justify-content:space-between"><div class="muted tiny">Spend by channel</div><button class="ghost" id="addSpend">+ Add spend</button></div>
  <div class="card" style="padding:16px;margin-bottom:14px" id="roasChannels"></div>
  <div class="card" id="spendList"></div>
</section>
<section data-pane="social" hidden>
  <div class="bar"><div class="muted tiny" id="weekLabel"></div></div>
  <div class="calgrid" id="cal"></div>
</section>
<section data-pane="settings" hidden>
  <div class="card" style="padding:16px;margin-bottom:14px"><div style="font-weight:600;margin-bottom:8px">Gmail — two-way email</div><div id="gmailWrap" class="muted tiny">Loading…</div></div>
  <div class="card" style="padding:16px"><div style="font-weight:600;margin-bottom:8px">Webhooks</div>
    <div class="muted tiny" style="margin-bottom:4px">Crisp (Settings → Webhooks):</div><input id="whCrisp" readonly style="width:100%;margin-bottom:10px">
    <div class="muted tiny" style="margin-bottom:4px">Apollo (push identified visitors here):</div><input id="whApollo" readonly style="width:100%">
    <div class="muted tiny" style="margin-top:8px">Apollo visitors arrive flagged “identified” — retargeting/intel only, blocked from outreach.</div>
  </div>
</section>
</div>
<script>
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

var ANALYTICS=null,SOCIAL=null;
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
api("/api/crm/spend").then(function(r){return r.json();}).then(function(d){var s=d.spend||[];document.getElementById("spendList").innerHTML=s.length?s.map(function(r){return '<div class="row" style="cursor:default"><div style="flex:1">'+esc(r.channel)+' <span class="muted">'+esc(r.industry||"")+'</span></div><div class="muted tiny">'+esc((r.period||r.created_at||"").slice(0,10))+'</div><div style="width:80px;text-align:right;font-weight:700">'+money(r.amount_usd)+'</div></div>';}).join(""):'<div class="soon">No spend entries.</div>';});}
function doAddSpend(){var amount=prompt("Amount $ (e.g. 1200)");if(!amount)return;var channel=prompt("Channel (instantly/apollo/crisp/meta/google/other)","meta")||"other";var industry=prompt("Industry slug (e.g. hvac)","")||"";var period=prompt("Period (YYYY-MM, optional)","")||"";
fetch("/api/crm/spend"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({amount_usd:amount,channel:channel,industry:industry,period:period})}).then(function(r){return r.json();}).then(function(res){if(res.error){alert(res.error);return;}ANALYTICS=null;ensureAnalytics();});}
function ensureSocial(){if(SOCIAL){renderSocial();return;}api("/api/crm/social").then(function(r){return r.json();}).then(function(d){SOCIAL=d.posts||[];renderSocial();});}
function renderSocial(){var posts=SOCIAL||[];var now=new Date();var monday=new Date(now);monday.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7));monday.setUTCHours(0,0,0,0);
var pcolor={x:"#888780",twitter:"#888780",linkedin_company:"#378ADD",linkedin:"#378ADD",facebook:"#7F77DD",google_business_profile:"#639922",instagram:"#D4537E"};
var dn=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];var cells=[];for(var i=0;i<7;i++){var d=new Date(monday);d.setUTCDate(monday.getUTCDate()+i);cells.push(d);}
document.getElementById("weekLabel").textContent="Week of "+monday.toISOString().slice(0,10);
document.getElementById("cal").innerHTML=cells.map(function(d){var ds=d.toISOString().slice(0,10);var dp=posts.filter(function(p){return (p.at||"").slice(0,10)===ds;});var chips=dp.map(function(p){var c=pcolor[(p.platform||"").toLowerCase()]||"#888780";return '<div class="chip" style="background:'+c+'">'+esc((p.platform||"").replace(/_/g," "))+'</div>';}).join("")||'<div class="muted tiny">—</div>';return '<div class="calcell"><div class="muted tiny" style="margin-bottom:5px">'+dn[d.getUTCDay()]+' '+d.getUTCDate()+'</div>'+chips+'</div>';}).join("");}

function ensureSettings(){var o=location.origin;var wc=document.getElementById("whCrisp");if(wc)wc.value=o+"/api/crm/crisp?key="+encodeURIComponent(KEY);var wa=document.getElementById("whApollo");if(wa)wa.value=o+"/api/crm/apollo?key="+encodeURIComponent(KEY);api("/api/crm/gmail/status").then(function(r){return r.json();}).then(function(d){renderGmailAccounts(d);});}
function renderGmailAccounts(d){var w=document.getElementById("gmailWrap");if(!d||d.error){w.textContent="unavailable";return;}
var accts=(d.accounts||[]).map(function(a){return '<div class="row" style="cursor:default"><div style="flex:1">'+esc(a.email)+'</div><span class="pill" style="background:rgba(0,229,160,.16);color:#7ff0cd">connected</span></div>';}).join("")||'<div class="muted tiny">No accounts connected yet.</div>';
var cfg=d.configured?"":'<div style="background:rgba(239,159,39,.14);color:#f0c27a;border-radius:8px;padding:9px 11px;margin-bottom:10px">Set GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET in Cloudflare first (or reuse GOOGLE_*), then redeploy.</div>';
w.innerHTML=cfg+accts+'<div style="margin-top:12px"><button class="btn" id="gConnect"'+(d.configured?"":" disabled")+'>+ Connect Gmail account</button></div><div class="muted tiny" style="margin-top:10px">Authorized redirect URI to register on the OAuth client:<br><code style="color:#cbd5e1">'+esc(d.redirect_uri||"")+'</code></div>';
var gc=document.getElementById("gConnect");if(gc)gc.onclick=function(){location.href="/api/crm/gmail/auth"+(KEY?"?key="+encodeURIComponent(KEY):"");};}

document.getElementById("fQ").oninput=render;document.getElementById("fInd").onchange=render;document.getElementById("fSrc").onchange=render;document.getElementById("add").onclick=add;document.getElementById("addSpend").onclick=doAddSpend;
[].forEach.call(document.querySelectorAll("nav button"),function(b){b.onclick=function(){[].forEach.call(document.querySelectorAll("nav button"),function(x){x.classList.remove("active");});b.classList.add("active");var v=b.getAttribute("data-v");[].forEach.call(document.querySelectorAll("[data-pane]"),function(p){p.hidden=p.getAttribute("data-pane")!==v;});if(v==="industry"||v==="roas")ensureAnalytics();if(v==="social")ensureSocial();if(v==="settings")ensureSettings();};});
load();
if(new URLSearchParams(location.search).get("connected")){var sb=null;[].forEach.call(document.querySelectorAll("nav button"),function(b){if(b.getAttribute("data-v")==="settings")sb=b;});if(sb)sb.click();}
</script></body></html>`;

export async function handle({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const ok = (await isAuthed(request, env)) || (key && key === crmKey(env));
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (!ok) return new Response(LOGIN_HTML, { status: 401, headers });
  return new Response(PAGE_HTML, { headers });
}
