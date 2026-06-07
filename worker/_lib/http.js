// Small HTTP helpers. The demo is same-origin (form + API both on
// consentresolve.com), so CORS is normally a no-op. The allowlist is still
// honored so the form could be embedded on another origin later.

export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export function json(data, init = {}, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

export function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    null
  );
}

export function baseOrigin(request, env) {
  if (env.BASE_URL) return env.BASE_URL.replace(/\/$/, "");
  return new URL(request.url).origin;
}
