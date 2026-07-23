/* Inbox render — reads window.DATA. Pure view logic, no app code (Rule Zero).
   Middle stays calm (who + what to do + the messages); ALL status/tags/activity
   live in the right rail. */
const SRC = {meta:"Meta",instantly:"Instantly",chatwoot:"Chatwoot",site:"Site",demo:"Demo",apollo:"Apollo",manual:"Manual"};
const SRC_COLOR = {meta:"var(--src-meta)",instantly:"var(--src-instantly)",chatwoot:"var(--src-chatwoot)",site:"var(--src-site)",demo:"var(--src-site)",apollo:"var(--src-apollo)",manual:"var(--src-manual)"};
const CH  = {email:"✉ Email",sms:"💬 SMS",ai_call:"📞 AI call",chatwoot:"💬 Chat",demo_form:"✉ Demo",identified:"⛓ Identified"};
const SEQ_ICON = {active:"●",earn_consent:"✉",replied:"✓",booked:"🎉",opted_out:"⛔",failed:"⚠",voicemail:"📞",blocked:"⛓",onboarding:"⚙",none:"—"};
const SEQ_LBL = s => ({active:"In sequence",earn_consent:"Earn consent",replied:"Replied",booked:"Booked",opted_out:"Opted out",failed:"Send failed",voicemail:"Voicemail → email",blocked:"No outreach",onboarding:"Onboarding",none:"New"}[s.status]||"");
/* inline SVG line-icon set — inherits currentColor from the parent */
const _s='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">',_e='</svg>';
const IC = {
  reply:   _s+'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v3"/>'+_e,
  activity:_s+'<path d="M22 12h-4l-3 8-4-16-3 8H2"/>'+_e,
  intel:   _s+'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'+_e,
  task:    _s+'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'+_e,
  deal:    _s+'<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'+_e,
  snooze:  _s+'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'+_e,
  wake:    _s+'<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2"/>'+_e,
  trash:   _s+'<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'+_e,
  attach:  _s+'<path d="M21.4 11 12.2 20.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.9-2.9l8.5-8.5"/>'+_e,
  smiley:  _s+'<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>'+_e,
  pipe:    _s+'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'+_e,
  mail:    _s+'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>'+_e,
  sms:     _s+'<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z"/>'+_e,
  click:   _s+'<path d="M9 9l5 12 1.8-5.2L21 14 9 9z"/><path d="M7.5 2.3 8 5M2.3 7.5 5 8M4.8 16 3 17.8M16 5l1.8-1.8"/>'+_e,
  globe:   _s+'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>'+_e
};
const AV_COLOR = ["#4c8dff","#a884ff","#28c5c0","#33cf7a","#f0b23c","#f6708a"];
function avColor(s){let h=0;for(const c of (s||"?"))h=(h*31+c.charCodeAt(0))>>>0;return AV_COLOR[h%AV_COLOR.length];}
function esc(s){const d=document.createElement("div");d.textContent=s==null?"":s;return d.innerHTML;}
const srcChip = s => `<span class="chip src-${s.source}"><span class="dot"></span>${SRC[s.source]}</span>`;
function initials(n){return (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();}
function cbadge(ch,st){const map={granted:["g","✓"],none:["n","◌"],revoked:["r","⊘"],na:["na","–"]};const[cl,ic]=map[st]||["n","◌"];return `<span class="cbadge ${cl}" title="${ch} consent: ${st} — click to view ledger">${ic} ${ch[0].toUpperCase()+ch.slice(1)}</span>`;}

/* lead phone numbers (prototype) */
const PHONES = {c01:"(727) 555-0155",c02:"(210) 555-0134",c04:"(386) 555-0110",c05:"(512) 555-0142",
  c06:"(352) 555-0188",c07:"(281) 555-0147",c08:"(813) 555-0198",c09:"(409) 555-0121",
  c12:"(813) 555-0166",c13:"(830) 555-0173",c14:"(956) 555-0102"};
function telHref(p){return "tel:+1"+(p||"").replace(/\D/g,"");}

/* team + ownership. Open items were auto-assigned to a rep when the lead replied;
   c10 is left unassigned to show the manual "Assign" state. Auto/suppressed = unassigned. */
const TEAM = {
  andy:{name:"Andy Mentges",init:"AM",color:"#00a86e"},
  tyler:{name:"Tyler Reed",init:"TR",color:"#4c8dff"},
  jason:{name:"Jason Poe",init:"JP",color:"#a884ff"} };
const OWNERS = {c05:"andy",c08:"andy",c03:"tyler",c13:"jason",c09:"tyler"};
function ownerOf(c){return TEAM[OWNERS[c.id]]||null;}

/* campaign a paid lead came from (prototype) */
const CAMPAIGN = {c01:"Meta · Exclusive HVAC Leads",c05:"Meta · Roofing Leads Q3",
  c06:"Meta · Home Services US",c08:"Meta · Painter Leads",c12:"Meta · Appliance Repair (no PEWC)"};
function animateCost(){
  document.querySelectorAll('[data-cost]').forEach(el=>{
    const to=parseFloat(el.dataset.cost), start=Date.now(), dur=650;
    (function step(){const t=Math.min(1,(Date.now()-start)/dur),e=1-Math.pow(1-t,3);
      el.textContent='$'+(to*e).toFixed(2); if(t<1)requestAnimationFrame(step);})();
  });
}

/* lead age at page load (seconds) — the list clock ticks up from here */
const AGE = {c01:540,c02:259200,c03:180,c04:86400,c05:1320,c06:2400,c07:7200,c08:1800,
  c09:1814400,c10:10800,c11:18000,c12:3000,c13:3600,c14:172800};
const T0 = Date.now();
function fmtAge(sec){sec=Math.max(0,Math.floor(sec));const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),m=Math.floor(sec%3600/60),s=sec%60;
  if(sec<3600)return `${m}m ${String(s).padStart(2,'0')}s`;
  if(sec<86400)return `${h}h ${String(m).padStart(2,'0')}m`;
  return `${d}d ${h}h`;}
function tickClocks(){const now=Date.now();document.querySelectorAll('.clk[data-base]').forEach(n=>{n.textContent='⏱ '+fmtAge((+n.dataset.base)+(now-T0)/1000);});}

let sel="c05";

/* LIST — clean rows: source dot + name + time, company, one action/summary line */
function renderList(filter){
  const rows=document.getElementById("rows");
  const items=DATA.conversations.filter(c=> filter==="all" ? true : c.bucket===filter);
  rows.innerHTML = items.map(c=>{
    const col=SRC_COLOR[c.source]||"var(--tx-3)";
    const dot=`<span class="srcdot" style="border-color:${col};${c.unread?'background:'+col:''}"></span>`;
    const needsFix = c.task && c.task.tag==="wait";
    const o = ownerOf(c);
    const ownerSm = o ? `<span class="oav-sm" style="background:${o.color}" title="Owner: ${o.name}">${o.init}</span>` : "";
    const tp=taskProgress(c.id);
    const dstg=dstate(c.id).stage;
    const stagePill = dstg!=='new' ? `<span class="rstage ${dstg}" title="Deal stage">${dstg}</span>` : '';
    return `<button class="row ${c.id===sel?'sel':''} ${needsFix?'fix':''} ${c.bucket==='suppressed'?'dim':''}" onclick="select('${c.id}')">
      <div class="row-main">
        <div class="l1">${dot}<span class="nm">${esc(c.name||"Unknown")}</span>${ownerSm}<span class="clk" data-base="${AGE[c.id]||0}">⏱ …</span></div>
        <div class="co"><span class="conm">${esc(c.company||"— no company —")}</span>${stagePill}<span class="trollup ${tp.done===tp.total?'done':''}" title="Research & engagement tasks done">🗒 ${tp.done}/${tp.total}</span></div>
      </div>
      <span class="rowacts">
        <span class="ract" title="${c.bucket==='snoozed'?'Wake':'Snooze'}" onclick="event.stopPropagation();snoozeConv('${c.id}')">${c.bucket==='snoozed'?IC.wake:IC.snooze}</span>
        <span class="ract del" title="Delete" onclick="event.stopPropagation();deleteConv('${c.id}')">${IC.trash}</span>
      </span>
    </button>`;
  }).join("") || `<div style="padding:30px;text-align:center;color:var(--tx-3)">Nothing here. 🎉</div>`;
  tickClocks();
  updatePipe();
}

function tracker(seq,isAuto){
  if(!seq.total) return "";
  const steps=["SMS","AI call","Email","Next-day"].slice(0,seq.total);
  const lbls = seq.label.startsWith("Earn")?["Email 1","Email 2","Pref center"]: seq.label.startsWith("Onboard")?["Welcome","Install","Activate"]: steps;
  const exited=["replied","booked","opted_out"].includes(seq.status);
  return `<div class="tracker ${isAuto?'tk-auto':'tk-paused'}">${lbls.map((l,i)=>{
    const n=i+1; const done=n<seq.step||exited&&n<=seq.step; const cur=n===seq.step&&!exited;
    return `<div class="st ${done?'done':''} ${cur?'cur':''}"><div class="bub">${done?'✓':n}</div><div class="cap">${l}</div></div>`;
  }).join("")}</div>`;
}

/* SMS / chat bubble thread */
function bubbleThread(c){
  return `<div class="msgs">${c.messages.map(m=>{
    if(m.dir==="system") return `<div class="msg system">${esc(m.body)}<div class="mt">${esc(m.ts)}</div></div>`;
    return `<div class="msg ${m.dir}"><div class="mh">${m.dir==='in'?'▸ ':''}${(CH[m.channel]||m.channel||'').replace(/^[^ ]+ /,'')} ${m.meta?'· '+esc(m.meta):''}</div>${esc(m.body)}<div class="mt">${esc(m.ts)}</div></div>`;
  }).join("")}</div>`;
}

/* unified composer with an SMS / Email channel switch (limited to consented channels) */
const REPLYCH={}, CHLABEL={sms:'💬 SMS',email:'✉ Email',chat:'💬 Chat'};
const CHWORD={sms:'SMS',email:'Email',chat:'Chat'}, CHICON={sms:'💬',email:'✉',chat:'💬'};
function replyChannels(c){
  const out=[];
  if(c.channel==='chatwoot') out.push('chat');
  if(c.consent.sms==='granted') out.push('sms');
  if(c.consent.email==='granted') out.push('email');
  return out;
}
function replyChOf(c){
  const avail=replyChannels(c);
  let cur=REPLYCH[c.id];
  if(!cur||!avail.includes(cur)) cur=REPLYCH[c.id]= (avail.includes(c.channel)?c.channel:avail[0])||null;
  return cur;
}
function setReplyCh(id,ch){REPLYCH[id]=ch; if(curTab==='reply') rerenderComposer(); else renderTab(DATA.conversations.find(x=>x.id===id));}
window.setReplyCh=setReplyCh;

/* Gmail-style reply: hidden behind a Reply button, expands into a WYSIWYG editor
   with a formatting toolbar + attachments. */
