// CRM user auth via Google sign-in (replaces ?key in the URL).
//   GET /api/crm/auth/login    -> redirect to Google consent
//   GET /api/crm/auth/callback -> exchange code, verify email allowlist, set cr_crm cookie
//   GET /api/crm/auth/logout   -> clear cookie
//   GET /api/crm/auth/me       -> { email } | { email:null }  (for the header)
// Reuses the Gmail OAuth client (GMAIL_/GOOGLE_CLIENT_ID+SECRET). The Google client
// must list this callback as an Authorized redirect URI. Allowlist: CRM_ALLOWED_EMAILS.
import { json } from "../_lib/http.js";
import { gClientId, gClientSecret } from "../_lib/gmail.js";
import { createUserSession, crmSessionCookie, crmClearCookie, crmSessionEmail } from "../_lib/auth.js";

// Decode a Google id_token payload (no signature check needed — it came straight
// from Google's token endpoint over TLS). Returns {email, email_verified, hd, ...}.
function decodeJwt(idToken) {
  try { return JSON.parse(atob(((idToken || "").split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/"))); }
  catch { return {}; }
}
// Lock sign-in to a Workspace org via the `hd` (hosted-domain) claim
// (CRM_ALLOWED_DOMAIN) and/or a specific email allowlist (CRM_ALLOWED_EMAILS).
// At least one gate must be configured, and email must be verified.
function allowed(env, claims) {
  if (!claims.email || claims.email_verified === false) return false;
  const domain = (env.CRM_ALLOWED_DOMAIN || "").toLowerCase().trim();
  const list = (env.CRM_ALLOWED_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (!domain && !list.length) return false;                               // must configure a gate
  if (domain && (claims.hd || "").toLowerCase() !== domain) return false;  // org/domain lock
  if (list.length && !list.includes(claims.email.toLowerCase())) return false;
  return true;
}

const origin = (request, env) => env.SITE_URL || new URL(request.url).origin;
const cbUri = (request, env) => origin(request, env) + "/api/crm/auth/callback";
const html = (body, status) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Consent Resolve CRM</title><body style="margin:0;background:#0a1628;color:#e2e8f0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center"><div style="max-width:360px">${body}</div></body>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/crm/auth/me") {
    const email = await crmSessionEmail(request, env);
    // Apollo has no credit-balance API, so we surface our own spend: enrichments run via
    // the CRM this calendar month (~1 credit each). The header links to Apollo for the
    // true remaining balance.
    let apolloUsed = null;
    if (email && env.DB) {
      try {
        const mo = new Date().toISOString().slice(0, 7) + "-01";
        const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM activities WHERE action='enriched' AND created_at >= ?").bind(mo).first();
        apolloUsed = r ? Number(r.n) : 0;
      } catch (_) {}
    }
    return json({ email, apolloUsed }, { headers: { "Cache-Control": "no-store" } });
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
    if (env.CRM_ALLOWED_DOMAIN) p.set("hd", env.CRM_ALLOWED_DOMAIN); // scope the account picker to the org
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
    const claims = decodeJwt(tok.id_token || "");
    const email = claims.email;
    if (!email) return html("<p>Could not read your Google email.</p>", 400);
    if (!allowed(env, claims)) {
      return html(`<div style="font-size:18px;font-weight:600;color:#f08a8a">Access denied</div><p style="color:#94a3b8;margin-top:12px"><b>${email}</b> isn't allowed. This CRM is locked to its organization — sign in with your company Google account.</p>`, 403);
    }
    const sess = await createUserSession(env, email);
    return new Response(null, { status: 302, headers: { Location: next, "Set-Cookie": crmSessionCookie(sess) } });
  }

  return new Response("not found", { status: 404 });
}
