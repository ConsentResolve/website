// Social Queue API — /api/social-queue
//
//   GET  -> { published: [], scheduled: [], ready_to_publish: [] }  (reads D1)
//   POST -> two actions (JSON body):
//       { action: "enqueue", resource_slug, resource_type, items: [{platform, payload}] }
//           upserts one ready_to_publish row per platform (idempotent).
//       { action: "callback", resource_slug, platform, status, post_url?, post_id?, published_at? }
//           updates a row after automation posts it (status -> published/scheduled).
//
// Auth: every request must send  X-CR-Automation-Key: <CR_AUTOMATION_KEY>.
// The secret is a Cloudflare env var (never committed). If it isn't set, the
// endpoint returns 503 so it fails closed rather than open.

import { json, corsHeaders } from "../_lib/http.js";
import { nowIso } from "../_lib/db.js";

const VALID_STATUS = new Set(["ready_to_publish", "scheduled", "published"]);

function authed(request, env) {
  const key = env.CR_AUTOMATION_KEY;
  if (!key) return { ok: false, code: 503, error: "queue_unconfigured" };
  const given = request.headers.get("X-CR-Automation-Key") || "";
  // Constant-ish comparison (length + value); fine for a shared secret header.
  if (given.length !== key.length || given !== key) {
    return { ok: false, code: 401, error: "unauthorized" };
  }
  return { ok: true };
}

function mapRow(r) {
  return {
    id: r.id,
    resource_slug: r.resource_slug,
    resource_type: r.resource_type,
    platform: r.platform,
    status: r.status,
    scheduled_at: r.scheduled_at,
    published_at: r.published_at,
    post_url: r.post_url,
    post_id: r.post_id,
    payload: r.payload ? safeParse(r.payload) : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
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

  const { results } = await env.DB.prepare(
    "SELECT * FROM social_queue ORDER BY updated_at DESC"
  ).all();

  const buckets = { published: [], scheduled: [], ready_to_publish: [] };
  for (const r of results || []) {
    const item = mapRow(r);
    (buckets[r.status] || (buckets[r.status] = [])).push(item);
  }
  return json(buckets);
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
    const now = nowIso();
    let n = 0;
    for (const it of items) {
      if (!it || !it.platform) continue;
      await env.DB.prepare(
        `INSERT INTO social_queue (resource_slug, resource_type, platform, status, payload, created_at, updated_at)
         VALUES (?, ?, ?, 'ready_to_publish', ?, ?, ?)
         ON CONFLICT(resource_slug, platform) DO UPDATE SET
           resource_type = excluded.resource_type,
           payload       = excluded.payload,
           updated_at    = excluded.updated_at`
      )
        .bind(resource_slug, resource_type, it.platform, it.payload ? JSON.stringify(it.payload) : null, now, now)
        .run();
      n++;
    }
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
    const published_at =
      status === "published" ? body.published_at || nowIso() : body.published_at || null;
    const res = await env.DB.prepare(
      `UPDATE social_queue
         SET status = ?, post_url = ?, post_id = ?, scheduled_at = ?, published_at = ?, updated_at = ?
       WHERE resource_slug = ? AND platform = ?`
    )
      .bind(
        status,
        body.post_url || null,
        body.post_id || null,
        body.scheduled_at || null,
        published_at,
        nowIso(),
        resource_slug,
        platform
      )
      .run();

    const changed = res.meta?.changes ?? res.changes ?? 0;
    if (!changed) return json({ error: "not_found", resource_slug, platform }, { status: 404 });
    return json({ ok: true, updated: changed });
  }

  return json({ error: "unknown_action", action }, { status: 400 });
}
