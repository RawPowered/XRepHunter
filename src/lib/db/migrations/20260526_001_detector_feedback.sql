CREATE TABLE IF NOT EXISTS detector_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_fingerprint TEXT NOT NULL,
  handle TEXT NOT NULL,
  correction TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(post_fingerprint, correction)
);

CREATE INDEX IF NOT EXISTS idx_detector_corrections_fp ON detector_corrections(post_fingerprint);
CREATE INDEX IF NOT EXISTS idx_detector_corrections_handle ON detector_corrections(handle);

ALTER TABLE posts_observed ADD COLUMN quality_json TEXT;
