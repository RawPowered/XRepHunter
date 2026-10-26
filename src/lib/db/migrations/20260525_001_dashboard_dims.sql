ALTER TABLE post_attention_daily ADD COLUMN surface TEXT;
ALTER TABLE post_attention_daily ADD COLUMN media_type TEXT;
ALTER TABLE post_attention_daily ADD COLUMN card_domain TEXT;
ALTER TABLE post_attention_daily ADD COLUMN is_promoted INTEGER NOT NULL DEFAULT 0;