let replyOpen=false, ATTACH=[];
function composer(c){
  if(c.sequence.status==='opted_out') return `<div class="banner stop">⛔ Contact opted out of SMS/voice. Only email is permitted. Revocation is on the consent ledger.</div>`;
  if(c.sequence.status==='blocked') return `<div class="banner block">⛓ Identified visitor (no consent to contact). Outreach is disabled — retargeting + context only.</div>`;
  const avail=replyChannels(c), cur=replyChOf(c);
  if(!cur) return `<div class="banner block">No consented channel to reply on yet — earn consent first (email preference center).</div>`;
  const chToggle = avail.length>1
    ? `<div class="chswitch">${avail.map(ch=>`<button class="chseg ${ch===cur?'on':''}" onclick="event.stopPropagation();setReplyCh('${c.id}','${ch}')"><span class="ci">${CHICON[ch]}</span>${CHWORD[ch]}</button>`).join('')}</div>`
    : `<span class="rvia-chip"><span class="ci">${CHICON[cur]}</span>${CHWORD[cur]}</span>`;
  if(!replyOpen){
    return `<div class="rcollapse">
      <button class="rbtn-reply" onclick="openReply()">${IC.reply}&nbsp;Reply</button>
      <span class="rvia-lbl">Send via</span>${chToggle}
    </div>`;
  }
  const sw = chToggle;
  const fmtGroup = cur==='email' ? `
      <button class="tb" onmousedown="return false" onclick="fmt('bold')" title="Bold" style="font-weight:800">B</button>
      <button class="tb" onmousedown="return false" onclick="fmt('italic')" title="Italic" style="font-style:italic">I</button>
      <button class="tb" onmousedown="return false" onclick="fmt('underline')" title="Underline" style="text-decoration:underline">U</button>
      <span class="rc-sep"></span>
      <button class="tb" onmousedown="return false" onclick="fmt('insertUnorderedList')" title="Bulleted list">•≡</button>
      <button class="tb" onmousedown="return false" onclick="rteLink()" title="Insert link">🔗</button>
      <span class="rc-sep"></span>` : '';
  const ph = cur==='email' ? "Write your email reply…" : cur==='chat' ? "Reply in chat…" : "Write a reply… (auto-personalizes {first}/{trade})";
  return `<div class="rcomp">
    <div class="rc-head"><span class="clabel">Reply via</span>${sw}${cur==='email'?`<span class="cto">to ${esc(c.contact_email||'lead')}</span>`:''}<button class="rc-x" onclick="closeReply()" title="Discard">✕</button></div>
    <div class="rc-toolbar">${fmtGroup}
      <span class="tmpl" onmousedown="return false" onclick="insertTemplate('demo')">Book a demo</span>
      <span class="tmpl" onmousedown="return false" onclick="insertTemplate('how')">How it works</span>
      <span class="tmpl" onmousedown="return false" onclick="insertTemplate('pricing')">Pricing</span>
    </div>
    <div class="rte" id="rte" contenteditable="true" data-ph="${ph}"></div>
    <div class="rc-attach" id="attachChips"></div>
    <div class="rc-foot">
      <button class="btn" onclick="sendReply()">Send</button>
      <input type="file" id="attachInput" multiple hidden onchange="onAttach(this.files)">
      <button class="rc-icon" onclick="document.getElementById('attachInput').click()" title="Attach files">${IC.attach}</button>
      <button class="rc-icon" onmousedown="return false" onclick="insertText('🙂')" title="Insert emoji">${IC.smiley}</button>
      <button class="rc-icon rc-trash" onclick="closeReply()" title="Discard draft">${IC.trash}</button>
    </div>
  </div>`;
}
function rerenderComposer(){const host=document.getElementById('composerhost'); if(!host)return; host.innerHTML=composer(DATA.conversations.find(x=>x.id===sel)); renderAttachChips();}
function openReply(){replyOpen=true; ATTACH=[]; rerenderComposer(); setTimeout(()=>document.getElementById('rte')?.focus(),0);}
function closeReply(){replyOpen=false; ATTACH=[]; rerenderComposer();}
function fmt(cmd){document.execCommand(cmd,false,null); document.getElementById('rte')?.focus();}
function rteLink(){const u=prompt('Link URL','https://'); if(u){document.getElementById('rte')?.focus(); document.execCommand('createLink',false,u);}}
function insertText(t){const ed=document.getElementById('rte'); if(!ed)return; ed.focus(); document.execCommand('insertText',false,t);}
const RTMPL={
  demo:"Want the 2-minute version? Grab any time here and I'll show it on your own site: [link]",
  how:"Short version: we turn the visitors your site already gets into consented, exclusive leads — $7 each, never resold.",
  pricing:"Pricing is a flat $7 per exclusive lead. No minimum, no reselling — the lead is yours alone."
};
function insertTemplate(k){insertText(RTMPL[k]||'');}
function onAttach(files){for(const f of files)ATTACH.push({name:f.name,size:f.size}); renderAttachChips();}
function removeAttach(i){ATTACH.splice(i,1); renderAttachChips();}
function renderAttachChips(){const el=document.getElementById('attachChips'); if(!el)return; el.innerHTML=ATTACH.map((a,i)=>`<span class="achip">📎 ${esc(a.name)}<span class="ax" onclick="removeAttach(${i})">✕</span></span>`).join('');}
function sendReply(){
  const c=DATA.conversations.find(x=>x.id===sel), ed=document.getElementById('rte');
  const text=ed?ed.innerText.trim():'';
  if(!text && !ATTACH.length){closeReply(); return;}
  const ch=replyChOf(c), n=ATTACH.length;
  c.messages.push({dir:'out',channel:ch,body:text||'(attachment sent)',ts:'just now',meta:n?`sent · ${n} file${n>1?'s':''}`:'sent'});
  replyOpen=false; ATTACH=[];
  renderTab(c);
  const sc=document.querySelector('#tabbody .msgs, #tabbody .gmail'); if(sc)sc.scrollTop=sc.scrollHeight;
}
window.openReply=openReply; window.closeReply=closeReply; window.fmt=fmt; window.rteLink=rteLink;
window.insertText=insertText; window.insertTemplate=insertTemplate; window.onAttach=onAttach; window.removeAttach=removeAttach; window.sendReply=sendReply;

/* Gmail-style email thread */
function gmailThread(c){
  const subj = c.email_subject || (c.messages.find(m=>m.subject)||{}).subject || "(no subject)";
  const emails = c.messages.filter(m=>m.dir!=="system");
  const sys = c.messages.filter(m=>m.dir==="system");
  const card = m=>{
    const out = m.dir==="out";
    const who = out ? DATA.me.name : (c.name||"Unknown");
    const addr = out ? DATA.me.email : (c.contact_email||"");
    const init = out ? initials(DATA.me.name) : (c.initials==="?"?"?":c.initials);
    const opened = m.meta==="opened";
    return `<div class="gm-msg">
      <div class="gm-head">
        <div class="gm-av" style="background:${out?'var(--accent)':avColor(who)};${out?'color:var(--on-accent)':''}">${esc(init)}</div>
        <div class="gm-who"><b>${esc(who)}</b> <span class="addr">&lt;${esc(addr)}&gt;</span><span class="to">to ${out?esc(c.name||'lead'):'me'}</span></div>
        <div class="gm-time">${esc(m.ts)}${opened?'<span class="op">✓ opened</span>':''}</div>
      </div>
      <div class="gm-body">${esc(m.body)}</div>
    </div>`;
  };
  return `<div class="gmail">
    <div class="gm-subject">${esc(subj)} <span class="gm-count">(${emails.length})</span></div>
    ${sys.map(m=>`<div class="gm-msg sys">${esc(m.body)} · ${esc(m.ts)}</div>`).join("")}
    ${emails.map(card).join("")}
  </div>`;
}

/* RIGHT RAIL — status + activity + consent + intel (everything lives here) */
/* automation state: on=workflow running, paused=human replying, none=no sequence yet,
   done=goal met, off=outreach not allowed */
function autoState(c){
  const s=c.sequence.status;
  if(c.bucket==="auto") return "on";
  if(s==="booked") return "done";
  if(s==="opted_out"||s==="blocked") return "off";
  if(c.sequence.total>0) return "paused";
  return "none";
}
const ANOTE = {
  on:    `<b>Automation on.</b> The workflow is sending the next steps for you — no action needed.`,
  paused:`<b>Paused — you're replying manually.</b> Flip to <b>Auto</b> to hand it back to the workflow. It also auto-resumes if the lead goes quiet.`,
  none:  `<b>No workflow yet.</b> Reply manually, or flip to <b>Auto</b> to start a follow-up sequence.`,
  done:  `<b>Sequence ended — goal met.</b> No further automated steps will fire.`,
  off:   `<b>Automation off.</b> Outreach isn't permitted for this contact.`
};
function recount(){
  const n={open:0,auto:0,snoozed:0};
  DATA.conversations.forEach(c=>{ if(c.bucket in n) n[c.bucket]++; });
  DATA.counts.open=n.open; DATA.counts.auto=n.auto; DATA.counts.snoozed=n.snoozed;
  document.querySelector('.filters [data-f=open] .n').textContent=n.open;
  document.querySelector('.filters [data-f=auto] .n').textContent=n.auto;
  document.querySelector('.filters [data-f=snoozed] .n').textContent=n.snoozed;
  document.querySelector('.filters [data-f=all] .n').textContent=DATA.conversations.length;
}
/* snooze / delete a conversation */
function curFilter(){return document.querySelector('.filters .on').dataset.f;}
function snoozeConv(id){
  const c=DATA.conversations.find(x=>x.id===id); if(!c)return;
  if(c.bucket==='snoozed'){ c.bucket=c._prevBucket||'open'; }
  else { c._prevBucket=c.bucket; c.bucket='snoozed'; }
  recount(); renderList(curFilter());
}
function deleteConv(id){
  const i=DATA.conversations.findIndex(x=>x.id===id); if(i<0)return;
  DATA.conversations.splice(i,1); recount();
  const f=curFilter();
  if(sel===id){ const nx=DATA.conversations.find(c=> f==='all'?true:c.bucket===f)||DATA.conversations[0];
    if(nx){ select(nx.id); } else { document.getElementById('thread').innerHTML=`<div class="emptytab" style="margin:auto"><div class="ei">📭</div><h3>No conversations</h3></div>`; renderList(f); } }
  else renderList(f);
  if(!document.getElementById('pipelineview').hidden) renderPipeline();
}
window.snoozeConv=snoozeConv;window.deleteConv=deleteConv;
function setAuto(btn,mode){
  const c=DATA.conversations.find(x=>x.id===sel);
  // Flipping automation re-buckets the conversation: Auto → runs in the workflow
  // (Auto tab); Manual → a human owns it in Open.
  if(c){
    if(mode==='auto' && c.bucket!=='auto') c.bucket='auto';
    else if(mode==='manual' && c.bucket!=='open') c.bucket='open';
    recount();
  }
  const sw=btn.parentElement;
  sw.querySelectorAll('.seg').forEach(b=>b.classList.remove('on','onauto','onman'));
  btn.classList.add('on', mode==='auto'?'onauto':'onman');
  document.getElementById('autotip').innerHTML = mode==='auto' ? ANOTE.on : ANOTE.paused;
  const tk=document.querySelector('.tracker');
  if(tk){ tk.classList.remove('tk-auto','tk-paused'); tk.classList.add(mode==='auto'?'tk-auto':'tk-paused'); }
  renderList(document.querySelector('.filters .on').dataset.f);
}
window.setAuto = setAuto;

