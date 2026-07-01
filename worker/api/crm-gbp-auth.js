// Google Business Profile connect — browser re-auth, no local creds (mirrors the Gmail flow).
//   GET /api/crm/gbp/auth     -> redirect to Google consent (scope business.manage), gated
//   GET /api/crm/gbp/callback -> exchange code -> store refresh token in D1 (provider "google")
//   GET /api/crm/gbp/status   -> { configured, redirect_uri, connected }
// Uses the GOOGLE_CLIENT_ID/SECRET already in Cloudflare. The stored refresh token self-heals
// postGBP (publish.js googleAccessToken prefers the D1 token). Register the redirect_uri below
// as an Authorized redirect URI on the OAuth client.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, crmKey } from "../_lib/crm.js";
import { gBase } from "../_lib/gmail.js";
import { getTokens, saveTokens, googleAccessToken } from "../_lib/publish.js";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/business.manage";

const redirectUri = (env) => gBase(env) + "/api/crm/gbp/callback";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const cors = corsHeaders(request, env);

  // Callback returns from Google with no cookie — authenticate via state (the CRM key).
  if (path === "/api/crm/gbp/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    const err = url.searchParams.get("error");
    if (err) return new Response("Google denied: " + err, { status: 400 });
    if (state !== crmKey(env)) return new Response("bad state", { status: 403 });
    if (!code) return new Response("missing code", { status: 400 });
    const res = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri(env) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.refresh_token) {
      return new Response("No refresh_token returned (Google omits it unless prompt=consent + access_type=offline, which we send — try revoking prior access at myaccount.google.com/permissions and reconnect). " + JSON.stringify(data).slice(0, 200), { status: 400 });
    }
    await saveTokens(env, "google", {
      access_token: data.access_token || null,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    });
    return Response.redirect(gBase(env) + "/crm/status?key=" + encodeURIComponent(state) + "&gbp=connected", 302);
  }

  // CRM session, OR ?key=<FEEDBACK_KEY> for the read-only status/locations probes.
  const keyed = env.FEEDBACK_KEY && url.searchParams.get("key") === env.FEEDBACK_KEY;
  const readPath = path === "/api/crm/gbp/status" || path === "/api/crm/gbp/locations";
  if (!(await crmAuthed(request, env)) && !(keyed && readPath)) return json({ error: "unauthorized" }, { status: 401 }, cors);

  if (path === "/api/crm/gbp/auth") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return json({ error: "no_client", message: "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET must be set in Cloudflare." }, { status: 400 }, cors);
    }
    const state = url.searchParams.get("key") || crmKey(env);
    const u = AUTH + "?" + new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(env), response_type: "code",
      scope: SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
    }).toString();
    return Response.redirect(u, 302);
  }

  if (path === "/api/crm/gbp/status") {
    const t = await getTokens(env, "google");
    return json({
      configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      redirect_uri: redirectUri(env),
      connected: !!(t && t.refresh_token),
      account_id: env.GBP_ACCOUNT_ID || null, location_id: env.GBP_LOCATION_ID || null,
    }, {}, cors);
  }

  // Discover the account + location IDs using the stored token (Account-Mgmt + Business-Info
  // APIs) — so the IDs can be set from the CRM without the gbp_ids.py CLI.
  if (path === "/api/crm/gbp/locations") {
    const token = await googleAccessToken(env);
    if (!token) return json({ error: "no_token", message: "Connect / re-auth GBP first." }, { status: 400 }, cors);
    const aRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: "Bearer " + token } });
    const aData = await aRes.json().catch(() => ({}));
    if (!aRes.ok) return json({ error: "accounts_failed", status: aRes.status, detail: (aData.error && aData.error.message) || "" }, { status: 200 }, cors);
    const accounts = [];
    for (const a of (aData.accounts || [])) {
      const accId = String(a.name || "").split("/")[1] || "";
      let locs = [];
      try {
        const lRes = await fetch("https://mybusinessbusinessinformation.googleapis.com/v1/" + a.name + "/locations?readMask=name,title&pageSize=100", { headers: { Authorization: "Bearer " + token } });
        const lData = await lRes.json().catch(() => ({}));
        locs = (lData.locations || []).map((l) => ({ location_id: String(l.name || "").split("/").pop(), title: l.title || "" }));
      } catch (_) {}
      accounts.push({ account_id: accId, account_name: a.accountName || "", locations: locs });
    }
    return json({ ok: true, accounts }, {}, cors);
  }

  return json({ error: "not_found" }, { status: 404 }, cors);
}
