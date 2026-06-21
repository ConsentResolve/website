// Manual one-shot publish — /api/x-trigger?key=<FEEDBACK_KEY>&confirm=post  (GET, key-gated)
// Fires exactly ONE real post via the same path the cron uses (publishNextLive), so we
// can confirm end-to-end posting on demand instead of waiting for the 15:00 UTC cron.
// &platform=x (default) | google_business_profile — any LAUNCH_PLATFORMS target.
// Requires &confirm=post (so a casual/probe hit never publishes). &dry=1 inspects the
// next candidate row (url + liveness) without posting. Returns the live platform error
// if the post fails.
import { json } from "../_lib/http.js";
import { publishNextLive, LAUNCH_PLATFORMS } from "../_lib/publish.js";
import { nextReady } from "../_lib/queue.js";

// Mirror publish.js urlOk() so the dry run reports exactly what the cron would see
// (incl. the same-zone skip — a Worker self-fetch 522s, so we trust our own URLs).
async function liveness(url) {
  if (!url) return null;
  try {
    const host = new URL(url).host;
    if (host === "consentresolve.com" || host.endsWith(".consentresolve.com"))
      return { ok: true, status: 0, note: "own-zone (skipped)" };
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { method: "GET", redirect: "follow", signal: ctl.signal,
      headers: { "User-Agent": "ConsentResolve-LinkCheck/1.0" } });
    clearTimeout(to);
    if (r.status >= 500) return { ok: true, status: r.status };
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: true, status: 0, err: String(e).slice(0, 80) }; }
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (!env.FEEDBACK_KEY || u.searchParams.get("key") !== env.FEEDBACK_KEY)
    return json({ error: "unauthorized" }, { status: 401 });

  const platform = u.searchParams.get("platform") || "x";
  if (!LAUNCH_PLATFORMS.includes(platform))
    return json({ error: `platform must be one of ${LAUNCH_PLATFORMS.join(", ")}` }, { status: 400 });

  // Diagnostic: show the next candidate row per kind + its liveness, WITHOUT posting.
  if (u.searchParams.get("dry") === "1") {
    const out = { dry: true, platform };
    for (const kind of ["resource", "ad"]) {
      const row = await nextReady(env, platform, kind);
      if (!row) { out[kind] = { none: true }; continue; }
      const url = row.payload?.utm_url || null;
      out[kind] = { slug: row.resource_slug, url, image_url: row.payload?.image_url || null, live: await liveness(url) };
    }
    return json(out);
  }

  if (u.searchParams.get("confirm") !== "post")
    return json({ error: "add &confirm=post to publish ONE real post" }, { status: 400 });
  if (env.SOCIAL_AUTOPOST_ENABLED !== "true")
    return json({ error: "SOCIAL_AUTOPOST_ENABLED is not true" }, { status: 400 });

  const out = await publishNextLive(env, platform);
  return json({
    triggered: platform,
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
