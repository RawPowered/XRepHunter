/**
 * Copy ONNX Runtime WASM loader into public/onnx for MV3 (no CDN dynamic import).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgVersion =
  JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies[
    '@huggingface/transformers'
  ]?.replace(/^\^/, '') ?? '3.4.0';

const outDir = path.join(root, 'public', 'onnx');
const srcMjs = path.join(
  root,
  'node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs',
);
const outMjs = path.join(outDir, 'ort-wasm-simd-threaded.jsep.mjs');
const outWasm = path.join(outDir, 'ort-wasm-simd-threaded.jsep.wasm');
const wasmUrl = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${pkgVersion}/dist/ort-wasm-simd-threaded.jsep.wasm`;

fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(srcMjs)) {
  console.error('Missing', srcMjs, '— run npm install');
  process.exit(1);
}
fs.copyFileSync(srcMjs, outMjs);
console.log('Copied', path.basename(outMjs));

async function ensureWasm() {
  if (fs.existsSync(outWasm) && process.env.FORCE_ONNX_WASM !== '1') {
    console.log('WASM already present:', path.basename(outWasm));
    return;
  }
  const localCandidates = [
    path.join(root, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm'),
    path.join(
      root,
      'node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm',
    ),
  ];
  for (const local of localCandidates) {
    if (fs.existsSync(local)) {
      fs.copyFileSync(local, outWasm);
      console.log('Copied WASM from', path.relative(root, local));
      return;
    }
  }
  console.log('Downloading', wasmUrl, '…');
  const res = await fetch(wasmUrl);
  if (!res.ok) {
    console.error('Failed to download WASM:', res.status, res.statusText);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outWasm, buf);
  console.log('Wrote', path.basename(outWasm), `(${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

await ensureWasm();

// ORT may request non-jsep filenames depending on the bundled runtime build.
const altPairs = [
  ['ort-wasm-simd-threaded.mjs', outMjs],
  ['ort-wasm-simd-threaded.wasm', outWasm],
];
for (const [altName, src] of altPairs) {
  const altPath = path.join(outDir, altName);
  if (!fs.existsSync(altPath) || process.env.FORCE_ONNX_WASM === '1') {
    fs.copyFileSync(src, altPath);
    console.log('Copied alias', altName);
  }
}

if (!fs.existsSync(outWasm) || fs.statSync(outWasm).size < 1024) {
  console.error('ONNX WASM missing or too small — slop/toxicity models will not load.');
  process.exit(1);
}
