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
const feedbackSql = readFileSync(
  join(root, '../src/lib/db/migrations/20260526_001_detector_feedback.sql'),
  'utf8',
);

describe('detector_corrections migration', () => {
  it('creates detector_corrections table', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(initSql);
    db.exec(feedbackSql);
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const names = tables[0].values.map((v) => v[0]);
    expect(names).toContain('detector_corrections');
  });
});
