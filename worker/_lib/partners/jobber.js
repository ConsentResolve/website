// Jobber partner adapter — OAuth 2.0 + GraphQL lead push.
//
// Facts verified against developer.getjobber.com (2026-07-21):
//   authorize:  https://api.getjobber.com/api/oauth/authorize (code grant; &state)
//   token:      POST https://api.getjobber.com/api/oauth/token (form-encoded)
//   graphql:    POST https://api.getjobber.com/api/graphql
//               headers: Authorization Bearer + X-JOBBER-GRAPHQL-VERSION + JSON
//   access tokens are 60-min JWTs (exp in payload); refresh tokens ROTATE when
//   rotation is enabled — always persist the refresh token returned by any
//   token-endpoint call, overwriting the old one.
//   clientCreate auto-captures the app name in Jobber's Lead Source field.
//   Webhooks: base64 HMAC-SHA256 of the raw body with the OAuth client secret
//   in X-Jobber-Hmac-SHA256; APP_DISCONNECT handling is required for
//   marketplace apps; deliveries are at-least-once (dedupe by topic+itemId).
//
// Env: JOBBER_CLIENT_ID, JOBBER_CLIENT_SECRET, JOBBER_GRAPHQL_VERSION (optional).
// V1 is single-connection (our own Jobber account / a design partner's): one
// row per (partner, account_id) in partner_connections; the newest connected
// row wins. Multi-tenant keying comes with the customer dashboard.

const AUTH_URL = "https://api.getjobber.com/api/oauth/authorize";
const TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
const GRAPHQL_URL = "https://api.getjobber.com/api/graphql";

export const jobberVersion = (env) => env.JOBBER_GRAPHQL_VERSION || "2025-04-16";
export const jobberConfigured = (env) => Boolean(env.JOBBER_CLIENT_ID && env.JOBBER_CLIENT_SECRET);

// ── schema (self-initializing, same pattern as crm.js) ──────────────────────
export async function ensurePartnerSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS partner_connections (
      partner TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      status TEXT DEFAULT 'connected',
      connected_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      PRIMARY KEY (partner, account_id)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS partner_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner TEXT NOT NULL,
      account_id TEXT,
      lead_email TEXT,
      payload TEXT,
      result TEXT,
      status TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS partner_webhook_events (
      partner TEXT NOT NULL,
      topic TEXT NOT NULL,
      item_id TEXT,
      account_id TEXT,
      occurred_at TEXT,
      received_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (partner, topic, item_id, occurred_at)
    )`),
  ]);
}

// ── OAuth ───────────────────────────────────────────────────────────────────
export function jobberAuthUrl(env, redirectUri, state) {
  return AUTH_URL + "?" + new URLSearchParams({
    response_type: "code",
    client_id: env.JOBBER_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
  }).toString();
}

async function tokenRequest(env, params) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.JOBBER_CLIENT_ID,
      client_secret: env.JOBBER_CLIENT_SECRET,
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`jobber token ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data; // { access_token, refresh_token } (+ maybe expires_in)
}

// Access tokens are JWTs; the payload exp is authoritative (the token response
// isn't documented to include expires_in). 60s skew; 55-min fallback.
export function accessTokenExpiry(accessToken, expiresIn) {
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp) return new Date(payload.exp * 1000 - 60_000).toISOString();
  } catch { /* not a parseable JWT — fall through */ }
  return new Date(Date.now() + ((expiresIn || 3300) - 60) * 1000).toISOString();
}

