import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';

const root = dirname(fileURLToPath(import.meta.url));
const browseTopicsSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260520_001_browse_topics.sql'),
  'utf8',
);

describe('browse-topics migration', () => {
  it('creates topic tables', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(browseTopicsSql);
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'browse_topics%'",
    );
    const names = tables[0].values.map((v) => v[0]);
    expect(names).toContain('browse_topics_daily');
    expect(names).toContain('browse_topics_posts_seen');
    db.close();
  });

  it('dedupes post fingerprint per day', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(browseTopicsSql);
    const day = '2026-05-20';
    const fp = 'fp-1';
    const labels = JSON.stringify(['news', 'politics']);
    db.run(
      'INSERT INTO browse_topics_posts_seen (day_key, post_fingerprint, topics_json) VALUES (?, ?, ?)',
      [day, fp, labels],
    );
    db.run(
      'INSERT INTO browse_topics_daily (day_key, topic, posts_seen) VALUES (?, ?, 1)',
      [day, 'news'],
    );
    db.run(
      'INSERT INTO browse_topics_daily (day_key, topic, posts_seen) VALUES (?, ?, 1)',
      [day, 'politics'],
    );
    const count = db.exec('SELECT posts_seen FROM browse_topics_daily WHERE topic = ?', [
      'news',
    ]);
    expect(count[0].values[0][0]).toBe(1);
    db.close();
  });
});
