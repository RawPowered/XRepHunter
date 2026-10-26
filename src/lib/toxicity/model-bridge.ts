/** Background ↔ offscreen bridge for Xenova/toxic-bert (Transformers.js / ONNX). */

import { ensureOffscreenDocument, markOffscreenClosed } from '../offscreen/lifecycle';
import type { ToxicityAnalysis } from '../types';

export interface ToxicityModelStatus {
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
      await ensureOffscreenDocument('Run local toxicity classifier (Transformers.js ONNX)');
      return (await chrome.runtime.sendMessage(message)) as T;
    } catch (err) {
      markOffscreenClosed();
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Offscreen unreachable');
}

export function getToxicityModelStatus(): ToxicityModelStatus {
  return {
    isLoaded: isModelLoaded,
    isLoading,
    progress: loadingProgress,
    error: lastError,
  };
}

export function handleToxicityOffscreenBroadcast(message: {
  type: string;
  progress?: number;
  error?: string;
}): void {
  if (message.type === 'TOXICITY_MODEL_PROGRESS' && message.progress != null) {
    loadingProgress = message.progress;
  }
  if (message.type === 'TOXICITY_MODEL_READY') {
    isModelLoaded = true;
    isLoading = false;
    loadingProgress = 100;
    lastError = undefined;
  }
  if (message.type === 'TOXICITY_MODEL_ERROR') {
    isModelLoaded = false;
    isLoading = false;
    lastError = message.error;
  }
}

export async function initToxicityModel(): Promise<ToxicityModelStatus> {
  if (isModelLoaded) return getToxicityModelStatus();
  if (isLoading && initializationPromise) {
    await initializationPromise.catch(() => {});
    return getToxicityModelStatus();
  }

  isLoading = true;
  loadingProgress = 0;
  lastError = undefined;

  initializationPromise = (async () => {
    try {
      const response = await sendToOffscreen<{ success?: boolean; error?: string }>({
        type: 'LOAD_TOXICITY_MODEL',
      });
      if (response?.success !== false && !response?.error) {
        isModelLoaded = true;
        loadingProgress = 100;
      } else {
        throw new Error(response?.error ?? 'Toxicity model load failed');
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
  return getToxicityModelStatus();
}

export async function classifyToxicityText(
  text: string,
): Promise<{ success: boolean; result?: ToxicityAnalysis; error?: string }> {
  if (!isModelLoaded) {
    const status = await sendToOffscreen<{ isLoaded?: boolean }>({ type: 'CHECK_TOXICITY_STATUS' });
    if (status?.isLoaded) isModelLoaded = true;
    else await initToxicityModel();
  }
  if (!isModelLoaded) {
    return { success: false, error: lastError ?? 'Toxicity model not ready' };
  }
  return sendToOffscreen({ type: 'CLASSIFY_TOXICITY_TEXT', text });
}

export async function checkToxicityOffscreenStatus(): Promise<ToxicityModelStatus> {
  try {
    const status = await sendToOffscreen<{ isLoaded?: boolean; isLoading?: boolean }>({
      type: 'CHECK_TOXICITY_STATUS',
    });
    if (status?.isLoaded) isModelLoaded = true;
    if (status?.isLoading) isLoading = true;
  } catch {
    /* cached */
  }
  return getToxicityModelStatus();
}