export async function exchangeCode(env, code, redirectUri) {
  return tokenRequest(env, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export async function saveConnection(env, { accountId, accountName, accessToken, refreshToken, expiresAt }) {
  await ensurePartnerSchema(env);
  await env.DB.prepare(
    `INSERT INTO partner_connections (partner, account_id, account_name, access_token, refresh_token, expires_at, status, updated_at)
     VALUES ('jobber', ?, ?, ?, ?, ?, 'connected', datetime('now'))
     ON CONFLICT(partner, account_id) DO UPDATE SET
       account_name = excluded.account_name,
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, partner_connections.refresh_token),
       expires_at = excluded.expires_at,
       status = 'connected',
       updated_at = datetime('now')`
  ).bind(accountId, accountName || null, accessToken, refreshToken || null, expiresAt).run();
}

export async function getConnection(env) {
  await ensurePartnerSchema(env);
  return env.DB.prepare(
    "SELECT * FROM partner_connections WHERE partner = 'jobber' AND status = 'connected' ORDER BY connected_at DESC LIMIT 1"
  ).first();
}

export async function markDisconnected(env, accountId) {
  await ensurePartnerSchema(env);
  await env.DB.prepare(
    "UPDATE partner_connections SET status = 'disconnected', access_token = NULL, refresh_token = NULL, updated_at = datetime('now') WHERE partner = 'jobber' AND account_id = ?"
  ).bind(accountId).run();
}

// Refresh rotation: the response may carry a NEW refresh token — persist it
// immediately, or the connection dies on the next refresh.
async function refreshConnection(env, conn) {
  const data = await tokenRequest(env, { grant_type: "refresh_token", refresh_token: conn.refresh_token });
  const expiresAt = accessTokenExpiry(data.access_token, data.expires_in);
  await saveConnection(env, {
    accountId: conn.account_id,
    accountName: conn.account_name,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || conn.refresh_token,
    expiresAt,
  });
  return { ...conn, access_token: data.access_token, refresh_token: data.refresh_token || conn.refresh_token, expires_at: expiresAt };
}

// ── GraphQL ─────────────────────────────────────────────────────────────────
async function gqlRaw(env, accessToken, query, variables) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-JOBBER-GRAPHQL-VERSION": jobberVersion(env),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(variables ? { query, variables } : { query }),
  });
  if (res.status === 401) return { unauthorized: true };
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ...data };
}

// Authenticated query with proactive refresh + one reactive retry on 401.
export async function gql(env, query, variables) {
  let conn = await getConnection(env);
  if (!conn) throw new Error("jobber not connected");
  if (!conn.expires_at || new Date(conn.expires_at) <= new Date()) conn = await refreshConnection(env, conn);
  let out = await gqlRaw(env, conn.access_token, query, variables);
  if (out.unauthorized) {
    conn = await refreshConnection(env, conn);
    out = await gqlRaw(env, conn.access_token, query, variables);
    if (out.unauthorized) throw new Error("jobber 401 after refresh — reconnect required");
  }
  if (out.errors) throw new Error("jobber graphql: " + JSON.stringify(out.errors).slice(0, 300));
  return out.data;
}

export async function fetchAccount(env, accessToken) {
  const out = await gqlRaw(env, accessToken, "{ account { id name } }");
  if (out.unauthorized || out.errors || !out.data?.account) {
    throw new Error("jobber account query failed: " + JSON.stringify(out.errors || out).slice(0, 200));
  }
  return out.data.account;
}

// ── lead push ───────────────────────────────────────────────────────────────
// GraphQL string literals share JSON's escape rules, so JSON.stringify is a
// safe quoting function; enums (MAIN) must stay bare. Inline-literal input
// (per Jobber's own docs sample) also sidesteps pinning the input type's name,
// which has shifted across API versions (ClientCreateInput vs …Attributes).
const q = (s) => JSON.stringify(String(s));

export function splitName(name, email) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return { first: parts[0], last: parts.slice(1).join(" ") };
  if (parts.length === 1) return { first: parts[0], last: "(ConsentResolve)" };
  // Jobber requires lastName; fall back to the email local part.
  return { first: String(email || "lead").split("@")[0], last: "(ConsentResolve)" };
}

export function buildClientCreateMutation(lead) {
  const { first, last } = splitName(lead.name, lead.email);
  const phones = lead.phone
    ? `\n      phones: [{ description: MAIN, primary: true, number: ${q(lead.phone)} }]`
    : "";
  const company = lead.company ? `\n      companyName: ${q(lead.company)}` : "";
  return `mutation {
  clientCreate(
    input: {
      firstName: ${q(first)}
      lastName: ${q(last)}${company}
      emails: [{ description: MAIN, primary: true, address: ${q(lead.email)} }]${phones}
    }
  ) {
    client { id firstName lastName }
    userErrors { message path }
  }
}`;
}

