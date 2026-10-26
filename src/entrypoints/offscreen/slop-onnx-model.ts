import { env } from '@huggingface/transformers';
import { safeRuntimeSend } from '../../lib/offscreen/safe-runtime';
import { labelsToSlopOnnxScore, type OnnxLabelScore } from '../../lib/slop/onnx-aggregate';
import { loadTransformersPipeline } from './transformers-runtime';

/** Transformers.js needs ONNX artifacts under onnx/; openai-community has weights only. */
const MODEL_ID = 'onnx-community/roberta-base-openai-detector-ONNX';

type Classifier = Awaited<ReturnType<typeof loadTransformersPipeline>>;

let classifier: Classifier | null = null;
let isModelLoaded = false;
let isLoading = false;
let loadingPromise: Promise<void> | null = null;
let lastError: string | undefined;

export async function loadSlopOnnxModel(): Promise<void> {
  if (isModelLoaded) return loadingPromise ?? Promise.resolve();
  if (isLoading && loadingPromise) return loadingPromise;

  isLoading = true;
  loadingPromise = (async () => {
    try {
      let lastProgress = 0;
      classifier = await loadTransformersPipeline(env, 'text-classification', MODEL_ID, {
        progress_callback: (data: { progress?: number }) => {
          if (data.progress != null) {
            const progress = Math.min(Math.round(data.progress), 99);
            if (progress >= lastProgress + 5) {
              lastProgress = progress;
              safeRuntimeSend({ type: 'SLOP_ONNX_MODEL_PROGRESS', progress });
            }
          }
        },
      });
      isModelLoaded = true;
      lastError = undefined;
      safeRuntimeSend({ type: 'SLOP_ONNX_MODEL_READY' });
    } catch (e) {
      isModelLoaded = false;
      lastError = e instanceof Error ? e.message : String(e);
      safeRuntimeSend({ type: 'SLOP_ONNX_MODEL_ERROR', error: lastError });
    }
  })().finally(() => {
    isLoading = false;
  });

  return loadingPromise;
}

export async function classifySlopOnnxText(text: string): Promise<{
  score: number;
  label: string;
}> {
  if (!classifier || !isModelLoaded) throw new Error('Slop ONNX model not loaded');
  const truncated = text.trim().slice(0, 512);
  if (truncated.length < 12) return { score: 0, label: 'short' };

  const raw = await classifier(truncated, { topk: 2 });
  const items: OnnxLabelScore[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (Array.isArray(row)) {
        for (const x of row as OnnxLabelScore[]) items.push(x);
      } else if (row && typeof row === 'object' && 'label' in row) {
        items.push(row as OnnxLabelScore);
      }
    }
  }
  return labelsToSlopOnnxScore(items);
}

export function registerSlopOnnxOffscreenHandlers(): void {
  browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'LOAD_SLOP_ONNX_MODEL') {
      if (isModelLoaded) {
        sendResponse({ success: true, loaded: true });
        return false;
      }
      loadSlopOnnxModel()
        .then(() =>
          sendResponse(
            isModelLoaded
              ? { success: true, loaded: true }
              : { success: false, error: lastError ?? 'Slop ONNX load failed' },
          ),
        )
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.type === 'CLASSIFY_SLOP_ONNX_TEXT') {
      if (!isModelLoaded) {
        sendResponse({ success: false, error: lastError ?? 'Slop ONNX not loaded' });
        return false;
      }
      classifySlopOnnxText(request.text as string)
        .then((result) => sendResponse({ success: true, result }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.type === 'CHECK_SLOP_ONNX_STATUS') {
      sendResponse({ isLoaded: isModelLoaded, isLoading, error: lastError });
      return false;
    }
    return false;
  });
}
