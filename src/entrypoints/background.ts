import { initDb } from '../lib/db/bridge';
import { migrateScoresFromStorageIfNeeded } from '../lib/db/migrate-storage';
import { isExtensionContextInvalidated } from '../lib/messaging';
import { resetOffscreenDocument } from '../lib/offscreen/lifecycle';
import { maybePrefetchSlopModels } from '../lib/slop/async-refine';
import { initToxicityModel } from '../lib/toxicity/model-bridge';
import { getSettings } from '../lib/storage';
import { installBackgroundErrorHandlers } from './background/error-handlers';
import { ensureDefaultExamples } from './background/scan-pipeline';
import { registerMessageRouter } from './background/message-router';
import { refreshXContentTabs } from './background/refresh-content';

async function onBackgroundWake(): Promise<void> {
  await resetOffscreenDocument();
  await refreshXContentTabs();
}

async function initDbSafe(): Promise<void> {
  try {
    await initDb();
    await migrateScoresFromStorageIfNeeded();
  } catch (err) {
    if (!isExtensionContextInvalidated(err)) throw err;
  }
}

export default defineBackground(() => {
  installBackgroundErrorHandlers();
  void ensureDefaultExamples();
  void onBackgroundWake().then(() => initDbSafe());
  registerMessageRouter();

  browser.runtime.onStartup.addListener(() => {
    void onBackgroundWake();
  });

  browser.runtime.onInstalled.addListener(async () => {
    await onBackgroundWake();
    void ensureDefaultExamples();
    const settings = await getSettings();
    // Defer ONNX prefetch so offscreen finishes WASM bootstrap first.
    setTimeout(() => {
      void maybePrefetchSlopModels(settings);
      if (settings.toxicityModelEnabled !== false && settings.toxicityModelAutoLoad) {
        void initToxicityModel();
      }
    }, 1500);
  });
});
