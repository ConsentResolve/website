// Google Ads API — connection + read helpers for the internal CRM (our own single account).
// OAuth (adwords scope) refresh token lives in D1 "google_ads" (set by the in-CRM Connect flow);
// developer token + login-customer-id are Cloudflare secrets. Inert until configured.
//   secrets: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_LOGIN_CUSTOMER_ID, GOOGLE_CLIENT_ID/SECRET
import { getTokens, saveTokens } from "./publish.js";

// Google Ads API versions get sunset ~yearly. Probe newest→oldest and use the first that
// isn't a 404, so we self-heal across version churn. Pin with GOOGLE_ADS_API_VERSION if needed.
function apiVersions(env) {
  return env.GOOGLE_ADS_API_VERSION ? [String(env.GOOGLE_ADS_API_VERSION)] : ["v23", "v22", "v21", "v20", "v19", "v18"];
}
const gurl = (ver, path) => "https://googleads.googleapis.com/" + ver + path;

export function googleAdsConfigured(env) {
  return !!(env.GOOGLE_ADS_DEVELOPER_TOKEN && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

// Access token from the adwords-scope refresh token (D1, set by Connect Google Ads).
export async function gadsAccessToken(env) {
  const t = await getTokens(env, "google_ads");
  const refresh = (t && t.refresh_token) || env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !refresh) return null;
  if (t && t.access_token && t.expires_at && new Date(t.expires_at) > new Date(Date.now() + 60000)) return t.access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refresh }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.access_token) return null;
  await saveTokens(env, "google_ads", { access_token: d.access_token, refresh_token: refresh, expires_at: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString() });
  return d.access_token;
}

function adsHeaders(env, token) {
  const h = { Authorization: "Bearer " + token, "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN, "Content-Type": "application/json" };
  if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) h["login-customer-id"] = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/-/g, "");
  return h;
}

// Connection probe: lists the accounts the token can access (no customer-id needed). This
// surfaces whether the dev token + OAuth + (Basic) access are all live.
export async function googleAdsStatus(env) {
  if (!googleAdsConfigured(env)) return { configured: false };
  const t = await getTokens(env, "google_ads");
  const hasToken = !!(t && t.refresh_token) || !!env.GOOGLE_ADS_REFRESH_TOKEN;
  const out = { configured: true, hasToken, connected: false, loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null, customers: [] };
  if (!hasToken) { out.note = "Not connected — click Connect Google Ads."; return out; }
  const token = await gadsAccessToken(env);
  if (!token) { out.error = "token refresh failed — reconnect"; return out; }
  let lastErr = "all API versions returned 404 — enable the Google Ads API in the Cloud project, or set GOOGLE_ADS_API_VERSION";
  for (const ver of apiVersions(env)) {
    try {
      const res = await fetch(gurl(ver, "/customers:listAccessibleCustomers"), { headers: adsHeaders(env, token) });
      if (res.status === 404) { lastErr = `version ${ver}: 404`; continue; } // bad/sunset version — try next
      const d = await res.json().catch(() => ({}));
      out.apiVersion = ver;
      if (!res.ok) { out.error = (d.error && d.error.message) || ("http " + res.status); return out; }
      out.connected = true;
      out.customers = (d.resourceNames || []).map((r) => String(r).split("/").pop());
      return out;
    } catch (e) { lastErr = String(e).slice(0, 120); }
  }
  out.error = lastErr;
  return out;
}

// Read conversion actions (GAQL) for a customer — used to auto-resolve the on-site conversion
// label. Returns [{ name, id, tagSnippetLabel? }]. Requires GOOGLE_ADS_CUSTOMER_ID.
export async function listConversionActions(env, customerId) {
  const cid = String(customerId || env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  if (!cid) return { ok: false, error: "no_customer_id" };
  const token = await gadsAccessToken(env);
  if (!token) return { ok: false, error: "no_token" };
  const query = "SELECT conversion_action.id, conversion_action.name, conversion_action.type, conversion_action.status, conversion_action.tag_snippets FROM conversion_action";
  let lastErr = "all API versions 404";
  for (const ver of apiVersions(env)) {
    const res = await fetch(gurl(ver, "/customers/" + cid + "/googleAds:search"), {
      method: "POST", headers: adsHeaders(env, token), body: JSON.stringify({ query }),
    });
    if (res.status === 404) { lastErr = `version ${ver}: 404`; continue; }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (d.error && d.error.message) || ("http " + res.status) };
    const rows = (d.results || []).map((r) => {
      const ca = r.conversionAction || {};
      let label = null;
      for (const ts of (ca.tagSnippets || [])) {
        const m = /AW-\d+\/([\w-]+)/.exec(ts.eventSnippet || ts.globalSiteTag || "");
        if (m) { label = m[1]; break; }
      }
      return { id: ca.id, name: ca.name, type: ca.type, status: ca.status, label };
    });
    return { ok: true, apiVersion: ver, conversionActions: rows };
  }
  return { ok: false, error: lastErr };
}
