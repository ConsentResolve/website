// GET /r?u=<dest>&e=<email>&c=<campaign>&l=<label>
// Public email-click redirect. Logs the click (link_clicked event + contact activity +
// outreach attribution), then 302s to the same-origin destination. Open-redirect safe:
// safeDest() drops anything cross-origin back to the home page.
import { safeDest, recordClick } from "../_lib/click-track.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const dest = safeDest(env, u.searchParams.get("u"));
  const email = u.searchParams.get("e") || "";
  const campaign = u.searchParams.get("c") || "";
  const label = u.searchParams.get("l") || "";

  // Log before redirecting — D1 writes are fast, and we want the click recorded even if
  // the reader closes the tab immediately. Failures never block the redirect.
  try { await recordClick(env, { dest, email, campaign, label }); } catch (_) {}

  return new Response(null, {
    status: 302,
    headers: { Location: dest, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
