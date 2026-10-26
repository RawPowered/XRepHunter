const ML_MESSAGE_TYPES = new Set([
  'LOAD_SLOP_ONNX_MODEL',
  'CLASSIFY_SLOP_ONNX_TEXT',
  'CHECK_SLOP_ONNX_STATUS',
  'LOAD_TOXICITY_MODEL',
  'CLASSIFY_TOXICITY_TEXT',
  'CHECK_TOXICITY_STATUS',
  'LOAD_SLOP_IMAGE_MODEL',
  'CLASSIFY_SLOP_IMAGE',
  'CLASSIFY_BROWSE_TOPIC_IMAGE',
  'CHECK_SLOP_IMAGE_STATUS',
]);

let mlHandlersReady = false;
let bootPromise: Promise<void> | null = null;

async function bootMlHandlers(): Promise<void> {
  const { ensureOffscreenOnnxReady } = await import('./onnx-init');
  await ensureOffscreenOnnxReady();
  const [slopOnnx, toxicity, slopImage] = await Promise.all([
    import('./slop-onnx-model'),
    import('./toxicity-model'),
    import('./slop-image-model'),
  ]);
  slopOnnx.registerSlopOnnxOffscreenHandlers();
  toxicity.registerToxicityOffscreenHandlers();
  slopImage.registerSlopImageOffscreenHandlers();
  mlHandlersReady = true;
}

function ensureMlHandlers(): Promise<void> {
  if (!bootPromise) {
    bootPromise = bootMlHandlers().catch((err) => {
      bootPromise = null;
      throw err;
    });
  }
  return bootPromise;
}

function isMlMessage(type: string): boolean {
  return ML_MESSAGE_TYPES.has(type);
}

/** Defer Transformers until first ML message (keeps idle offscreen free of HF/onnx chunk). */
export function registerLazyMlHandlers(): void {
  browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    const type = request?.type as string | undefined;
    if (!type || !isMlMessage(type)) return false;

    if (mlHandlersReady) return false;

    void ensureMlHandlers()
      .then(() => browser.runtime.sendMessage(request))
      .then((res) => sendResponse(res))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));

    return true;
  });
}
