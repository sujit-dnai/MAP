-- Field Officer Location Tracker — initial schema
-- Applied with:  npx wrangler d1 migrations apply field-officers --remote

-- Officer master list. One row per officer, keyed by mobile number.
CREATE TABLE IF NOT EXISTS officers (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  mobile       TEXT,
  designation  TEXT,
  branch       TEXT,
  home_address TEXT,
  home_lat     REAL,
  home_lng     REAL,
  photo_key    TEXT,
  active       INTEGER DEFAULT 1,
  updated_at   TEXT
);

-- One row per location submission.
CREATE TABLE IF NOT EXISTS checkins (
  id          TEXT PRIMARY KEY,
  ts          INTEGER,
  officer_id  TEXT,
  name        TEXT,
  mobile      TEXT,
  designation TEXT,
  branch      TEXT,
  photo_key   TEXT,
  lat         REAL,
  lng         REAL,
  accuracy    REAL,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  pincode     TEXT,
  loc_type    TEXT,
  notes       TEXT,
  source      TEXT
);

CREATE INDEX        IF NOT EXISTS idx_checkins_ts      ON checkins(ts DESC);
CREATE INDEX        IF NOT EXISTS idx_checkins_mobile  ON checkins(mobile);
CREATE UNIQUE INDEX IF NOT EXISTS idx_officers_mobile  ON officers(mobile);
