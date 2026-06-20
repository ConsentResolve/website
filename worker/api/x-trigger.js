// Manual one-shot X publish — /api/x-trigger?key=<FEEDBACK_KEY>&confirm=post  (GET, key-gated)
// Fires exactly ONE real tweet via the same path the cron uses (publishNextLive),
// so we can confirm end-to-end posting on demand instead of waiting for 15:00 UTC.
// Requires &confirm=post (so a casual/probe hit never publishes). Returns the live
// result incl. the actual X error if the tweet POST fails.
import { json } from "../_lib/http.js";
import { publishNextLive } from "../_lib/publish.js";
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

  // Diagnostic: show the next candidate row per kind + its liveness, WITHOUT posting.
  if (u.searchParams.get("dry") === "1") {
    const out = { dry: true };
    for (const kind of ["resource", "ad"]) {
      const row = await nextReady(env, "x", kind);
      if (!row) { out[kind] = { none: true }; continue; }
      const url = row.payload?.utm_url || null;
      out[kind] = { slug: row.resource_slug, url, live: await liveness(url) };
    }
    return json(out);
  }

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
