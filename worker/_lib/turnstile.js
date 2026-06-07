// Cloudflare Turnstile server-side verification.
// If TURNSTILE_SECRET is unset, verification is skipped so the demo still works
// before the widget is configured. Set the secret to enforce it.

export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: "missing_token" };

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = await res.json();
    return { ok: !!data.success, data };
  } catch (err) {
    return { ok: false, error: "verify_failed", detail: String(err) };
  }
}