// The consent trail is the product — it rides along as a client note even
// though Jobber has no first-class field for it.
export function buildConsentNote(lead) {
  const c = lead.consent || {};
  const s = lead.session || {};
  const lines = [
    "Recovered by ConsentResolve — consented website visitor.",
    c.ts && `Consent given: ${c.ts}`,
    c.policyVersion && `Policy version: ${c.policyVersion}`,
    c.sourceUrl && `Consent source: ${c.sourceUrl}`,
    s.firstSeen && `First seen: ${s.firstSeen}`,
    Array.isArray(s.pages) && s.pages.length && `Pages viewed: ${s.pages.slice(0, 10).join(", ")}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildNoteMutation(clientId, message) {
  // Confirmed by live GraphiQL introspection (API 2025-04-16, 2026-07-29):
  // the mutation is clientCreateNote (clientNoteCreate no longer exists) and
  // ClientCreateNoteInput = { message: String, attachments, pinned: Boolean,
  // linkedTo }. pinned:true keeps the consent receipt at the top of the
  // client's notes — it's the product's proof artifact, so it should lead.
  // Callers treat note failure as non-fatal either way.
  return `mutation {
  clientCreateNote(clientId: ${q(clientId)}, input: { message: ${q(message)}, pinned: true }) {
    clientNote { id }
    userErrors { message path }
  }
}`;
}

/**
 * Push one normalized RecoveredLead into the connected Jobber account.
 * lead: { email, name?, phone?, company?, consent?: {ts, policyVersion, sourceUrl},
 *         session?: {pages[], firstSeen} }
 * Returns { ok, client_id?, note_ok?, error? } and always logs to partner_deliveries.
 */
export async function pushLead(env, lead) {
  const conn = await getConnection(env);
  const result = { ok: false };
  try {
    if (!conn) throw new Error("jobber not connected");
    if (!lead || !lead.email) throw new Error("lead.email required");

    const data = await gql(env, buildClientCreateMutation(lead));
    const errs = data?.clientCreate?.userErrors || [];
    if (errs.length) throw new Error("clientCreate rejected: " + JSON.stringify(errs).slice(0, 300));
    result.client_id = data?.clientCreate?.client?.id || null;
    result.ok = true;

    // Best-effort consent note — never fails the delivery.
    try {
      const noteData = await gql(env, buildNoteMutation(result.client_id, buildConsentNote(lead)));
      result.note_ok = !(noteData?.clientCreateNote?.userErrors || []).length;
    } catch (e) {
      result.note_ok = false;
      result.note_error = String(e).slice(0, 200);
    }
  } catch (e) {
    result.error = String(e).slice(0, 300);
  }
  try {
    await env.DB.prepare(
      "INSERT INTO partner_deliveries (partner, account_id, lead_email, payload, result, status) VALUES ('jobber', ?, ?, ?, ?, ?)"
    ).bind(conn?.account_id || null, lead?.email || null, JSON.stringify(lead || {}), JSON.stringify(result), result.ok ? "delivered" : "failed").run();
  } catch { /* delivery logging must never mask the push result */ }
  return result;
}

// ── webhooks ────────────────────────────────────────────────────────────────
// base64(HMAC-SHA256(client_secret, raw_body)) must equal X-Jobber-Hmac-SHA256.
export async function verifyWebhookSignature(secret, rawBody, hmacHeader) {
  if (!secret || !hmacHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const digest = btoa(String.fromCharCode(...new Uint8Array(sig)));
  if (digest.length !== hmacHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < digest.length; i++) diff |= digest.charCodeAt(i) ^ hmacHeader.charCodeAt(i);
  return diff === 0;
}

// Record + act on a webhook event. Deliveries are at-least-once and some
// actions legitimately fire the same topic twice, so dedupe on the natural key.
export async function handleWebhookEvent(env, event) {
  const topic = event?.topic || "";
  const accountId = event?.accountId || null;
  const itemId = event?.itemId || null;
  const occurredAt = event?.occurredAt || event?.occuredAt || null; // pre-2023 apps misspell it
  await ensurePartnerSchema(env);
  const dup = await env.DB.prepare(
    `INSERT INTO partner_webhook_events (partner, topic, item_id, account_id, occurred_at)
     VALUES ('jobber', ?, ?, ?, ?) ON CONFLICT DO NOTHING`
  ).bind(topic, itemId, accountId, occurredAt).run();
  if (dup.meta && dup.meta.changes === 0) return { duplicate: true, topic };
  if (topic === "APP_DISCONNECT" && accountId) {
    await markDisconnected(env, accountId);
    return { topic, disconnected: accountId };
  }
  return { topic, recorded: true };
}
