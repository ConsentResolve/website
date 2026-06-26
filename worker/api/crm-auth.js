// CRM user auth via Google sign-in (replaces ?key in the URL).
//   GET /api/crm/auth/login    -> redirect to Google consent
//   GET /api/crm/auth/callback -> exchange code, verify email allowlist, set cr_crm cookie
//   GET /api/crm/auth/logout   -> clear cookie
//   GET /api/crm/auth/me       -> { email } | { email:null }  (for the header)
// Reuses the Gmail OAuth client (GMAIL_/GOOGLE_CLIENT_ID+SECRET). The Google client
// must list this callback as an Authorized redirect URI. Allowlist: CRM_ALLOWED_EMAILS.
import { json } from "../_lib/http.js";
import { gClientId, gClientSecret, emailFromIdToken } from "../_lib/gmail.js";
import { createUserSession, crmSessionCookie, crmClearCookie, crmSessionEmail, emailAllowed } from "../_lib/auth.js";

const origin = (request, env) => env.SITE_URL || new URL(request.url).origin;
const cbUri = (request, env) => origin(request, env) + "/api/crm/auth/callback";
const html = (body, status) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consent Resolve CRM</title><body style="margin:0;background:#0a1628;color:#e2e8f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center"><div style="max-width:360px">${body}</div></body>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/crm/auth/me") {
    return json({ email: await crmSessionEmail(request, env) }, { headers: { "Cache-Control": "no-store" } });
  }

  if (path === "/api/crm/auth/logout") {
    return new Response(null, { status: 302, headers: { Location: "/crm", "Set-Cookie": crmClearCookie() } });
  }

  if (path === "/api/crm/auth/login") {
    if (!gClientId(env)) return html("<p>Sign-in not configured yet (set GMAIL_CLIENT_ID / GOOGLE_CLIENT_ID).</p>", 503);
    const next = url.searchParams.get("next") || "/crm";
    const p = new URLSearchParams({
      client_id: gClientId(env), redirect_uri: cbUri(request, env), response_type: "code",
      scope: "openid email profile", access_type: "online", prompt: "select_account", state: next,
    });
    return Response.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + p.toString(), 302);
  }

  if (path === "/api/crm/auth/callback") {
    const code = url.searchParams.get("code");
    let next = url.searchParams.get("state") || "/crm";
    if (!next.startsWith("/crm")) next = "/crm";
    if (!code) return html("<p>Sign-in failed (no code).</p>", 400);
    let tok = {};
    try {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: gClientId(env), client_secret: gClientSecret(env), redirect_uri: cbUri(request, env), grant_type: "authorization_code" }),
      });
      tok = await r.json();
    } catch (_) {}
    const email = emailFromIdToken(tok.id_token || "");
    if (!email) return html("<p>Could not read your Google email.</p>", 400);
    if (!emailAllowed(env, email)) {
      return html(`<div style="font-size:18px;font-weight:600;color:#f08a8a">Access denied</div><p style="color:#94a3b8;margin-top:12px"><b>${email}</b> isn't on the CRM allowlist. Ask an admin to add it to CRM_ALLOWED_EMAILS.</p>`, 403);
    }
    const sess = await createUserSession(env, email);
    return new Response(null, { status: 302, headers: { Location: next, "Set-Cookie": crmSessionCookie(sess) } });
  }

  return new Response("not found", { status: 404 });
}
