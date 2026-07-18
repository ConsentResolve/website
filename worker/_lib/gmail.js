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

function b64url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// RFC 2047 encoded-word for header values with non-ASCII (em-dashes, accents, emoji).
// Raw UTF-8 bytes in a header make Gmail double-encode them into mojibake (a spam signal).
function encodeHeader(s) {
  const str = String(s || "");
  if (/^[\x20-\x7E]*$/.test(str)) return str;              // pure ASCII → leave as-is
  const bytes = new TextEncoder().encode(str);
  let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "=?UTF-8?B?" + btoa(bin) + "?=";
}

// Search a connected inbox for the thread with a lead (messages from/to them).
export async function searchThread(env, account, leadEmail, max) {
  const tok = await gAccessToken(env, account);
  if (!tok) return { error: "no_token" };
  const q = encodeURIComponent("from:" + leadEmail + " OR to:" + leadEmail);
  const lr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=" + (max || 8) + "&q=" + q, { headers: { Authorization: "Bearer " + tok } });
  const lj = await lr.json();
  if (lj.error) return { error: (lj.error && lj.error.message) || "list_failed" };
  const ids = (lj.messages || []).map((m) => m.id);
  const msgs = [];
  for (const id of ids) {
    const mr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + id + "?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date", { headers: { Authorization: "Bearer " + tok } });
    const m = await mr.json();
    if (m.error) continue;
    const h = {}; ((m.payload && m.payload.headers) || []).forEach((x) => { h[x.name.toLowerCase()] = x.value; });
    msgs.push({ id: m.id, threadId: m.threadId, from: h.from || "", subject: h.subject || "", date: h.date || "", snippet: m.snippet || "", fromMe: (h.from || "").toLowerCase().indexOf(account.toLowerCase()) > -1 });
  }
  msgs.reverse();
  return { messages: msgs, threadId: msgs.length ? msgs[msgs.length - 1].threadId : null, lastSubject: msgs.length ? msgs[msgs.length - 1].subject : "" };
}

// Send (or reply, if threadId) as the connected account. `opts.headers` adds extra RFC-822
// headers (e.g. List-Unsubscribe) — values must be ASCII.
export async function sendMessage(env, account, to, subject, body, threadId, opts) {
  const tok = await gAccessToken(env, account);
  if (!tok) return { error: "no_token" };
  // Strip CR/LF from any value interpolated into the header block — `to` can come
  // from unvalidated lead data, so a crafted address must not inject headers.
  const noCrlf = (v) => String(v == null ? "" : v).replace(/[\r\n]+/g, " ").trim();
  const extra = opts && opts.headers
    ? Object.keys(opts.headers).map((k) => noCrlf(k) + ": " + noCrlf(opts.headers[k]) + "\r\n").join("") : "";
  const raw = b64url("To: " + noCrlf(to) + "\r\nSubject: " + encodeHeader(subject) + "\r\n" + extra + "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + body);
  const payload = { raw }; if (threadId) payload.threadId = threadId;
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (j.error) return { error: (j.error && j.error.message) || "send_failed" };
  return { ok: true, id: j.id, threadId: j.threadId };
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
