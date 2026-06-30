// Google Ads connect — browser re-auth, no local creds (mirrors the GBP flow).
//   GET /api/crm/gads/auth     -> redirect to Google consent (scope adwords), gated
//   GET /api/crm/gads/callback -> exchange code -> store refresh token in D1 (provider "google_ads")
//   GET /api/crm/gads/status   -> connection probe via the Google Ads API
// Register the redirect_uri (below) as an Authorized redirect URI on the same OAuth client.
import { json, corsHeaders } from "../_lib/http.js";
import { crmAuthed, crmKey } from "../_lib/crm.js";
import { gBase } from "../_lib/gmail.js";
import { saveTokens } from "../_lib/publish.js";
import { googleAdsStatus } from "../_lib/google-ads.js";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/adwords";

const redirectUri = (env) => gBase(env) + "/api/crm/gads/callback";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const cors = corsHeaders(request, env);

  if (path === "/api/crm/gads/callback") {
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
      return new Response("No refresh_token returned (revoke prior access at myaccount.google.com/permissions, then reconnect). " + JSON.stringify(data).slice(0, 200), { status: 400 });
    }
    await saveTokens(env, "google_ads", {
      access_token: data.access_token || null,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    });
    return Response.redirect(gBase(env) + "/crm/status?key=" + encodeURIComponent(state) + "&gads=connected", 302);
  }

  if (!(await crmAuthed(request, env))) return json({ error: "unauthorized" }, { status: 401 }, cors);

  if (path === "/api/crm/gads/auth") {
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

  if (path === "/api/crm/gads/status") {
    const s = await googleAdsStatus(env);
    return json({ ...s, redirect_uri: redirectUri(env), has_dev_token: !!env.GOOGLE_ADS_DEVELOPER_TOKEN }, {}, cors);
  }

  return json({ error: "not_found" }, { status: 404 }, cors);
}
