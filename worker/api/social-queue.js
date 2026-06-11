// Social Queue API — /api/social-queue (for external automation: Make/Zapier/n8n)
//
//   GET  -> { published: [], scheduled: [], ready_to_publish: [] }
//   POST -> { action: "enqueue", resource_slug, resource_type, items: [{platform, payload}] }
//        -> { action: "callback", resource_slug, platform, status, post_url?, post_id?, published_at? }
//
// Auth: X-CR-Automation-Key must equal env CR_AUTOMATION_KEY. Fails closed
// (503 if the secret isn't set). The admin UI uses the same queue via a
// cookie-authed path instead of this header.

import { json, corsHeaders } from "../_lib/http.js";
import { readBuckets, enqueue, updateStatus, VALID_STATUS } from "../_lib/queue.js";
import { publishNextLive, LAUNCH_PLATFORMS } from "../_lib/publish.js";

function authed(request, env) {
  const key = env.CR_AUTOMATION_KEY;
  if (!key) return { ok: false, code: 503, error: "queue_unconfigured" };
  const given = request.headers.get("X-CR-Automation-Key") || "";
  if (given.length !== key.length || given !== key) return { ok: false, code: 401, error: "unauthorized" };
  return { ok: true };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request, env),
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-CR-Automation-Key",
    },
  });
}

export async function onRequestGet({ request, env }) {
  const a = authed(request, env);
  if (!a.ok) return json({ error: a.error }, { status: a.code });
  return json(await readBuckets(env));
}

export async function onRequestPost({ request, env }) {
  const a = authed(request, env);
  if (!a.ok) return json({ error: a.error }, { status: a.code });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, { status: 400 });
  }

  const action = body.action || (body.status ? "callback" : "enqueue");

  if (action === "enqueue") {
    const { resource_slug, resource_type, items } = body;
    if (!resource_slug || !resource_type || !Array.isArray(items) || items.length === 0) {
      return json({ error: "missing_fields", need: "resource_slug, resource_type, items[]" }, { status: 400 });
    }
    const n = await enqueue(env, resource_slug, resource_type, items);
    return json({ ok: true, enqueued: n });
  }

  if (action === "callback") {
    const { resource_slug, platform, status } = body;
    if (!resource_slug || !platform || !status) {
      return json({ error: "missing_fields", need: "resource_slug, platform, status" }, { status: 400 });
    }
    if (!VALID_STATUS.has(status)) {
      return json({ error: "bad_status", allowed: [...VALID_STATUS] }, { status: 400 });
    }
    const changed = await updateStatus(env, body);
    if (!changed) return json({ error: "not_found", resource_slug, platform }, { status: 404 });
    return json({ ok: true, updated: changed });
  }

  // Manual "post one now" — auth-gated test/trigger. Publishes the next
  // ready_to_publish item for the given platform (or each launch platform if
  // none), regardless of SOCIAL_AUTOPOST_ENABLED, honoring per-platform creds.
  if (action === "run") {
    const platforms = body.platform ? [body.platform] : LAUNCH_PLATFORMS;
    const results = [];
    for (const pl of platforms) {
      const out = await publishNextLive(env, pl);
      if (out.empty) { results.push({ platform: pl, status: "empty" }); continue; }
      if (out.exhausted) { results.push({ platform: pl, status: "no_live_items" }); continue; }
      results.push({ platform: pl, resource_slug: out.row.resource_slug, ...out.res });
    }
    return json({ ok: true, results });
  }

  return json({ error: "unknown_action", action }, { status: 400 });
}
