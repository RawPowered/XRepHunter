import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));
const initSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260518_001_init.sql'),
  'utf8',
);
const browseStatsSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260518_003_browse_stats.sql'),
  'utf8',
);
const postAttentionSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260523_001_post_attention.sql'),
  'utf8',
);
const feedEventsSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260524_001_feed_events.sql'),
  'utf8',
);
const dashboardDimsSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260525_001_dashboard_dims.sql'),
  'utf8',
);

describe('db migrations', () => {
  it('applies init schema on empty database', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(initSql);
    db.run('INSERT OR REPLACE INTO schema_version (id, version) VALUES (1, 1)');

    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables[0].values.map((v) => v[0]);
    expect(names).toContain('accounts');
    expect(names).toContain('posts_observed');
    expect(names).toContain('reputation_snapshots');

    db.run(
      `INSERT INTO accounts (handle, current_score, band, spam_risk, general_risk, last_scanned_at)
       VALUES ('testuser', 42, 'caution', 10, 5, 1)`,
    );
    const row = db.exec("SELECT current_score FROM accounts WHERE handle = 'testuser'");
    expect(row[0].values[0][0]).toBe(42);
    db.close();
  });

  it('applies browse stats migration', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(initSql);
    db.exec(browseStatsSql);
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'browse%'",
    );
    const names = tables[0].values.map((v) => v[0]);
    expect(names).toContain('browse_daily');
    expect(names).toContain('browse_posts_seen');
    db.close();
  });

  it('applies post attention migration with additive upsert', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(postAttentionSql);
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = 'post_attention_daily'",
    );
    expect(tables[0].values[0][0]).toBe('post_attention_daily');

    const day = '2026-05-23';
    const fp = 'fp-attn-1';
    db.run(
      `INSERT INTO post_attention_daily (day_key, post_fingerprint, handle, visible_ms, focused_visible_ms)
       VALUES (?, ?, 'alice', 100, 80)`,
      [day, fp],
    );
    db.run(
      `INSERT INTO post_attention_daily (day_key, post_fingerprint, handle, visible_ms, focused_visible_ms, revisit_count)
       VALUES (?, ?, 'alice', 50, 40, 1)
       ON CONFLICT(day_key, post_fingerprint) DO UPDATE SET
         visible_ms = visible_ms + excluded.visible_ms,
         focused_visible_ms = focused_visible_ms + excluded.focused_visible_ms,
         revisit_count = revisit_count + excluded.revisit_count`,
      [day, fp],
    );
    const row = db.exec(
      'SELECT visible_ms, focused_visible_ms, revisit_count FROM post_attention_daily WHERE post_fingerprint = ?',
      [fp],
    );
    expect(row[0].values[0]).toEqual([150, 120, 1]);
    db.close();
  });

  it('applies feed intelligence migration v7', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(postAttentionSql);
    db.exec(feedEventsSql);
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables[0].values.map((v) => v[0]);
    expect(names).toContain('feed_events');
    expect(names).toContain('post_provenance_daily');
    expect(names).toContain('account_reach_daily');

    db.run(
      `INSERT INTO feed_events (event_at, day_key, event_kind, post_fingerprint, handle)
       VALUES (1, '2026-05-24', 'like', 'fp1', 'alice')`,
    );
    db.run(
      `INSERT INTO feed_events (event_at, day_key, event_kind, post_fingerprint, handle)
       VALUES (2, '2026-05-24', 'post_exposure', 'fp2', 'bob')`,
    );
    const count = db.exec("SELECT COUNT(*) FROM feed_events WHERE day_key = '2026-05-24'");
    expect(count[0].values[0][0]).toBe(2);

    const cols = db.exec('PRAGMA table_info(post_attention_daily)');
    const colNames = cols[0].values.map((v) => v[1]);
    expect(colNames).toContain('weighted_visible_ms');
    expect(colNames).toContain('focused_weighted_ms');
    db.close();
  });

  it('applies dashboard dims migration v8', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(postAttentionSql);
    db.exec(dashboardDimsSql);
    const cols = db.exec('PRAGMA table_info(post_attention_daily)');
    const colNames = cols[0].values.map((v) => v[1]);
    expect(colNames).toContain('surface');
    expect(colNames).toContain('media_type');
    expect(colNames).toContain('card_domain');
    expect(colNames).toContain('is_promoted');
    db.close();
  });
});
