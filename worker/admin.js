// Authenticated admin — /admin*
//
// Served by the Worker (dynamic). Gated by a session cookie (worker/_lib/auth.js).
// Capabilities:
//   • Preview every resource's OG card + 7 platform posts (from build-time
//     social.json) and links to feeds.
//   • Live social-queue actions against D1 (the runtime-mutable surface):
//       - Generate / enqueue a resource's pack (all 7 platforms)
//       - Enqueue ALL resources
//       - Per platform: set status (ready_to_publish | scheduled | published)
//         and record the live post URL.
//
// NOTE: resource CONTENT (the markdown + its `status:` frontmatter) lives in git
// and is edited through the normal repo/PR flow — it can't be rewritten at
// runtime on a static deploy. This admin manages the queue + previews.

import { isAuthed, checkPassword, createSession, sessionCookie, clearCookie, adminConfigured } from "./_lib/auth.js";
import { readBuckets, enqueue, updateStatus, VALID_STATUS } from "./_lib/queue.js";
import { json } from "./_lib/http.js";

const NOSTORE = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function redirect(to, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: to, ...headers } });
}
function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/><title>${esc(title)} · Consent Resolve Admin</title>
<style>
  :root{--navy:#0a1628;--navy2:#11203a;--mint:#00e5a0;--ink:#e2e8f0;--muted:#94a3b8;--rule:rgba(255,255,255,.12);--card:#0f1d34}
  *{box-sizing:border-box}body{margin:0;background:var(--navy);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif}
  a{color:var(--mint)}header{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;border-bottom:1px solid var(--rule)}
  .brand{font-weight:800;letter-spacing:.02em}.brand .dot{color:var(--mint)}
  main{max-width:1080px;margin:0 auto;padding:28px}
  .row{display:grid;grid-template-columns:96px 1fr auto;gap:16px;align-items:center;padding:14px;border:1px solid var(--rule);border-radius:14px;background:var(--card);margin-bottom:12px}
  .row img{width:96px;height:64px;object-fit:cover;border-radius:8px;background:#fff}
  .title{font-weight:700}.meta{color:var(--muted);font-size:13px;margin-top:2px}
  .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .chip{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--rule);color:var(--muted)}
  .chip.ready{border-color:#475569}.chip.scheduled{border-color:#b45309;color:#fbbf24}.chip.published{border-color:var(--mint);color:var(--mint)}
  .btn{cursor:pointer;border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px}
  .btn.p{background:var(--mint);color:var(--navy)}.btn.g{background:transparent;color:var(--ink);border:1px solid var(--rule)}
  .actions{display:flex;gap:8px;flex-direction:column}
  .panel{grid-column:1/-1;margin-top:12px;border-top:1px dashed var(--rule);padding-top:12px;display:none}
  .panel.open{display:block}
  .pf{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
  .pcard{border:1px solid var(--rule);border-radius:10px;padding:12px;background:var(--navy2)}
  .pcard h4{margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mint)}
  .pcard p{margin:6px 0;font-size:13px;color:var(--ink)}
  .pcard .ht{color:var(--muted);font-size:12px}
  .pcard select,.pcard input{width:100%;margin-top:6px;padding:6px;border-radius:6px;border:1px solid var(--rule);background:var(--navy);color:var(--ink)}
  .summary{display:flex;gap:18px;margin-bottom:20px;color:var(--muted)}
  .summary b{color:var(--ink)}
  .toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--mint);color:var(--navy);font-weight:700;padding:10px 18px;border-radius:10px;opacity:0;transition:opacity .2s}
  .toast.show{opacity:1}
  form.login{max-width:340px;margin:80px auto;padding:28px;border:1px solid var(--rule);border-radius:16px;background:var(--card)}
  form.login input{width:100%;padding:11px;margin:10px 0;border-radius:8px;border:1px solid var(--rule);background:var(--navy);color:var(--ink)}
  .err{color:#fca5a5;font-size:13px}
</style></head><body>${body}<div class="toast" id="toast"></div></body></html>`;
}

function loginPage(error = "") {
  return new Response(
    shell("Login", `<form class="login" method="POST" action="/admin/login">
      <div class="brand">Consent Resolve <span class="dot">●</span> Admin</div>
      <p style="color:#94a3b8;font-size:13px">Resource Center — content distribution.</p>
      ${error ? `<p class="err">${esc(error)}</p>` : ""}
      <input type="password" name="password" placeholder="Password" autofocus required/>
      <button class="btn p" type="submit" style="width:100%">Sign in</button>
    </form>`),
    { status: error ? 401 : 200, headers: NOSTORE }
  );
}

async function handleLogin(request, env) {
  const form = await request.formData().catch(() => null);
  const pw = form ? form.get("password") : "";
  if (!checkPassword(env, pw)) return loginPage("Incorrect password.");
  const token = await createSession(env);
  return redirect("/admin/", { "Set-Cookie": sessionCookie(token) });
}

async function loadIndex(request, env) {
  const res = await env.ASSETS.fetch(new Request(new URL("/resources/index.json", request.url)));
  if (!res.ok) return { items: [] };
  return res.json();
}

async function dashboard(request, env) {
  const [{ items = [] }, buckets] = await Promise.all([loadIndex(request, env), readBuckets(env)]);

  // queue map: slug -> platform -> row
  const qmap = {};
  for (const status of Object.keys(buckets)) {
    for (const r of buckets[status]) {
      (qmap[r.resource_slug] ||= {})[r.platform] = r;
    }
  }
  const counts = {
    published: (buckets.published || []).length,
    scheduled: (buckets.scheduled || []).length,
    ready_to_publish: (buckets.ready_to_publish || []).length,
  };

  const rows = items
    .map((it) => {
      const q = qmap[it.slug] || {};
      const chips = it.platforms
        .map((p) => {
          const st = q[p]?.status;
          const cls = st ? st.replace("_to_publish", "") : "";
          return `<span class="chip ${cls}" title="${p}">${p.split("_")[0]}${st ? "·" + cls : ""}</span>`;
        })
        .join("");
      return `<div class="row" data-slug="${esc(it.slug)}" data-type="${esc(it.resource_type)}" data-social="${esc(it.social_json)}">
        <img src="${esc(it.thumbnail)}" alt=""/>
        <div>
          <div class="title">${esc(it.title)}</div>
          <div class="meta">${esc(it.type_segment)} · content: <b>${esc(it.status)}</b> · <a href="${esc(it.url)}" target="_blank">view</a> · <a href="${esc(it.social_json)}" target="_blank">social.json</a></div>
          <div class="chips">${chips}</div>
        </div>
        <div class="actions">
          <button class="btn p" onclick="enqueueOne(this)">Generate pack</button>
          <button class="btn g" onclick="togglePanel(this)">Preview ▼</button>
        </div>
        <div class="panel"></div>
      </div>`;
    })
    .join("");

  const body = `<header>
      <div class="brand">Consent Resolve <span class="dot">●</span> Admin</div>
      <div><a href="/admin/logout">Sign out</a></div>
    </header>
    <main>
      <div class="summary">
        <div><b>${items.length}</b> resources</div>
        <div><b>${counts.ready_to_publish}</b> ready</div>
        <div><b>${counts.scheduled}</b> scheduled</div>
        <div><b>${counts.published}</b> published</div>
        <button class="btn g" onclick="enqueueAll()">Enqueue ALL packs</button>
      </div>
      ${rows || "<p>No resources found.</p>"}
    </main>
    <script>
      const PLATFORMS = ${JSON.stringify(items[0]?.platforms || [])};
      const QUEUE = ${JSON.stringify(qmap)};
      function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);}
      async function action(payload){
        const r=await fetch('/admin/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        return r.json();
      }
      async function fetchSocial(row){
        const r=await fetch(row.dataset.social);return r.json();
      }
      async function enqueueOne(btn){
        const row=btn.closest('.row');const sj=await fetchSocial(row);
        const items=PLATFORMS.map(p=>({platform:p,payload:sj.social[p]})).filter(x=>x.payload);
        const res=await action({op:'enqueue',slug:row.dataset.slug,type:row.dataset.type,items});
        toast(res.ok?('Enqueued '+res.enqueued+' platforms'):'Error');
      }
      async function enqueueAll(){
        const rows=[...document.querySelectorAll('.row')];let n=0;
        for(const row of rows){const sj=await fetchSocial(row);const items=PLATFORMS.map(p=>({platform:p,payload:sj.social[p]})).filter(x=>x.payload);const res=await action({op:'enqueue',slug:row.dataset.slug,type:row.dataset.type,items});if(res.ok)n+=res.enqueued;}
        toast('Enqueued '+n+' rows. Reloading…');setTimeout(()=>location.reload(),900);
      }
      async function togglePanel(btn){
        const row=btn.closest('.row');const panel=row.querySelector('.panel');
        if(panel.classList.contains('open')){panel.classList.remove('open');return;}
        panel.classList.add('open');panel.innerHTML='Loading…';
        const sj=await fetchSocial(row);const q=QUEUE[row.dataset.slug]||{};
        panel.innerHTML='<div style="margin:8px 0"><img src="'+sj.open_graph.image+'" alt="" style="max-width:420px;width:100%;border-radius:10px"/></div><div class="pf">'+
          PLATFORMS.map(p=>{const v=sj.social[p]||{};const st=(q[p]&&q[p].status)||'';
            return '<div class="pcard"><h4>'+p.replace(/_/g,' ')+'</h4>'+
              (v.title?'<p><b>'+esc(v.title)+'</b></p>':'')+
              '<p>'+esc(v.caption||v.hook||'')+'</p>'+
              (v.hashtags&&v.hashtags.length?'<p class="ht">'+v.hashtags.map(h=>'#'+esc(h)).join(' ')+'</p>':'')+
              '<p class="ht"><a href="'+esc(v.utm_url)+'" target="_blank">tracked link</a></p>'+
              '<select data-slug="'+row.dataset.slug+'" data-platform="'+p+'">'+
                ['','ready_to_publish','scheduled','published'].map(o=>'<option value="'+o+'"'+(o===st?' selected':'')+'>'+(o||'— not queued —')+'</option>').join('')+
              '</select>'+
              '<input placeholder="post URL (optional)" data-url value="'+esc((q[p]&&q[p].post_url)||'')+'"/>'+
              '<button class="btn g" style="margin-top:8px" onclick="saveStatus(this)">Save</button>'+
            '</div>';}).join('')+'</div>';
      }
      function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
      async function saveStatus(btn){
        const card=btn.closest('.pcard');const sel=card.querySelector('select');const url=card.querySelector('input[data-url]').value;
        const status=sel.value;if(!status){toast('Pick a status');return;}
        const res=await action({op:'status',slug:sel.dataset.slug,platform:sel.dataset.platform,status,post_url:url});
        toast(res.ok?'Saved':(res.error||'Error'));
      }
    </script>`;
  return new Response(shell("Dashboard", body), { headers: NOSTORE });
}

async function handleAction(request, env) {
  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: "bad_json" }, { status: 400 });
  }
  if (b.op === "enqueue") {
    if (!b.slug || !b.type || !Array.isArray(b.items)) return json({ error: "missing_fields" }, { status: 400 });
    const n = await enqueue(env, b.slug, b.type, b.items);
    return json({ ok: true, enqueued: n });
  }
  if (b.op === "status") {
    if (!b.slug || !b.platform || !VALID_STATUS.has(b.status)) return json({ error: "bad_fields" }, { status: 400 });
    const changed = await updateStatus(env, { resource_slug: b.slug, platform: b.platform, status: b.status, post_url: b.post_url });
    if (!changed) return json({ error: "not_found_enqueue_first" }, { status: 404 });
    return json({ ok: true, updated: changed });
  }
  return json({ error: "unknown_op" }, { status: 400 });
}

export async function handle(context) {
  const { request, env } = context;
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/admin";

  if (!adminConfigured(env)) {
    return new Response(
      shell("Setup", `<main><h2>Admin not configured</h2><p>Set the <code>ADMIN_PASSWORD</code> and <code>ADMIN_SESSION_SECRET</code> secrets in Cloudflare, then redeploy.</p></main>`),
      { status: 503, headers: NOSTORE }
    );
  }

  if (path === "/admin/login") {
    if (request.method === "POST") return handleLogin(request, env);
    if (await isAuthed(request, env)) return redirect("/admin/");
    return loginPage();
  }
  if (path === "/admin/logout") {
    return redirect("/admin/login", { "Set-Cookie": clearCookie() });
  }

  if (!(await isAuthed(request, env))) return redirect("/admin/login");

  if (path === "/admin/action" && request.method === "POST") return handleAction(request, env);

  return dashboard(request, env);
}
