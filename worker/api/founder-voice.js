// worker/api/founder-voice.js
//   GET  /founder-voice[?key=<CRM_KEY>]        -> the intake page (prefilled), for Andy
//   GET  /founder-voice?json=1                 -> saved answers as JSON (admin read)
//   POST /founder-voice                        -> save answers
// Gated like the CRM app: an admin/CRM session, OR ?key=<CRM_KEY>. Captures CEO Andy Mentges's
// voice for the field-kit newsletter — 8 prompts, one editable D1 row (id='andy').
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, crmKey } from "../_lib/crm.js";
import { crmSessionEmail } from "../_lib/auth.js";

// Only Andy fills this out. Match the signed-in CRM email against his (overridable via env).
async function isAndy(request, env) {
  const e = (await crmSessionEmail(request, env).catch(() => "")) || "";
  const andy = (env.ANDY_EMAIL || "andy@consentresolve.com").toLowerCase();
  return e.toLowerCase() === andy;
}

export const QUESTIONS = [
  { k: "why", q: "Why did you start Consent Resolve — the real reason, in your words?" },
  { k: "first_sign", q: "The first-yard-sign or first-customer moment that stuck with you." },
  { k: "angry", q: "What about the shared-lead / reseller world actually makes you angry?" },
  { k: "phrases", q: "Three phrases you catch yourself saying all the time." },
  { k: "customer", q: "Describe your favorite kind of contractor customer." },
  { k: "belief", q: "A belief about marketing most people in this space would disagree with." },
  { k: "feel", q: "What do you want a contractor to FEEL when they read your newsletter?" },
  { k: "flywheel", q: "A story where the flywheel (signs → leads → more signs) clicked for someone." },
];

async function ensureSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS founder_voice (id TEXT PRIMARY KEY, answers TEXT, updated_at TEXT)`).run().catch(() => {});
}
async function gate(request, env) {
  if (await crmAuthed(request, env)) return true;
  const k = new URL(request.url).searchParams.get("key") || request.headers.get("x-cr-key") || "";
  return Boolean(k) && k === crmKey(env);
}
async function loadAnswers(env) {
  await ensureSchema(env);
  const r = await env.DB.prepare("SELECT answers, updated_at FROM founder_voice WHERE id='andy'").first().catch(() => null);
  let answers = {};
  try { answers = r && r.answers ? JSON.parse(r.answers) : {}; } catch (_) {}
  return { answers, updated_at: r ? r.updated_at : null };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await isAndy(request, env))) return json({ ok: false, error: "forbidden" }, { status: 403 }, cors);
  await ensureSchema(env);
  const body = await request.json().catch(() => ({}));
  const incoming = body.answers || {};
  const clean = {};
  for (const { k } of QUESTIONS) clean[k] = String(incoming[k] || "").slice(0, 4000);
  await env.DB.prepare(`INSERT OR REPLACE INTO founder_voice (id, answers, updated_at) VALUES ('andy', ?, datetime('now'))`)
    .bind(JSON.stringify(clean)).run();
  const saved = await loadAnswers(env);
  return json({ ok: true, updated_at: saved.updated_at }, {}, cors);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);
  if (!(await gate(request, env))) {
    if (url.searchParams.get("json")) return json({ ok: false, error: "unauthorized" }, { status: 403 }, cors);
    return new Response(lockedPage(), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  const { answers, updated_at } = await loadAnswers(env);
  if (url.searchParams.get("json")) return json({ ok: true, answers, updated_at, questions: QUESTIONS, is_andy: await isAndy(request, env) }, {}, cors);
  return new Response(page(answers, updated_at, url.searchParams.get("key") || ""), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function lockedPage() {
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex>
<title>Founder Voice</title><body style="font-family:-apple-system,system-ui,Arial,sans-serif;background:#0a1628;color:#eaf2f8;min-height:100vh;margin:0;display:grid;place-items:center;padding:24px">
<div style="max-width:440px;text-align:center;background:#12263c;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:34px 28px">
<div style="font-size:30px">🔒</div><h1 style="font-size:20px;margin:10px 0 6px">Founder Voice</h1>
<p style="color:#9fb3c6;font-size:14px">This page is private. Open it from the link Aaron sent you (it carries your access key), or sign in to the CRM first.</p></div></body>`;
}

