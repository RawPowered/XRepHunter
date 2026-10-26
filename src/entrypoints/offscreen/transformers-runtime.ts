import { pipeline, type env as TransformersEnv } from '@huggingface/transformers';
import {
  configureTransformersEnv,
  ensureOnnxWasmReady,
} from '../../lib/onnx/configure-transformers-env';

let configured = false;

function ensureEnvConfigured(env: typeof TransformersEnv): void {
  if (configured) return;
  configureTransformersEnv(env);
  configured = true;
}

/** Load a Transformers pipeline after ONNX WASM is ready (MV3-safe). */
export async function loadTransformersPipeline(
  env: typeof TransformersEnv,
  task: Parameters<typeof pipeline>[0],
  model: string,
  options?: Parameters<typeof pipeline>[2],
): Promise<Awaited<ReturnType<typeof pipeline>>> {
  ensureEnvConfigured(env);
  await ensureOnnxWasmReady(env);
  return pipeline(task, model, options);
}
