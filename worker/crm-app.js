// worker/crm-app.js
// Serves the FROZEN CRM-rebuild frontend (built from proto/screens/inbox-artifact.html)
// at /crm/app, behind the same Google (cr_crm) auth gate as the legacy /crm.
// Additive: the legacy /crm keeps working untouched during cutover.
//
// STATUS: this serves the frozen design running on its bundled demo fixtures — the
// shell, live behind login. The fixture->fetch data swap (per-screen wiring to the
// new /api/crm/* endpoints) is the next step; see MORNING-HANDOFF.md.
import APP_HTML from "./crm-app.html";
import { isAuthed } from "./_lib/auth.js";
import { crmSessionEmail } from "./_lib/auth.js";

const LOGIN_HTML = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Consent Resolve CRM — sign in</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#eef2f6;font-family:system-ui,sans-serif;color:#0e1c2e}
.card{background:#fff;border:1px solid rgba(15,32,53,.11);border-radius:14px;padding:34px 30px;text-align:center;box-shadow:0 18px 44px -26px rgba(15,32,53,.28);max-width:340px}
.mk{width:34px;height:34px;border-radius:9px;background:#00b985;color:#fff;display:grid;place-items:center;font-size:19px;margin:0 auto 14px;font-weight:800}
h1{font-size:18px;margin:0 0 6px} p{color:#48586a;font-size:14px;margin:0 0 20px}
a{display:inline-block;background:#00b985;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px;font-size:14px}</style>
<div class=card><div class=mk>✓</div><h1>Consent Resolve CRM</h1><p>Sign in with your Consent Resolve Google account.</p>
<a href="/api/crm/auth/login?next=/crm/app">Sign in with Google</a></div>`;

export async function handle({ request, env }) {
  const authed = (await isAuthed(request, env)) || (await crmSessionEmail(request, env));
  if (!authed) {
    return new Response(LOGIN_HTML, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return new Response(APP_HTML, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
