// worker/crm-changelog.js
// A tiny chat-style changelog for the CRM at /crm/changelog — every feature, fix,
// and change rendered as a chronological message thread. Same cr_crm auth gate as
// /crm/app. Data lives in CHANGELOG below; add a new entry at the TOP of its day.
import { isAuthed, crmSessionEmail } from "./_lib/auth.js";

// type: "feature" | "fix" | "change". Newest day last (chat reads top→bottom, latest
// at the bottom like a real thread). Within a day, list in the order they happened.
const CHANGELOG = [
  // ---- July 2026 · foundations ----
  { date: "2026-07-10", time: "9:12 AM",  type: "feature", title: "CRM launched — unified inbox", body: "Two-way Gmail inbox on hello@, lead detail with editable stage / owner / value, and a full activity timeline." },
  { date: "2026-07-12", time: "2:40 PM",  type: "feature", title: "Dashboards", body: "Per-industry funnel, ad-spend + ROAS tracking, and a read-only social calendar." },
  { date: "2026-07-15", time: "11:05 AM", type: "feature", title: "Source ingest", body: "Leads flow in automatically from RB2B, Instantly (via Gmail), site chat, Apollo, and Meta lead forms." },
  { date: "2026-07-20", time: "4:22 PM",  type: "feature", title: "Lead scoring", body: "Behavior scoring with hot / warm / cold tiers and a 60-day decay, surfaced right in the inbox." },
  { date: "2026-07-24", time: "10:18 AM", type: "feature", title: "Prospecting tab", body: "A shared business database with filters and one-click promote-to-lead." },
  { date: "2026-07-28", time: "3:31 PM",  type: "feature", title: "Conversation threading", body: "Messages threaded by person and company, newest first — no more scattered one-offs." },
  { date: "2026-07-30", time: "1:07 PM",  type: "fix",     title: "Deleted conversations stay deleted", body: "Tombstones stop re-ingested email/social threads from resurrecting on the next sync." },

  // ---- Aug 3, 2026 ----
  { date: "2026-08-03", time: "10:20 AM", type: "feature", title: "Identified-visitor email sequence", body: "Editable subject / body / cadence preview in Sequences; every send attaches to the conversation thread." },
  { date: "2026-08-03", time: "11:48 AM", type: "feature", title: "Consent-receipt landing page", body: "A cinematic data / erase page — a homeowner can view their record or delete it in one click." },
  { date: "2026-08-03", time: "1:36 PM",  type: "feature", title: "Manual reply by SMS or Email", body: "Reply to any Open conversation on either channel — identified visitors included." },
  { date: "2026-08-03", time: "2:05 PM",  type: "change",  title: "Pause = human takeover", body: "The Open box is human-owned. A manual reply pauses automation so Mack and sequences never reply on top of a rep. Survives a refresh." },
  { date: "2026-08-03", time: "3:14 PM",  type: "feature", title: "Send status / failure log", body: "Every SMS and email drops a ✓ sent / ✗ failed line right in the conversation window." },
  { date: "2026-08-03", time: "3:52 PM",  type: "change",  title: "Team CC on email replies", body: "Email replies CC tyler@, jbeyke@, and aaron@ — and the CC is shown in the composer." },
  { date: "2026-08-03", time: "4:30 PM",  type: "change",  title: "One Auto menu", body: "Consolidated the two Auto controls into a single ▶ Auto menu: enroll in a sequence or subscribe to the newsletter." },

  // ---- Aug 4, 2026 ----
  { date: "2026-08-04", time: "9:40 AM",  type: "feature", title: "Sender-labeled chat bubbles", body: "SMS / chat bubbles now show who sent each line — the phone number inbound, 🤖 Mack or the rep's name outbound." },
  { date: "2026-08-04", time: "11:15 AM", type: "fix",     title: "SMS replies actually send", body: "Inbound texts were mistyped as un-repliable “website chat,” and the number lost its country code. SMS is now its own channel, repliable, with correct +1 dialing." },
  { date: "2026-08-04", time: "11:30 AM", type: "change",  title: "Chatwoot retired", body: "SMS and website chat run through Retell / Mack now; site chat shows as “Site chat · Mack” instead of Chatwoot." },
  { date: "2026-08-04", time: "1:05 PM",  type: "fix",     title: "No more resurrecting conversations", body: "Self-sent digests (like “SEO weekly”) are no longer filed as conversations, and website-chat threads are tombstone-guarded — deletes finally stick." },
  { date: "2026-08-04", time: "1:40 PM",  type: "feature", title: "Email / SMS toggle in the composer", body: "When a contact has both an email and a phone on file, the bottom bar lets you pick either channel." },
  { date: "2026-08-04", time: "3:10 PM",  type: "fix",     title: "Facebook leads verified", body: "Confirmed ~91 Meta lead-form leads are flowing into the inbox — an earlier “zero” was a display-filter false alarm, not a real outage. Webhook + ingest are healthy." },
];

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PILL = { feature: ["Feature", "#00b985"], fix: ["Fix", "#f59e0b"], change: ["Change", "#3b82f6"] };
const fmtDay = (iso) => { try { return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z")); } catch (_) { return iso; } };

function render() {
  let out = "", lastDay = "";
  const counts = { feature: 0, fix: 0, change: 0 };
  for (const e of CHANGELOG) {
    counts[e.type] = (counts[e.type] || 0) + 1;
    if (e.date !== lastDay) { out += `<div class="day"><span>${esc(fmtDay(e.date))}</span></div>`; lastDay = e.date; }
    const [label, color] = PILL[e.type] || ["Update", "#64748b"];
    out += `<div class="msg">
      <div class="bubble">
        <div class="mh"><span class="pill" style="background:${color}1a;color:${color}">${label}</span><span class="ttl">${esc(e.title)}</span></div>
        <div class="body">${esc(e.body)}</div>
        <div class="time">${esc(e.time || "")}</div>
      </div>
    </div>`;
  }
  return { html: out, counts, total: CHANGELOG.length };
}

export async function handle({ request, env }) {
  const authed = (await isAuthed(request, env)) || (await crmSessionEmail(request, env));
  if (!authed) {
    return new Response(`<!doctype html><meta charset=utf-8><title>Sign in</title><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#eef2f6"><a href="/api/crm/auth/login?next=/crm/changelog" style="background:#00b985;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px">Sign in with Google</a></body>`,
      { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  const { html, counts, total } = render();
  const page = `<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content="noindex">
<title>CRM Changelog</title>
<style>
  :root{--mint:#00b985;--navy:#0e1c2e;--ink:#0e1c2e;--tx2:#48586a;--line:rgba(15,32,53,.10);--bg:#eef2f6;--surface:#fff}
  *{box-sizing:border-box}
  body{margin:0;height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
  header{display:flex;align-items:center;gap:12px;padding:14px 20px;background:var(--navy);color:#fff;box-shadow:0 2px 12px -4px rgba(15,32,53,.4);z-index:2}
  header .mk{width:32px;height:32px;border-radius:9px;background:var(--mint);display:grid;place-items:center;font-weight:800;font-size:17px}
  header h1{font-size:16px;margin:0;font-weight:700;line-height:1.1}
  header .sub{font-size:12px;color:#9fb0c3;margin-top:2px}
  header a.back{margin-left:auto;color:#cfe;text-decoration:none;font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,.25);padding:7px 13px;border-radius:8px}
  header a.back:hover{background:rgba(255,255,255,.08)}
  .legend{display:flex;gap:14px;padding:9px 20px;background:var(--surface);border-bottom:1px solid var(--line);font-size:12px;color:var(--tx2);flex-wrap:wrap}
  .legend b{color:var(--ink)}
  .legend .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:1px}
  .thread{flex:1;overflow-y:auto;padding:18px 16px 26px;display:flex;flex-direction:column;gap:12px;max-width:760px;width:100%;margin:0 auto}
  .day{display:flex;align-items:center;justify-content:center;margin:14px 0 4px}
  .day span{background:rgba(15,32,53,.06);color:var(--tx2);font-size:11.5px;font-weight:700;letter-spacing:.02em;padding:5px 12px;border-radius:999px;text-transform:uppercase}
  .msg{display:flex}
  .bubble{background:var(--surface);border:1px solid var(--line);border-radius:16px;border-top-left-radius:5px;padding:12px 15px;max-width:82%;box-shadow:0 10px 26px -20px rgba(15,32,53,.3);animation:pop .25s ease-out both}
  @keyframes pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  .mh{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
  .pill{font-size:10.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;padding:2px 8px;border-radius:999px}
  .ttl{font-weight:700;font-size:14.5px;color:var(--ink)}
  .body{font-size:13.5px;line-height:1.5;color:var(--tx2)}
  .time{font-size:11px;color:#9aa7b6;margin-top:6px;text-align:right}
  .composer{border-top:1px solid var(--line);background:var(--surface);padding:12px 16px}
  .composer .box{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:10px;background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:10px 16px;color:#9aa7b6;font-size:13px}
  @media (prefers-color-scheme:dark){
    :root{--bg:#0b1523;--surface:#13233a;--ink:#e7eef6;--tx2:#9fb2c6;--line:rgba(255,255,255,.09)}
    body{color:var(--ink)} .day span{background:rgba(255,255,255,.06)}
  }
</style></head>
<body>
  <header>
    <div class=mk>✓</div>
    <div><h1>CRM Changelog</h1><div class=sub>${total} updates · every feature, fix &amp; change</div></div>
    <a class=back href="/crm/app">← Back to CRM</a>
  </header>
  <div class=legend>
    <span><span class=dot style="background:#00b985"></span><b>${counts.feature || 0}</b> features</span>
    <span><span class=dot style="background:#f59e0b"></span><b>${counts.fix || 0}</b> fixes</span>
    <span><span class=dot style="background:#3b82f6"></span><b>${counts.change || 0}</b> changes</span>
  </div>
  <div class=thread id=thread>${html}</div>
  <div class=composer><div class=box>📜 Read-only — this is the CRM's history, updated as we ship.</div></div>
  <script>var t=document.getElementById('thread');if(t)t.scrollTop=t.scrollHeight;</script>
</body></html>`;
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
