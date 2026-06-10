-- OAuth token store for social auto-posting (Cloudflare Cron Worker).
-- Apply to the same D1 as the demo + social_queue:
--   npx wrangler d1 execute consentresolve-demo --remote --file=worker/social-tokens.sql
--
-- Used for providers whose access tokens expire and must be refreshed at post
-- time (X rotates its refresh token on every refresh, so we persist the new
-- one here; Google's refresh token is stable but we cache the access token).
CREATE TABLE IF NOT EXISTS social_tokens (
  provider      TEXT PRIMARY KEY,   -- 'x' | 'google'
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TEXT,               -- ISO; when access_token expires
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
