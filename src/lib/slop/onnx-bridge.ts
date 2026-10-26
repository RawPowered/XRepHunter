/** Background ↔ offscreen bridge for slop text ONNX (roberta openai-detector ONNX). */

import { ensureOffscreenDocument, markOffscreenClosed } from '../offscreen/lifecycle';

export interface SlopOnnxModelStatus {
  isLoaded: boolean;
  isLoading: boolean;
  progress: number;
  error?: string;
}

let isModelLoaded = false;
let isLoading = false;
let loadingProgress = 0;
let initializationPromise: Promise<void> | null = null;
let lastError: string | undefined;

async function sendToOffscreen<T>(message: Record<string, unknown>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      await ensureOffscreenDocument('Run ONNX slop and image classifiers');
      return (await chrome.runtime.sendMessage(message)) as T;
    } catch (err) {
      markOffscreenClosed();
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Offscreen unreachable');
}

export function getSlopOnnxModelStatus(): SlopOnnxModelStatus {
  return {
    isLoaded: isModelLoaded,
    isLoading,
    progress: loadingProgress,
    error: lastError,
  };
}

export function handleSlopOnnxOffscreenBroadcast(message: {
  type: string;
  progress?: number;
  error?: string;
}): void {
  if (message.type === 'SLOP_ONNX_MODEL_PROGRESS' && message.progress != null) {
    loadingProgress = message.progress;
  }
  if (message.type === 'SLOP_ONNX_MODEL_READY') {
    isModelLoaded = true;
    isLoading = false;
    loadingProgress = 100;
    lastError = undefined;
  }
  if (message.type === 'SLOP_ONNX_MODEL_ERROR') {
    isModelLoaded = false;
    isLoading = false;
    lastError = message.error;
  }
}

export async function initSlopOnnxModel(): Promise<SlopOnnxModelStatus> {
  if (isModelLoaded) return getSlopOnnxModelStatus();
  if (isLoading && initializationPromise) {
    await initializationPromise.catch(() => {});
    return getSlopOnnxModelStatus();
  }

  isLoading = true;
  loadingProgress = 0;
  lastError = undefined;

  initializationPromise = (async () => {
    try {
      const response = await sendToOffscreen<{ success?: boolean; error?: string }>({
        type: 'LOAD_SLOP_ONNX_MODEL',
      });
      if (response?.success !== false && !response?.error) {
        isModelLoaded = true;
        loadingProgress = 100;
      } else {
        throw new Error(response?.error ?? 'Slop ONNX load failed');
      }
    } catch (e) {
      isModelLoaded = false;
      lastError = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      isLoading = false;
    }
  })();

  try {
    await initializationPromise;
  } catch {
    /* status below */
  }
  return getSlopOnnxModelStatus();
}

export async function classifySlopOnnxText(
  text: string,
): Promise<{ success: boolean; result?: { score: number; label: string }; error?: string }> {
  if (!isModelLoaded) {
    const status = await sendToOffscreen<{ isLoaded?: boolean }>({ type: 'CHECK_SLOP_ONNX_STATUS' });
    if (status?.isLoaded) isModelLoaded = true;
  }
  if (!isModelLoaded) {
    return { success: false, error: lastError ?? 'Slop ONNX not loaded' };
  }
  return sendToOffscreen({ type: 'CLASSIFY_SLOP_ONNX_TEXT', text });
}

export async function checkSlopOnnxOffscreenStatus(): Promise<SlopOnnxModelStatus> {
  try {
    const status = await sendToOffscreen<{ isLoaded?: boolean; isLoading?: boolean }>({
      type: 'CHECK_SLOP_ONNX_STATUS',
    });
    if (status?.isLoaded) isModelLoaded = true;
    if (status?.isLoading) isLoading = true;
  } catch {
    /* cached */
  }
  return getSlopOnnxModelStatus();
}
