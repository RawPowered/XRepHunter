CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS accounts (
  handle TEXT PRIMARY KEY,
  display_name TEXT,
  current_score INTEGER NOT NULL DEFAULT 50,
  band TEXT NOT NULL DEFAULT 'caution',
  spam_risk INTEGER NOT NULL DEFAULT 0,
  general_risk INTEGER NOT NULL DEFAULT 0,
  note_rate REAL NOT NULL DEFAULT 0,
  avg_post_spam REAL NOT NULL DEFAULT 0,
  max_post_spam INTEGER NOT NULL DEFAULT 0,
  avg_post_slop REAL NOT NULL DEFAULT 0,
  max_post_slop INTEGER NOT NULL DEFAULT 0,
  avg_post_toxicity REAL NOT NULL DEFAULT 0,
  max_post_toxicity INTEGER NOT NULL DEFAULT 0,
  posts_analyzed INTEGER NOT NULL DEFAULT 0,
  posts_with_note INTEGER NOT NULL DEFAULT 0,
  last_scanned_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts_observed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  text_fingerprint TEXT NOT NULL,
  slop_score INTEGER,
  spam_score INTEGER,
  toxicity_score INTEGER,
  has_community_note INTEGER NOT NULL DEFAULT 0,
  UNIQUE(handle, text_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_posts_handle ON posts_observed(handle);
CREATE INDEX IF NOT EXISTS idx_posts_observed_at ON posts_observed(observed_at);
CREATE INDEX IF NOT EXISTS idx_accounts_score ON accounts(current_score);
CREATE INDEX IF NOT EXISTS idx_accounts_posts ON accounts(posts_analyzed DESC);

CREATE TABLE IF NOT EXISTS reputation_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL,
  score INTEGER NOT NULL,
  breakdown_json TEXT NOT NULL,
  hits_json TEXT NOT NULL,
  scanned_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_handle ON reputation_snapshots(handle);
