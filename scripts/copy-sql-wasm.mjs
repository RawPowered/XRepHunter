/**
 * Copy sql.js assets for MV3 offscreen (browser build needs sql-wasm-browser.wasm).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'node_modules', 'sql.js', 'dist');
const outDir = path.join(root, 'public', 'sql');

const copies = [
  ['sql-wasm-browser.wasm', 'sql-wasm-browser.wasm'],
  ['sql-wasm-browser.js', 'sql-wasm-browser.js'],
  // Legacy names (worker / node entry)
  ['sql-wasm.wasm', 'sql-wasm.wasm'],
  ['sql-wasm.js', 'sql-wasm.js'],
];

fs.mkdirSync(outDir, { recursive: true });

for (const [srcName, destName] of copies) {
  const src = path.join(dist, srcName);
  const dest = path.join(outDir, destName);
  if (!fs.existsSync(src)) {
    console.error('Missing', src, '— run npm install');
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  console.log('Copied', destName);
}

const browserWasm = path.join(outDir, 'sql-wasm-browser.wasm');
if (!fs.existsSync(browserWasm) || fs.statSync(browserWasm).size < 1024) {
  console.error('sql-wasm-browser.wasm missing or too small');
  process.exit(1);
}
