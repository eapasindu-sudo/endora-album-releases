-- Endora Cloud database (Cloudflare D1). The app runs this automatically during setup.

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- one row per connected PC (only a hash of its key is stored)
CREATE TABLE IF NOT EXISTS app_keys (
  key_hash TEXT PRIMARY KEY,
  label TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  couple TEXT NOT NULL DEFAULT '',
  date TEXT,
  aspect REAL NOT NULL DEFAULT 3,
  spreads INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  live_version INTEGER NOT NULL DEFAULT 0,
  live_spreads INTEGER NOT NULL DEFAULT 0,
  pin TEXT NOT NULL,
  cover TEXT,
  video_pos TEXT NOT NULL DEFAULT 'none',
  music TEXT,
  perms TEXT NOT NULL DEFAULT '{}',
  sections TEXT NOT NULL DEFAULT '[]',
  video_key TEXT,
  video_type TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER,
  views INTEGER NOT NULL DEFAULT 0,
  approved_at INTEGER,
  approved_by TEXT,
  studio TEXT,
  cover_options TEXT,
  cover_choice TEXT,
  cover_chosen_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS albums_by_owner ON albums(owner);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id TEXT NOT NULL,
  spread INTEGER NOT NULL,
  x REAL, y REAL,
  kind TEXT NOT NULL DEFAULT 'comment',
  name TEXT,
  text TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_by_album ON comments(album_id);

CREATE TABLE IF NOT EXISTS attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

-- upgrades for databases made by older versions (errors about existing columns are ignored)
ALTER TABLE albums ADD COLUMN cover_options TEXT;
ALTER TABLE albums ADD COLUMN cover_choice TEXT;
ALTER TABLE albums ADD COLUMN cover_chosen_at INTEGER;
