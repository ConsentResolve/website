// LinkedIn connection status — /api/li-status?key=<FEEDBACK_KEY>  (GET, key-gated)
// Reports whether the company + personal tokens are configured and still authenticate.
// /v2/me: 401 = token dead; 200/403/other = token authenticates (403 just means no profile scope).
import { json } from "../_lib/http.js";

async function ping(token) {
  if (!token) return "missing";
  try {
    const r = await fetch("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" } });
    if (r.status === 401) return "INVALID / expired (401) — re-auth needed";
    if (r.ok) return "live (200)";
    return `live, limited scope (${r.status})`;
  } catch (e) { return "error: " + e; }
}

export async function onRequestGet({ request, env }) {
  if (!env.FEEDBACK_KEY || new URL(request.url).searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });
  return json({
    pipeline: "PAUSED — LinkedIn is not in LAUNCH_PLATFORMS or the reel schedule",
    company: { urn: env.LINKEDIN_COMPANY_URN || null,
      token: env.LINKEDIN_COMPANY_ACCESS_TOKEN ? "configured" : "missing",
      status: await ping(env.LINKEDIN_COMPANY_ACCESS_TOKEN) },
    personal: { urn: env.LINKEDIN_PERSONAL_URN || null,
      token: env.LINKEDIN_PERSONAL_ACCESS_TOKEN ? "configured" : "missing",
      status: await ping(env.LINKEDIN_PERSONAL_ACCESS_TOKEN) },
  });
}
