CREATE TABLE IF NOT EXISTS browse_daily (
  day_key TEXT PRIMARY KEY,
  posts_seen INTEGER NOT NULL DEFAULT 0,
  spam_flagged INTEGER NOT NULL DEFAULT 0,
  slop_flagged INTEGER NOT NULL DEFAULT 0,
  slop_sum INTEGER NOT NULL DEFAULT 0,
  slop_count INTEGER NOT NULL DEFAULT 0,
  accounts_seen INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS browse_posts_seen (
  day_key TEXT NOT NULL,
  post_fingerprint TEXT NOT NULL,
  PRIMARY KEY (day_key, post_fingerprint)
);