function statusCard(c){
  const s=c.sequence, st=autoState(c), autoOn=st==="on";
  const controllable = st==="on"||st==="paused"||st==="none";
  const control = controllable
    ? `<div class="autoswitch">
        <button class="seg ${!autoOn?'on onman':''}" onclick="setAuto(this,'manual')">⏸ Paused</button>
        <button class="seg ${autoOn?'on onauto':''}" onclick="setAuto(this,'auto')">▶ Auto</button>
      </div>`
    : `<span class="autobadge ${st}">${st==="done"?"✓ Ended":"⛔ Off"}</span>`;
  const waiting = st==="on" ? `<span class="sv mut">Automated</span>`
    : (c.sla.level==="warn"||c.sla.level==="bad") ? `<span class="sv ${c.sla.level}">${c.sla.min}m</span>`
    : (st==="done"||st==="off") ? `<span class="sv mut">—</span>`
    : `<span class="sv mut">on track</span>`;
  const seqBlock = s.total ? `<div class="seqwrap">${tracker(s, st==='on'||st==='done')}</div>` : '';
  const acq = c.intel.cost_per_lead
    ? `<div class="acqcost"><div class="lab">Our cost for this lead</div><div class="amt" data-cost="${c.intel.cost_per_lead}">$0.00</div><div class="ch">${esc(CAMPAIGN[c.id]||c.intel.src_label)}</div></div>`
    : `<div class="acqcost none">No ad cost — organic / inbound</div>`;
  return `<div class="card status">
    <div class="shead"><h4>Status</h4>
      <div class="autowrap">${control}<div class="tip" id="autotip">${ANOTE[st]}</div></div>
    </div>
    ${seqBlock}
    <div class="sgrid">
      <div class="scell"><span class="sl">Stage</span><span class="sv">${c.lifecycle}</span></div>
      <div class="scell"><span class="sl">Channel</span><span class="sv">${CH[c.channel]||c.channel}</span></div>
      <div class="scell"><span class="sl">Priority</span><span class="sv ${c.hot?'bad':'mut'}">${c.hot?'🔥 Hot':'Normal'}</span></div>
      <div class="scell"><span class="sl">Response</span>${waiting}</div>
    </div>
    ${acq}
  </div>`;
}
function activityCard(c){
  const L=c.last, N=c.next;
  const nextClass = N.kind==="you" ? (N.tone==="urgent"?"urgent":"act") : (N.tone||"info");
  const nextLabel = N.kind==="you" ? "You — next step" : N.kind==="auto" ? "Next (automatic)" : N.kind==="snoozed" ? "Snoozed" : "Next";
  return `<div class="card"><h4>Activity</h4>
    <div class="act">
      <div class="actrow ${L.tone}"><span class="adot"></span><div><label>What happened</label><b>${esc(L.label)}</b><time>${esc(L.ts)}</time></div></div>
      <div class="actrow ${nextClass}"><span class="adot"></span><div><label>${nextLabel}</label><b>${esc(N.label)}</b><time>${esc(N.when)}</time></div></div>
    </div>
  </div>`;
}

