// Manual one-shot X publish — /api/x-trigger?key=<FEEDBACK_KEY>&confirm=post  (GET, key-gated)
// Fires exactly ONE real tweet via the same path the cron uses (publishNextLive),
// so we can confirm end-to-end posting on demand instead of waiting for 15:00 UTC.
// Requires &confirm=post (so a casual/probe hit never publishes). Returns the live
// result incl. the actual X error if the tweet POST fails.
import { json } from "../_lib/http.js";
import { publishNextLive } from "../_lib/publish.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });
  if (u.searchParams.get("confirm") !== "post")
    return json({ error: "add &confirm=post to publish ONE real tweet" }, { status: 400 });
  if (env.SOCIAL_AUTOPOST_ENABLED !== "true")
    return json({ error: "SOCIAL_AUTOPOST_ENABLED is not true" }, { status: 400 });

  const out = await publishNextLive(env, "x");
  return json({
    triggered: "x",
    resource_slug: out.row?.resource_slug || null,
    ok: Boolean(out.res?.ok),
    post_url: out.res?.post_url || null,
    post_id: out.res?.post_id || null,
    error: out.res?.error || null,
    skipped: out.res?.skipped || false,
    empty: out.empty || false,
    exhausted: out.exhausted || false,
  });
}
