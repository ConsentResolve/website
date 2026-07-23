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
  return new Response(APP_HTML + BOOTSTRAP, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// Fixture→fetch bootstrap: runs after the frozen render code, pulls real data from
// /api/crm/app and swaps it into the window globals the render layer reads. Only the
// keys we can back with real data are overridden; every other screen keeps its
// fixtures (graceful, incremental). Fails silent → app still works on fixtures.
const BOOTSTRAP = `<script>
(async () => {
  var snap = {
    convs: window.DATA && window.DATA.conversations, counts: window.DATA && window.DATA.counts,
    CL: window.CONSENT_LEDGER, CS: window.CONSENT_STATS, SEQ: window.SEQUENCES, SS: window.SITE_SOURCES, SPY: window.SITESPY, NUR: window.NURTURE, PIPE: window.PIPELINE, AN: window.ANALYTICS
  };
  var d;
  try {
    var r = await fetch('/api/crm/app', { credentials: 'same-origin' });
    if (!r.ok) return;                 // not signed in / error -> keep fixtures
    d = await r.json();
  } catch (e) { return; }
  try {
    if (d.CONSENT_LEDGER) window.CONSENT_LEDGER = d.CONSENT_LEDGER;
    if (d.CONSENT_STATS)  window.CONSENT_STATS = d.CONSENT_STATS;
    if (d.SEQUENCES && d.SEQUENCES.length) window.SEQUENCES = d.SEQUENCES;
    if (d.SITE_SOURCES) window.SITE_SOURCES = d.SITE_SOURCES;
    if (d.SITESPY && d.SITESPY.visitors && d.SITESPY.visitors.length) window.SITESPY = d.SITESPY;
    if (d.NURTURE && d.NURTURE.pool && d.NURTURE.pool.length) window.NURTURE = d.NURTURE;
    if (d.PIPELINE && d.PIPELINE.length) window.PIPELINE = d.PIPELINE;
    if (d.ANALYTICS && d.ANALYTICS.kpis) window.ANALYTICS = d.ANALYTICS;
    if (d.me && window.DATA) window.DATA.me = d.me;
    if (d.DATA_CONVERSATIONS && d.DATA_CONVERSATIONS.length && window.DATA) {
      window.DATA.conversations = d.DATA_CONVERSATIONS;
      if (d.DATA_COUNTS) window.DATA.counts = d.DATA_COUNTS;
    }
    if (window.renderConsent) window.renderConsent();
    if (window.renderSequences) window.renderSequences();
    if ((d.SITE_SOURCES || d.SITESPY) && window.renderSiteSpy) window.renderSiteSpy();
    if (d.NURTURE && window.renderNurture) window.renderNurture();
    if (d.PIPELINE && d.PIPELINE.length && window.renderPipeline) window.renderPipeline();
    if (d.ANALYTICS && d.ANALYTICS.kpis && window.renderAnalytics) window.renderAnalytics();
    if (d.DATA_CONVERSATIONS && d.DATA_CONVERSATIONS.length && window.renderList) {
      window.renderList('open');
      if (window.recount) window.recount();
      if (window.select && window.DATA.conversations[0]) window.select(window.DATA.conversations[0].id);
    }
  } catch (e) {
    // FAIL-SAFE: any render error -> restore the demo fixtures so the app never breaks
    try {
      if (window.DATA) { window.DATA.conversations = snap.convs; window.DATA.counts = snap.counts; }
      window.CONSENT_LEDGER = snap.CL; window.CONSENT_STATS = snap.CS; window.SEQUENCES = snap.SEQ; window.SITE_SOURCES = snap.SS; window.SITESPY = snap.SPY; window.NURTURE = snap.NUR; window.PIPELINE = snap.PIPE; window.ANALYTICS = snap.AN;
      if (window.renderList) window.renderList('open');
      if (window.recount) window.recount();
      if (window.select && window.DATA && window.DATA.conversations[0]) window.select(window.DATA.conversations[0].id);
      if (window.renderConsent) window.renderConsent();
      if (window.renderSequences) window.renderSequences();
      if (window.renderSiteSpy) window.renderSiteSpy();
      if (window.renderNurture) window.renderNurture();
      if (window.renderPipeline) window.renderPipeline();
      if (window.renderAnalytics) window.renderAnalytics();
    } catch (_) {}
    if (window.console) console.warn('crm/app: live-data swap failed, reverted to fixtures', e);
  }
})();
</script>`;
