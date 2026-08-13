-- worker/prospecting.sql — bulk prospecting pipeline tables.
-- Applied idempotently by ensureProspectingSchema() in worker/api/prospecting.js;
-- also safe to paste into the D1 console.

CREATE TABLE IF NOT EXISTS prospects (
  id                  TEXT PRIMARY KEY,      -- domain-derived stable id (pr_<hash>)
  domain              TEXT UNIQUE,           -- normalized, no www
  name                TEXT,
  phone               TEXT,
  city                TEXT,
  region              TEXT,                  -- state
  trade               TEXT,                  -- canonical trade slug
  rating              REAL,
  reviews             INTEGER,
  score               INTEGER DEFAULT 0,
  tier                TEXT DEFAULT 'unscored', -- hot|warm|cold|dead|no_site|unscored
  signals             TEXT,                  -- JSON signal object
  reasons             TEXT,                  -- JSON array of human-readable score reasons
  stages_run          TEXT,                  -- JSON array e.g. ["tam","tech","traffic","backlinks"]
  cost_cents          INTEGER DEFAULT 0,     -- summed real DFS cost x100
  status              TEXT DEFAULT 'new',    -- new|promoted|suppressed
  run_id              TEXT,                  -- the sweep that discovered it
  promoted_contact_id TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prospects_tier ON prospects(tier, trade);
CREATE INDEX IF NOT EXISTS idx_prospects_city ON prospects(city, trade);
CREATE INDEX IF NOT EXISTS idx_prospects_run  ON prospects(run_id);

CREATE TABLE IF NOT EXISTS prospect_runs (
  id            TEXT PRIMARY KEY,            -- pr_run_<...>
  query         TEXT,                        -- JSON {trade, city, region, limit}
  stage         TEXT DEFAULT 'tech',         -- tech|traffic|backlinks|done (the NEXT stage to run)
  counts        TEXT,                        -- JSON {found, tech, traffic, backlinks, hot, warm, cold, dead}
  cost_cents    INTEGER DEFAULT 0,
  max_cost_cents INTEGER DEFAULT 500,        -- $5 default ceiling; run pauses when hit
  status        TEXT DEFAULT 'running',      -- running|done|error|paused
  actor         TEXT,
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prospect_runs_status ON prospect_runs(status);
