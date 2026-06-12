// Shared social_queue data access — used by both the public automation API
// (/api/social-queue, gated by X-CR-Automation-Key) and the authenticated admin
// (/admin, gated by a session cookie). Keeping the SQL in one place means both
// surfaces behave identically.
import { nowIso } from "./db.js";

export const VALID_STATUS = new Set(["ready_to_publish", "scheduled", "published"]);

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export function mapRow(r) {
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

/** All rows, bucketed by status. */
export async function readBuckets(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM social_queue ORDER BY updated_at DESC"
  ).all();
  const buckets = { published: [], scheduled: [], ready_to_publish: [] };
  for (const r of results || []) {
    (buckets[r.status] || (buckets[r.status] = [])).push(mapRow(r));
  }
  return buckets;
}

/** Most recent published_at (ISO) for a platform, or null if never posted.
 *  ISO-8601 strings sort lexically, so MAX() gives the latest timestamp. */
export async function lastPublishedAt(env, platform) {
  const row = await env.DB.prepare(
    "SELECT MAX(published_at) AS last FROM social_queue WHERE platform = ? AND status = 'published'"
  )
    .bind(platform)
    .first();
  return row && row.last ? row.last : null;
}

/** Oldest ready_to_publish row for a platform (the next one to drip).
 *  kind: "ad" = VoC product ads (resource_slug LIKE 'voc-%'), "resource" = the
 *  rest, undefined = any. Used by the publisher to interleave ads with shares. */
export async function nextReady(env, platform, kind) {
  let q = "SELECT * FROM social_queue WHERE platform = ? AND status = 'ready_to_publish'";
  if (kind === "ad") q += " AND resource_slug LIKE 'voc-%'";
  else if (kind === "resource") q += " AND resource_slug NOT LIKE 'voc-%'";
  q += " ORDER BY id ASC LIMIT 1";
  const row = await env.DB.prepare(q).bind(platform).first();
  return row ? mapRow(row) : null;
}

/** How many rows a platform has already published (drip position). */
export async function publishedCount(env, platform) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM social_queue WHERE platform = ? AND status = 'published'"
  )
    .bind(platform)
    .first();
  return (row && Number(row.c)) || 0;
}

/** Upsert one ready_to_publish row per platform item. Returns count. */
export async function enqueue(env, resource_slug, resource_type, items) {
  const now = nowIso();
  let n = 0;
  for (const it of items || []) {
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
  return n;
}

/** Update a row's status (+ optional post url/id, schedule, publish time). */
export async function updateStatus(env, { resource_slug, platform, status, post_url, post_id, scheduled_at, published_at }) {
  const pub = status === "published" ? published_at || nowIso() : published_at || null;
  const res = await env.DB.prepare(
    `UPDATE social_queue
       SET status = ?, post_url = ?, post_id = ?, scheduled_at = ?, published_at = ?, updated_at = ?
     WHERE resource_slug = ? AND platform = ?`
  )
    .bind(status, post_url || null, post_id || null, scheduled_at || null, pub, nowIso(), resource_slug, platform)
    .run();
  return res.meta?.changes ?? res.changes ?? 0;
}