/* ---- auto-verified prospect intel (Fit & site) ---- */
function fmtK(n){return n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+'k':String(n);}
function prow(status,k,v,link,tone){
  const s={ok:'✓',no:'✗',off:'—'}[status]||'—', sc={ok:'good',no:'bad',off:'mut'}[status];
  const val = link?`<a href="${link}" target="_blank" rel="noopener">${esc(v)} ↗</a>`:esc(v);
  return `<div class="prow"><span class="pst ${sc}">${s}</span><span class="pk">${k}</span><span class="pv ${tone||''}">${val}</span></div>`;
}
function xtile(v,k){return `<div class="xtile"><div class="v">${esc(String(v))}</div><div class="k">${k}</div></div>`;}
function adsTxt(a){if(!a)return"not running";const p=[];if(a.google)p.push("Google Ads");if(a.lsa)p.push("LSA");return p.length?p.join(" + "):"not running";}
function intelCard(c){
  const it=c.intel, e=((window.ENRICH||{})[c.id]||{});
  const fitRow=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span class="fit ${it.fit}">${it.fit.toUpperCase()}</span><span style="font-size:var(--t-12);color:var(--tx-2)">${esc(it.src_label)}</span></div>`;
  if(!e) return `<div class="card"><h4>Fit &amp; site — auto-verified</h4>${fitRow}
    <div class="noenrich" style="margin-top:8px">No public profile matched yet — need a name or company.<button class="mini">Run lookup ▸</button></div></div>`;
  const rows=[
    prow(e.website?'ok':'no','Website', e.website?`${e.website.domain} · ${e.website.capture?'has a form':'no lead form'}`:'not found', e.website?('https://'+e.website.domain):null, e.website&&!e.website.capture?'warn':''),
    prow(e.facebook?'ok':'no','Facebook', e.facebook?(e.facebook.ads_live>0?`@${e.facebook.handle} · ${e.facebook.ads_live} ads live`:`@${e.facebook.handle} · ${fmtK(e.facebook.followers)} followers`):'no page found', e.facebook?('https://facebook.com/'+e.facebook.handle):null, e.facebook&&e.facebook.ads_live>0?'good':''),
    prow(e.gmb?'ok':'no','Google Biz', e.gmb?`${e.gmb.rating}★ (${e.gmb.reviews}) · ${e.gmb.verified?'verified':'unclaimed'}`:'no listing', null, ''),
    prow(e.ads&&(e.ads.google||e.ads.lsa)?'ok':'off','Paid search', adsTxt(e.ads), null, ''),
    prow(e.pixels&&e.pixels.length?'ok':'off','Tracking', e.pixels&&e.pixels.length?e.pixels.join(' + ')+' pixel':'none detected', null, ''),
    prow(e.spend_high>0?'ok':'off','Ad spend', e.spend_high>0?`$${(e.spend_low/1000).toFixed(1).replace(/\.0$/,'')}k–${(e.spend_high/1000).toFixed(1).replace(/\.0$/,'')}k/mo · ${e.spend_channels.join(', ')}`:'not advertising', null, ''),
    prow(foundVal(c.id,'address')?'ok':'off','Address', foundVal(c.id,'address')||'— add in Tasks', null, ''),
    prow(foundVal(c.id,'linkedin')?'ok':'off','LinkedIn', foundVal(c.id,'linkedin')||'— add in Tasks', foundVal(c.id,'linkedin')?linkFor('linkedin',foundVal(c.id,'linkedin')):null, ''),
    prow(foundVal(c.id,'instagram')?'ok':'off','Instagram', foundVal(c.id,'instagram')||'— add in Tasks', foundVal(c.id,'instagram')?linkFor('instagram',foundVal(c.id,'instagram')):null, ''),
    prow(foundVal(c.id,'tiktok')?'ok':'off','TikTok', foundVal(c.id,'tiktok')||'— add in Tasks', foundVal(c.id,'tiktok')?linkFor('tiktok',foundVal(c.id,'tiktok')):null, '')
  ].join("");
  const extra=`<div class="xgrid">${e.traffic_month?xtile(fmtK(e.traffic_month),'Visits/mo'):''}${e.employees?xtile(e.employees,'Employees'):''}${e.years?xtile(e.years+' yr','In business'):''}</div>`;
  const signal = e.signal?`<div class="signal">🔥 <span>${esc(e.signal)}</span></div>`:'';
  return `<div class="card"><h4>Fit &amp; site — auto-verified</h4>${fitRow}
    <div class="presence">${rows}</div>${extra}${signal}</div>`;
}

/* ---- right-rail cards + tab content ---- */
function consentCard(c){return `<div class="card"><h4>Consent — click a row to open the ledger</h4><div class="clist">
  <div class="crow"><span class="k">Email</span> ${cbadge('email',c.consent.email)}</div>
  <div class="crow"><span class="k">SMS</span> ${cbadge('sms',c.consent.sms)}</div>
  <div class="crow"><span class="k">Voice</span> ${cbadge('voice',c.consent.voice)}</div>
</div></div>`;}
function engagementCard(c){const it=c.intel;return `<div class="card"><h4>Engagement — visit to our site</h4><div class="tiles">
  <div class="tile"><div class="v">${esc(it.time_on_site)}</div><div class="k">On site</div></div>
  <div class="tile"><div class="v">${it.pages}</div><div class="k">Pages</div></div>
  <div class="tile"><div class="v">${esc(it.first_seen)}</div><div class="k">First seen</div></div>
  <div class="tile"><div class="v">${it.speed_to_lead_h!=null?it.speed_to_lead_h+'h':'—'}</div><div class="k">Speed→lead</div></div>
</div></div>`;}
function pagesCard(c){const it=c.intel;return it.pages_viewed.length?`<div class="card"><h4>Pages viewed</h4><div class="pv-list">${it.pages_viewed.map(p=>'→ '+esc(p)).join("")}</div></div>`:'';}
function dealCard(c){return c.deal?`<div class="card dealcard"><h4>Deal</h4><div style="font-weight:700">${esc(c.deal.title)}</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px"><b>${c.deal.value_usd?'$'+c.deal.value_usd.toLocaleString():'—'}</b><span style="color:var(--tx-3);font-size:var(--t-12)">${c.deal.prob}% likely</span></div>
  <div class="prob"><i style="width:${c.deal.prob}%"></i></div></div>`:'';}

/* ---- Tasks: auto-lookup data (→ Intel) + manual engagement actions ---- */
const DATA_FIELDS=['website','address','facebook','linkedin','instagram','tiktok'];
const ACTION_KEYS=['fb_follow','fb_group','li_follow','li_group','li_connect','ig_follow','ig_like','tt_follow','tt_like'];
const TASKSTATE={};
function initialFound(id){const e=(window.ENRICH||{})[id]||{};const f={};if(e.website)f.website=e.website.domain;if(e.facebook)f.facebook='@'+e.facebook.handle;return f;}
function tstate(id){if(!TASKSTATE[id])TASKSTATE[id]={found:initialFound(id),done:new Set()};return TASKSTATE[id];}
function foundVal(id,f){const x=tstate(id).found[f];return x&&x!=='__none__'?x:null;}
function taskProgress(id){const st=tstate(id);
  const d=DATA_FIELDS.filter(f=>foundVal(id,f)).length, a=ACTION_KEYS.filter(k=>st.done.has(k)).length;
  return {done:d+a, total:DATA_FIELDS.length+ACTION_KEYS.length};}
function linkFor(field,v){v=v.replace('@','');return {
  website:'https://'+v, facebook:'https://facebook.com/'+v, linkedin:'https://linkedin.com/company/'+v,
  instagram:'https://instagram.com/'+v, tiktok:'https://tiktok.com/@'+v }[field]||null;}
function taskLookup(id,field){
  const e=(window.ENRICH||{})[id]||{}, d=(window.DIRECTORY||{})[id]||{}, st=tstate(id);
  const val = field==='website'?(e.website&&e.website.domain)
    : field==='facebook'?(e.facebook&&'@'+e.facebook.handle) : d[field];
  st.found[field]= val || '__none__';
  rerenderTasks(id);
}
function taskEnter(id,field,val){val=(val||'').trim();const st=tstate(id);if(val)st.found[field]=val;else delete st.found[field];rerenderTasks(id);}
function taskToggle(id,key){const st=tstate(id);st.done.has(key)?st.done.delete(key):st.done.add(key);rerenderTasks(id);}
function rerenderTasks(id){
  if(curTab==='task'&&sel===id)renderTab(DATA.conversations.find(x=>x.id===id));
  renderList(document.querySelector('.filters .on').dataset.f); // roll the count up to the lead row
}
window.taskLookup=taskLookup;window.taskEnter=taskEnter;window.taskToggle=taskToggle;

function dataRow(c,field,label){
  const v=foundVal(c.id,field), st=tstate(c.id);
  if(v){
    const link=linkFor(field,v), disp=link?`<a href="${link}" target="_blank" rel="noopener">${esc(v)} ↗</a>`:esc(v);
    return `<div class="trow"><span class="tcheck on">✓</span><div class="tlabel">${label}</div><div class="tval">${disp}<span class="tointel">→ Intel</span></div></div>`;
  }
  const nf = st.found[field]==='__none__' ? `<span class="tnf">not found — enter it</span>` : '';
  return `<div class="trow"><span class="tcheck"></span><div class="tlabel">${label}${nf}</div>
    <input class="tinput" placeholder="paste…" onchange="taskEnter('${c.id}','${field}',this.value)">
    <button class="tlook" onclick="taskLookup('${c.id}','${field}')">Look up ▸</button></div>`;
}
function actionRow(c,key,label,sub,field,linkLabel){
  const on=tstate(c.id).done.has(key);
  const v=field?foundVal(c.id,field):null, link=v?linkFor(field,v):null;
  const open = field ? (link
      ? `<a class="topen" href="${link}" target="_blank" rel="noopener">${linkLabel||'Open'} ↗</a>`
      : `<span class="topen off" title="Look up the ${field} handle first (in this tab)">${linkLabel||'Open'} ↗</span>`)
    : '';
  return `<div class="trow"><span class="tcheck ${on?'on':''}" onclick="taskToggle('${c.id}','${key}')">${on?'✓':''}</span>
    <div class="tlabel">${label}${sub?`<div class="sub">${sub}</div>`:''}</div>${open}</div>`;
}
function taskTab(c){
  const st=tstate(c.id);
  const groups=[
    ['Contact details',[dataRow(c,'website','Find website'),dataRow(c,'address','Find postal address')]],
    ['Facebook',[dataRow(c,'facebook','Add Facebook handle'),actionRow(c,'fb_follow','Follow the page',null,'facebook','Follow'),actionRow(c,'fb_group','Join 1 group they’re in','as Consent Resolve','facebook','Find groups')]],
    ['LinkedIn',[dataRow(c,'linkedin','Add company page + profile URL'),actionRow(c,'li_follow','Follow the page',null,'linkedin','Follow'),actionRow(c,'li_group','Join 1 group they’re in',null,'linkedin','Find groups'),actionRow(c,'li_connect','Connect via LinkedIn persona',null,'linkedin','Open')]],
    ['Instagram',[dataRow(c,'instagram','Add username'),actionRow(c,'ig_follow','Follow',null,'instagram','Follow'),actionRow(c,'ig_like','Like a few videos',null,'instagram','Open')]],
    ['TikTok',[dataRow(c,'tiktok','Add username'),actionRow(c,'tt_follow','Follow',null,'tiktok','Follow'),actionRow(c,'tt_like','Like a few videos',null,'tiktok','Open')]]
  ];
  const dataDone=DATA_FIELDS.filter(f=>foundVal(c.id,f)).length;
  const actDone=ACTION_KEYS.filter(k=>st.done.has(k)).length;
  const total=DATA_FIELDS.length+ACTION_KEYS.length, done=dataDone+actDone;
  return `<div class="tasks">
    <div class="tprog"><b>${done}</b> / ${total} done · <span class="tintel-note">${dataDone} data points synced to Intel</span></div>
    ${groups.map(([t,rows])=>`<div class="tgroup"><h5>${t}</h5>${rows.join('')}</div>`).join('')}
  </div>`;
}

/* automation toggle (moves to the header, under the owner) */
function autoControl(c){
  const st=autoState(c), autoOn=st==='on', controllable=st==='on'||st==='paused'||st==='none';
  return controllable
    ? `<div class="autowrap"><div class="autoswitch">
        <button class="seg ${!autoOn?'on onman':''}" onclick="setAuto(this,'manual')">⏸ Paused</button>
        <button class="seg ${autoOn?'on onauto':''}" onclick="setAuto(this,'auto')">▶ Auto</button>
      </div><div class="tip" id="autotip">${ANOTE[st]}</div></div>`
    : `<span class="autobadge ${st}">${st==='done'?'✓ Ended':'⛔ Off'}</span>`;
}
/* status detail (grid + step tracker) — lives at the top of the Intel tab */
function statusIntel(c){
  const s=c.sequence, st=autoState(c);
  const waiting = st==="on" ? `<span class="sv mut">Automated</span>`
    : (c.sla.level==="warn"||c.sla.level==="bad") ? `<span class="sv ${c.sla.level}">${c.sla.min}m</span>`
    : (st==="done"||st==="off") ? `<span class="sv mut">—</span>`
    : `<span class="sv mut">on track</span>`;
  const seqBlock = s.total ? `<div class="seqwrap">${tracker(s, st==='on'||st==='done')}</div>` : '';
  return `<div class="card status"><h4>Status</h4>
    <div class="sgrid">
      <div class="scell"><span class="sl">Stage</span><span class="sv">${c.lifecycle}</span></div>
      <div class="scell"><span class="sl">Channel</span><span class="sv">${CH[c.channel]||c.channel}</span></div>
      <div class="scell"><span class="sl">Priority</span><span class="sv ${c.hot?'bad':'mut'}">${c.hot?'🔥 Hot':'Normal'}</span></div>
      <div class="scell"><span class="sl">Response</span>${waiting}</div>
    </div>
    ${seqBlock}
  </div>`;
}

/* ---- Deal tab: stage · trial signup (console username) · traffic→deal-size predictor ---- */
const CR_IDENTIFY_RATE=0.02, CR_PRICE=7;          // ~2% of visitors become consented $7 leads
function predictLeads(v){return Math.round(v*CR_IDENTIFY_RATE);}
function predictValue(v){return predictLeads(v)*CR_PRICE;}
function snap(v){if(v<=100)return 100;if(v>=100000)return 100000;const m=Math.pow(10,Math.floor(Math.log10(v))-1);return Math.round(v/m)*m;}
const DEALSTATE={};
function initStage(id){const c=DATA.conversations.find(x=>x.id===id);if(!c)return'new';const s=c.sequence.status;if(s==='booked')return'trial';if(s==='opted_out'||s==='blocked')return'lost';return'new';}
function dstate(id){if(!DEALSTATE[id]){const e=(window.ENRICH||{})[id]||{},st=initStage(id);DEALSTATE[id]={stage:st,trial:st==='trial',username:'',visitors:e.traffic_month||1000};}return DEALSTATE[id];}
function dealStage(id,stage){dstate(id).stage=stage;rerenderDeal(id);}
function dealTrial(id,on){dstate(id).trial=(on===true||on==='true');rerenderDeal(id);}
function dealUser(id,val){dstate(id).username=(val||'').trim();}
function dealTraffic(id,pct){const v=snap(Math.round(100*Math.pow(1000,pct/100)));dstate(id).visitors=v;
  const set=(k,val)=>{const el=document.getElementById(k);if(el)el.textContent=val;};
  set('dvalue',predictValue(v).toLocaleString());set('dyear',(predictValue(v)*12).toLocaleString());
  set('dvisits',v.toLocaleString());set('dleads',predictLeads(v).toLocaleString());}
function rerenderDeal(id){
  if(curTab==='deal'&&sel===id)renderTab(DATA.conversations.find(x=>x.id===id));
  renderList(document.querySelector('.filters .on').dataset.f); // roll stage + pipeline total to the list
}
function updatePipe(){
  const el=document.getElementById('pipe'); if(!el) return;
  let sum=0,n=0;
  DATA.conversations.forEach(c=>{const d=dstate(c.id); if(d.stage==='trial'||d.stage==='active'){sum+=predictValue(d.visitors);n++;}});
  el.innerHTML = `${IC.pipe} Pipeline <b>$${sum.toLocaleString()}</b><span class="pmo">/mo</span><span class="pn">${n} open deal${n===1?'':'s'}</span>`;
}

/* ---- view switching (Inbox ⇄ Pipeline) ---- */
function showView(v){
  document.querySelectorAll('.rail a[data-view]').forEach(a=>a.classList.toggle('on', a.dataset.view===v));
  const views={inbox:'inboxview',pipeline:'pipelineview',nurture:'nurtureview',sitespy:'sitespyview',sequences:'sequencesview',analytics:'analyticsview',consent:'consentview'};
  Object.entries(views).forEach(([k,id])=>{const el=document.getElementById(id); if(el) el.hidden=k!==v;});
  if(v==='pipeline')renderPipeline();
  if(v==='nurture')renderNurture();
  if(v==='sitespy')renderSiteSpy();
  if(v==='sequences')renderSequences();
  if(v==='analytics')renderAnalytics();
  if(v==='consent')renderConsent();
}
window.showView=showView;
window.renderConsent=renderConsent; // exposed for the live-data bootstrap (fixture→fetch)
window.renderSequences=renderSequences;
window.renderList=renderList;
window.recount=recount;
function openFromPipeline(id){ showView('inbox'); select(id); }
window.openFromPipeline=openFromPipeline;

/* ---- Nurture: dormant long-term follow-up pool ---- */
function nuChans(chs){ return chs.map(ch=> ch==='sms'?IC.sms:IC.mail).join(''); }
function renderNurture(){
  const el=document.getElementById('nurtureview'); if(!el||!window.NURTURE) return;
  const N=window.NURTURE, s=N.stats;
  const kpis = `<div class="kpis kpis-4" style="margin-bottom:20px">
    <div class="kpi"><div class="kpi-v">${s.total}</div><div class="kpi-l">In nurture</div><div class="kpi-s" style="color:var(--good)">+${s.added7} this week</div></div>
    <div class="kpi"><div class="kpi-v">${s.cadence}</div><div class="kpi-l">On auto follow-up</div><div class="kpi-s">email + SMS keep-warm</div></div>
    <div class="kpi"><div class="kpi-v" style="color:var(--accent)">${s.reengaging}</div><div class="kpi-l">Re-engaging now</div><div class="kpi-s">intent → sequence firing</div></div>
    <div class="kpi"><div class="kpi-v" style="color:var(--good)">${s.wonBack}</div><div class="kpi-l">Won back</div><div class="kpi-s">meetings from nurture</div></div>
  </div>`;
  const cards = N.reengaging.map(r=>{
    const steps = Array.from({length:r.seq.of},(_,i)=>`<i class="${i<r.seq.step?'on':''}"></i>`).join('');
    const sig = r.signal.kind==='visit'?IC.globe:IC.click;
    return `<div class="nu-card">
      <div class="nu-c-top"><span class="nu-c-av" style="background:${avColor(r.name)}">${initials(r.name)}</span>
        <div class="nu-c-id"><div class="nu-c-name">${esc(r.name)}</div><div class="nu-c-co">${esc(r.company)} · <span class="chip src-${r.source}" style="padding:0 6px"><span class="dot"></span>${SRC[r.source]}</span></div></div>
        <div class="nu-c-chs" title="${r.channels.join(' + ')}">${nuChans(r.channels)}</div>
      </div>
      <div class="nu-signal">${sig}<div><b>${esc(r.signal.text)}</b><time>${esc(r.signal.when)} · dormant ${r.dormant}d before this</time></div></div>
      <div class="nu-seq">
        <div class="nu-seq-bar"><div class="nu-seq-steps">${steps}</div><div class="nu-seq-txt">Re-engage · step ${r.seq.step} of ${r.seq.of} — <b>${esc(r.seq.done)}</b> · next: ${esc(r.seq.next)}</div></div>
        <button class="nu-open" onclick="showView('inbox')">Open →</button>
      </div>
    </div>`;
  }).join('');
  const rows = N.pool.map(p=>{
    const intent=(p.clicks+p.visits)>0, ic=intent?'var(--accent)':'var(--tx-3)';
    const act=`${p.opens} opens · <b style="color:${ic}">${p.clicks} clk · ${p.visits} vis</b>`;
    const stat = p.status==='recovered'?'recovered':'dormant', statTxt=p.status==='recovered'?'Recovered':'Dormant';
    return `<tr>
      <td><div class="nu-nm" style="font-weight:700">${esc(p.name)}</div><div class="nu-cco">${esc(p.company)}</div></td>
      <td><span class="chip src-${p.source}"><span class="dot"></span>${SRC[p.source]}</span></td>
      <td><div class="nu-ch-cell" title="${p.channels.join(' + ')}">${nuChans(p.channels)}</div></td>
      <td>${esc(p.cadence)}</td>
      <td class="nu-dd">${esc(p.last)}</td>
      <td class="nu-dd">${esc(p.next)}</td>
      <td class="nu-act">${act}</td>
      <td>${p.status==='dormant'?`<span class="nu-dd">${p.dormant}d</span>`:'<span class="nu-dd">—</span>'}</td>
      <td><span class="nustat ${stat}">${statTxt}</span>${p.note?`<div class="nu-cco" style="margin-top:3px">${esc(p.note)}</div>`:''}</td>
    </tr>`;
  }).join('');
  el.innerHTML = `
    <div class="nu-head"><h2>Nurture</h2><div class="sub">Dormant leads on long-term auto follow-up. They stay quiet until they click a link or visit the site — then a fast re-engage sequence fires and they surface back into the Inbox.</div></div>
    ${kpis}
    <div class="nu-how"><h4>How the nurture pool works</h4><ol>
      <li><span class="stp">1</span><b>Goes quiet</b>All sequences finished, no reply, nothing automated running — the lead drops into nurture instead of being lost.</li>
      <li><span class="stp">2</span><b>Keep-warm touches</b>Low-frequency email + SMS on a slow cadence, honoring consent &amp; STOP. Not worked day-to-day.</li>
      <li><span class="stp">3</span><b>Watch for intent</b>A link click or a website visit is the buying signal we wait for.</li>
      <li><span class="stp">4</span><b>Pounce</b>Intent auto-fires a fast re-engage sequence for a meeting or demo, and surfaces the lead into the Inbox.</li>
    </ol></div>
    <div class="nu-band">
      <div class="nu-band-h">Re-engaging now <span class="nu-live"><span class="dot"></span>LIVE</span></div>
      ${N.reengaging.length?`<div class="nu-cards">${cards}</div>`:`<div class="idash-empty">No intent signals right now — the pool is quiet.</div>`}
    </div>
    <div class="nu-pool-h"><h4>Nurture pool · showing ${N.pool.length} of ${s.total}</h4><span class="atable-note">Next 7 days: ${s.next7} scheduled keep-warm touches</span></div>
    <table class="atable">
      <thead><tr><th>Contact</th><th>Source</th><th>Channels</th><th>Cadence</th><th>Last touch</th><th>Next touch</th><th>Activity</th><th>Dormant</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="atable-note" style="margin-top:14px">Activity in mint (clicks · visits) is intent — any lead that trips it jumps into “Re-engaging now” automatically.</p>
  `;
}
window.renderNurture=renderNurture;

/* ---- Site Spy: known visitors by last activity ---- */
function spyEngPills(e){
  const p=[];
  if(e.seq) p.push(`<span class="se-pill seq">In sequence · ${esc(e.seq)}</span>`);
  if(e.conv) p.push(`<span class="se-pill conv">Live conversation</span>`);
  if(e.auto===true) p.push(`<span class="se-pill auto">Automation on</span>`);
  if(e.auto===false) p.push(`<span class="se-pill paused">Manual — automation paused</span>`);
  if(e.nurture) p.push(`<span class="se-pill nurture">In nurture</span>`);
  if(e.suppressed) p.push(`<span class="se-pill supp">Opted out — do not contact</span>`);
  if(e.none) p.push(`<span class="se-pill newp">Not engaged yet</span>`);
  return `<div class="se-pills">${p.join('')}</div>`;
}
function renderSiteSpy(){
  const el=document.getElementById('sitespyview'); if(!el||!window.SITESPY) return;
  const S=window.SITESPY, st=S.stats;
  const live=S.visitors.filter(v=>v.live);
  const recent=S.visitors.filter(v=>!v.live).sort((a,b)=>a.lastMin-b.lastMin);
  const kpis=`<div class="kpis kpis-4" style="margin-bottom:20px">
    <div class="kpi"><div class="kpi-v" style="color:var(--good)">${st.onSite}</div><div class="kpi-l">On the site now</div><div class="kpi-s">identified, live</div></div>
    <div class="kpi"><div class="kpi-v">${st.today}</div><div class="kpi-l">Identified today</div><div class="kpi-s">known visitors</div></div>
    <div class="kpi"><div class="kpi-v">${st.inWorkflow}</div><div class="kpi-l">Already engaging</div><div class="kpi-s">sequence, chat or nurture</div></div>
    <div class="kpi"><div class="kpi-v" style="color:var(--accent)">${st.netNew}</div><div class="kpi-l">Not engaged yet</div><div class="kpi-s">net-new opportunities</div></div>
  </div>`;
  const liveCards=live.map(v=>`<div class="nu-card">
    <div class="nu-c-top"><span class="nu-c-av" style="background:${avColor(v.name)}">${initials(v.name)}</span>
      <div class="nu-c-id"><div class="nu-c-name">${esc(v.name)}</div><div class="nu-c-co">${esc(v.company)} · <span class="chip src-${v.source}" style="padding:0 6px"><span class="dot"></span>${SRC[v.source]}</span></div></div>
      <span class="sp-livedot"><span class="d"></span>LIVE</span>
    </div>
    <div class="nu-signal now"><span class="sp-eye">${IC.globe}</span><div>Viewing <span class="sp-view">${esc(v.page)}</span><time>on site ${esc(v.time)} · ${v.trail.length} pages this session</time></div></div>
    <div class="sp-trail">${v.trail.map(esc).join('  ›  ')}</div>
    <div class="sp-cardfoot">${spyEngPills(v.eng)}<button class="nu-open" onclick="showView('inbox')">Open →</button></div>
  </div>`).join('');
  const rows=recent.map(v=>`<tr>
    <td><div class="nu-nm" style="font-weight:700">${esc(v.name)}</div><div class="nu-cco">${esc(v.company)} · ${SRC[v.source]}</div></td>
    <td><span class="sp-page">${esc(v.page)}</span><div class="sp-trail">${v.trail.map(esc).join(' › ')}</div></td>
    <td class="sp-time">${v.pages||v.trail.length} pages · ${esc(v.time)}</td>
    <td>${spyEngPills(v.eng)}</td>
    <td class="sp-last">${esc(v.last)}</td>
  </tr>`).join('');
  // Live data-source panel (real): where Site Spy / Nurture intent data comes from,
  // how each source performs, and how to add more. Reads window.SITE_SOURCES.
  const SS=window.SITE_SOURCES;
  const stSty={connected:'background:var(--good-soft);color:var(--good)',ready:'background:var(--accent-soft);color:var(--accent)',needs_setup:'background:var(--warn-soft);color:var(--warn)',available:'background:var(--surface-3);color:var(--tx-3)'};
  const stLbl={connected:'Connected',ready:'Ready',needs_setup:'Needs setup',available:'Available'};
  const srcPanel = SS ? `
    <div class="nu-pool-h" style="margin-top:28px"><h4>Where this data comes from</h4>
      <span class="atable-note">${SS.summary.site_visit_events_30d} identified site visits · ${SS.summary.identity_match_rate}% identity match · ${SS.summary.link_click_events_30d} email clicks (30d)</span></div>
    <div class="idash-grid" style="grid-template-columns:1fr 1fr">
      ${SS.sources.map(s=>`<div class="icard">
        <div class="icard-h"><h4>${esc(s.name)}</h4><span class="lbadge" style="${stSty[s.status]||stSty.available}">${stLbl[s.status]||esc(s.status)}</span></div>
        <div style="font-size:var(--t-12);color:var(--tx-2);line-height:1.5">${esc(s.provides)}</div>
        ${s.perf?`<div style="margin-top:9px;font-size:var(--t-12)"><b>${esc(s.perf.label)}:</b> <span style="color:var(--accent);font-weight:800">${esc(s.perf.value)}</span><div style="color:var(--tx-3);font-size:11px;margin-top:1px">${esc(s.perf.detail)}</div></div>`:''}
        ${s.events30d!=null?`<div style="margin-top:7px;font-size:11px;color:var(--tx-3);font-family:var(--font-mono)">${s.events30d} events · 30d</div>`:''}
        ${s.contribution?`<div style="margin-top:7px;font-size:11px;color:var(--tx-3)">${esc(s.contribution)}</div>`:''}
        ${s.boost?`<div style="margin-top:9px;font-size:11px;color:var(--warn);font-weight:600">⚠ ${esc(s.boost)}</div>`:''}
        ${s.status!=='connected'&&(s.howToEnable||s.note)?`<div style="margin-top:9px;font-size:11px;color:var(--tx-3);line-height:1.45">${esc(s.howToEnable||s.note)}</div>`:''}
      </div>`).join('')}
    </div>
    <p class="atable-note" style="margin-top:12px">Add or strengthen a source when coverage is low — a higher identity-match rate means more of your visitors show up here by name, not as anonymous traffic.</p>` : '';
  el.innerHTML=`
    <div class="nu-head"><h2>Site Spy</h2><div class="sub">Known visitors by last activity — who's on the site, what they're looking at, and whether we're already engaging them through a sequence, an automation, or a human conversation.</div></div>
    ${kpis}
    <div class="nu-band">
      <div class="nu-band-h">On the site now <span class="nu-live"><span class="dot"></span>LIVE</span></div>
      ${live.length?`<div class="nu-cards">${liveCards}</div>`:`<div class="idash-empty">No identified visitors on the site this moment.</div>`}
    </div>
    <div class="nu-pool-h"><h4>Recent visitors · by last activity</h4><span class="atable-note">Only consent-identified visitors are shown.</span></div>
    <table class="atable">
      <thead><tr><th>Visitor</th><th>Last page</th><th>Session</th><th>Engagement</th><th>Last active</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="atable-note" style="margin-top:14px">A “Not engaged yet” visitor is a net-new opportunity — open them to start a conversation or drop them into a sequence.</p>
    ${srcPanel}
  `;
}
window.renderSiteSpy=renderSiteSpy;

/* ---- Profile menu (top-left): open/close, avatar upload ---- */
function toggleProfile(e){ e.stopPropagation(); const m=document.getElementById('pfmenu'); if(m) m.hidden=!m.hidden; }
window.toggleProfile=toggleProfile;
function onAvatar(files){
  if(!files||!files[0]) return;
  const r=new FileReader();
  r.onload=ev=>{ const img=`<img src="${ev.target.result}" alt="">`; ['pfav','pfavLg'].forEach(id=>{const el=document.getElementById(id); if(el) el.innerHTML=img;}); };
  r.readAsDataURL(files[0]);
}
window.onAvatar=onAvatar;
document.addEventListener('click',e=>{ const m=document.getElementById('pfmenu'); if(m && !m.hidden && !e.target.closest('.profile')) m.hidden=true; });

/* ---- Pipeline kanban board ---- */
const PSTAGES=[['new','New'],['trial','Trial'],['active','Active'],['lost','Lost']];
let dragId=null;
function pipeDrag(e,id){dragId=id;e.dataTransfer.effectAllowed='move';}
function pipeDrop(e,stage){e.preventDefault();e.currentTarget.classList.remove('dragover');
  if(dragId){dstate(dragId).stage=stage;dragId=null;renderPipeline();renderList(curFilter());}}
function pipeOver(e){e.preventDefault();e.currentTarget.classList.add('dragover');}
function pipeLeave(e){e.currentTarget.classList.remove('dragover');}
window.pipeDrag=pipeDrag;window.pipeDrop=pipeDrop;window.pipeOver=pipeOver;window.pipeLeave=pipeLeave;
/* live-data drop: persists the stage change to the real deal via POST /api/crm/deals.
   Column -> {lead_status, close_probability} mapping; optimistic re-render, revert on failure. */
function pipeDropReal(e,stage){
  e.preventDefault(); e.currentTarget.classList.remove('dragover');
  const id=dragId; dragId=null;
  if(!id||!window.PIPELINE) return;
  const d=window.PIPELINE.find(x=>x.id===id);
  if(!d||d.stage===stage) return;
  const map={lost:{lead_status:'lost'},'new':{lead_status:'active',close_probability:20},trial:{lead_status:'active',close_probability:50},active:{lead_status:'active',close_probability:85}};
  const payload=map[stage]; if(!payload) return;
  const prev={stage:d.stage,prob:d.prob,status:d.status};
  d.stage=stage; d.status=payload.lead_status;
  if(payload.close_probability!=null) d.prob=payload.close_probability;
  renderPipeline();
  fetch('/api/crm/deals',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({id},payload))})
    .then(r=>{ if(!r.ok) throw new Error('http '+r.status); return r.json(); })
    .then(j=>{ if(!j||j.ok!==true) throw new Error('bad response'); })
    .catch(err=>{ d.stage=prev.stage; d.prob=prev.prob; d.status=prev.status; renderPipeline(); if(window.console) console.warn('deal update failed, reverted',err); alert('Could not save that move — reverted.'); });
}
window.pipeDropReal=pipeDropReal;
/* live-data pipeline: real deals grouped by stage (view-only; editing needs an endpoint) */
function renderPipelineReal(el,P){
  const cols=PSTAGES.map(([k,l])=>{
    const items=P.filter(d=>d.stage===k);
    const sum=items.reduce((a,d)=>a+(d.value_usd||0),0);
    const cards=items.map(d=>`<div class="pcard" draggable="true" ondragstart="pipeDrag(event,'${d.id}')" onclick="showView('inbox')"><div class="pc-top"><span class="pc-name">${esc(d.name||'Unknown')}</span>${d.owner?`<span class="oav-sm" style="background:${d.owner.color}">${esc(d.owner.init)}</span>`:''}</div><div class="pc-co">${esc(d.company||'—')}</div><div class="pc-val">$${(d.value_usd||0).toLocaleString()}${d.prob!=null?`<span> · ${d.prob}%</span>`:''}</div></div>`).join('')||`<div class="pcol-empty">No deals</div>`;
    return `<div class="pcol ${k}" ondragover="pipeOver(event)" ondragleave="pipeLeave(event)" ondrop="pipeDropReal(event,'${k}')"><div class="pcol-h"><span class="pcol-t">${l}</span><span class="pcol-c">${items.length}</span><span class="pcol-sum">$${sum.toLocaleString()}</span></div><div class="pcol-body">${cards}</div></div>`;
  }).join('');
  const openD=P.filter(d=>['new','trial','active'].includes(d.stage));
  const total=openD.reduce((a,d)=>a+(d.value_usd||0),0);
  el.innerHTML=`<div class="pipe-head"><h2>Pipeline</h2><div class="pipe-total">${IC.pipe} Open pipeline <b>$${total.toLocaleString()}</b> · ${openD.length} deal${openD.length===1?'':'s'}</div></div><div class="pboard">${cols}</div>`;
}
function renderPipeline(){
  const el=document.getElementById('pipelineview'); if(!el) return;
  if(window.PIPELINE) return renderPipelineReal(el, window.PIPELINE);
  const cols=PSTAGES.map(([k,l])=>{
    const items=DATA.conversations.filter(c=>dstate(c.id).stage===k);
    const sum=items.reduce((a,c)=>a+predictValue(dstate(c.id).visitors),0);
    const cards=items.map(c=>{
      const o=ownerOf(c), d=dstate(c.id);
      return `<div class="pcard" draggable="true" ondragstart="pipeDrag(event,'${c.id}')" onclick="openFromPipeline('${c.id}')">
        <div class="pc-top"><span class="pc-name">${esc(c.name||'Unknown')}</span>${o?`<span class="oav-sm" style="background:${o.color}">${o.init}</span>`:''}</div>
        <div class="pc-co">${esc(c.company||'—')}</div>
        <div class="pc-val">$${predictValue(d.visitors).toLocaleString()}<span> /mo</span></div>
      </div>`;
    }).join('') || `<div class="pcol-empty">Drag deals here</div>`;
    return `<div class="pcol ${k}" ondragover="pipeOver(event)" ondragleave="pipeLeave(event)" ondrop="pipeDrop(event,'${k}')">
      <div class="pcol-h"><span class="pcol-t">${l}</span><span class="pcol-c">${items.length}</span><span class="pcol-sum">$${sum.toLocaleString()}/mo</span></div>
      <div class="pcol-body">${cards}</div>
    </div>`;
  }).join('');
  const open=DATA.conversations.filter(c=>['trial','active'].includes(dstate(c.id).stage));
  const total=open.reduce((a,c)=>a+predictValue(dstate(c.id).visitors),0);
  el.innerHTML = `<div class="pipe-head"><h2>Pipeline</h2><div class="pipe-total">${IC.pipe} Open pipeline <b>$${total.toLocaleString()}</b>/mo · ${open.length} deal${open.length===1?'':'s'}</div></div>
    <div class="pboard">${cols}</div>`;
}

/* ===================== SEQUENCES ===================== */
const SEQ_CH={sms:{i:"💬",l:"SMS"},ai_call:{i:"📞",l:"AI call"},email:{i:"✉",l:"Email"}};
let curSeq="speed";
function selectSeq(id){curSeq=id;renderSequences();}
window.selectSeq=selectSeq;
function renderSequences(){
  const el=document.getElementById("sequencesview"); if(!el) return;
  const S=window.SEQUENCES;
  const list=S.map(s=>`<button class="seqitem ${s.id===curSeq?'on':''}" onclick="selectSeq('${s.id}')">
      <div class="seqit-nm">${esc(s.name)}</div>
      <div class="seqit-sub"><span>${s.active} active</span><span>${Math.round(s.replyRate*100)}% reply</span></div>
    </button>`).join('');
  const s=S.find(x=>x.id===curSeq)||S[0];
  const chip=c=>`<span class="cchip">${({sms:'💬 SMS',voice:'📞 Voice',email:'✉ Email'})[c]}</span>`;
  const metric=(v,l)=>`<div class="seqm"><div class="seqm-v">${v}</div><div class="seqm-l">${l}</div></div>`;
  const flow=s.steps.map((st,i)=>{
    const m=SEQ_CH[st.ch]||{i:'•',l:st.ch};
    const outs=st.out.map(o=>`<div class="sn-out ${o.tone||''}"><span class="sn-n">${o.n.toLocaleString()}</span>${esc(o.t)}</div>`).join('');
    return `<div class="stepnode">
        <div class="sn-h"><span class="sn-ch ${st.ch}">${m.i} ${m.l}</span><span class="sn-idx">${i+1}</span></div>
        <div class="sn-label">${esc(st.label)}</div>
        <div class="sn-time">🕓 ${esc(st.timing)}</div>
        <div class="sn-entered">Entered <b>${st.entered.toLocaleString()}</b></div>
        <div class="sn-outs">${outs}</div>
        ${st.branch?`<div class="sn-branch">⑃ ${esc(st.branch)}</div>`:''}
      </div>${i<s.steps.length-1?'<div class="stepconn">→</div>':''}`;
  }).join('');
  el.innerHTML = `
    <aside class="seq-list">
      <div class="seq-list-h">Sequences</div>${list}
      <button class="seq-new">＋ New sequence</button>
    </aside>
    <div class="seq-detail">
      <div class="seq-head">
        <div><h2>${esc(s.name)}</h2>
          <div class="seq-trig"><b>Enrolls:</b> ${esc(s.trigger)} &nbsp;·&nbsp; <b>Goal:</b> ${esc(s.goal)}</div>
          <div class="seq-consent">Requires consent: ${s.consent.map(chip).join('')}</div>
        </div>
        <div class="seq-metrics">
          ${metric(s.active,'Active now')}
          ${metric(s.enrolled.toLocaleString(),'Enrolled · 30d')}
          ${metric(Math.round(s.replyRate*100)+'%','Reply rate')}
          ${metric(Math.round(s.goalRate*100)+'%',esc(s.goal))}
          ${metric(Math.round(s.optoutRate*100)+'%','Opt-out')}
        </div>
      </div>
      <div class="stepflow">${flow}</div>
      <div class="seq-foot">Steps only fire on channels the contact has consented to. A reply, a booked demo, or an opt-out exits the sequence immediately.</div>
    </div>`;
}

window.renderPipeline=renderPipeline; // exposed for the live-data bootstrap (fixture→fetch)

/* ===================== ANALYTICS ===================== */
function renderAnalytics(){
  const el=document.getElementById("analyticsview"); if(!el) return;
  const A=window.ANALYTICS, k=A.kpis, S=window.SEQUENCES;
  const kpi=(v,l,s)=>`<div class="kpi"><div class="kpi-v">${v}</div><div class="kpi-l">${l}</div>${s?`<div class="kpi-s">${s}</div>`:''}</div>`;
  const kpis=[
    kpi(k.leads,'Leads · 30d'),
    kpi((k.leads?Math.round(k.replies/k.leads*100):0)+'%','Reply rate',`${k.replies} replies`),
    kpi(k.demos,'Demos booked'),
    kpi(k.activations,'Activations','new customers'),
    kpi('$'+k.spend.toLocaleString(),'Ad spend'),
    kpi('$'+k.cpl.toFixed(2),'Cost / lead','blended'),
    kpi('$'+k.cpd,'Cost / demo'),
    kpi('$'+k.pipeline.toLocaleString(),'Open pipeline','/mo')
  ].join('');
  const fmax=Math.max(1,...A.funnel.map(f=>f.n));
  const funnel=A.funnel.map((f,i)=>`<div class="fnl-row"><span class="fnl-k">${f.k}</span><div class="fnl-bar"><i style="width:${Math.max(4,Math.round(f.n/fmax*100))}%"></i></div><span class="fnl-n">${f.n}</span><span class="fnl-p">${i?Math.round(f.n/fmax*100)+'%':'—'}</span></div>`).join('');
  const srows=A.sources.map(s=>{
    const cpl=s.spend>0?'$'+(s.spend/s.leads).toFixed(2):'—';
    const cpd=s.spend>0&&s.demos>0?'$'+Math.round(s.spend/s.demos):'—';
    const roas=s.spend>0?(s.act*A.avgDealYr/s.spend).toFixed(1)+'×':(s.leads?'organic':'—');
    return `<tr>
      <td><span class="chip src-${s.src}"><span class="dot"></span>${SRC[s.src]}</span></td>
      <td class="num">${s.leads}</td><td class="num">${Math.round(s.reply*100)}%</td>
      <td class="num">${s.demos}</td><td class="num">${s.act}</td>
      <td class="num">${s.spend?'$'+s.spend.toLocaleString():'—'}</td>
      <td class="num">${cpl}</td><td class="num">${cpd}</td>
      <td class="num roas">${roas}</td></tr>`;
  }).join('');
  const smax=Math.max(1,...A.spendByChannel.map(x=>x.v));
  const spend=A.spendByChannel.map(x=>`<div class="sb-row"><span class="sb-k">${x.k}</span><div class="sb-bar"><i style="width:${Math.round(x.v/smax*100)}%"></i></div><span class="sb-v">$${x.v.toLocaleString()}</span></div>`).join('');
  const seqrows=S.map(s=>`<tr><td>${esc(s.name)}</td><td class="num">${s.enrolled.toLocaleString()}</td><td class="num">${Math.round(s.replyRate*100)}%</td><td class="num">${Math.round(s.goalRate*100)}%</td><td class="num">${Math.round(s.optoutRate*100)}%</td></tr>`).join('');
  const dmax=Math.max(1,...A.leadsByDay);
  const spark=A.leadsByDay.map(v=>`<span class="spk" style="height:${Math.max(8,Math.round(v/dmax*100))}%" title="${v} leads"></span>`).join('');
  el.innerHTML=`
    <div class="an-head"><h2>Analytics</h2><span class="an-sub">Last 30 days · which source, sequence, and message books the job — and what it costs</span></div>
    <div class="kpis">${kpis}</div>
    <div class="an-grid">
      <div class="card an-card"><h4>Funnel — lead to customer</h4><div class="fnl">${funnel}</div></div>
      <div class="card an-card"><h4>Leads / day</h4><div class="spark">${spark}</div><div class="spark-x"><span>30 days ago</span><span>today</span></div></div>
    </div>
    <div class="card an-card"><h4>By source</h4>
      <table class="atable"><thead><tr><th>Source</th><th class="num">Leads</th><th class="num">Reply</th><th class="num">Demos</th><th class="num">Active</th><th class="num">Spend</th><th class="num">Cost/lead</th><th class="num">Cost/demo</th><th class="num">Est. ROAS</th></tr></thead>
      <tbody>${srows}</tbody></table>
      <div class="atable-note">Est. ROAS assumes $${A.avgDealYr.toLocaleString()}/yr average value per activation. “Organic” = no ad spend attributed.</div>
    </div>
    <div class="an-grid">
      <div class="card an-card"><h4>Ad spend by channel</h4><div class="sbchart">${spend}</div></div>
      <div class="card an-card"><h4>Sequence performance</h4>
        <table class="atable"><thead><tr><th>Sequence</th><th class="num">Enrolled</th><th class="num">Reply</th><th class="num">Goal hit</th><th class="num">Opt-out</th></tr></thead><tbody>${seqrows}</tbody></table>
      </div>
    </div>`;
}

window.renderAnalytics=renderAnalytics; // exposed for the live-data bootstrap (fixture→fetch)

/* ===================== CONSENT LEDGER ===================== */
const CONSENT_OPEN=new Set();
function toggleProof(i){ CONSENT_OPEN.has(i)?CONSENT_OPEN.delete(i):CONSENT_OPEN.add(i); renderConsent(); }
window.toggleProof=toggleProof;
function renderConsent(){
  const el=document.getElementById("consentview"); if(!el) return;
  const L=window.CONSENT_LEDGER;
  const chLabel={email:'✉ Email',sms:'💬 SMS',voice:'📞 Voice'};
  const actCls={granted:'g',revoked:'r',none:'n'};
  const kpi=(v,l,s)=>`<div class="kpi"><div class="kpi-v">${v}</div><div class="kpi-l">${l}</div>${s?`<div class="kpi-s">${s}</div>`:''}</div>`;
  const cs=window.CONSENT_STATS;
  const kpis=[
    kpi(cs?cs.consented:'271','Consented contacts',cs?'contacts with consent':'of 308 leads'),
    kpi(cs?cs.suppressions:'8','Active suppressions','opt-outs honored'),
    kpi((cs?cs.pewcPct:'63')+'%','PEWC capture','SMS + voice consent'),
    kpi('100%','Sends backed by a record')
  ].join('');
  const cb=cs?cs.byChannel:null;
  const chanSummary=[['email','Email',cb?cb.email.g:271,cb?cb.email.r:0],['sms','SMS',cb?cb.sms.g:168,cb?cb.sms.r:8],['voice','Voice',cb?cb.voice.g:168,cb?cb.voice.r:8]].map(([k,l,g,r])=>
    `<div class="chanrow"><span class="chan-l">${chLabel[k]}</span>
      <span class="chan-g">✓ ${g} granted</span>${r?`<span class="chan-r">⊘ ${r} revoked</span>`:''}</div>`).join('');
  const rows=L.map((e,i)=>{
    const open=CONSENT_OPEN.has(i);
    const chs=e.ch.map(c=>`<span class="lch">${chLabel[c]}</span>`).join('');
    const badge=`<span class="lbadge ${actCls[e.action]}">${e.action}</span>`;
    const detail=open?`<tr class="proofrow"><td colspan="5"><div class="proof">
        <div class="proof-q">“${esc(e.proof)}”</div>
        <div class="proof-meta">
          <span><b>Basis</b> ${esc(e.basis)}</span>
          ${e.form?`<span><b>Source</b> ${esc(e.form)}</span>`:''}
          ${e.ip?`<span><b>IP</b> ${esc(e.ip)}</span>`:''}
          <span><b>Logged</b> ${esc(e.ts)}</span>
        </div>
        <div class="proof-foot">🛡️ This is the record we can produce if a send is ever challenged.</div>
      </div></td></tr>`:'';
    return `<tr class="lrow ${open?'open':''}" onclick="toggleProof(${i})">
        <td class="lt">${esc(e.ts)}</td>
        <td><div class="lname">${esc(e.name)}</div><div class="lco">${esc(e.co)}</div></td>
        <td>${chs}</td>
        <td>${badge}</td>
        <td class="lbasis">${esc(e.basis)} <span class="lchev">${open?'▾':'▸'}</span></td>
      </tr>${detail}`;
  }).join('');
  el.innerHTML=`
    <div class="cn-head"><h2>Consent ledger</h2><span class="cn-sub">Every message we send is backed by a timestamped, auditable record. Click any row to see the proof.</span></div>
    <div class="kpis kpis-4">${kpis}</div>
    <div class="an-grid">
      <div class="card an-card"><h4>Consent by channel</h4><div class="chansum">${chanSummary}</div></div>
      <div class="card an-card"><h4>How consent is captured</h4>
        <ul class="cn-methods">
          <li><b>PEWC checkbox</b> on Meta lead forms & /get-started — full SMS + voice + email opt-in.</li>
          <li><b>Email-only</b> when a form has no PEWC — routed to the earn-consent branch, no calls/texts.</li>
          <li><b>CAN-SPAM</b> legitimate-interest for cold B2B email (address + one-click unsubscribe).</li>
          <li><b>STOP / unsubscribe</b> revokes instantly and suppresses permanently.</li>
        </ul>
      </div>
    </div>
    <div class="card an-card"><h4>Recent consent events</h4>
      <table class="ltable"><thead><tr><th>When</th><th>Contact</th><th>Channels</th><th>Action</th><th>Basis</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}
