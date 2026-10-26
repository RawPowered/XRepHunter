import type { env as TransformersEnv } from '@huggingface/transformers';
import { configureOnnxWasm, ensureOnnxWasmReady as ensureWasmBinary } from './configure-wasm';

/** Shared Transformers.js env for all offscreen ONNX pipelines (MV3 + HF hub). */
export function configureTransformersEnv(env: typeof TransformersEnv): void {
  configureOnnxWasm(env);
  env.allowRemoteModels = true;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.remoteHost = 'https://huggingface.co/';
}

export function ensureOnnxWasmReady(env: typeof TransformersEnv): Promise<void> {
  configureOnnxWasm(env);
  return ensureWasmBinary(env);
}
