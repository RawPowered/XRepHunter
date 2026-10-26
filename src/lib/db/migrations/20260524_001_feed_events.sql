CREATE TABLE IF NOT EXISTS feed_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_at INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  event_kind TEXT NOT NULL,
  post_fingerprint TEXT,
  handle TEXT,
  status_id TEXT,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_feed_events_day_at ON feed_events (day_key, event_at);
CREATE INDEX IF NOT EXISTS idx_feed_events_kind_at ON feed_events (event_kind, event_at);
CREATE INDEX IF NOT EXISTS idx_feed_events_fp_at ON feed_events (post_fingerprint, event_at);
CREATE INDEX IF NOT EXISTS idx_feed_events_handle_at ON feed_events (handle, event_at);

ALTER TABLE post_attention_daily ADD COLUMN weighted_visible_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE post_attention_daily ADD COLUMN focused_weighted_ms INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS post_provenance_daily (
  day_key TEXT NOT NULL,
  post_fingerprint TEXT NOT NULL,
  handle TEXT NOT NULL DEFAULT '',
  status_id TEXT,
  likelihood_category TEXT NOT NULL DEFAULT 'uncertain',
  sponsorship_score REAL,
  influencer_ad_score REAL,
  copypasta_score REAL,
  ai_assisted_score REAL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (day_key, post_fingerprint)
);

CREATE TABLE IF NOT EXISTS provenance_text_seen (
  text_fingerprint TEXT NOT NULL,
  first_handle TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (text_fingerprint)
);

CREATE TABLE IF NOT EXISTS account_reach_daily (
  day_key TEXT NOT NULL,
  handle TEXT NOT NULL,
  posts_exposed INTEGER NOT NULL DEFAULT 0,
  posts_with_focus INTEGER NOT NULL DEFAULT 0,
  focused_weighted_ms INTEGER NOT NULL DEFAULT 0,
  sponsored_exposure INTEGER NOT NULL DEFAULT 0,
  ai_assisted_exposure INTEGER NOT NULL DEFAULT 0,
  copypasta_exposure INTEGER NOT NULL DEFAULT 0,
  actions INTEGER NOT NULL DEFAULT 0,
  account_kind TEXT,
  PRIMARY KEY (day_key, handle)
);

CREATE INDEX IF NOT EXISTS idx_provenance_day_category ON post_provenance_daily (day_key, likelihood_category);
CREATE INDEX IF NOT EXISTS idx_account_reach_day_handle ON account_reach_daily (day_key, handle);