function page(answers, updatedAt, key) {
  const fields = QUESTIONS.map((qq, i) => `
    <div style="margin:0 0 22px">
      <label style="display:block;font-weight:700;font-size:15px;margin:0 0 8px;color:#0a1628">
        <span style="color:#00a37a;font-family:ui-monospace,monospace;font-size:12px;margin-right:8px">${String(i + 1).padStart(2, "0")}</span>${esc(qq.q)}
      </label>
      <textarea data-k="${qq.k}" rows="4" placeholder="In your own words…" style="width:100%;box-sizing:border-box;border:1px solid #cfdae6;border-radius:10px;padding:12px 14px;font:inherit;font-size:15px;line-height:1.5;resize:vertical;background:#fff;color:#0a1628">${esc(answers[qq.k] || "")}</textarea>
    </div>`).join("");

  return `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex>
<title>Founder Voice — Andy Mentges</title>
<style>body{margin:0;font-family:-apple-system,system-ui,Segoe UI,Arial,sans-serif;background:#eef3f8;color:#0a1628}
.wrap{max-width:680px;margin:0 auto;padding:28px 20px 80px}
.card{background:#fff;border:1px solid #e2ebf3;border-radius:18px;padding:28px 26px;box-shadow:0 12px 40px -24px rgba(10,22,40,.5)}
.hero{background:linear-gradient(160deg,#0d1b2a,#0a1628);color:#eaf2f8;border-radius:18px;padding:26px 26px 22px;margin-bottom:16px}
.hero h1{margin:0 0 6px;font-size:22px}.hero p{margin:0;color:#9fb3c6;font-size:14px;line-height:1.55}
.bar{position:fixed;left:0;right:0;bottom:0;background:#0a1628;color:#eaf2f8;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 20px}
.bar .msg{font-size:13px;color:#9fb3c6}
button{border:0;background:#00e5a0;color:#04120b;font-weight:800;font-size:15px;padding:12px 22px;border-radius:10px;cursor:pointer}
textarea:focus{outline:2px solid #00c98d;border-color:#00c98d}</style></head>
<body><div class="wrap">
  <div class="hero"><h1>Andy — talk to me for 15 minutes.</h1>
  <p>I'm writing the field-kit newsletter in your voice, so I want the real thing, not my impression of it. Answer these however you actually talk — messy, funny, blunt, whatever. There are no wrong answers, and it saves as you go. — the team</p></div>
  <div class="card">${fields}</div>
</div>
<div class="bar"><span class="msg" id="msg">Autosaves as you type.</span><button id="save">Save</button></div>
<script>
  var KEY=${JSON.stringify(key)};
  function collect(){var o={};document.querySelectorAll('textarea[data-k]').forEach(function(t){o[t.getAttribute('data-k')]=t.value;});return o;}
  function post(){
    var msg=document.getElementById('msg');msg.textContent='Saving…';
    var headers={'Content-Type':'application/json'};if(KEY)headers['X-CR-Key']=KEY;
    return fetch(location.pathname+(KEY?('?key='+encodeURIComponent(KEY)):''),{method:'POST',headers:headers,body:JSON.stringify({answers:collect()})})
      .then(function(r){return r.json();}).then(function(d){msg.textContent=d&&d.ok?('Saved '+new Date().toLocaleTimeString()):'Save failed — check your link.';})
      .catch(function(){msg.textContent='Save failed — check your connection.';});
  }
  var t;document.querySelectorAll('textarea[data-k]').forEach(function(el){el.addEventListener('input',function(){clearTimeout(t);t=setTimeout(post,1200);});});
  document.getElementById('save').addEventListener('click',post);
</script></body></html>`;
}
