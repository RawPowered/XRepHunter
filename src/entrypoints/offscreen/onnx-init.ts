import { env } from '@huggingface/transformers';
import {
  configureTransformersEnv,
  ensureOnnxWasmReady,
} from '../../lib/onnx/configure-transformers-env';

/** Sync path override (blocks transformers CDN default) — call before any pipeline/session. */
configureTransformersEnv(env);

let bootPromise: Promise<void> | null = null;

/** Await once per offscreen document before loading ONNX models. */
export function ensureOffscreenOnnxReady(): Promise<void> {
  if (!bootPromise) {
    bootPromise = ensureOnnxWasmReady(env).catch((err) => {
      bootPromise = null;
      throw err;
    });
  }
  return bootPromise;
}
