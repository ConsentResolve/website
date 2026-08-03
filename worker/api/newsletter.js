// worker/api/newsletter.js
//   GET  /api/newsletter/optin?c=&a=yes|no&t=   -> public opt-in/out landing (from re-perm emails)
//   GET  /api/newsletter                         -> admin: status summary
//   POST /api/newsletter {action}                -> admin: enroll_repermission | run | send_test
// Admin actions gated by the CRM session; the opt-in landing is public (HMAC-token protected).
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed } from "../_lib/crm.js";
import { isAdmin } from "../_lib/crm-v2.js";
import { ensureNewsletterSchema, enrollRepermission, runRepermission, handleOptin, resendSend, decideSend, nlConfig, setNlSettings, handlePoll, sendIssue, runReengagement } from "../_lib/newsletter.js";
import { loadIssues, loadIssue, saveIssue } from "../_lib/newsletter-issues.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

function page(title, body) {
  return new Response(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content="noindex">
     <title>${title}</title><body style="font-family:-apple-system,system-ui,Arial,sans-serif;background:#0e1c2e;color:#eaf2f8;min-height:100vh;margin:0;display:grid;place-items:center;padding:24px">
     <div style="max-width:460px;text-align:center;background:#14263c;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:34px 28px">
     <div style="font-size:34px;margin-bottom:8px">✓</div><h1 style="font-size:21px;margin:0 0 8px">${title}</h1>${body}</div></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  await ensureNewsletterSchema(env);

  // Public opt-in landing (clicked from a re-permission email button).
  if (url.pathname.endsWith("/optin")) {
    const c = url.searchParams.get("c") || "";
    const a = url.searchParams.get("a") === "yes" ? "yes" : "no";
    const t = url.searchParams.get("t") || "";
    const res = await handleOptin(env, c, a, t);
    if (!res.ok) return page("Link expired", `<p style="color:#9fb3c6">That link isn't valid anymore. No problem — just reply to any of our emails and we'll sort it out.</p>`);
    if (res.status === "opted_in") return page("You're on the list.", `<p style="color:#9fb3c6">Thanks — you'll get one useful issue a month, and nothing else. First one's on its way.</p>`);
    return page("All set — you're off the list.", `<p style="color:#9fb3c6">We won't email you the newsletter. No hard feelings. The door's always open if you change your mind.</p>`);
  }

  // Public poll tap (from a newsletter segmentation question). Captures + scores, then thanks.
  if (url.pathname.endsWith("/poll")) {
    const res = await handlePoll(env, {
      contactId: url.searchParams.get("c") || "", field: url.searchParams.get("f") || "",
      value: url.searchParams.get("v") || "", issue: url.searchParams.get("i") || "", token: url.searchParams.get("t") || "",
    });
    if (!res.ok) return page("Got it", `<p style="color:#9fb3c6">Thanks for the tap.</p>`);
    return page("Thanks — noted.", `<p style="color:#9fb3c6">That one tap changes what we send you next. Talk soon.</p>`);
  }

  // Admin status summary.
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  if (!(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);
  const s = (await env.DB.prepare(
    `SELECT COALESCE(newsletter_status,'pending') st, COUNT(*) n FROM contacts WHERE primary_email IS NOT NULL GROUP BY st`
  ).all()).results || [];
  const byStatus = Object.fromEntries(s.map((r) => [r.st, r.n]));
  const inSeq = (await env.DB.prepare("SELECT COUNT(*) n FROM contacts WHERE repermission_step BETWEEN 1 AND 4").first())?.n || 0;
  const cfg = await nlConfig(env);
  return json({
    ok: true,
    sending: cfg.enabled ? "LIVE" : "simulate",
    how_to_go_live: cfg.enabled ? undefined : "POST {action:'set_settings', enabled:true, test_emails:'you@…'} — survives deploys (D1-backed)",
    from: env.NEWSLETTER_FROM || "Aaron Phillips <aaron@tryconsentresolve.com>",
    reply_to: env.NEWSLETTER_REPLY_TO || "hello@consentresolve.com",
    resend_key_set: !!env.NEWSLETTER_RESEND_KEY,
    test_allowlist: cfg.allow,
    contacts_by_newsletter_status: byStatus, in_repermission_sequence: inSeq,
  }, {}, cors);
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);
  await ensureNewsletterSchema(env);
  let b = {}; try { b = await request.json(); } catch (_) {}
  const action = b.action || "";
  // Admin-only = the sensitive, org-wide actions (settings, editing/sending issues, bulk run).
  // Enrolling a single lead in the newsletter is an everyday sales action any CRM user can do.
  const ADMIN_ONLY = new Set(["set_settings", "run", "save_issue", "send_issue"]);
  if (ADMIN_ONLY.has(action) && !(await isAdmin(request, env))) return json({ error: "forbidden" }, { status: 403 }, cors);

  if (action === "set_settings") {
    const patch = {};
    if (b.enabled !== undefined) patch.enabled = b.enabled === true || b.enabled === "true" || b.enabled === "1" ? "1" : "0";
    if (b.test_emails !== undefined) patch.test_emails = String(b.test_emails || "");
    await setNlSettings(env, patch);
    return json({ ok: true, config: await nlConfig(env) }, {}, cors);
  }
  if (action === "enroll_repermission") {
    return json({ ok: true, ...(await enrollRepermission(env, { contactIds: b.contact_ids })) }, {}, cors);
  }
  if (action === "run") {
    return json({ ok: true, ...(await runRepermission(env, {})) }, {}, cors);
  }
  if (action === "issues") {
    const issues = await loadIssues(env);
    // Per-issue send stats (how many opted-in readers already got it).
    const sentCounts = Object.fromEntries(((await env.DB.prepare("SELECT issue_id, COUNT(*) n FROM newsletter_issue_log GROUP BY issue_id").all().catch(() => ({ results: [] }))).results || []).map((r) => [r.issue_id, r.n]));
    return json({ ok: true, issues: issues.map((i) => ({ id: i.id, month: i.month, cep: i.cep, subject: (i.subjects || [])[0] || "", has_poll: !!i.poll, sent: sentCounts[i.id] || 0 })) }, {}, cors);
  }
  if (action === "get_issue") {
    const issue = await loadIssue(env, String(b.issue || b.issue_id || "").padStart(2, "0"));
    return issue ? json({ ok: true, issue }, {}, cors) : json({ error: "unknown_issue" }, { status: 404 }, cors);
  }
  if (action === "save_issue") {
    const id = String(b.issue || b.issue_id || "").padStart(2, "0");
    const fields = b.fields || {};
    return json(await saveIssue(env, id, fields), {}, cors);
  }
  // Hold-for-approval: preview (dry) shows recipients + rendered HTML; confirm:true actually sends.
  if (action === "send_issue" || action === "preview_issue") {
    const issueId = String(b.issue || b.issue_id || "").padStart(2, "0");
    const confirm = action === "send_issue" && b.confirm === true;
    return json(await sendIssue(env, { issueId, confirm }), {}, cors);
  }
  if (action === "reengage_run") {
    return json({ ok: true, ...(await runReengagement(env, {})) }, {}, cors);
  }
  if (action === "send_test") {
    const to = String(b.to || "").trim();
    if (!to) return json({ error: "need 'to'" }, { status: 400 }, cors);
    const res = await resendSend(env, { to, subject: "Test — Consent Resolve newsletter path", html: "<p>If you got this, the Resend / tryconsentresolve.com path works. Reply-To is hello@consentresolve.com.</p>", text: "Resend path works. Reply-To is hello@consentresolve.com." });
    return json({ ok: res.ok, act: res.act, id: res.id || null, decide: decideSend(await nlConfig(env), to), error: res.error || null }, {}, cors);
  }
  return json({ error: "unknown_action", actions: ["enroll_repermission", "run", "send_test"] }, { status: 400 }, cors);
}
