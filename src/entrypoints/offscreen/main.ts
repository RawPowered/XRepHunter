// Adapted from Distil Labs AI Slop Detector (Apache 2.0)
// @see https://github.com/distil-labs/distil-ai-slop-detector

import { safeRuntimeSend } from '../../lib/offscreen/safe-runtime';
import { installOffscreenErrorHandlers } from './error-handlers';

installOffscreenErrorHandlers();

/** SQLite (sql.js) — must register before background sends DB_INIT. */
const { registerDbHandlers } = await import('./db-handlers');
registerDbHandlers();

/** Transformers / ONNX — loaded on first ML message only. */
const { registerLazyMlHandlers } = await import('./ml-handlers');
registerLazyMlHandlers();

const wllamaModule = await import(browser.runtime.getURL('/wllama/esm/index.js'));
const { Wllama } = wllamaModule as { Wllama: new (paths: Record<string, string>, opts?: object) => WllamaInstance };

type WllamaInstance = {
  loadModelFromUrl: (url: string, opts: object) => Promise<void>;
  createCompletion: (prompt: string, opts: object) => Promise<string>;
};

const CONFIG_PATHS = {
  'single-thread/wllama.wasm': browser.runtime.getURL('/wllama/esm/single-thread/wllama.wasm'),
  'multi-thread/wllama.wasm': browser.runtime.getURL('/wllama/esm/multi-thread/wllama.wasm'),
};

const MODEL_URL =
  'https://huggingface.co/distil-labs/ai-slop-detector-v1-gguf/resolve/main/ai-slop-v4-q4_k_m.gguf';

let wllama: WllamaInstance | null = null;
let isModelLoaded = false;
let isLoading = false;
let loadingPromise: Promise<void> | null = null;

browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'LOAD_MODEL') {
    if (isModelLoaded) {
      sendResponse({ success: true, loaded: true });
      return false;
    }
    if (isLoading) {
      sendResponse({ success: false, error: 'Already loading' });
      return false;
    }
    loadModel()
      .then(() => sendResponse({ success: true, loaded: true }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'CLASSIFY_TEXT') {
    if (!isModelLoaded) {
      sendResponse({ success: false, error: 'Model not loaded in offscreen' });
      return false;
    }
    classifyText(request.text as string)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error: Error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'CHECK_STATUS') {
    sendResponse({ isLoaded: isModelLoaded, isLoading });
    return false;
  }

  return false;
});

async function loadModel(): Promise<void> {
  if (isModelLoaded) return loadingPromise ?? Promise.resolve();
  if (isLoading && loadingPromise) return loadingPromise;

  isLoading = true;
  loadingPromise = (async () => {
    wllama = new Wllama(CONFIG_PATHS, {
      logger: {
        debug: () => {},
        log: () => {},
        warn: (...args: unknown[]) => {
          const msg = args.join(' ');
          const ignore = ['special_eos_id', 'munmap failed', 'n_ctx_seq', 'n_ctx_train', 'llama_kv_cache'];
          if (!ignore.some((w) => msg.includes(w))) console.warn(...args);
        },
        error: (...args: unknown[]) => console.error(...args),
      },
    });

    let lastProgress = 0;
    await wllama.loadModelFromUrl(MODEL_URL, {
      n_ctx: 2048,
      n_threads: navigator.hardwareConcurrency || 4,
      progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
        if (total && total > 0) {
          const progress = Math.min(Math.round((loaded / total) * 100), 99);
          if (progress >= lastProgress + 5) {
            lastProgress = progress;
            safeRuntimeSend({ type: 'MODEL_PROGRESS', progress });
          }
        }
      },
    });

    isModelLoaded = true;
    safeRuntimeSend({ type: 'MODEL_READY' });
  })().finally(() => {
    isLoading = false;
  });

  return loadingPromise;
}

async function classifyText(text: string): Promise<{ label: string; raw: string }> {
  if (!wllama || !isModelLoaded) throw new Error('Model not loaded');

  const truncatedText = text.slice(0, 1500);
  const prompt = `<|user|>
Classify this text as exactly 'ai_generated' or 'human_written':

"${truncatedText.replace(/"/g, '\\"')}"

Respond with ONLY one of these two words: ai_generated or human_written
<|model|>
`;

  const output = await wllama.createCompletion(prompt, {
    nPredict: 10,
    sampling: {
      temp: 0.0,
      top_k: 1,
      top_p: 1.0,
      repeat_penalty: 1.1,
    },
    stop: ['\n', '.', ' '],
  });

  const normalized = output.toLowerCase().trim();
  if (normalized.includes('ai_generated') || normalized.startsWith('ai')) {
    return { label: 'ai_generated', raw: output };
  }
  if (normalized.includes('human_written') || normalized.startsWith('human')) {
    return { label: 'human_written', raw: output };
  }
  return { label: 'uncertain', raw: output };
}
