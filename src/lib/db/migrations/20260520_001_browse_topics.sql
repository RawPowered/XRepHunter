CREATE TABLE IF NOT EXISTS browse_topics_daily (
  day_key TEXT NOT NULL,
  topic TEXT NOT NULL,
  posts_seen INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day_key, topic)
);

CREATE TABLE IF NOT EXISTS browse_topics_posts_seen (
  day_key TEXT NOT NULL,
  post_fingerprint TEXT NOT NULL,
  topics_json TEXT NOT NULL,
  PRIMARY KEY (day_key, post_fingerprint)
);
