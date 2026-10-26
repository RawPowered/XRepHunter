import { type Database, type SqlValue } from 'sql.js';
import { initSqlJsExtension } from '../../lib/db/sql-init';
import initMigrationSql from '../../lib/db/migrations/20260518_001_init.sql?raw';
import manualAiImagesSql from '../../lib/db/migrations/20260518_002_manual_ai_images.sql?raw';
import browseStatsSql from '../../lib/db/migrations/20260518_003_browse_stats.sql?raw';
import browseMetricsSql from '../../lib/db/migrations/20260519_001_browse_metrics.sql?raw';
import browseTopicsSql from '../../lib/db/migrations/20260520_001_browse_topics.sql?raw';
import postAttentionSql from '../../lib/db/migrations/20260523_001_post_attention.sql?raw';
import feedEventsSql from '../../lib/db/migrations/20260524_001_feed_events.sql?raw';
import dashboardDimsSql from '../../lib/db/migrations/20260525_001_dashboard_dims.sql?raw';
import detectorFeedbackSql from '../../lib/db/migrations/20260526_001_detector_feedback.sql?raw';

const IDB_NAME = 'xrephunter-sqlite';
const IDB_STORE = 'db';
const IDB_KEY = 'main';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function loadPersistedDb(): Promise<Uint8Array | null> {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const v = req.result;
      resolve(v instanceof Uint8Array ? v : v ? new Uint8Array(v) : null);
    };
  });
}

async function persistDb(database: Database): Promise<void> {
  const data = database.export();
  const idb = await openIdb();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).put(data, IDB_KEY);
  });
}

function getSchemaVersion(database: Database): number {
  try {
    const r = database.exec('SELECT version FROM schema_version LIMIT 1');
    if (!r.length || !r[0].values.length) return 0;
    return Number(r[0].values[0][0]) || 0;
  } catch {
    return 0;
  }
}

function applyMigrations(database: Database): void {
  let version = getSchemaVersion(database);
  if (version < 1) {
    database.exec(initMigrationSql);
    database.run('INSERT OR REPLACE INTO schema_version (id, version) VALUES (1, 1)');
    version = 1;
  }
  if (version < 2) {
    database.exec(manualAiImagesSql);
    database.run('UPDATE schema_version SET version = 2 WHERE id = 1');
    version = 2;
  }
  if (version < 3) {
    database.exec(browseStatsSql);
    database.run('UPDATE schema_version SET version = 3 WHERE id = 1');
    version = 3;
  }
  if (version < 4) {
    database.exec(browseMetricsSql);
    database.run('UPDATE schema_version SET version = 4 WHERE id = 1');
    version = 4;
  }
  if (version < 5) {
    database.exec(browseTopicsSql);
    database.run('UPDATE schema_version SET version = 5 WHERE id = 1');
    version = 5;
  }
  if (version < 6) {
    database.exec(postAttentionSql);
    database.run('UPDATE schema_version SET version = 6 WHERE id = 1');
    version = 6;
  }
  if (version < 7) {
    database.exec(feedEventsSql);
    database.run('UPDATE schema_version SET version = 7 WHERE id = 1');
    version = 7;
  }
  if (version < 8) {
    database.exec(dashboardDimsSql);
    database.run('UPDATE schema_version SET version = 8 WHERE id = 1');
    version = 8;
  }
  if (version < 9) {
    database.exec(detectorFeedbackSql);
    database.run('UPDATE schema_version SET version = 9 WHERE id = 1');
  }
}

export async function getDatabase(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const SQL = await initSqlJsExtension();
    const saved = await loadPersistedDb();
    const database = saved?.length ? new SQL.Database(saved) : new SQL.Database();
    applyMigrations(database);
    await persistDb(database);
    db = database;
    return database;
  })();
  return initPromise;
}

export async function flushDatabase(): Promise<void> {
  if (!db) return;
  await persistDb(db);
}

