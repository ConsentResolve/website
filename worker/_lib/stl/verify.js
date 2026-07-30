// Speed-to-Lead — webhook signature verification (HMAC-SHA256, hex).
// OPT-IN: only enforced when STL_VERIFY_WEBHOOKS === "1", so integrations can be
// stood up and confirmed first, then locked down. Returns true when NOT enforcing.
async function hmacHex(secret, body) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// rawBody must be the exact string received (read request.text() before JSON.parse).
export async function verifyHmac(env, rawBody, headerSig, secret) {
  if (env.STL_VERIFY_WEBHOOKS !== "1") return true; // not enforcing yet
  if (!secret || !headerSig) return false;
  try {
    const want = await hmacHex(secret, rawBody);
    const got = String(headerSig).replace(/^(sha256=|v=)/i, "").trim().toLowerCase();
    return got === want;
  } catch (_) { return false; }
}
