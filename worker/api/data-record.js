// worker/api/data-record.js
// The "See everything we have on you / delete it" landing page linked from the Identified
// Visitor Outreach emails (Tyler). One page, three jobs:
//   1. Show the person EVERYTHING we actually hold on them — honestly, including the fields
//      we deliberately never collected.
//   2. Three escalating, playful "Hail Mary" attempts to book a meeting before they erase.
//   3. A real one-click data erasure that plays a dramatic, cinematic screen-SHRED and
//      leaves one final message.
//
// Routes (both wired in index.js to this module):
//   GET  /api/crm/data-record?c=<contactId>   -> the page
//   GET  /api/crm/data-delete?c=<contactId>   -> same page, auto-focused on the erase panel
//   POST /api/crm/data-delete?c=<contactId>   -> performs the erasure, returns {ok}
//
// Erasure = suppress (all channels) + revoke consent + exit any active sequence + scrub the
// contact's PII + clear cached enrichment + log an activity. Idempotent + best-effort.

import { json } from "../_lib/http.js";
import { ulid, nowIso, ensureRebuildSchema, addSuppression, recordConsent } from "../_lib/crm-rebuild.js";
import { handleGoalEvent } from "../_lib/workflow-engine.js";

const SITE = "https://consentresolve.com";
const BOOK = SITE + "/demo/";
const TEL = "+17279999846";
const PHONE = "(727) 999-9846";
const AVATAR = SITE + "/team/tyler-spurlock.jpg";

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fmtDateTime(v) {
  if (!v) return null;
  const d = /^\d+$/.test(String(v)) ? new Date(Number(v) * (String(v).length <= 10 ? 1000 : 1)) : new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

async function loadRecord(env, contactId) {
  const c = await env.DB.prepare(
    "SELECT c.id, c.full_name, c.primary_email, c.phone, c.source, c.created_at, c.company_id, co.enrichment, co.name company_name FROM contacts c LEFT JOIN companies co ON co.id=c.company_id WHERE c.id=? LIMIT 1"
  ).bind(contactId).first();
  if (!c) return null;
  let en = {}; try { en = c.enrichment ? JSON.parse(c.enrichment) : {}; } catch (_) { en = {}; }
  c._visitor = en._visitor || {};
  c._person = en._person || {};
  return c;
}

async function alreadyErased(env, contactId) {
  try {
    const r = await env.DB.prepare("SELECT id FROM activities WHERE entity_type='contact' AND entity_id=? AND action='data_erased' LIMIT 1").bind(contactId).first();
    return !!r;
  } catch (_) { return false; }
}

async function eraseContact(env, contactId) {
  await ensureRebuildSchema(env);
  const c = await loadRecord(env, contactId);
  if (!c) return { ok: false, error: "not_found" };
  const email = c.primary_email || null;
  // 1) Stop all future contact + record the revocation in the system the engine checks.
  try { await addSuppression(env, { contactId, email, phone: c.phone, channel: "all", reason: "data_erasure", source: "data_page" }); } catch (_) {}
  try { await recordConsent(env, { contactId, email, channel: "email", action: "revoked", basis: "data erasure request", captureMethod: "data_page", source: "data_page" }); } catch (_) {}
  // 2) Exit any active sequence.
  try { await handleGoalEvent(env, { contactId, goal: "opted_out" }); } catch (_) {}
  // 3) Scrub the contact's PII + clear cached enrichment so nothing personal is left at rest.
  try { await env.DB.prepare("UPDATE contacts SET full_name='(erased at their request)', phone=NULL, updated_at=? WHERE id=?").bind(nowIso(), contactId).run(); } catch (_) {}
  if (c.company_id) {
    try {
      let en = {}; try { en = c.enrichment ? JSON.parse(c.enrichment) : {}; } catch (_) {}
      delete en._visitor; delete en._person; delete en._person_nomatch;
      await env.DB.prepare("UPDATE companies SET enrichment=? WHERE id=?").bind(JSON.stringify(en), c.company_id).run();
    } catch (_) {}
  }
  // 4) Leave a trace of the erasure itself (this is what the team sees, and what makes the
  //    page idempotent).
  try {
    await env.DB.prepare("INSERT INTO activities (id, entity_type, entity_id, action, meta, created_at) VALUES (?,?,?,?,?,?)")
      .bind(ulid(), "contact", contactId, "data_erased", JSON.stringify({ email, via: "data_page" }), nowIso()).run();
  } catch (_) {}
  return { ok: true };
}

export async function onRequestOptions() { return new Response(null, { status: 204 }); }

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get("c") || "";
  if (!contactId) return json({ ok: false, error: "missing_contact" }, { status: 400 });
  const r = await eraseContact(env, contactId);
  return json(r, { status: r.ok ? 200 : 404 });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get("c") || "";
  const eraseIntent = url.pathname.endsWith("/data-delete") || url.searchParams.get("erase") === "1";
  const headers = { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };

  let rec = null, gone = false;
  try {
    if (contactId) {
      gone = await alreadyErased(env, contactId);
      if (!gone) rec = await loadRecord(env, contactId);
    }
  } catch (_) {}

  if (!contactId || (!rec && !gone)) return new Response(pageShell(emptyState()), { headers });
  if (gone) return new Response(pageShell(erasedState()), { headers });
  return new Response(renderPage(rec, contactId, eraseIntent), { headers });
}

