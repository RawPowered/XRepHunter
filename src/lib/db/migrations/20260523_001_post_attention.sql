CREATE TABLE IF NOT EXISTS post_attention_daily (
  day_key TEXT NOT NULL,
  post_fingerprint TEXT NOT NULL,
  handle TEXT NOT NULL DEFAULT '',
  status_id TEXT,
  visible_ms INTEGER NOT NULL DEFAULT 0,
  focused_visible_ms INTEGER NOT NULL DEFAULT 0,
  max_visible_ratio REAL NOT NULL DEFAULT 0,
  first_seen_at INTEGER,
  last_seen_at INTEGER,
  revisit_count INTEGER NOT NULL DEFAULT 0,
  pause_count INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  quotes INTEGER NOT NULL DEFAULT 0,
  slop_score REAL,
  spam_score REAL,
  toxicity_score REAL,
  topics_json TEXT,
  PRIMARY KEY (day_key, post_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_post_attention_day_handle ON post_attention_daily (day_key, handle);
CREATE INDEX IF NOT EXISTS idx_post_attention_day_focused ON post_attention_daily (day_key, focused_visible_ms DESC);
