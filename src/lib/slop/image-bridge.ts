/** Background ↔ offscreen bridge for slop image classification (CLIP zero-shot). */

import { ensureOffscreenDocument, markOffscreenClosed } from '../offscreen/lifecycle';

export interface SlopImageModelStatus {
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

export function getSlopImageModelStatus(): SlopImageModelStatus {
  return {
    isLoaded: isModelLoaded,
    isLoading,
    progress: loadingProgress,
    error: lastError,
  };
}

export function handleSlopImageOffscreenBroadcast(message: {
  type: string;
  progress?: number;
  error?: string;
}): void {
  if (message.type === 'SLOP_IMAGE_MODEL_PROGRESS' && message.progress != null) {
    loadingProgress = message.progress;
  }
  if (message.type === 'SLOP_IMAGE_MODEL_READY') {
    isModelLoaded = true;
    isLoading = false;
    loadingProgress = 100;
    lastError = undefined;
  }
  if (message.type === 'SLOP_IMAGE_MODEL_ERROR') {
    isModelLoaded = false;
    isLoading = false;
    lastError = message.error;
  }
}

export async function initSlopImageModel(): Promise<SlopImageModelStatus> {
  if (isModelLoaded) return getSlopImageModelStatus();
  if (isLoading && initializationPromise) {
    await initializationPromise.catch(() => {});
    return getSlopImageModelStatus();
  }

  isLoading = true;
  loadingProgress = 0;
  lastError = undefined;

  initializationPromise = (async () => {
    try {
      const response = await sendToOffscreen<{ success?: boolean; error?: string }>({
        type: 'LOAD_SLOP_IMAGE_MODEL',
      });
      if (response?.success !== false && !response?.error) {
        isModelLoaded = true;
        loadingProgress = 100;
      } else {
        throw new Error(response?.error ?? 'Slop image model load failed');
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
  return getSlopImageModelStatus();
}

export async function classifySlopImage(
  imageUrl: string,
): Promise<{ success: boolean; result?: { score: number; label: string }; error?: string }> {
  if (!isModelLoaded) {
    const status = await sendToOffscreen<{ isLoaded?: boolean }>({ type: 'CHECK_SLOP_IMAGE_STATUS' });
    if (status?.isLoaded) isModelLoaded = true;
    else await initSlopImageModel();
  }
  if (!isModelLoaded) {
    return { success: false, error: lastError ?? 'Slop image model not ready' };
  }
  return sendToOffscreen({ type: 'CLASSIFY_SLOP_IMAGE', imageUrl });
}

export async function checkSlopImageOffscreenStatus(): Promise<SlopImageModelStatus> {
  try {
    const status = await sendToOffscreen<{ isLoaded?: boolean; isLoading?: boolean }>({
      type: 'CHECK_SLOP_IMAGE_STATUS',
    });
    if (status?.isLoaded) isModelLoaded = true;
    if (status?.isLoading) isLoading = true;
  } catch {
    /* cached */
  }
  return getSlopImageModelStatus();
}