window.dealStage=dealStage;window.dealTrial=dealTrial;window.dealUser=dealUser;window.dealTraffic=dealTraffic;
function dealTab(c){
  const d=dstate(c.id), v=d.visitors, pct=Math.max(0,Math.min(100,100*Math.log10(v/100)/3));
  const stages=[['new','New'],['trial','Trial'],['active','Active'],['lost','Lost']];
  return `<div class="dealtab">
    <div class="dblock"><h5>Stage</h5>
      <div class="dstages">${stages.map(([k,l])=>`<button class="dstage ${d.stage===k?'on '+k:''}" onclick="dealStage('${c.id}','${k}')">${l}</button>`).join('')}</div>
    </div>
    <div class="dblock"><h5>Trial</h5>
      <div class="dchk"><span class="tcheck ${d.trial?'on':''}" onclick="dealTrial('${c.id}',${d.trial?'false':'true'})">${d.trial?'✓':''}</span>Signed up for a trial <span class="dsub">via console.consentresolve.com</span></div>
      ${d.trial?`<div class="duser"><label>Console username</label><input placeholder="e.g. langroofing-tx" value="${esc(d.username)}" onchange="dealUser('${c.id}',this.value)"></div>`:''}
    </div>
    <div class="dblock"><h5>Estimated deal size — from monthly traffic</h5>
      <div class="dpredict">
        <div class="dp-value"><span class="dp-big">$<span id="dvalue">${predictValue(v).toLocaleString()}</span></span><span class="dp-per">/mo</span><span class="dp-yr">≈ $<span id="dyear">${(predictValue(v)*12).toLocaleString()}</span> / yr</span></div>
        <div class="dp-flow">
          <div class="dp-cell visits"><div class="dp-n" id="dvisits">${v.toLocaleString()}</div><div class="dp-l">Visitors / mo</div></div>
          <span class="dp-arrow">→</span>
          <div class="dp-cell leads"><div class="dp-n" id="dleads">${predictLeads(v).toLocaleString()}</div><div class="dp-l">Consented leads</div></div>
          <span class="dp-arrow">×</span>
          <div class="dp-cell rate"><div class="dp-n">$7</div><div class="dp-l">Per lead</div></div>
        </div>
        <input class="dslider" type="range" min="0" max="100" step="0.5" value="${pct.toFixed(1)}" oninput="dealTraffic('${c.id}',this.value)">
        <div class="dscale"><span>100</span><span>1k</span><span>10k</span><span>100k</span></div>
        <div class="dp-note">Assumes ~2% of monthly visitors opt in as consented $7 leads.</div>
      </div>
    </div>
  </div>`;
}

