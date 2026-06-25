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
</style></head><body>
<header><div class="logo">✓</div><div style="font-weight:600">Consent Resolve <span class="muted">CRM</span></div><div class="muted tiny" style="margin-left:auto" id="count"></div></header>
<nav>
<button class="active" data-v="leads">Leads</button>
<button data-v="industry">Industries</button>
<button data-v="roas">ROAS</button>
<button data-v="social">Social</button>
</nav>
<div class="wrap">
<section data-pane="leads">
  <div class="bar">
    <select id="fInd"><option value="all">All industries</option></select>
    <select id="fSrc"><option value="all">All sources</option><option value="demo">Demo form</option><option value="instantly">Instantly</option><option value="crisp">Crisp</option><option value="rb2b">RB2B</option><option value="manual">Manual</option></select>
    <input id="fQ" placeholder="Search" style="flex:1;min-width:120px">
    <button class="btn" id="add">+ Add lead</button>
  </div>
  <div class="grid">
    <div class="card" id="list"></div>
    <div class="card detail" id="detail"><div class="soon">Select a lead</div></div>
  </div>
</section>
<section data-pane="industry" hidden><div class="soon">Per-industry funnel — building next (slice 4).</div></section>
<section data-pane="roas" hidden><div class="soon">Spend &amp; ROAS — building next (slice 5).</div></section>
<section data-pane="social" hidden><div class="soon">Social calendar — building next (slice 6).</div></section>
</div>
<script>
var KEY=new URLSearchParams(location.search).get("key")||"";
var ALL=[],SEL=null;
function api(p){var sep=p.indexOf("?")>-1?"&":"?";return fetch(p+(KEY?sep+"key="+encodeURIComponent(KEY):""),{credentials:"same-origin"});}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
var SRC={demo:["rgba(0,229,160,.16)","#7ff0cd"],instantly:["rgba(55,138,221,.18)","#9cc6f3"],crisp:["rgba(127,119,221,.2)","#bcb6f2"],rb2b:["rgba(239,159,39,.18)","#f0c27a"],manual:["rgba(148,163,184,.18)","#cbd5e1"]};
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
(rb2b?'<div style="background:rgba(239,159,39,.14);color:#f0c27a;border-radius:8px;padding:9px 11px;font-size:12px;margin-bottom:12px">⚠ Identified by RB2B — no consent. Retargeting &amp; intel only; cannot be moved into outreach.</div>':"")+
'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">'+
'<div><label class="fld">Stage</label><select id="eStage">'+["new","contacted","qualified","demo","proposal"].map(function(s){return '<option'+(l.stage===s?" selected":"")+'>'+s+'</option>';}).join("")+'</select></div>'+
'<div><label class="fld">Status</label><select id="eStatus">'+["open","won","lost","closed"].map(function(s){return '<option'+(l.status===s?" selected":"")+'>'+s+'</option>';}).join("")+'</select></div>'+
'<div><label class="fld">Value $</label><input id="eVal" type="number" value="'+(Number(l.value_usd)||0)+'"></div>'+
'</div>'+
'<div style="margin-bottom:12px"><label class="fld">Owner</label><input id="eOwner" value="'+esc(l.owner||"")+'" placeholder="Aaron / Tyler"></div>'+
'<div style="margin-bottom:12px"><label class="fld">Add note</label><textarea id="eNote" rows="2" style="width:100%" placeholder="Log a note…"></textarea></div>'+
'<div style="display:flex;gap:8px;margin-bottom:18px"><button class="btn" id="save">Save</button><span class="muted tiny" id="saveMsg" style="align-self:center"></span></div>'+
'<div class="muted tiny" style="margin-bottom:8px">Activity</div><div class="tl">'+tlh+'</div>';
document.getElementById("save").onclick=save;}

function save(){if(!SEL)return;var body={id:SEL.id,stage:document.getElementById("eStage").value,status:document.getElementById("eStatus").value,value_usd:document.getElementById("eVal").value,owner:document.getElementById("eOwner").value};var note=document.getElementById("eNote").value.trim();if(note)body.note=note;
document.getElementById("saveMsg").textContent="Saving…";
api("/api/crm/leads").then(function(){return fetch("/api/crm/leads"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});}).then(function(r){return r.json();}).then(function(res){if(res.error){document.getElementById("saveMsg").textContent=res.message||res.error;return;}document.getElementById("saveMsg").textContent="Saved";load(SEL.id);});}

function add(){var name=prompt("Lead name");if(!name)return;var email=prompt("Email (required)");if(!email)return;var industry=prompt("Industry slug (e.g. hvac)")||"";var company=prompt("Company")||"";
fetch("/api/crm/leads"+(KEY?"?key="+encodeURIComponent(KEY):""),{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({create:true,name:name,email:email,industry:industry,company:company,source:"manual"})}).then(function(r){return r.json();}).then(function(res){if(res.error){alert(res.message||res.error);return;}load(res.id);});}

function load(selId){api("/api/crm/leads").then(function(r){return r.json();}).then(function(d){if(d.error){document.getElementById("list").innerHTML='<div class="soon">'+esc(d.error)+' — append ?key=</div>';return;}ALL=d.leads||[];fillIndustries();render();if(selId)selPick(selId);});}

document.getElementById("fQ").oninput=render;document.getElementById("fInd").onchange=render;document.getElementById("fSrc").onchange=render;document.getElementById("add").onclick=add;
[].forEach.call(document.querySelectorAll("nav button"),function(b){b.onclick=function(){[].forEach.call(document.querySelectorAll("nav button"),function(x){x.classList.remove("active");});b.classList.add("active");[].forEach.call(document.querySelectorAll("[data-pane]"),function(p){p.hidden=p.getAttribute("data-pane")!==b.getAttribute("data-v");});};});
load();
</script></body></html>`;

export async function handle({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const ok = (await isAuthed(request, env)) || (key && key === crmKey(env));
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (!ok) return new Response(LOGIN_HTML, { status: 401, headers });
  return new Response(PAGE_HTML, { headers });
}
