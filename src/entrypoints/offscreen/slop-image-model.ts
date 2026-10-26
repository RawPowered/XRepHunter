import { env, RawImage } from '@huggingface/transformers';
import { safeRuntimeSend } from '../../lib/offscreen/safe-runtime';
import { CLIP_LABEL_TO_TOPIC, TOPIC_CLIP_LABELS } from '../../lib/browse/topic-taxonomy';
import type { BrowseTopicId } from '../../lib/browse/topic-taxonomy';
import { labelsToSlopImageScore, type ImageLabelScore } from '../../lib/slop/image-aggregate';
import { loadTransformersPipeline } from './transformers-runtime';

const MODEL_ID = 'Xenova/clip-vit-base-patch32';
const CLIP_LABELS = [
  'AI generated promotional marketing graphic',
  'authentic photograph of a real scene',
  'screenshot or UI mockup',
];

type ZeroShotClassifier = Awaited<ReturnType<typeof loadTransformersPipeline>>;

let classifier: ZeroShotClassifier | null = null;
let isModelLoaded = false;
let isLoading = false;
let loadingPromise: Promise<void> | null = null;
let lastError: string | undefined;

export async function loadSlopImageModel(): Promise<void> {
  if (isModelLoaded) return loadingPromise ?? Promise.resolve();
  if (isLoading && loadingPromise) return loadingPromise;

  isLoading = true;
  loadingPromise = (async () => {
    try {
      let lastProgress = 0;
      classifier = await loadTransformersPipeline(env, 'zero-shot-image-classification', MODEL_ID, {
        progress_callback: (data: { progress?: number }) => {
          if (data.progress != null) {
            const progress = Math.min(Math.round(data.progress), 99);
            if (progress >= lastProgress + 5) {
              lastProgress = progress;
              safeRuntimeSend({ type: 'SLOP_IMAGE_MODEL_PROGRESS', progress });
            }
          }
        },
      });
      isModelLoaded = true;
      lastError = undefined;
      safeRuntimeSend({ type: 'SLOP_IMAGE_MODEL_READY' });
    } catch (e) {
      isModelLoaded = false;
      lastError = e instanceof Error ? e.message : String(e);
      safeRuntimeSend({ type: 'SLOP_IMAGE_MODEL_ERROR', error: lastError });
    }
  })().finally(() => {
    isLoading = false;
  });

  return loadingPromise;
}

export async function classifySlopImageUrl(imageUrl: string): Promise<{
  score: number;
  label: string;
}> {
  if (!classifier || !isModelLoaded) throw new Error('Slop image model not loaded');
  const image = await RawImage.fromURL(imageUrl);
  const raw = await classifier(image, CLIP_LABELS);
  const items: ImageLabelScore[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (row && typeof row === 'object' && 'label' in row) {
        items.push(row as ImageLabelScore);
      }
    }
  }
  const ai = items.find((i) => i.label.includes('AI generated'));
  if (ai && ai.score >= 0.35) {
    return { score: Math.round(ai.score * 100), label: ai.label };
  }
  return labelsToSlopImageScore(items);
}

export async function classifyBrowseTopicImageUrl(imageUrl: string): Promise<{
  topic: BrowseTopicId;
  score: number;
  label: string;
}> {
  if (!classifier || !isModelLoaded) throw new Error('Slop image model not loaded');
  const image = await RawImage.fromURL(imageUrl);
  const raw = await classifier(image, TOPIC_CLIP_LABELS);
  const items: ImageLabelScore[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (row && typeof row === 'object' && 'label' in row) {
        items.push(row as ImageLabelScore);
      }
    }
  }
  const best = items.sort((a, b) => b.score - a.score)[0];
  const label = best?.label ?? TOPIC_CLIP_LABELS[0];
  const topic = CLIP_LABEL_TO_TOPIC[label] ?? 'other';
  return { topic, score: best?.score ?? 0, label };
}

export function registerSlopImageOffscreenHandlers(): void {
  browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'LOAD_SLOP_IMAGE_MODEL') {
      if (isModelLoaded) {
        sendResponse({ success: true, loaded: true });
        return false;
      }
      loadSlopImageModel()
        .then(() =>
          sendResponse(
            isModelLoaded
              ? { success: true, loaded: true }
              : { success: false, error: lastError ?? 'Slop image load failed' },
          ),
        )
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.type === 'CLASSIFY_SLOP_IMAGE') {
      if (!isModelLoaded) {
        sendResponse({ success: false, error: lastError ?? 'Slop image model not loaded' });
        return false;
      }
      classifySlopImageUrl(request.imageUrl as string)
        .then((result) => sendResponse({ success: true, result }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.type === 'CLASSIFY_BROWSE_TOPIC_IMAGE') {
      if (!isModelLoaded) {
        sendResponse({ success: false, error: lastError ?? 'Slop image model not loaded' });
        return false;
      }
      classifyBrowseTopicImageUrl(request.imageUrl as string)
        .then((result) => sendResponse({ success: true, result }))
        .catch((error: Error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
    if (request.type === 'CHECK_SLOP_IMAGE_STATUS') {
      sendResponse({ isLoaded: isModelLoaded, isLoading, error: lastError });
      return false;
    }
    return false;
  });
}
