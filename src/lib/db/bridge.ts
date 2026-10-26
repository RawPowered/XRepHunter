import type { DbQueryResult } from '../../entrypoints/offscreen/db-engine';
import { isExtensionContextInvalidated } from '../messaging';
import { ensureOffscreenDocument, markOffscreenClosed } from '../offscreen/lifecycle';

async function sendDb<T>(message: Record<string, unknown>): Promise<T> {
  await ensureOffscreenDocument('Run local AI models and SQLite database');
  try {
    const res = (await chrome.runtime.sendMessage(message)) as {
      ok: boolean;
      error?: string;
      result?: T;
      bytes?: number[];
    };
    if (!res?.ok) throw new Error(res?.error ?? 'Database request failed');
    return res as T;
  } catch (err) {
    if (isExtensionContextInvalidated(err)) {
      markOffscreenClosed();
      throw err;
    }
    throw err;
  }
}

let dbReady = false;

export async function initDb(): Promise<void> {
  if (dbReady) return;
  await sendDb({ type: 'DB_INIT' });
  dbReady = true;
}

export async function dbRun(sql: string, params?: unknown[]): Promise<void> {
  await initDb();
  await sendDb({ type: 'DB_RUN', sql, params });
}

export async function dbExec(sql: string): Promise<void> {
  await initDb();
  await sendDb({ type: 'DB_EXEC', sql });
}

export async function dbQuery(sql: string, params?: unknown[]): Promise<DbQueryResult> {
  await initDb();
  const res = await sendDb<{ result: DbQueryResult }>({ type: 'DB_QUERY', sql, params });
  return (res as { result: DbQueryResult }).result;
}

export async function dbExportBytes(): Promise<Uint8Array> {
  await initDb();
  const res = await sendDb<{ bytes: number[] }>({ type: 'DB_EXPORT' });
  return new Uint8Array((res as { bytes: number[] }).bytes);
}

export async function dbImportBytes(bytes: Uint8Array, mode: 'replace' | 'merge'): Promise<void> {
  await sendDb({ type: 'DB_IMPORT', bytes: Array.from(bytes), mode });
  dbReady = true;
}
