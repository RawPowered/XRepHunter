import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));
const postAttentionSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260523_001_post_attention.sql'),
  'utf8',
);
const feedEventsSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260524_001_feed_events.sql'),
  'utf8',
);

describe('feed_events schema', () => {
  it('supports append-only inserts', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(postAttentionSql);
    db.exec(feedEventsSql);
    db.run(
      `INSERT INTO feed_events (event_at, day_key, event_kind, handle, payload_json)
       VALUES (100, '2026-05-24', 'like', 'alice', '{"deduped":false}')`,
    );
    db.run(
      `INSERT INTO feed_events (event_at, day_key, event_kind, handle, payload_json)
       VALUES (200, '2026-05-24', 'like', 'alice', '{"deduped":true}')`,
    );
    const r = db.exec("SELECT COUNT(*) FROM feed_events WHERE event_kind = 'like'");
    expect(r[0].values[0][0]).toBe(2);
    db.close();
  });
});
