// Gmail two-way for the CRM. Per-account OAuth (the sending Google accounts);
// refresh tokens stored in social_tokens as provider 'gmail:<email>'. Reuses the
// GBP Google token-refresh approach. Client creds: GMAIL_CLIENT_ID/SECRET, or
// fall back to the existing GOOGLE_CLIENT_ID/SECRET (add the Gmail scopes + the
// /api/crm/gmail/callback redirect URI to that OAuth client if reusing).

import { nowIso } from "./db.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "openid",
  "email",
].join(" ");

export function gClientId(env) { return env.GMAIL_CLIENT_ID || env.GOOGLE_CLIENT_ID || ""; }
export function gClientSecret(env) { return env.GMAIL_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || ""; }
export function gBase(env) { return (env.BASE_URL || "https://consentresolve.com").replace(/\/$/, ""); }
export function gRedirect(env) { return gBase(env) + "/api/crm/gmail/callback"; }

export async function ensureTokens(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS social_tokens (provider TEXT PRIMARY KEY, access_token TEXT, refresh_token TEXT, expires_at TEXT, updated_at TEXT)"
  ).run();
}

export function gAuthUrl(env, state) {
  const p = new URLSearchParams({
    client_id: gClientId(env), redirect_uri: gRedirect(env), response_type: "code",
    scope: SCOPES, access_type: "offline", prompt: "consent", include_granted_scopes: "true",
    state: state || "",
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}

export async function gExchange(env, code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: gClientId(env), client_secret: gClientSecret(env), redirect_uri: gRedirect(env) }),
  });
  return res.json();
}

export function emailFromIdToken(idToken) {
  try {
    const part = (idToken || "").split(".")[1] || "";
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return (json.email || "").toLowerCase();
  } catch (_) { return ""; }
}

export async function saveGmail(env, email, data) {
  await ensureTokens(env);
  const expires_at = data.expires_in ? new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString() : null;
  await env.DB.prepare(
    "INSERT INTO social_tokens (provider, access_token, refresh_token, expires_at, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET access_token=excluded.access_token, refresh_token=COALESCE(excluded.refresh_token, social_tokens.refresh_token), expires_at=excluded.expires_at, updated_at=excluded.updated_at"
  ).bind("gmail:" + email, data.access_token || null, data.refresh_token || null, expires_at, nowIso()).run();
}

export async function listGmailAccounts(env) {
  await ensureTokens(env);
  const rows = (await env.DB.prepare("SELECT provider, updated_at FROM social_tokens WHERE provider LIKE 'gmail:%'").all()).results || [];
  return rows.map((r) => ({ email: r.provider.slice(6), connected_at: r.updated_at }));
}

export async function gAccessToken(env, email) {
  await ensureTokens(env);
  const row = await env.DB.prepare("SELECT * FROM social_tokens WHERE provider=?").bind("gmail:" + email).first();
  if (!row || !row.refresh_token) return null;
  if (row.access_token && row.expires_at && new Date(row.expires_at) > new Date(Date.now() + 60000)) return row.access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: gClientId(env), client_secret: gClientSecret(env), refresh_token: row.refresh_token }),
  });
  const data = await res.json();
  if (!data.access_token) return null;
  const expires_at = new Date(Date.now() + ((data.expires_in || 3500) - 60) * 1000).toISOString();
  await env.DB.prepare("UPDATE social_tokens SET access_token=?, expires_at=?, updated_at=? WHERE provider=?")
    .bind(data.access_token, expires_at, nowIso(), "gmail:" + email).run();
  return data.access_token;
}
