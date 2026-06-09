-- Resource Center social distribution queue.
--
-- Apply to the same D1 database as the demo (binding: DB) before relying on
-- /api/social-queue. Run in the Cloudflare dashboard D1 console, or:
--   npx wrangler d1 execute consentresolve-demo --remote --file=worker/social-queue.sql
--
-- One row per (resource_slug, platform). Automation polls GET /api/social-queue
-- for ready_to_publish items, posts them, then POSTs a status callback that
-- moves the row to published (with the live post URL/id).

CREATE TABLE IF NOT EXISTS social_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_slug TEXT    NOT NULL,
  resource_type TEXT    NOT NULL,
  platform      TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'ready_to_publish',  -- ready_to_publish | scheduled | published
  scheduled_at  TEXT,                                          -- ISO; when status=scheduled
  published_at  TEXT,                                          -- ISO; set on callback
  post_url      TEXT,                                          -- live post URL from the platform
  post_id       TEXT,                                          -- platform post id
  payload       TEXT,                                          -- JSON of the social variant (caption, utm_url, image, …)
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (resource_slug, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_queue_status   ON social_queue (status);
CREATE INDEX IF NOT EXISTS idx_social_queue_resource ON social_queue (resource_slug);
