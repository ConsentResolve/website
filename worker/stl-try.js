// Speed-to-Lead — shareable team walk-through form at /try (public, noindex).
// A teammate fills this and watches the WHOLE engine run on themselves in ~15 min:
// Mack calls in ~30s → text in ~2m → consent-receipt email in ~4m, and every step
// lands in the CRM Inbox. Submits to /api/lead with is_demo=true (compressed timing).
export async function handle() {
  return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

const PAGE = `<!doctype html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content="noindex,nofollow">
<title>See the Speed-to-Lead engine run — Consent Resolve</title>
<style>
:root{--bg:#0e1c2e;--sf:#14263c;--sf2:#1b3049;--ln:rgba(255,255,255,.12);--tx:#eaf2f8;--tx2:#9fb3c6;--ac:#00e5a0;--ok:#39d98a}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#0b1726,#0e1c2e);color:var(--tx);font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px;line-height:1.5}
.card{width:min(560px,96vw);background:var(--sf);border:1px solid var(--ln);border-radius:18px;padding:28px 26px 30px;box-shadow:0 30px 80px -40px rgba(0,0,0,.7)}
.tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ac);background:rgba(0,229,160,.12);padding:4px 10px;border-radius:999px}
h1{font-size:23px;margin:12px 0 6px;line-height:1.15}p.sub{color:var(--tx2);margin:0 0 18px;font-size:14.5px}
label{display:block;font-size:12px;color:var(--tx2);margin:12px 0 4px;font-weight:600}
input,select{width:100%;padding:11px 12px;background:var(--bg);border:1px solid var(--ln);border-radius:10px;color:var(--tx);font-size:15px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ck{display:flex;gap:9px;align-items:flex-start;padding:6px 0;font-size:12.5px;color:var(--tx2);line-height:1.4}
.ck input{width:17px;height:17px;margin-top:1px;accent-color:var(--ac);flex:0 0 auto}
.consents{margin:16px 0 4px;border:1px solid var(--ln);border-radius:12px;padding:11px 13px;background:rgba(255,255,255,.02)}
button{margin-top:16px;width:100%;background:var(--ac);color:#04120b;border:0;border-radius:11px;padding:14px;font-weight:800;font-size:15.5px;cursor:pointer}
.steps{display:none;margin-top:18px}
.steps.on{display:block}
.step{display:flex;gap:12px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--ln);font-size:14px}
.step:first-child{border-top:0}
.step .when{flex:0 0 86px;font-family:ui-monospace,monospace;font-size:12px;font-weight:800;color:var(--ac);font-variant-numeric:tabular-nums}
.step .when.due{color:var(--ok);animation:tryPulse 1.1s ease-in-out infinite}
.step.firing{background:rgba(0,229,160,.06);border-radius:8px}
@keyframes tryPulse{0%,100%{opacity:1}50%{opacity:.42}}
@media(prefers-reduced-motion:reduce){.step .when.due{animation:none}}
.out{margin-top:14px;font-size:14px;padding:12px 14px;border-radius:11px;display:none}
.out.ok{display:block;background:rgba(57,217,138,.12);color:var(--ok)}
.out.err{display:block;background:rgba(255,107,107,.14);color:#ff9b9b}
.note{font-size:12px;color:var(--tx2);margin-top:10px}
</style></head><body>
<form class=card id=f onsubmit="return go(event)">
  <span class=tag>Live walk-through · watch it happen to you</span>
  <h1>See our Speed-to-Lead engine run — on you, in real time.</h1>
  <p class=sub>Put in your <b>real</b> phone + email. In about <b>30 seconds</b> Mack (our AI) calls you, then a text, then a consent-receipt email — and every step shows up in the CRM. The whole flow finishes in ~15 minutes.</p>
  <div class=row2>
    <div><label>First name</label><input id=first value=""></div>
    <div><label>Company</label><input id=company placeholder="Your shop"></div>
  </div>
  <div class=row2>
    <div><label>Email (real)</label><input id=email type=email placeholder="you@company.com"></div>
    <div><label>Mobile (real, any format)</label><input id=phone inputmode="tel" placeholder="(713) 555-1234"></div>
  </div>
  <div class=row2>
    <div><label>Trade</label><select id=trade><option>roofing</option><option>plumbing</option><option>hvac</option><option>electrical</option><option>other</option></select></div>
    <div><label>State</label><input id=state value="TX"></div>
  </div>
  <div class=consents>
    <label class=ck><input type=checkbox id=c_email checked> I agree Consent Resolve may email me.</label>
    <label class=ck><input type=checkbox id=c_sms checked> I agree Consent Resolve may text me, including automated messages. Reply STOP to opt out.</label>
    <label class=ck><input type=checkbox id=c_hum checked> I agree a rep may call me.</label>
    <label class=ck><input type=checkbox id=c_ai checked> I agree Consent Resolve may call me with an AI assistant ("Mack"), which identifies itself as AI.</label>
  </div>
  <button type=submit>▶ Start the demo — call me now</button>
  <div class=out id=out></div>
  <div class="steps" id=steps>
    <div class=step data-off="30"><span class=when>~30 sec</span><span>📞 <b>Mack calls you.</b> Mack discloses it's AI, offers to connect you to a rep, and can transfer live.</span></div>
    <div class=step data-off="120"><span class=when>~2 min</span><span>💬 <b>Text message</b> from the same number.</span></div>
    <div class=step data-off="240"><span class=when>~4 min</span><span>✉️ <b>Consent-receipt email</b> — the "here's exactly what you agreed to" proof.</span></div>
    <div class=step data-off="480"><span class=when>~8 min</span><span>📞 <b>Human dial</b> step (if Mack didn't transfer).</span></div>
    <div class=step><span class=when>live</span><span>🗂️ Watch all of it appear in the CRM Inbox at <b>/crm/app</b> as it happens.</span></div>
  </div>
  <div class=note>This is a demo — you consented above and can reply STOP or revoke anytime.</div>
</form>
<script>
function go(e){e.preventDefault();
  var g=function(id){return document.getElementById(id);};
  var out=g('out'), phone=g('phone').value.trim();
  if(phone.replace(/[^0-9]/g,'').length<10){ out.className='out err'; out.textContent='Add a real 10-digit mobile so Mack can call you.'; return false; }
  var q=new URLSearchParams(location.search);
  var consent={email:g('c_email').checked,sms:g('c_sms').checked,phone_human:g('c_hum').checked,phone_ai:g('c_ai').checked,grade:'written',exact_language:'Team walk-through demo — email/SMS/call/AI consents.'};
  var body={kind:'form_submit',is_demo:true,first_name:g('first').value||'Demo',company:g('company').value,email:g('email').value,phone:phone,trade:g('trade').value,state:g('state').value,landing_page:'/try',ad_source:q.get('utm_source')||'demo',utm_campaign:q.get('utm_campaign')||'team-walkthrough',consent:consent};
  out.className='out'; out.textContent='Starting… Mack will call in ~30 seconds.'; out.style.display='block';
  fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    .then(function(r){return r.json();}).then(function(d){
      if(d&&d.ok){ out.className='out ok'; out.innerHTML='✓ You\\'re in the engine — <b>Population '+d.population+'</b>. Keep your phone handy; Mack calls in ~30 seconds. Revoke anytime: <a href="'+d.revoke_url+'" style="color:#00e5a0">one-click</a>.'; g('steps').className='steps on'; document.querySelector('button').style.display='none'; startCountdown(); }
      else { out.className='out err'; out.textContent='Error: '+((d&&d.error)||'unknown'); }
    }).catch(function(){ out.className='out err'; out.textContent='Network error.'; });
  return false;
}
// Live per-event countdowns: once the engine is running, each step ticks down to its
// expected fire time, then flips to "now". Timings match the demo cadence (approximate —
// the tick fires on a schedule, so treat these as "expect it around now").
function startCountdown(){
  var start=Date.now();
  var steps=[].slice.call(document.querySelectorAll('#steps .step[data-off]'));
  function fmt(s){s=Math.max(0,Math.round(s));var m=Math.floor(s/60),ss=s%60;return m+':'+(ss<10?'0':'')+ss;}
  function tick(){
    var el=(Date.now()-start)/1000;
    steps.forEach(function(st){
      var off=+st.getAttribute('data-off'),w=st.querySelector('.when');
      if(el>=off){ if(!w.classList.contains('due')){w.textContent='now';w.classList.add('due');st.classList.add('firing');} }
      else { w.textContent='in '+fmt(off-el); }
    });
    if(el>600){ clearInterval(window.__tryTimer); steps.forEach(function(st){st.querySelector('.when').textContent='✓ sent';}); }
  }
  tick(); window.__tryTimer=setInterval(tick,1000);
}
</script></body></html>`;
