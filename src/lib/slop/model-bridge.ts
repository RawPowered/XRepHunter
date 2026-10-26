/** Background ↔ offscreen bridge for Distil AI Slop Detector model (Apache 2.0). */

import { ensureOffscreenDocument, markOffscreenClosed } from '../offscreen/lifecycle';

export interface SlopModelStatus {
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
      await ensureOffscreenDocument('Run local AI slop classifier (Wllama)');
      return (await chrome.runtime.sendMessage(message)) as T;
    } catch (err) {
      markOffscreenClosed();
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Offscreen unreachable');
}

export function getSlopModelStatus(): SlopModelStatus {
  return {
    isLoaded: isModelLoaded,
    isLoading,
    progress: loadingProgress,
    error: lastError,
  };
}

export function handleOffscreenBroadcast(message: { type: string; progress?: number; error?: string }): void {
  if (message.type === 'MODEL_PROGRESS' && message.progress != null) {
    loadingProgress = message.progress;
  }
  if (message.type === 'MODEL_READY') {
    isModelLoaded = true;
    isLoading = false;
    loadingProgress = 100;
    lastError = undefined;
  }
  if (message.type === 'MODEL_ERROR') {
    isModelLoaded = false;
    isLoading = false;
    lastError = message.error;
  }
}

export async function initSlopModel(): Promise<SlopModelStatus> {
  if (isModelLoaded) return getSlopModelStatus();
  if (isLoading && initializationPromise) {
    await initializationPromise.catch(() => {});
    return getSlopModelStatus();
  }

  isLoading = true;
  loadingProgress = 0;
  lastError = undefined;

  initializationPromise = (async () => {
    try {
      const response = await sendToOffscreen<{ success?: boolean; error?: string }>({
        type: 'LOAD_MODEL',
      });
      if (response?.success !== false && !response?.error) {
        isModelLoaded = true;
        loadingProgress = 100;
      } else {
        throw new Error(response?.error ?? 'Model load failed');
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
    /* status returned below */
  }
  return getSlopModelStatus();
}

export async function classifySlopText(
  text: string,
): Promise<{ success: boolean; result?: { label: string }; error?: string }> {
  if (!isModelLoaded) {
    const status = await sendToOffscreen<{ isLoaded?: boolean }>({ type: 'CHECK_STATUS' });
    if (status?.isLoaded) isModelLoaded = true;
    else {
      await initSlopModel();
    }
  }
  if (!isModelLoaded) {
    return { success: false, error: lastError ?? 'Model not ready' };
  }
  return sendToOffscreen({ type: 'CLASSIFY_TEXT', text });
}

export async function checkOffscreenStatus(): Promise<SlopModelStatus> {
  try {
    const status = await sendToOffscreen<{ isLoaded?: boolean; isLoading?: boolean }>({
      type: 'CHECK_STATUS',
    });
    if (status?.isLoaded) isModelLoaded = true;
    if (status?.isLoading) isLoading = true;
  } catch {
    /* keep cached flags */
  }
  return getSlopModelStatus();
}
