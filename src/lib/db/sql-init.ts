import initSqlJs, { type SqlJsStatic } from 'sql.js';

const SQL_WASM_FILE = 'sql-wasm-browser.wasm';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

/** Load sql.js once with extension-local WASM (browser build → sql-wasm-browser.wasm). */
export function initSqlJsExtension(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = (async () => {
      const wasmUrl = browser.runtime.getURL(`/sql/${SQL_WASM_FILE}`);
      const res = await fetch(wasmUrl);
      if (!res.ok) {
        throw new Error(
          `sql.js WASM not found (${res.status}) at ${wasmUrl} — run npm run build and reload the extension.`,
        );
      }
      const wasmBinary = await res.arrayBuffer();
      return initSqlJs({
        wasmBinary,
        locateFile: (file) => browser.runtime.getURL(`/sql/${file}`),
      });
    })().catch((err) => {
      sqlJsPromise = null;
      throw err;
    });
  }
  return sqlJsPromise;
}
