// Speed-to-Lead — internal test console, served at /crm/speed (cr_crm-gated).
// A self-contained operator page for internally testing the engine before go-live:
// flip simulate↔live + per-channel + allowlists, inject test leads, run the cron
// tick on demand, and watch every touchpoint pass/blocked through the consent gate.
import { crmAuthed } from "./_lib/crm.js";

const LOGIN = `<!doctype html><meta charset=utf-8><title>Speed-to-Lead — sign in</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0e1c2e;color:#eaf2f8">
<div style="text-align:center"><h1>Speed-to-Lead console</h1><p>Sign in with your Consent Resolve account.</p>
<a href="/api/crm/auth/login?next=/crm/speed" style="color:#00e5a0">Sign in with Google →</a></div>`;

export async function handle({ request, env }) {
  if (!(await crmAuthed(request, env))) {
    return new Response(LOGIN, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const PAGE = `<!doctype html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><title>Speed-to-Lead — console</title>
<style>
:root{--bg:#0e1c2e;--sf:#14263c;--sf2:#1b3049;--ln:rgba(255,255,255,.1);--tx:#eaf2f8;--tx2:#9fb3c6;--ac:#00e5a0;--ok:#39d98a;--bad:#ff6b6b;--warn:#ffcc66}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.45}
a{color:var(--ac)}.wrap{max-width:1180px;margin:0 auto;padding:22px}
h1{font-size:22px;margin:0 0 2px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--tx2);margin:26px 0 10px}
.sub{color:var(--tx2);margin:0 0 6px}
.mode{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font-weight:800;font-size:12.5px}
.mode.sim{background:rgba(255,204,102,.16);color:var(--warn)}.mode.live{background:rgba(57,217,138,.16);color:var(--ok)}
.mode.paused{background:rgba(255,107,107,.16);color:var(--bad)}
.card{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:16px 18px;margin-bottom:14px}
.grid{display:grid;gap:12px}.g4{grid-template-columns:repeat(4,1fr)}.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}
@media(max-width:820px){.g4,.g3{grid-template-columns:1fr 1fr}.g2{grid-template-columns:1fr}}
.kpi{background:var(--sf2);border:1px solid var(--ln);border-radius:11px;padding:12px 14px}
.kpi .v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}.kpi .l{font-size:11.5px;color:var(--tx2);margin-top:2px}
.kpi.alarm .v{color:var(--bad)}.kpi.good .v{color:var(--ok)}
label{display:block;font-size:12px;color:var(--tx2);margin:8px 0 4px;font-weight:600}
input,select,textarea{width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--ln);border-radius:8px;color:var(--tx);font-size:13.5px;font-family:inherit}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sw{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--sf2);border:1px solid var(--ln);border-radius:9px;font-weight:600}
.sw input{width:auto}
button{background:var(--ac);color:#04120b;border:0;border-radius:9px;padding:9px 15px;font-weight:800;cursor:pointer;font-size:13px}
button.ghost{background:transparent;border:1px solid var(--ln);color:var(--tx)}
button.danger{background:transparent;border:1px solid var(--bad);color:var(--bad)}
button:disabled{opacity:.5;cursor:not-allowed}
table{width:100%;border-collapse:collapse;font-size:12.5px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--ln);vertical-align:top}
th{color:var(--tx2);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em}
.pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.pA{background:rgba(159,179,198,.18);color:var(--tx2)}.pB{background:rgba(0,229,160,.16);color:var(--ac)}
.s-sent{color:var(--ok)}.s-blocked{color:var(--bad)}.s-pending{color:var(--warn)}.s-canceled,.s-skipped{color:var(--tx2)}.s-failed{color:var(--bad)}
.tp{font-family:ui-monospace,monospace;font-size:11.5px;color:var(--tx2)}
.muted{color:var(--tx2)}.mono{font-family:ui-monospace,monospace}
details{border:1px solid var(--ln);border-radius:9px;margin:6px 0;background:var(--sf2)}summary{padding:9px 12px;cursor:pointer;font-weight:700}
.note{font-size:12px;color:var(--tx2)}#msg{font-weight:800}
</style></head><body><div class=wrap>
<div class=row style="justify-content:space-between">
  <div><h1>Speed-to-Lead</h1><p class=sub>Internal test console — exercise the whole engine before go-live.</p></div>
  <div id=modeBadge></div>
</div>
<div id=alarm></div>

<h2>Dispatch mode <span class=note>— simulate records intended sends; live actually dispatches (allowlist still applies)</span></h2>
<div class=card>
  <div class=row>
    <div class=sw><input type=radio name=mode value=simulate id=mSim><label for=mSim style="margin:0">Simulate (safe)</label></div>
    <div class=sw><input type=radio name=mode value=live id=mLive><label for=mLive style="margin:0">Live</label></div>
    <div class=sw><input type=checkbox id=paused><label for=paused style="margin:0">Pause all (kill switch)</label></div>
  </div>
  <div class="grid g4" style="margin-top:12px">
    <div class=sw><input type=checkbox id=live_email><label for=live_email style="margin:0">Live: Email</label></div>
    <div class=sw><input type=checkbox id=live_sms><label for=live_sms style="margin:0">Live: SMS</label></div>
    <div class=sw><input type=checkbox id=live_call_ai><label for=live_call_ai style="margin:0">Live: AI voice</label></div>
    <div class=sw><input type=checkbox id=live_call_human><label for=live_call_human style="margin:0">Live: Human dial</label></div>
  </div>
  <div class="grid g2" style="margin-top:6px">
    <div><label>Test email allowlist (csv — only these get real email when live; blank = all)</label><input id=test_emails placeholder="you@consentresolve.com"></div>
    <div><label>Test phone allowlist (csv E.164)</label><input id=test_phones placeholder="+15555550123"></div>
  </div>
  <div class=row style="margin-top:12px"><button onclick=saveSettings()>Save mode</button><span id=msg class=muted></span></div>
</div>

<h2>Metrics</h2>
<div class="grid g4" id=kpis></div>

<h2>Integrations &amp; go-live</h2>
<div class=card>
  <div id=readiness class="grid g4"></div>
  <div id=twilioDebug class="note mono" style="margin-top:8px"></div>
  <div class=row style="margin-top:14px;gap:10px">
    <button onclick=provisionRetell()>⚡ Provision Ruby (Retell)</button>
    <button class=ghost onclick=listNumbers()>List Retell numbers</button>
    <a href="/speed-demo" target="_blank"><button class=ghost type=button>Open test demo form ↗</button></a>
  </div>
  <div class=row style="margin-top:10px">
    <button class=ghost onclick=verifyTwilio()>Verify Twilio</button>
    <button class=ghost onclick=listTwilioNums()>List Twilio numbers</button>
    <button class=ghost onclick=findNumberOwner()>Which account owns the From #?</button>
  </div>
  <div class=row style="margin-top:10px">
    <input id=testEmail placeholder="you@consentresolve.com" style="max-width:260px">
    <button class=ghost onclick=sendTestEmail()>Send test email</button>
    <input id=testSms placeholder="+15555550123" style="max-width:200px">
    <button class=ghost onclick=sendTestSms()>Send test SMS</button>
  </div>
  <div class=row style="margin-top:10px">
    <input id=msgSid placeholder="SM… message SID to check delivery" style="max-width:340px">
    <button class=ghost onclick=checkSms()>Check SMS delivery status</button>
  </div>
  <div id=intgOut class="note mono" style="margin-top:10px"></div>
</div>

<h2>Test drive</h2>
<div class="grid g2">
  <div class=card>
    <b>Inject a test lead</b>
    <div class="grid g2">
      <div><label>Population</label><select id=inPop><option value=A>A — cookie banner only (email + human dial)</option><option value=B>B — full consent (all channels)</option></select></div>
      <div><label>Trade</label><select id=inTrade><option>roofing</option><option>plumbing</option><option>hvac</option><option>electrical</option><option>other</option></select></div>
      <div><label>First name</label><input id=inFirst value="Test"></div>
      <div><label>Company</label><input id=inCo value="Acme Roofing"></div>
      <div><label>Email</label><input id=inEmail value="test@example.com"></div>
      <div><label>Phone (E.164)</label><input id=inPhone value="+15555550123"></div>
      <div><label>Timezone</label><input id=inTz value="America/Chicago"></div>
      <div><label>State</label><input id=inState value="TX"></div>
    </div>
    <div class=row style="margin-top:10px"><button onclick=inject()>Inject lead</button><span class=note>B1 is scheduled T+45s — click "Run tick" to fire it now.</span></div>
  </div>
  <div class=card>
    <b>Run the engine</b>
    <p class=note>The cron ticks every minute in production. Here you can fire it on demand to dispatch every due touchpoint through the consent gate.</p>
    <div class=row><button onclick=runTick()>▶ Run tick now</button> <button class=ghost onclick=seedRep()>+ Seed a rep</button></div>
    <p class=note style="margin-top:14px"><b>Reset:</b> remove all test leads + their data.</p>
    <button class=danger onclick=resetTests()>Delete test data</button>
    <div id=tickOut class="note mono" style="margin-top:10px"></div>
  </div>
</div>

<h2>Gate violations <span class=note>— target: zero. Any row is a bug or a real block.</span></h2>
<div class=card id=violations><span class=muted>none</span></div>

<h2>Recent errors <span class=note>— live send failures with the provider's exact code (catch via GET /api/stl/admin → errors[])</span></h2>
<div class=card id=errors><span class=muted>none</span></div>

<h2>Leads &amp; touchpoints</h2>
<div id=leads></div>

<script>
const $=s=>document.querySelector(s);
let STATE=null;
async function api(method,body){const r=await fetch('/api/stl/admin',{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return r.json();}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function ts(t){return t?new Date(t).toLocaleString():'—';}
function fmtDelta(t){if(!t)return '';const s=Math.round((t-Date.now())/1000);if(Math.abs(s)<90)return s>=0?'in '+s+'s':Math.abs(s)+'s ago';const m=Math.round(s/60);return m>=0?'in '+m+'m':Math.abs(m)+'m ago';}

async function load(){
  const d=await api('GET');if(!d.ok){$('#msg').textContent='load failed';return;}
  STATE=d;
  // mode
  const s=d.settings;
  document.querySelector('input[name=mode][value='+(s.mode==='live'?'live':'simulate')+']').checked=true;
  $('#paused').checked=s.paused==='1';
  ['live_email','live_sms','live_call_ai','live_call_human'].forEach(k=>$('#'+k).checked=s[k]==='1');
  $('#test_emails').value=s.test_emails||'';$('#test_phones').value=s.test_phones||'';
  renderMode(s);
  // metrics
  const m=d.metrics;
  const K=(v,l,cls)=>'<div class="kpi '+(cls||'')+'"><div class=v>'+(v==null?'—':v)+'</div><div class=l>'+l+'</div></div>';
  $('#kpis').innerHTML=
    K(m.leads_total+' ('+m.leads_A+'A/'+m.leads_B+'B)','Leads')+
    K(m.speed_to_first_ring_p95_s==null?'—':m.speed_to_first_ring_p95_s+'s','Speed to first ring p95', m.speed_to_first_ring_p95_s>60?'alarm':'good')+
    K(m.sla_breach_rate_pct==null?'—':m.sla_breach_rate_pct+'%','SLA breach (>5m)')+
    K(m.identified_contacted_60m_pct==null?'—':m.identified_contacted_60m_pct+'%','A contacted <60m')+
    K(m.gate_violations, 'Gate violations', m.gate_violations>0?'alarm':'good')+
    K(m.cookie_leak_flags,'Cookie-banner leaks', m.cookie_leak_flags>0?'alarm':'good')+
    K(m.window_compliance_dials_sent,'Dials sent (in-window)')+
    K((m.dispatch_by_mode&&(m.dispatch_by_mode.live||0))+' / '+(m.dispatch_by_mode&&(m.dispatch_by_mode.simulate||0)),'Live / simulated sends');
  // readiness
  renderReadiness(d.readiness||{});
  // recent errors (live send failures with the provider code)
  const errs=d.errors||[];
  $('#errors').innerHTML=errs.length? '<table><tr><th>When</th><th>Kind</th><th>Detail</th><th>Lead</th></tr>'+
    errs.map(e=>{let dt='';try{dt=e.detail?JSON.stringify(JSON.parse(e.detail)):''}catch(_){dt=e.detail||''}return '<tr><td>'+ts(e.at)+'</td><td class=s-failed>'+esc(e.kind)+'</td><td class=mono>'+esc(dt)+'</td><td class=tp>'+esc((e.lead_id||'').slice(0,8))+'</td></tr>';}).join('')+'</table>' : '<span class=muted>none</span>';
  // violations
  $('#violations').innerHTML=d.violations.length? '<table><tr><th>When</th><th>Channel</th><th>Reason</th><th>Caller</th><th>Lead</th></tr>'+
    d.violations.map(v=>'<tr><td>'+ts(v.attempted_at)+'</td><td>'+esc(v.channel)+'</td><td class=s-blocked>'+esc(v.reason)+'</td><td class=tp>'+esc(v.caller)+'</td><td class=tp>'+esc(v.lead_id.slice(0,8))+'</td></tr>').join('')+'</table>' : '<span class=muted>none — clean</span>';
  // leads + touchpoints
  const byLead={};d.touchpoints.forEach(t=>{(byLead[t.lead_id]=byLead[t.lead_id]||[]).push(t);});
  $('#leads').innerHTML=d.leads.map(l=>{
    const tps=(byLead[l.id]||[]).sort((a,b)=>a.scheduled_for-b.scheduled_for);
    const rows=tps.map(t=>{
      const detail=(t.status==='failed'||t.outcome==='sms_failed')&&t.notes?' <span class=s-failed>('+esc(t.notes)+')</span>':(t.notes?' <span class=muted>'+esc(t.notes)+'</span>':'');
      return '<tr><td class=tp>'+esc(t.sequence_step)+'</td><td>'+esc(t.channel)+'</td><td class=s-'+esc(t.status)+'>'+esc(t.status)+'</td><td>'+esc(t.outcome||'')+detail+'</td><td>'+(t.consent_check==='blocked'?'<span class=s-blocked>blocked: '+esc(t.block_reason)+'</span>':(t.consent_check||''))+'</td><td>'+(t.dispatch_mode||'')+'</td><td class=tp>'+(t.attempted_at?ts(t.attempted_at):esc(fmtDelta(t.scheduled_for)))+'</td></tr>';
    }).join('');
    return '<details><summary><span class="pill p'+l.population+'">'+l.population+'</span> '+esc(l.first_name||'')+' '+esc(l.company?'· '+l.company:'')+' <span class=muted>'+esc(l.email||'')+' · '+esc(l.phone||'')+'</span> — <span class=muted>'+esc(l.status)+'</span> '+(l.is_test?'<span class=note>[test]</span>':'')+' <button class=ghost style="float:right;padding:3px 9px" onclick="event.preventDefault();revokeLead(\\''+l.id+'\\')">Revoke</button>'+(l.population==='B'?' <button class=ghost style="float:right;padding:3px 9px;margin-right:6px" onclick="event.preventDefault();markTransfer(\\''+l.id+'\\')">Mark B1 transfer</button>':'')+'</summary>'+
      '<div style="padding:0 12px 10px"><table><tr><th>Step</th><th>Channel</th><th>Status</th><th>Outcome</th><th>Gate</th><th>Mode</th><th>When</th></tr>'+(rows||'<tr><td colspan=7 class=muted>no touchpoints</td></tr>')+'</table></div></details>';
  }).join('')||'<span class=muted>No leads yet — inject one above.</span>';
}
function renderMode(s){
  const paused=s.paused==='1';const live=s.mode==='live';
  const b=$('#modeBadge');b.innerHTML='<span class="mode '+(paused?'paused':live?'live':'sim')+'">'+(paused?'⏸ PAUSED':live?'● LIVE':'◐ SIMULATE')+'</span>';
  $('#alarm').innerHTML=live&&!paused?'<div class=card style="border-color:var(--warn)"><b style="color:var(--warn)">Live mode is ON.</b> Channels toggled Live will send for real. Recipients outside the allowlist are still simulated.</div>':'';
}
async function saveSettings(){
  const settings={mode:document.querySelector('input[name=mode]:checked').value,paused:$('#paused').checked?'1':'0',test_emails:$('#test_emails').value.trim(),test_phones:$('#test_phones').value.trim()};
  ['live_email','live_sms','live_call_ai','live_call_human'].forEach(k=>settings[k]=$('#'+k).checked?'1':'0');
  $('#msg').textContent='saving…';const d=await api('POST',{action:'set_settings',settings});$('#msg').textContent=d.ok?'saved ✓':'error';await load();
}
async function inject(){
  const lead={first_name:$('#inFirst').value,company:$('#inCo').value,trade:$('#inTrade').value,email:$('#inEmail').value,phone:$('#inPhone').value,timezone:$('#inTz').value,state:$('#inState').value};
  const d=await api('POST',{action:'inject',population:$('#inPop').value,lead});$('#tickOut').textContent=d.ok?('Injected '+d.population+' lead '+d.lead_id.slice(0,8)):('error: '+(d.error||''));await load();
}
async function runTick(){$('#tickOut').textContent='ticking…';const d=await api('POST',{action:'tick'});$('#tickOut').textContent=d.ok?('tick: '+JSON.stringify(d.summary)):'error';await load();}
async function seedRep(){const d=await api('POST',{action:'seed_rep'});$('#tickOut').textContent=d.ok?'rep seeded':'error';await load();}
async function resetTests(){if(!confirm('Delete ALL test leads and their data?'))return;const d=await api('POST',{action:'reset_tests'});$('#tickOut').textContent=d.ok?('deleted '+d.deleted):'error';await load();}
function renderReadiness(r){
  const chip=(ok,label,note)=>'<div class="kpi '+(ok?'good':'')+'"><div class=v style="font-size:15px">'+(ok?'● ready':'○ not set')+'</div><div class=l>'+label+(note?' <span class=muted>'+note+'</span>':'')+'</div></div>';
  document.getElementById('readiness').innerHTML=
    chip(r.email_resend,'Email (Resend)')+
    chip(r.retell_key,'Retell key')+
    chip(r.retell_agent&&r.retell_from,'Retell agent + number')+
    chip(r.twilio&&r.twilio_from,'Twilio (SMS)','partner')+
    chip(r.calcom,'Cal.com secret')+
    chip(r.alert_url,'Alerts / paging')+
    chip(!!r.booking_link,'Booking link')+
    chip(r.verify_webhooks,'Webhook signatures');
  const d=r._debug||{};
  const dbg=document.getElementById('twilioDebug');
  if(dbg) dbg.textContent='Twilio env → From='+JSON.stringify(d.from_value)+' (len '+d.from_len+') · SID='+(d.sid||'—')+' (len '+d.sid_len+') · auth_token len '+d.auth_token_len+' · MsgService='+(d.messaging_service||'—');
}
async function provisionRetell(){ $('#intgOut').textContent='provisioning Ruby…'; const d=await api('POST',{action:'retell_setup'}); $('#intgOut').textContent=JSON.stringify(d); await load(); }
async function listNumbers(){ $('#intgOut').textContent='fetching numbers…'; const d=await api('POST',{action:'retell_numbers'}); $('#intgOut').textContent=JSON.stringify(d); }
async function sendTestEmail(){ const to=$('#testEmail').value.trim(); if(!to){$('#intgOut').textContent='enter a to-address';return;} $('#intgOut').textContent='sending…'; const d=await api('POST',{action:'test_email',to}); $('#intgOut').textContent=JSON.stringify(d); }
async function verifyTwilio(){ $('#intgOut').textContent='checking Twilio…'; const d=await api('POST',{action:'twilio_status'}); $('#intgOut').textContent=JSON.stringify(d); }
async function listTwilioNums(){ $('#intgOut').textContent='fetching…'; const d=await api('POST',{action:'twilio_numbers'}); $('#intgOut').textContent=JSON.stringify(d); }
async function findNumberOwner(){ $('#intgOut').textContent='searching this account + subaccounts…'; const d=await api('POST',{action:'twilio_find_number'}); $('#intgOut').textContent=JSON.stringify(d); }
async function sendTestSms(){ const to=$('#testSms').value.trim(); if(!to){$('#intgOut').textContent='enter a to-number (E.164)';return;} $('#intgOut').textContent='sending…'; const d=await api('POST',{action:'test_sms',to}); $('#intgOut').textContent=JSON.stringify(d); if(d&&d.sid){$('#msgSid').value=d.sid;} }
async function checkSms(){ const sid=$('#msgSid').value.trim(); if(!sid){$('#intgOut').textContent='paste a message SID (SM…)';return;} $('#intgOut').textContent='checking delivery…'; const d=await api('POST',{action:'twilio_message_status',sid}); $('#intgOut').textContent=JSON.stringify(d); }
async function revokeLead(id){const d=await api('POST',{action:'revoke',lead_id:id});await load();}
async function markTransfer(id){const d=await api('POST',{action:'mark_transfer',lead_id:id});await load();}
load();setInterval(load,15000);
</script></div></body></html>`;
