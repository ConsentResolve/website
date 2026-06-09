// Minimal session auth for the /admin area. A stateless, HMAC-signed cookie
// (no server-side session store needed). Secrets (env, never committed):
//   ADMIN_PASSWORD        — the login password
//   ADMIN_SESSION_SECRET  — HMAC key for signing the session cookie
//
// Defense-in-depth tip (docs): you can ALSO put Cloudflare Access in front of
// /admin* for SSO + a second gate. This cookie auth stands on its own too.

const enc = new TextEncoder();
const TTL = 12 * 60 * 60; // 12h

function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(env) {
  if (!env.ADMIN_SESSION_SECRET) throw new Error("ADMIN_SESSION_SECRET not set");
  const payload = b64url(enc.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + TTL })));
  const key = await hmacKey(env.ADMIN_SESSION_SECRET);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(env, token) {
  if (!env.ADMIN_SESSION_SECRET || !token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await hmacKey(env.ADMIN_SESSION_SECRET);
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, fromB64url(sig), enc.encode(payload));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (data.exp && data.exp > Math.floor(Date.now() / 1000)) return data;
  } catch {
    /* fall through */
  }
  return null;
}

export function parseCookies(request) {
  const h = request.headers.get("Cookie") || "";
  const out = {};
  for (const part of h.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  return out;
}

export function sessionCookie(token) {
  return `cr_admin=${token}; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=${TTL}`;
}
export function clearCookie() {
  return `cr_admin=; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=0`;
}

export async function isAuthed(request, env) {
  const c = parseCookies(request);
  return Boolean(await verifySession(env, c["cr_admin"]));
}

// Constant-time-ish password compare.
export function checkPassword(env, given) {
  const pw = env.ADMIN_PASSWORD;
  if (!pw || typeof given !== "string" || given.length !== pw.length) return false;
  let diff = 0;
  for (let i = 0; i < pw.length; i++) diff |= pw.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export function adminConfigured(env) {
  return Boolean(env.ADMIN_PASSWORD && env.ADMIN_SESSION_SECRET);
}
