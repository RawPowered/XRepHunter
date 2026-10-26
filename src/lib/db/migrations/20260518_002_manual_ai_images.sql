CREATE TABLE IF NOT EXISTS manual_ai_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handle TEXT NOT NULL,
  image_fingerprint TEXT NOT NULL,
  slop_score INTEGER NOT NULL DEFAULT 82,
  marked_at INTEGER NOT NULL,
  UNIQUE(handle, image_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_manual_ai_handle ON manual_ai_images(handle);
