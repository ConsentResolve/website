// Speed-to-Lead — internal TEST demo form, served at /speed-demo (public, noindex).
// Submits a real lead to POST /api/lead with the four channel-consent checkboxes so
// the whole engine (classifier → gate → cadence) can be exercised end-to-end. The
// checkbox wording here is the exact_language stored on the consent event.
export async function handle() {
  return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

const PAGE = `<!doctype html><html><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content="noindex,nofollow">
<title>Speed-to-Lead — test demo form</title>
<style>
:root{--bg:#0e1c2e;--sf:#14263c;--ln:rgba(255,255,255,.12);--tx:#eaf2f8;--tx2:#9fb3c6;--ac:#00e5a0;--ok:#39d98a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
.card{width:min(560px,96vw);background:var(--sf);border:1px solid var(--ln);border-radius:16px;padding:26px 26px 30px}
.tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ac);background:rgba(0,229,160,.12);padding:3px 9px;border-radius:999px}
h1{font-size:22px;margin:12px 0 4px}p.sub{color:var(--tx2);margin:0 0 18px;font-size:14px}
label{display:block;font-size:12px;color:var(--tx2);margin:12px 0 4px;font-weight:600}
input,select{width:100%;padding:10px 11px;background:var(--bg);border:1px solid var(--ln);border-radius:9px;color:var(--tx);font-size:14px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.consents{margin:18px 0 6px;border:1px solid var(--ln);border-radius:11px;padding:12px 14px;background:rgba(255,255,255,.02)}
.consents h3{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx2);margin:0 0 8px}
.ck{display:flex;gap:9px;align-items:flex-start;padding:7px 0;font-size:13px;line-height:1.4;border-top:1px solid var(--ln)}
.ck:first-of-type{border-top:0}.ck input{width:18px;height:18px;margin-top:1px;accent-color:var(--ac);flex:0 0 auto}
button{margin-top:16px;width:100%;background:var(--ac);color:#04120b;border:0;border-radius:10px;padding:13px;font-weight:800;font-size:15px;cursor:pointer}
.out{margin-top:16px;font-size:13px;line-height:1.5;padding:12px 14px;border-radius:10px;display:none}
.out.ok{display:block;background:rgba(57,217,138,.12);color:var(--ok)}
.out.err{display:block;background:rgba(255,107,107,.14);color:#ff9b9b}
.out a{color:var(--ac)}.note{font-size:11.5px;color:var(--tx2);margin-top:8px}
</style></head><body>
<form class=card id=f onsubmit="return submitLead(event)">
  <span class=tag>Internal test · Speed-to-Lead</span>
  <h1>Book a consent-first demo</h1>
  <p class=sub>Fill this to fire a real lead into the engine. Check the regulated boxes to create a <b>Population B</b> (24-hour, fully consented) lead; leave them unchecked for <b>Population A</b> (8-day, email + human dial only).</p>
  <div class=row2>
    <div><label>First name</label><input id=first value="Test"></div>
    <div><label>Company</label><input id=company value="Acme Roofing"></div>
  </div>
  <div class=row2>
    <div><label>Email</label><input id=email type=email value="test@example.com"></div>
    <div><label>Phone</label><input id=phone placeholder="+1 555 123 4567"></div>
  </div>
  <div class=row2>
    <div><label>Trade</label><select id=trade><option>roofing</option><option>plumbing</option><option>hvac</option><option>electrical</option><option>other</option></select></div>
    <div><label>State</label><input id=state value="TX"></div>
  </div>
  <div class=consents>
    <h3>What may we use to reach you?</h3>
    <label class=ck><input type=checkbox id=c_email checked> I agree Consent Resolve may <b>email</b> me. I can unsubscribe anytime.</label>
    <label class=ck><input type=checkbox id=c_sms> I agree Consent Resolve may <b>text</b> me at the number above, including automated messages. Msg &amp; data rates may apply. Reply STOP to opt out.</label>
    <label class=ck><input type=checkbox id=c_hum> I agree a Consent Resolve <b>rep may call</b> me at this number.</label>
    <label class=ck><input type=checkbox id=c_ai> I agree Consent Resolve may call me using an <b>AI voice assistant</b> ("Mack"), which will identify itself as AI.</label>
  </div>
  <button type=submit>Submit — start the sequence</button>
  <div class=out id=out></div>
  <div class=note>This is a test surface. Real dispatch only happens if the engine is switched to Live at /crm/speed.</div>
</form>
<script>
function submitLead(e){e.preventDefault();
  var g=function(id){return document.getElementById(id);};
  var consent={email:g('c_email').checked,sms:g('c_sms').checked,phone_human:g('c_hum').checked,phone_ai:g('c_ai').checked,grade:'written',
    exact_language:'Test demo form consents: '+['email','sms','phone(human)','phone(AI)'].filter(function(_,i){return [g('c_email'),g('c_sms'),g('c_hum'),g('c_ai')][i].checked;}).join(', ')};
  var body={kind:'form_submit',first_name:g('first').value,company:g('company').value,email:g('email').value,phone:g('phone').value,trade:g('trade').value,state:g('state').value,landing_page:'/speed-demo',ad_source:'test',consent:consent};
  var out=g('out');out.className='out';out.textContent='Submitting…';out.style.display='block';
  fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    .then(function(r){return r.json();}).then(function(d){
      if(d&&d.ok){out.className='out ok';out.innerHTML='✓ Lead created — <b>Population '+d.population+'</b>.<br>Lead id: '+d.lead_id+'<br>Revoke link: <a href="'+d.revoke_url+'" target=_blank>test one-click revoke ↗</a><br>Watch it run in the <a href="/crm/speed" target=_blank>console</a> (Run tick to fire due steps).';}
      else{out.className='out err';out.textContent='Error: '+((d&&d.error)||'unknown');}
    }).catch(function(){out.className='out err';out.textContent='Network error.';});
  return false;
}
</script></body></html>`;
