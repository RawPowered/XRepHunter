import type { env as TransformersEnv } from '@huggingface/transformers';

const WASM_DIR = '/onnx/';
const WASM_MJS = `${WASM_DIR}ort-wasm-simd-threaded.jsep.mjs`;
const WASM_WASM = `${WASM_DIR}ort-wasm-simd-threaded.jsep.wasm`;
type OrtWasm = NonNullable<NonNullable<TransformersEnv['backends']['onnx']>['wasm']>;

let readyPromise: Promise<void> | null = null;

function getOnnxWasm(env: typeof TransformersEnv): OrtWasm {
  const wasm = env.backends?.onnx?.wasm;
  if (!wasm) {
    throw new Error('Transformers ONNX wasm env missing — @huggingface/transformers failed to load');
  }
  return wasm;
}

function applyWasmPaths(wasm: OrtWasm): void {
  wasm.wasmPaths = {
    mjs: browser.runtime.getURL(WASM_MJS),
    wasm: browser.runtime.getURL(WASM_WASM),
  };
  wasm.numThreads = 1;
  wasm.proxy = false;
}

/** Point Transformers.js ORT at extension-local ONNX WASM (MV3; never jsdelivr CDN). */
export function configureOnnxWasm(env: typeof TransformersEnv): void {
  applyWasmPaths(getOnnxWasm(env));
}

/** Idempotent: fetch WASM bytes and set wasmBinary so ORT never hits chunks/ or CDN URLs. */
export function ensureOnnxWasmReady(env: typeof TransformersEnv): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      configureOnnxWasm(env);
      const wasm = getOnnxWasm(env);
      const wasmUrl = browser.runtime.getURL(WASM_WASM);
      const res = await fetch(wasmUrl);
      if (!res.ok) {
        throw new Error(
          `ONNX WASM not found (${res.status}) at ${wasmUrl} — run npm run build and reload the extension.`,
        );
      }
      const wasmBinary = await res.arrayBuffer();
      wasm.wasmBinary = wasmBinary;
      applyWasmPaths(wasm);
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}
