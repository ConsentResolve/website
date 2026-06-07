-- Consent Resolve live demo — D1 schema (binding: DB)
-- Apply:  wrangler d1 execute consentresolve-demo --remote --file=./worker/schema.sql

CREATE TABLE IF NOT EXISTS participants (
  id                   TEXT PRIMARY KEY,           -- demo_token (uuid v4)
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL,
  business_name        TEXT,
  phone                TEXT,
  trade                TEXT,                        -- plumber, roofer, hvac, electrician
  consent_contact      INTEGER DEFAULT 0,           -- consent to be contacted by Consent Resolve
  status               TEXT DEFAULT 'registered',   -- registered|visited|consented|emailed|enrolled
  sample_page          TEXT,
  consent_text_version TEXT,
  ip                   TEXT,
  user_agent           TEXT,
  created_at           TEXT NOT NULL,
  visited_at           TEXT,
  consented_at         TEXT,
  emailed_at           TEXT,
  enrolled_at          TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id TEXT NOT NULL,
  event_type     TEXT NOT NULL,                     -- registered|visited|consented|emailed|enrolled|error
  metadata       TEXT,                              -- json
  created_at     TEXT NOT NULL,
  FOREIGN KEY (participant_id) REFERENCES participants(id)
);

CREATE INDEX IF NOT EXISTS idx_events_participant ON events(participant_id);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_ip_created ON participants(ip, created_at);
