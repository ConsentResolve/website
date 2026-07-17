// Google service-account auth (read-only) for Search Console + GA4, minted in
// the Worker via RS256 JWT (WebCrypto). One service account can power both APIs.
// Secrets: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL, GA4_PROPERTY_ID
// (GA4_CLIENT_EMAIL/GA4_PRIVATE_KEY optional — fall back to the GSC pair).

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = (str) => b64url(new TextEncoder().encode(str));

function pemToBuf(pem) {
  const b64 = (pem || "").replace(/\\n/g, "\n").replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// Cache tokens in module scope (per isolate) to avoid re-minting every call.
const _cache = {};
export async function saToken(clientEmail, privateKeyPem, scope) {
  const ck = clientEmail + "|" + scope;
  const now = Math.floor(Date.now() / 1000);
  if (_cache[ck] && _cache[ck].exp > now + 60) return _cache[ck].token;
  const header = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64urlStr(JSON.stringify({ iss: clientEmail, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey("pkcs8", pemToBuf(privateKeyPem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + "." + b64url(new Uint8Array(sig));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("SA token failed: " + JSON.stringify(j).slice(0, 200));
  _cache[ck] = { token: j.access_token, exp: now + (j.expires_in || 3600) };
  return j.access_token;
}

export const gscConfigured = (env) => !!(env.GSC_CLIENT_EMAIL && env.GSC_PRIVATE_KEY);
export const ga4Configured = (env) => !!((env.GA4_CLIENT_EMAIL || env.GSC_CLIENT_EMAIL) && (env.GA4_PRIVATE_KEY || env.GSC_PRIVATE_KEY) && env.GA4_PROPERTY_ID);

// Search Console Search Analytics query. `body` = { startDate, endDate, dimensions?, rowLimit?, ... }
export async function gscQuery(env, body) {
  const site = env.GSC_SITE_URL || "https://consentresolve.com/";
  const tok = await saToken(env.GSC_CLIENT_EMAIL, env.GSC_PRIVATE_KEY, "https://www.googleapis.com/auth/webmasters.readonly");
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
    method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.error) throw new Error("GSC: " + (j.error.message || JSON.stringify(j.error)).slice(0, 200));
  return j;
}

// GA4 Data API runReport. `body` = { dateRanges, metrics, dimensions? }
export async function ga4Report(env, body) {
  const tok = await saToken(env.GA4_CLIENT_EMAIL || env.GSC_CLIENT_EMAIL, env.GA4_PRIVATE_KEY || env.GSC_PRIVATE_KEY, "https://www.googleapis.com/auth/analytics.readonly");
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`, {
    method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.error) throw new Error("GA4: " + (j.error.message || JSON.stringify(j.error)).slice(0, 200));
  return j;
}

// yyyy-mm-dd, `daysAgo` before today (UTC)
export function ymd(daysAgo = 0) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}
