import {
  dbExec,
  dbQuery,
  dbRun,
  exportDatabaseBytes,
  flushDatabase,
  getDatabase,
  importDatabaseBytes,
} from './db-engine';

export function registerDbHandlers(): void {
  browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    const type = request?.type as string | undefined;
    if (!type?.startsWith('DB_')) return false;

    void (async () => {
      try {
        switch (type) {
          case 'DB_INIT': {
            await getDatabase();
            sendResponse({ ok: true });
            break;
          }
          case 'DB_RUN': {
            await dbRun(request.sql as string, request.params as never);
            sendResponse({ ok: true });
            break;
          }
          case 'DB_EXEC': {
            await dbExec(request.sql as string);
            sendResponse({ ok: true });
            break;
          }
          case 'DB_QUERY': {
            const result = await dbQuery(request.sql as string, request.params as never);
            sendResponse({ ok: true, result });
            break;
          }
          case 'DB_FLUSH': {
            await flushDatabase();
            sendResponse({ ok: true });
            break;
          }
          case 'DB_EXPORT': {
            const bytes = await exportDatabaseBytes();
            sendResponse({ ok: true, bytes: Array.from(bytes) });
            break;
          }
          case 'DB_IMPORT': {
            const bytes = new Uint8Array(request.bytes as number[]);
            await importDatabaseBytes(bytes, (request.mode as 'replace' | 'merge') ?? 'replace');
            sendResponse({ ok: true });
            break;
          }
          default:
            sendResponse({ ok: false, error: 'Unknown DB message' });
        }
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  });
}
