/** Copy the pinned Wllama browser runtime into WXT's public asset directory. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = path.join(root, 'node_modules', '@wllama', 'wllama', 'esm');
const outRoot = path.join(root, 'public', 'wllama', 'esm');

const files = [
  ['index.js', 'index.js'],
  ['single-thread/wllama.wasm', 'single-thread/wllama.wasm'],
  ['multi-thread/wllama.wasm', 'multi-thread/wllama.wasm'],
];

for (const [sourceName, outputName] of files) {
  const source = path.join(packageRoot, sourceName);
  const output = path.join(outRoot, outputName);
  if (!fs.existsSync(source)) {
    console.error(`Missing Wllama runtime file: ${path.relative(root, source)}. Run npm install.`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(source, output);
  console.log(`Copied ${path.relative(root, output)}`);
}

// Earlier local snapshots contained CDN error bodies at these runtime paths.
// Remove only those known placeholder responses, preserving any valid custom file.
for (const name of [
  'single-thread/wllama.js',
  'multi-thread/wllama.js',
  'multi-thread/wllama.worker.mjs',
]) {
  const stale = path.join(outRoot, name);
  if (!fs.existsSync(stale)) continue;
  const body = fs.readFileSync(stale, 'utf8');
  if (body.startsWith("Couldn't find the requested file /esm/")) {
    fs.unlinkSync(stale);
    console.log(`Removed stale Wllama placeholder ${path.relative(root, stale)}`);
  }
}