function bindParams(stmt: ReturnType<Database['prepare']>, params?: SqlValue[]): void {
  if (!params?.length) return;
  stmt.bind(params);
}

export async function dbRun(sql: string, params?: SqlValue[]): Promise<void> {
  const database = await getDatabase();
  if (params?.length) {
    const stmt = database.prepare(sql);
    bindParams(stmt, params);
    stmt.step();
    stmt.free();
  } else {
    database.run(sql);
  }
  await persistDb(database);
}

export async function dbExec(sql: string): Promise<void> {
  const database = await getDatabase();
  database.exec(sql);
  await persistDb(database);
}

export interface DbQueryResult {
  columns: string[];
  rows: Record<string, SqlValue>[];
}

export async function dbQuery(sql: string, params?: SqlValue[]): Promise<DbQueryResult> {
  const database = await getDatabase();
  if (params?.length) {
    const stmt = database.prepare(sql);
    bindParams(stmt, params);
    const columns = stmt.getColumnNames();
    const rows: Record<string, SqlValue>[] = [];
    while (stmt.step()) {
      const values = stmt.get();
      const row: Record<string, SqlValue> = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      rows.push(row);
    }
    stmt.free();
    return { columns, rows };
  }
  const results = database.exec(sql);
  if (!results.length) return { columns: [], rows: [] };
  const { columns, values } = results[0];
  const rows = values.map((vals) => {
    const row: Record<string, SqlValue> = {};
    columns.forEach((col, i) => {
      row[col] = vals[i];
    });
    return row;
  });
  return { columns, rows };
}

export async function exportDatabaseBytes(): Promise<Uint8Array> {
  const database = await getDatabase();
  database.run('PRAGMA optimize');
  return database.export();
}

export async function importDatabaseBytes(bytes: Uint8Array, mode: 'replace' | 'merge'): Promise<void> {
  if (mode === 'replace') {
    const SQL = await initSqlJsExtension();
    db = new SQL.Database(bytes);
    applyMigrations(db);
    await persistDb(db);
    return;
  }
  const SQL = await initSqlJsExtension();
  const incoming = new SQL.Database(bytes);
  const local = await getDatabase();
  mergeDatabases(local, incoming);
  incoming.close();
  await persistDb(local);
}

function mergeDatabases(target: Database, source: Database): void {
  const accounts = source.exec('SELECT * FROM accounts');
  if (accounts.length) {
    const cols = accounts[0].columns;
    for (const vals of accounts[0].values) {
      const row: Record<string, SqlValue> = {};
      cols.forEach((c, i) => {
        row[c] = vals[i];
      });
      const handle = String(row.handle ?? '');
      if (!handle) continue;
      const existing = target.exec(
        `SELECT posts_analyzed, last_scanned_at FROM accounts WHERE handle = '${handle.replace(/'/g, "''")}'`,
      );
      const keepIncoming =
        !existing.length ||
        !existing[0].values.length ||
        Number(row.posts_analyzed) > Number(existing[0].values[0][0]) ||
        Number(row.last_scanned_at) > Number(existing[0].values[0][1]);
      if (!keepIncoming) continue;
      const placeholders = cols.map(() => '?').join(',');
      const stmt = target.prepare(
        `INSERT OR REPLACE INTO accounts (${cols.join(',')}) VALUES (${placeholders})`,
      );
      stmt.run(vals);
      stmt.free();
    }
  }
  const posts = source.exec('SELECT handle, observed_at, source, text_fingerprint, slop_score, spam_score, toxicity_score, has_community_note FROM posts_observed');
  if (posts.length) {
    const stmt = target.prepare(
      `INSERT OR IGNORE INTO posts_observed (handle, observed_at, source, text_fingerprint, slop_score, spam_score, toxicity_score, has_community_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const vals of posts[0].values) {
      stmt.run(vals);
    }
    stmt.free();
  }
}