/* sequence tracker card — moves to the Activity tab */
function seqCard(c){
  const s=c.sequence, st=autoState(c);
  if(!s.total) return '';
  return `<div class="card"><h4>Sequence · ${esc(s.label)}</h4>${tracker(s, st==='on'||st==='done')}
    <div style="text-align:center;font-size:11px;color:var(--tx-3);margin-top:8px">Step ${s.step} of ${s.total} · automation ${st==='on'?'on':st==='paused'?'paused':st}</div></div>`;
}

/* ===================== INTEL — company intelligence dashboard ===================== */
function cityFrom(a){if(!a)return '';const p=a.split(',');return p.length>=2?(p[1].trim()+(p[2]?', '+p[2].trim().replace(/\s*\d{5}.*/,''):'')):'';}
function tileD(v,l,variant){return `<div class="itile ${variant||''}"><div class="iv">${v}</div><div class="il">${l}</div></div>`;}
function idRow(status,label,value,link){
  const s={ok:'✓',no:'✗',off:'—'}[status]||'—', sc={ok:'good',no:'bad',off:'mut'}[status];
  const val=link?`<a href="${link}" target="_blank" rel="noopener">${esc(value)} ↗</a>`:esc(value);
  return `<div class="prow"><span class="pst ${sc}">${s}</span><span class="pk">${label}</span><span class="pv">${val}</span></div>`;
}
function icardD(title,src,body){return `<div class="icard"><div class="icard-h"><h4>${title}</h4><span class="isrc">${src}</span></div>${body}</div>`;}
function intelDashboard(c){
  const e=((window.ENRICH||{})[c.id]||{}), x=(window.INTEL||{})[c.id]||{}, d=(window.DIRECTORY||{})[c.id]||{}, it=c.intel, ph=PHONES[c.id];
  const fit=`<span class="fit ${it.fit}">${it.fit.toUpperCase()}</span>`;
  if(!e){
    return `<div class="intel-dash"><div class="idash-hero"><div class="idh-title">${fit}${esc(c.name||'Unknown')}</div>
      <p class="idh-brief">No public company profile matched yet — this lead came in without a company we can research (${esc(it.src_label)}). Add a name or company in the <b>Task</b> tab and we'll enrich it automatically.</p></div></div>`;
  }
  const traffic=e.traffic_month||it.traffic_month||0;
  const recoverable=predictLeads(traffic||1000), city=cityFrom(d.address);
  const k=n=>n?`$${(n/1000).toFixed(1).replace(/\.0$/,'')}`:'0';
  const tiles=[
    e.spend_high>0?tileD(`${k(e.spend_low)}–${k(e.spend_high)}k`,'Ad spend / mo','spend'):tileD('—','Not advertising','muted'),
    tileD(traffic?fmtK(traffic):'—','Visits / mo'),
    tileD(e.gmb?e.gmb.rating+'★':'—', e.gmb?`Google · ${e.gmb.reviews} reviews`:'Rating'),
    tileD(e.employees||'—','Team size'),
    tileD((e.years||'—')+' yr','In business'),
    tileD(recoverable.toLocaleString(),'Recoverable leads / mo','opp')
  ].join('');
  const foot=[
    idRow(e.website?'ok':'no','Website', e.website?`${e.website.domain} · ${e.website.capture?'has a form':'no form'}`:'not found', e.website?'https://'+e.website.domain:null),
    idRow(e.gmb?'ok':'no','Google Biz', e.gmb?`${e.gmb.rating}★ (${e.gmb.reviews}) · ${e.gmb.verified?'verified':'unclaimed'}`:'no listing', null),
    idRow(e.facebook?'ok':'no','Facebook', e.facebook?`@${e.facebook.handle}${e.facebook.ads_live>0?' · '+e.facebook.ads_live+' ads live':' · '+fmtK(e.facebook.followers)+' followers'}`:'not found', e.facebook?'https://facebook.com/'+e.facebook.handle:null),
    idRow(d.linkedin?'ok':'off','LinkedIn', d.linkedin||'not found', d.linkedin?'https://linkedin.com/company/'+d.linkedin:null),
    idRow(d.instagram?'ok':'off','Instagram', d.instagram||'not found', d.instagram?'https://instagram.com/'+d.instagram:null),
    idRow(d.tiktok?'ok':'off','TikTok', d.tiktok||'not found', d.tiktok?'https://tiktok.com/@'+d.tiktok:null)
  ].join('');
  const adBody = e.spend_high>0 ? `
    <div class="ad-total">$${e.spend_low.toLocaleString()}–${e.spend_high.toLocaleString()}<span> /mo</span></div>
    <div class="ad-ch">${e.spend_channels.map(ch=>`<span class="techchip">${ch}</span>`).join('')}</div>
    ${idRow(e.facebook&&e.facebook.ads_live>0?'ok':'off','Facebook ads', e.facebook&&e.facebook.ads_live>0?e.facebook.ads_live+' live now':'none live', null)}
    ${idRow(e.ads.google?'ok':'off','Google Ads', e.ads.google?'running':'not running', null)}
    ${idRow(e.ads.lsa?'ok':'off','Local Svc Ads', e.ads.lsa?'running':'not running', null)}`
    : `<div class="idash-empty">Not running paid ads right now — an organic-first opportunity.</div>`;
  const techChips=(x.tech||[]).map(t=>`<span class="techchip">${esc(t)}</span>`).join('') || `<span class="idash-empty">No technologies detected.</span>`;
  const gaps=[];
  if(e.website&&!e.website.capture) gaps.push('No lead-capture form');
  if(!x.chat) gaps.push('No live chat');
  if(!(e.pixels&&e.pixels.length)) gaps.push('No tracking pixel');
  const gapFlags=gaps.length?`<div class="gapline">${gaps.map(g=>`<span class="gap-flag">⚠ ${g}</span>`).join('')}</div>`:'';
  const rep = e.gmb ? `<div class="rep"><div class="rep-big">${e.gmb.rating}<span>★</span></div><div class="rep-sub"><b>${e.gmb.reviews}</b> Google reviews<br>${e.gmb.verified?'Verified profile':'Unclaimed profile'}</div></div>` : `<div class="idash-empty">No Google Business listing found.</div>`;
  const eng=`<div class="itiles-sm">
      <div class="itile-sm"><div class="iv">${esc(it.time_on_site)}</div><div class="il">On site</div></div>
      <div class="itile-sm"><div class="iv">${it.pages}</div><div class="il">Pages</div></div>
      <div class="itile-sm"><div class="iv">${esc(it.first_seen)}</div><div class="il">First seen</div></div>
      <div class="itile-sm"><div class="iv">${it.speed_to_lead_h!=null?it.speed_to_lead_h+'h':'—'}</div><div class="il">Speed→lead</div></div>
    </div>${it.pages_viewed.length?`<div class="pv-list">${it.pages_viewed.map(p=>'→ '+esc(p)).join('')}</div>`:''}`;
  const contact=`
    ${d.address?idRow('ok','Address',d.address,null):''}
    ${ph?`<div class="prow"><span class="pst good">✓</span><span class="pk">Phone</span><span class="pv"><a href="${telHref(ph)}">${esc(ph)}</a></span></div>`:''}
    ${c.contact_email?`<div class="prow"><span class="pst good">✓</span><span class="pk">Email</span><span class="pv"><a href="mailto:${esc(c.contact_email)}">${esc(c.contact_email)}</a></span></div>`:''}`;
  return `<div class="intel-dash">
    <div class="idash-hero">
      <div class="idh-title">${fit}${esc(c.company||c.name||'Unknown')}<span class="idh-trade">${[x.trade,city].filter(Boolean).join(' · ')}</span></div>
      <p class="idh-brief">${esc(x.brief||it.signal||'')}</p>
      <div class="idh-src">✨ AI-researched · enriched via BuiltWith, Meta Ad Library, Google Business &amp; traffic estimators</div>
    </div>
    <div class="idash-tiles">${tiles}</div>
    <div class="idash-grid">
      ${icardD('Digital footprint','Search + BuiltWith', `<div class="presence">${foot}</div>`)}
      ${icardD('Advertising','Meta Ad Library', adBody)}
      ${icardD('Website tech','BuiltWith', `<div class="techchips">${techChips}</div>${gapFlags}`)}
      ${icardD('Reputation','Google Business', rep)}
      ${icardD('On-site engagement','First-party', eng)}
      ${icardD('Contact &amp; location','CRM + directories', `<div class="presence">${contact||'<div class="idash-empty">—</div>'}</div>`)}
    </div>
    ${it.signal?`<div class="idash-opp">🔥 <div><b>Why they fit —</b> ${esc(it.signal)} <span class="opp-num">≈ ${recoverable.toLocaleString()} consented leads/mo</span> they're leaving on the table.</div></div>`:''}
  </div>`;
}

let curTab="reply";
function renderTab(c){
  const b=document.getElementById("tabbody"); if(!b) return;
  if(curTab==="reply"){
    b.className="tabbody acttab";
    b.innerHTML = (c.channel==="email"?gmailThread(c):bubbleThread(c)) + `<div class="composer-wrap" id="composerhost">${composer(c)}</div>`;
    renderAttachChips();
  } else if(curTab==="activity"){
    b.className="tabbody";
    b.innerHTML = `<div class="tabscroll">${activityCard(c)}${seqCard(c)}${consentCard(c)}</div>`;
  } else if(curTab==="intel"){
    b.className="tabbody";
    b.innerHTML = `<div class="tabscroll intel-scroll">${intelDashboard(c)}</div>`;
  } else if(curTab==="deal"){
    b.className="tabbody";
    b.innerHTML = `<div class="tabscroll">${dealTab(c)}</div>`;
  } else {
    b.className="tabbody";
    b.innerHTML = `<div class="tabscroll">${taskTab(c)}</div>`;
  }
}
function switchTab(t){
  curTab=t; replyOpen=false; ATTACH=[];
  document.querySelectorAll(".tabs .tab").forEach(x=>x.classList.toggle("on", x.dataset.tab===t));
  renderTab(DATA.conversations.find(x=>x.id===sel));
}
window.switchTab = switchTab;

function select(id){
  sel=id; replyOpen=false; ATTACH=[]; curTab="reply";
  const c=DATA.conversations.find(x=>x.id===id);
  renderList(document.querySelector(".filters .on").dataset.f);
  const useGmail = c.channel==="email";
  const phone = PHONES[c.id];
  const emailCm = c.contact_email
    ? `<span class="cm"><span class="ci">✉</span><a href="mailto:${esc(c.contact_email)}">${esc(c.contact_email)}</a></span>`
    : `<span class="cm none">no email yet</span>`;
  const phoneCm = phone
    ? `<span class="cm"><span class="ci">📞</span><a href="${telHref(phone)}">${esc(phone)}</a></span>`
    : `<span class="cm none">no phone</span>`;
  const o = ownerOf(c);
  const ownerEl = o
    ? `<div class="owner" title="Reassign this conversation"><span class="oav" style="background:${o.color}">${o.init}</span><span>${esc(o.name)}</span><span class="car">▾</span></div>`
    : `<div class="owner unassigned" title="Assign a rep — happens automatically when someone replies"><span>＋ Assign</span><span class="car">▾</span></div>`;
  const costTxt = c.intel.cost_per_lead ? ` ($${c.intel.cost_per_lead.toFixed(2)})` : '';
  document.getElementById("thread").innerHTML = `
    <div class="thead">
      <div class="t1"><div class="avatar" style="background:${avColor(c.name||c.id)};color:#fff">${esc(c.initials)}</div>
        <div class="who"><h2>${esc(c.name||"Unknown contact")}</h2><div class="sub">${esc(c.company||"no company")}</div>
          <div class="cmeta">
            <span class="cm"><span class="chip src-${c.source}"><span class="dot"></span>${SRC[c.source]}${costTxt}</span></span>
            <span class="sep">·</span>${emailCm}
            <span class="sep">·</span>${phoneCm}
          </div>
        </div>
        <div class="hdr-right">${ownerEl}${autoControl(c)}</div>
      </div>
      <div class="tabs">
        <button class="tab ${curTab==='reply'?'on':''}" data-tab="reply" onclick="switchTab('reply')"><span class="ti">${IC.reply}</span>Reply</button>
        <button class="tab ${curTab==='activity'?'on':''}" data-tab="activity" onclick="switchTab('activity')"><span class="ti">${IC.activity}</span>Activity</button>
        <button class="tab ${curTab==='intel'?'on':''}" data-tab="intel" onclick="switchTab('intel')"><span class="ti">${IC.intel}</span>Intel</button>
        <button class="tab ${curTab==='task'?'on':''}" data-tab="task" onclick="switchTab('task')"><span class="ti">${IC.task}</span>Task</button>
        <button class="tab ${curTab==='deal'?'on':''}" data-tab="deal" onclick="switchTab('deal')"><span class="ti">${IC.deal}</span>Deal</button>
      </div>
    </div>
    <div class="tabbody" id="tabbody"></div>
  `;
  renderTab(c);
}
window.select = select;

document.querySelectorAll(".filters button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("on"));b.classList.add("on");renderList(b.dataset.f);});
document.querySelectorAll(".toggle button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".toggle button").forEach(x=>x.classList.remove("on"));b.classList.add("on");document.documentElement.setAttribute("data-theme",b.dataset.th);});

document.documentElement.setAttribute("data-theme","light");
renderList("open");
select(sel);
setInterval(tickClocks,1000);
