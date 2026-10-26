import { env } from '@huggingface/transformers';
import { safeRuntimeSend } from '../../lib/offscreen/safe-runtime';
import { labelsToToxicityAnalysis, type LabelScore } from '../../lib/toxicity/aggregate';
import { loadTransformersPipeline } from './transformers-runtime';

const MODEL_ID = 'Xenova/toxic-bert';

type Classifier = Awaited<ReturnType<typeof loadTransformersPipeline>>;

let classifier: Classifier | null = null;
let isModelLoaded = false;
let isLoading = false;
let loadingPromise: Promise<void> | null = null;
let lastError: string | undefined;

export function getToxicityLoadState(): { isLoaded: boolean; isLoading: boolean } {
  return { isLoaded: isModelLoaded, isLoading };
}

export async function loadToxicityModel(): Promise<void> {
  if (isModelLoaded) return loadingPromise ?? Promise.resolve();
  if (isLoading && loadingPromise) return loadingPromise;

  isLoading = true;
  loadingPromise = (async () => {
    try {
      let lastProgress = 0;
      classifier = await loadTransformersPipeline(env, 'text-classification', MODEL_ID, {
        progress_callback: (data: { progress?: number; status?: string }) => {
          if (data.progress != null) {
            const progress = Math.min(Math.round(data.progress), 99);
            if (progress >= lastProgress + 5) {
              lastProgress = progress;
              safeRuntimeSend({ type: 'TOXICITY_MODEL_PROGRESS', progress });
            }
          }
        },
      });
      isModelLoaded = true;
      lastError = undefined;
      safeRuntimeSend({ type: 'TOXICITY_MODEL_READY' });
    } catch (e) {
      isModelLoaded = false;
      lastError = e instanceof Error ? e.message : String(e);
      safeRuntimeSend({ type: 'TOXICITY_MODEL_ERROR', error: lastError });
    }
  })().finally(() => {
    isLoading = false;
  });

  return loadingPromise;
}

export async function classifyToxicityText(text: string): Promise<ReturnType<typeof labelsToToxicityAnalysis>> {
  if (!classifier || !isModelLoaded) throw new Error('Toxicity model not loaded');
  const truncated = text.trim().slice(0, 512);
  if (truncated.length < 8) {
    return labelsToToxicityAnalysis([]);
  }

  const raw = await classifier(truncated, { topk: 6 });
  const items: LabelScore[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (Array.isArray(row)) {
        for (const x of row as LabelScore[]) items.push(x);
      } else if (row && typeof row === 'object' && 'label' in row) {
        items.push(row as LabelScore);
      }
    }
  }
  return labelsToToxicityAnalysis(items);
}

export function registerToxicityOffscreenHandlers(): void {
  browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'LOAD_TOXICITY_MODEL') {
      if (isModelLoaded) {
        sendResponse({ success: true, loaded: true });
        return false;
      }
      if (isLoading) {
        sendResponse({ success: false, error: 'Already loading' });
        return false;
      }
      loadToxicityModel()
        .then(() =>
          sendResponse(
            isModelLoaded
              ? { success: true, loaded: true }
              : { success: false, error: lastError ?? 'Toxicity load failed' },
          ),
        )
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (request.type === 'CLASSIFY_TOXICITY_TEXT') {
      if (!isModelLoaded) {
        sendResponse({ success: false, error: lastError ?? 'Toxicity model not loaded in offscreen' });
        return false;
      }
      classifyToxicityText(request.text as string)
        .then((result) => sendResponse({ success: true, result }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (request.type === 'CHECK_TOXICITY_STATUS') {
      sendResponse({ isLoaded: isModelLoaded, isLoading, error: lastError });
      return false;
    }

    return false;
  });
}