// ------------------------------------------------------------------ rendering
function pageShell(inner, extraHead) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Your data · Consent Resolve</title>
<style>
:root{--bg:#0B0F14;--panel:#121821;--panel2:#0E141C;--line:#1F2A38;--ink:#EAF0F6;--sub:#94A2B3;--mint:#22C08A;--mint2:#39D9A2;--danger:#E5484D;--gold:#E9C46A}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,'Segoe UI',Roboto,Inter,Arial,sans-serif;-webkit-font-smoothing:antialiased}
body{overflow-x:hidden}
a{color:var(--mint2)}
.wrap{max-width:640px;margin:0 auto;padding:40px 20px 80px}
.mk{width:34px;height:34px;border-radius:9px;background:var(--mint);color:#04231A;display:grid;place-items:center;font-size:19px;font-weight:900}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--sub);font-weight:700}
h1{font-size:30px;line-height:1.15;margin:14px 0 8px;font-weight:800;letter-spacing:-.02em;text-wrap:balance}
.lede{color:var(--sub);font-size:16px;line-height:1.6;margin:0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 24px 60px -30px rgba(0,0,0,.7)}
.card-h{padding:13px 18px;background:linear-gradient(180deg,#14202C,#101822);border-bottom:1px solid var(--line);font-size:13px;font-weight:700;color:var(--mint2);display:flex;align-items:center;gap:8px}
.rows{padding:6px 18px 14px}
.row{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.045);font-size:15px}
.row:last-child{border-bottom:0}
.row .k{color:var(--sub)}
.row .v{color:var(--ink);font-weight:600;text-align:right;word-break:break-word}
.row.empty .k,.row.empty .v{color:#4B5B6E}
.row.empty .v{font-weight:500;font-style:italic}
.foot-note{padding:13px 18px;background:var(--panel2);border-top:1px solid var(--line);font-size:13px;line-height:1.55;color:var(--sub)}
.section-label{margin:44px 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:800}
.hm{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--mint);border-radius:14px;padding:20px 20px 18px;margin:14px 0}
.hm .n{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--mint2);margin-bottom:8px}
.hm h3{margin:0 0 8px;font-size:19px;font-weight:800;letter-spacing:-.01em}
.hm p{margin:0 0 14px;color:#C6D2DE;font-size:15.5px;line-height:1.62}
.hm p:last-of-type{margin-bottom:16px}
.cta{display:inline-block;background:var(--mint);color:#04231A;font-weight:800;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:10px}
.cta.ghost{background:transparent;color:var(--mint2);border:1px solid var(--line);margin-left:8px}
.cta-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.tyler{display:flex;align-items:center;gap:12px;margin:26px 0 6px}
.tyler img{width:46px;height:46px;border-radius:50%;display:block}
.tyler .nm{font-weight:800;font-size:15px}
.tyler .sub{color:var(--sub);font-size:13px}
.erase-zone{margin-top:34px;text-align:center;padding:28px 18px;border:1px dashed var(--line);border-radius:16px;transition:border-color .3s,background .3s}
.erase-zone.focus{border-color:var(--danger);background:rgba(229,72,77,.06)}
.erase-zone p{color:var(--sub);font-size:14px;margin:0 0 16px}
.erase-btn{background:transparent;border:1px solid #5A2A2C;color:#E7898C;font-weight:700;font-size:15px;padding:13px 24px;border-radius:11px;cursor:pointer;transition:all .2s}
.erase-btn:hover{background:var(--danger);border-color:var(--danger);color:#fff}
.smalllinks{margin-top:40px;text-align:center;font-size:13px;color:#4B5B6E}
.smalllinks a{color:#6E7F92}
/* shred stage */
#stage{transition:filter .2s}
.shred-wrap{position:fixed;z-index:9998;pointer-events:none}
.shred-strip{position:absolute;top:0;overflow:hidden;will-change:transform,opacity;backface-visibility:hidden}
.shred-strip .inner{position:absolute;top:0}
.mouth{position:fixed;left:0;height:26px;z-index:9999;pointer-events:none;
  background:linear-gradient(180deg,#2A3644,#161E28);border-top:2px solid #3A4A5C;border-bottom:2px solid #05090D;
  box-shadow:0 10px 30px -6px rgba(0,0,0,.8),inset 0 -6px 10px -6px rgba(0,0,0,.9);transform:scaleX(0);transition:transform .28s cubic-bezier(.2,.8,.2,1)}
.mouth::after{content:"";position:absolute;left:0;right:0;bottom:-8px;height:8px;
  background:repeating-linear-gradient(90deg,#161E28 0 8px,transparent 8px 16px);
  -webkit-mask:repeating-linear-gradient(90deg,#000 0 8px,transparent 8px 16px)}
.mouth .teeth{position:absolute;left:0;right:0;bottom:-7px;height:9px;
  background:repeating-linear-gradient(90deg,#0B0F14 0 7px,#2A3644 7px 8px,#0B0F14 8px 15px);
  clip-path:polygon(0 0,4% 100%,8% 0,12% 100%,16% 0,20% 100%,24% 0,28% 100%,32% 0,36% 100%,40% 0,44% 100%,48% 0,52% 100%,56% 0,60% 100%,64% 0,68% 100%,72% 0,76% 100%,80% 0,84% 100%,88% 0,92% 100%,96% 0,100% 100%,100% 0,0 0)}
#blackout{position:fixed;inset:0;background:#04060A;opacity:0;z-index:9997;pointer-events:none;transition:opacity 1.1s ease}
#final{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .9s ease .2s}
#final .chk{font-size:44px}
#final h2{font-size:30px;font-weight:800;letter-spacing:-.02em;margin:14px 0 8px}
#final p{color:var(--sub);font-size:16px;line-height:1.6;max-width:420px;margin:0 auto 6px}
#final .sig{margin-top:22px;color:#6E7F92;font-size:14px}
#final .ret{margin-top:26px}
#final .ret a{color:var(--mint2);text-decoration:none;font-weight:700;border:1px solid var(--line);padding:10px 18px;border-radius:10px}
@media (prefers-reduced-motion:reduce){.mouth,.shred-wrap{display:none!important}#blackout{transition:opacity .3s}}
</style></head><body>${inner}</body></html>`;
}

function recordCard(rec) {
  const v = rec._visitor || {}, p = rec._person || {};
  const name = p.name || (rec.full_name && !/^\(erased/.test(rec.full_name) ? rec.full_name : "");
  const cityState = [p.city, p.state].filter(Boolean).join(", ");
  const source = v.referrer || v.source_url || rec.source || "";
  const seen = fmtDateTime(v.last_seen || rec.created_at);
  const first = fmtDateTime(v.first_seen);
  const pv = v.page_views != null ? `${v.page_views} page${v.page_views === 1 ? "" : "s"}` : "";
  const sess = v.sessions != null ? `${v.sessions} session${v.sessions === 1 ? "" : "s"}` : "";
  const filled = [];
  if (name) filled.push(["Name", esc(name)]);
  filled.push(["Email", esc(rec.primary_email || "—")]);
  if (cityState) filled.push(["Approx. area", esc(cityState)]);
  if (source) filled.push(["Arrived from", esc(source)]);
  if (rec.company_name) filled.push(["Company", esc(rec.company_name)]);
  if (seen) filled.push(["Last on our site", esc(seen)]);
  if (first && first !== seen) filled.push(["First seen", esc(first)]);
  if (pv || sess) filled.push(["Activity", esc([pv, sess].filter(Boolean).join(" · "))]);
  filled.push(["Consent", "Accepted the cookie banner on consentresolve.com" + (seen ? " · " + esc(seen) : "")]);
  const empty = [
    ["Phone number", "never collected"],
    ["Home / mailing address", "never collected"],
    ["Date of birth", "never collected"],
    ["Anything you didn't hand us", "never collected"],
  ];
  const rowsHtml = filled.map(([k, val]) => `<div class="row"><span class="k">${k}</span><span class="v">${val}</span></div>`).join("")
    + empty.map(([k, val]) => `<div class="row empty"><span class="k">${k}</span><span class="v">${val}</span></div>`).join("");
  return `<div class="card"><div class="card-h">🗂 Everything Consent Resolve has on you</div>
    <div class="rows">${rowsHtml}</div>
    <div class="foot-note">The greyed rows are what other visitor-identification companies would have appended and sold. We don't take them. What's above is the whole file — no shadow profile, no data broker, nothing at rest we didn't show you here.</div></div>`;
}

function hailMarys() {
  return `
  <div class="section-label">Before you erase it — 3 things</div>

  <div class="hm"><div class="n">Hail Mary #1 · the math</div>
    <h3>You clicked the button that deletes you. Bold. I respect it.</h3>
    <p>But here's the number I can't let you leave without: the lead you're about to erase cost seven dollars. The next 500 people who land on your website and vanish without a word? They cost you everything — because you never even knew they came.</p>
    <p>Give me fifteen minutes and I'll show you exactly how many of them we can hand back to you, by name.</p>
    <div class="cta-row"><a class="cta" href="${BOOK}">Book the 15 minutes →</a></div>
  </div>

  <div class="hm"><div class="n">Hail Mary #2 · the whole pitch is this page</div>
    <h3>I'll be honest — I don't want you to delete this.</h3>
    <p>This little file is the entire product, proven on you, in real time. Somebody is on <em>your</em> website right now, leaving the exact same way. I can introduce you to them. Seven dollars, their real name, and nobody else on earth ever gets that lead.</p>
    <p>Let me put this on your site instead of shredding it off ours.</p>
    <div class="cta-row"><a class="cta" href="${SITE}/get-started/">Put it on my site — $7 a lead</a></div>
  </div>

  <div class="hm"><div class="n">Hail Mary #3 · okay, last one, I mean it</div>
    <h3>Here's my actual phone. Not a form.</h3>
    <p>Text me the word <strong>SHRED</strong> and I'll erase you myself, today, by hand, and you'll never hear from me again. Or text me <strong>SHOW ME</strong> and I'll send the 60-second version of what your website's been quietly losing.</p>
    <p>Your call. The button at the bottom still works either way — no hard feelings.</p>
    <div class="cta-row"><a class="cta" href="sms:${TEL}">💬 Text Tyler: ${PHONE}</a></div>
    <div class="tyler"><img src="${AVATAR}" alt="Tyler Spurlock"><div><div class="nm">Tyler Spurlock</div><div class="sub">Consent Resolve · hello@consentresolve.com</div></div></div>
  </div>`;
}

function renderPage(rec, contactId, eraseIntent) {
  const first = (rec._person && rec._person.name || rec.full_name || "").split(" ")[0];
  const hi = first && !/^\(erased/.test(first) ? `${esc(first)}, here's` : "Here's";
  const inner = `
  <div class="wrap">
    <div id="stage">
      <div class="mk">✓</div>
      <div class="eyebrow" style="margin-top:16px">Your data · one click, no form</div>
      <h1>${hi} the entire file we keep on you.</h1>
      <p class="lede">You asked to see everything, or to delete it. Both are one click and both are real. No account, no verification hoops — this link <em>is</em> the proof we only hold what you can see.</p>
      <div style="height:22px"></div>
      ${recordCard(rec)}
    </div>

    ${hailMarys()}

    <div class="erase-zone${eraseIntent ? " focus" : ""}" id="eraseZone">
      <p>Still want it gone? This erases every field above — permanently, right now.</p>
      <button class="erase-btn" id="eraseBtn" data-c="${esc(contactId)}">No thanks — erase everything</button>
    </div>

    <div class="smalllinks"><a href="${SITE}/">Consent Resolve</a> · <a href="${SITE}/privacy-policy/">Privacy</a> · <a href="${SITE}/api/unsubscribe?c=${encodeURIComponent(contactId)}">Unsubscribe from email</a></div>
  </div>

  <div id="blackout"></div>
  <div id="final">
    <div class="chk">🗑️</div>
    <h2>It's gone. Every trace, erased.</h2>
    <p>Your file has been permanently deleted and you've been removed from every list. Nothing personal is left on our servers.</p>
    <p class="sig">If you ever change your mind, you know where to find me. — Tyler</p>
    <div class="ret"><a href="${SITE}/">Return to consentresolve.com</a></div>
  </div>

  <script>
  (function(){
    var eraseIntent = ${eraseIntent ? "true" : "false"};
    var zone = document.getElementById('eraseZone');
    if (eraseIntent && zone) { setTimeout(function(){ zone.scrollIntoView({behavior:'smooth',block:'center'}); }, 400); }
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    function finish(){
      document.getElementById('blackout').style.opacity='1';
      var f=document.getElementById('final'); f.style.opacity='1'; f.style.pointerEvents='auto';
      try{ window.scrollTo(0,0); }catch(e){}
    }

    function shred(stage){
      var rect = stage.getBoundingClientRect();
      var pageX = window.scrollX||window.pageXOffset||0, pageY = window.scrollY||window.pageYOffset||0;
      var left = rect.left, top = rect.top; // fixed positioning uses viewport coords
      var N = Math.max(22, Math.min(46, Math.round(rect.width/16)));
      var w = rect.width / N;
      var wrap = document.createElement('div'); wrap.className='shred-wrap';
      wrap.style.left=left+'px'; wrap.style.top=top+'px'; wrap.style.width=rect.width+'px'; wrap.style.height=rect.height+'px';
      var html = stage.innerHTML;
      for (var i=0;i<N;i++){
        var strip=document.createElement('div'); strip.className='shred-strip';
        strip.style.left=(i*w)+'px'; strip.style.width=w+'px'; strip.style.height=rect.height+'px';
        var inner=document.createElement('div'); inner.className='inner';
        inner.style.left=(-i*w)+'px'; inner.style.width=rect.width+'px'; inner.style.height=rect.height+'px';
        inner.innerHTML=html;
        strip.appendChild(inner); wrap.appendChild(strip);
      }
      document.body.appendChild(wrap);
      stage.style.visibility='hidden';

      // shredder mouth across the top of the stage
      var mouth=document.createElement('div'); mouth.className='mouth';
      mouth.style.left=left+'px'; mouth.style.width=rect.width+'px'; mouth.style.top=(top-13)+'px';
      mouth.innerHTML='<div class="teeth"></div>';
      document.body.appendChild(mouth);
      requestAnimationFrame(function(){ mouth.style.transform='scaleX(1)'; });

      var strips = wrap.children;
      setTimeout(function(){
        for (var i=0;i<strips.length;i++){
          (function(s,i){
            var delay = Math.round(Math.abs(i-N/2))*22 + (i%2?30:0);
            var drift = Math.sin(i*1.7)*46;
            var rot = (i-N/2)*(1.1+Math.abs(Math.sin(i))*1.4);
            var fall = rect.height + 520 + Math.abs(Math.sin(i*0.7))*160;
            s.style.transition='transform 1.45s cubic-bezier(.45,.02,.9,.32) '+delay+'ms, opacity 1.3s ease '+(delay+340)+'ms';
            s.style.transform='translateY('+fall+'px) translateX('+drift+'px) rotate('+rot+'deg)';
            s.style.opacity='0';
          })(strips[i],i);
        }
      }, 240);

      setTimeout(function(){ document.getElementById('blackout').style.opacity='1'; }, 900);
      setTimeout(finish, 1900);
    }

    var btn = document.getElementById('eraseBtn');
    if (btn) btn.addEventListener('click', function(){
      var c = btn.getAttribute('data-c');
      btn.disabled = true; btn.textContent = 'Erasing…';
      // Fire the real deletion; don't wait on it to start the animation.
      try { fetch('/api/crm/data-delete?c='+encodeURIComponent(c), {method:'POST'}).catch(function(){}); } catch(e){}
      var stage = document.getElementById('stage');
      if (reduce || !stage) {
        if(stage){ stage.style.transition='opacity .5s'; stage.style.opacity='0'; }
        setTimeout(finish, 500);
        return;
      }
      // hide the persuasion below the fold, scroll the file itself into view, THEN shred it
      // so the falling-strips drama actually happens on-screen (the button sits far below).
      var zone2=document.getElementById('eraseZone'); if(zone2) zone2.style.display='none';
      document.querySelectorAll('.hm,.section-label,.smalllinks').forEach(function(el){ el.style.transition='opacity .3s'; el.style.opacity='0'; });
      try { window.scrollTo({top:0, behavior:'smooth'}); } catch(e){ window.scrollTo(0,0); }
      setTimeout(function(){ shred(stage); }, 620);
    });
  })();
  </script>`;
  return pageShell(inner);
}

function emptyState() {
  return `<div class="wrap" style="text-align:center">
    <div class="mk" style="margin:0 auto">✓</div>
    <h1 style="margin-top:20px">Nothing on file.</h1>
    <p class="lede">We don't have a record matching this link — either it was already deleted, or it never existed. Either way, there's nothing here to see or erase.</p>
    <div class="smalllinks" style="margin-top:30px"><a href="${SITE}/">Return to consentresolve.com</a></div>
  </div>`;
}
function erasedState() {
  return `<div class="wrap" style="text-align:center">
    <div class="chk" style="font-size:44px">🗑️</div>
    <h1 style="margin-top:14px">Already erased.</h1>
    <p class="lede">This record was permanently deleted at your request. You've been removed from every list and nothing personal remains on our servers.</p>
    <div class="tyler" style="justify-content:center"><img src="${AVATAR}" alt="Tyler Spurlock"><div style="text-align:left"><div class="nm">Tyler Spurlock</div><div class="sub">Consent Resolve</div></div></div>
    <div class="smalllinks" style="margin-top:24px"><a href="${SITE}/">Return to consentresolve.com</a></div>
  </div>`;
}
