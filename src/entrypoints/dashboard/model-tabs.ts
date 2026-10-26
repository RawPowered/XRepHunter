import { scoreTextHeuristicDetailed } from '../../lib/detectors/ai-slop';
import { analyzeContentQuality } from '../../lib/detectors/content-quality';
import { sendMessage } from '../../lib/messaging';
import {
  classifySlopMediaRemote,
  getSlopModelStatus,
  initSlopModel,
} from '../../lib/slop/model-client';
import {
  classifyToxicityRemote,
  getToxicityModelStatus,
  initToxicityModel,
} from '../../lib/toxicity/model-client';
import type { ExtensionSettings } from '../../lib/types';
import { saveSettings } from './settings-shared';

const slopPerTweetEl = document.getElementById('slop-per-tweet') as HTMLInputElement;
const slopModelEnabledEl = document.getElementById('ai-slop-model-enabled') as HTMLInputElement;
const slopModelAutoloadEl = document.getElementById('ai-slop-model-autoload') as HTMLInputElement;
const slopThresholdEl = document.getElementById('slop-display-threshold') as HTMLInputElement;
const slopThresholdVal = document.getElementById('slop-display-threshold-val')!;
const spamThresholdEl = document.getElementById('spam-display-threshold') as HTMLInputElement;
const spamThresholdVal = document.getElementById('spam-display-threshold-val')!;
const slopStatusEl = document.getElementById('slop-model-status')!;
const slopProgressEl = document.getElementById('slop-model-progress') as HTMLElement;
const slopLoadBtn = document.getElementById('slop-model-load')!;
const slopTestText = document.getElementById('slop-test-text') as HTMLTextAreaElement;
const slopTestRun = document.getElementById('slop-test-run')!;
const slopTestResult = document.getElementById('slop-test-result')!;
const ollamaEnabledEl = document.getElementById('ollama-model-enabled') as HTMLInputElement;
const ollamaModelEl = document.getElementById('ollama-model-select') as HTMLSelectElement;
const ollamaRefreshEl = document.getElementById('ollama-model-refresh')!;
const ollamaStatusEl = document.getElementById('ollama-model-status')!;

const slopOnnxEnabledEl = document.getElementById('slop-onnx-enabled') as HTMLInputElement;
const slopImageEnabledEl = document.getElementById('slop-image-enabled') as HTMLInputElement;
const aiImageBadgeEnabledEl = document.getElementById('ai-image-badge-enabled') as HTMLInputElement;
const aiImageBadgeThresholdEl = document.getElementById('ai-image-badge-threshold') as HTMLInputElement;
const aiImageBadgeThresholdVal = document.getElementById('ai-image-badge-threshold-val')!;
const manualAiImageMarkEl = document.getElementById('manual-ai-image-mark') as HTMLInputElement;
const manualAiImageSlopEl = document.getElementById('manual-ai-image-slop') as HTMLInputElement;
const promotedAdDimEl = document.getElementById('promoted-ad-dim') as HTMLInputElement;
const slopOnnxStatusEl = document.getElementById('slop-onnx-status')!;
const slopOnnxLoadBtn = document.getElementById('slop-onnx-load')!;
const slopImageStatusEl = document.getElementById('slop-image-status')!;
const slopImageLoadBtn = document.getElementById('slop-image-load')!;
const slopTestImageUrl = document.getElementById('slop-test-image-url') as HTMLInputElement;
const slopTestImageRun = document.getElementById('slop-test-image-run')!;
const slopTestImageResult = document.getElementById('slop-test-image-result')!;

const toxicityEnabledEl = document.getElementById('toxicity-model-enabled') as HTMLInputElement;
const toxicityAutoloadEl = document.getElementById('toxicity-model-autoload') as HTMLInputElement;
const toxicityThresholdEl = document.getElementById('toxicity-display-threshold') as HTMLInputElement;
const toxicityThresholdVal = document.getElementById('toxicity-display-threshold-val')!;
const toxicityStatusEl = document.getElementById('toxicity-model-status')!;
const toxicityProgressEl = document.getElementById('toxicity-model-progress') as HTMLElement;
const toxicityLoadBtn = document.getElementById('toxicity-model-load')!;
const toxicityTestText = document.getElementById('toxicity-test-text') as HTMLTextAreaElement;
const toxicityTestRun = document.getElementById('toxicity-test-run')!;
const toxicityTestResult = document.getElementById('toxicity-test-result')!;

export async function refreshSlopModelUi(): Promise<void> {
  const status = await getSlopModelStatus();
  if (status.isLoaded) {
    slopStatusEl.textContent = 'Model: ready (local inference)';
    slopProgressEl.style.width = '100%';
  } else if (status.isLoading) {
    slopStatusEl.textContent = `Model: loading… ${status.progress}%`;
    slopProgressEl.style.width = `${status.progress}%`;
  } else {
    slopStatusEl.textContent = status.error ? `Model: error — ${status.error}` : 'Model: not loaded';
    slopProgressEl.style.width = '0%';
  }
}

async function refreshSlopOnnxUi(): Promise<void> {
  const status = await sendMessage<{ isLoaded: boolean; isLoading: boolean; error?: string }>({
    type: 'GET_SLOP_ONNX_MODEL_STATUS',
  });
  slopOnnxStatusEl.textContent = status.isLoaded
    ? 'ONNX text: ready'
    : status.isLoading
      ? 'ONNX text: loading…'
      : status.error
        ? `ONNX text: error — ${status.error}`
        : 'ONNX text: not loaded';
}

async function refreshSlopImageUi(): Promise<void> {
  const status = await sendMessage<{ isLoaded: boolean; isLoading: boolean; error?: string }>({
    type: 'GET_SLOP_IMAGE_MODEL_STATUS',
  });
  slopImageStatusEl.textContent = status.isLoaded
    ? 'Image model: ready'
    : status.isLoading
      ? 'Image model: loading…'
      : status.error
        ? `Image model: error — ${status.error}`
        : 'Image model: not loaded';
}

export async function refreshToxicityModelUi(): Promise<void> {
  const status = await getToxicityModelStatus();
  if (status.isLoaded) {
    toxicityStatusEl.textContent = 'Toxicity model: ready (local ONNX)';
    toxicityProgressEl.style.width = '100%';
  } else if (status.isLoading) {
    toxicityStatusEl.textContent = `Toxicity model: loading… ${status.progress}%`;
    toxicityProgressEl.style.width = `${status.progress}%`;
  } else {
    toxicityStatusEl.textContent = status.error
      ? `Toxicity model: error — ${status.error}`
      : 'Toxicity model: not loaded';
    toxicityProgressEl.style.width = '0%';
  }
}

export async function loadSlopSettings(): Promise<void> {
  const s = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  slopPerTweetEl.checked = s.slopPerTweetEnabled !== false;
  slopModelEnabledEl.checked = s.aiSlopModelEnabled;
  ollamaEnabledEl.checked = s.ollamaModelEnabled;
  ollamaModelEl.disabled = !s.ollamaModelEnabled;
  if (s.ollamaModel) ollamaModelEl.dataset.selected = s.ollamaModel;
  ollamaStatusEl.textContent = s.ollamaModelEnabled
    ? `Ollama enabled · ${s.ollamaModel || 'select an installed model'}`
    : 'Ollama disabled';
  slopModelAutoloadEl.checked = s.aiSlopModelAutoLoad;
  slopOnnxEnabledEl.checked = s.slopOnnxEnabled !== false;
  slopImageEnabledEl.checked = s.slopImageModelEnabled !== false;
  aiImageBadgeEnabledEl.checked = s.aiImageBadgeEnabled !== false;
  aiImageBadgeThresholdEl.value = String(s.aiImageBadgeThreshold ?? 35);
  aiImageBadgeThresholdVal.textContent = String(s.aiImageBadgeThreshold ?? 35);
  manualAiImageMarkEl.checked = s.manualAiImageMarkEnabled !== false;
  manualAiImageSlopEl.value = String(s.manualAiImageSlopScore ?? 82);
  promotedAdDimEl.checked = s.promotedAdDimEnabled !== false;
  slopThresholdEl.value = String(s.slopDisplayThreshold ?? 55);
  slopThresholdVal.textContent = String(s.slopDisplayThreshold ?? 55);
  spamThresholdEl.value = String(s.spamDisplayThreshold ?? 40);
  spamThresholdVal.textContent = String(s.spamDisplayThreshold ?? 40);
  void refreshSlopModelUi();
  void refreshSlopOnnxUi();
  void refreshSlopImageUi();
}

export async function loadToxicitySettings(): Promise<void> {
  const s = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  toxicityEnabledEl.checked = s.toxicityModelEnabled !== false;
  toxicityAutoloadEl.checked = s.toxicityModelAutoLoad === true;
  toxicityThresholdEl.value = String(s.toxicityDisplayThreshold ?? 45);
  toxicityThresholdVal.textContent = String(s.toxicityDisplayThreshold ?? 45);
  void refreshToxicityModelUi();
}

function ensureMlWarningsHint(): void {
  if (document.getElementById('ml-warnings-hint')) return;
  const note = document.createElement('p');
  note.id = 'ml-warnings-hint';
  note.className = 'hint';
  note.textContent =
    'Edge may show harmless Hugging Face / WebGPU warnings (content-length, dtype, powerPreference) while downloading models.';
  slopOnnxStatusEl.parentElement?.insertBefore(note, slopOnnxStatusEl);
}

export function initModelTabs(): void {
  ensureMlWarningsHint();
  slopPerTweetEl.addEventListener('change', () =>
    saveSettings({ slopPerTweetEnabled: slopPerTweetEl.checked }),
  );
  slopModelEnabledEl.addEventListener('change', () =>
    saveSettings({ aiSlopModelEnabled: slopModelEnabledEl.checked }),
  );
  slopModelAutoloadEl.addEventListener('change', () =>
    saveSettings({ aiSlopModelAutoLoad: slopModelAutoloadEl.checked }),
  );
  slopThresholdEl.addEventListener('input', () => {
    slopThresholdVal.textContent = slopThresholdEl.value;
    saveSettings({ slopDisplayThreshold: parseInt(slopThresholdEl.value, 10) || 55 });
  });
  spamThresholdEl.addEventListener('input', () => {
    spamThresholdVal.textContent = spamThresholdEl.value;
    saveSettings({ spamDisplayThreshold: parseInt(spamThresholdEl.value, 10) || 40 });
  });
  slopLoadBtn.addEventListener('click', async () => {
    slopStatusEl.textContent = 'Model: loading…';
    await initSlopModel();
    void refreshSlopModelUi();
  });
  ollamaEnabledEl.addEventListener('change', async () => {
    const enabled = ollamaEnabledEl.checked;
    ollamaModelEl.disabled = !enabled;
    await saveSettings({ ollamaModelEnabled: enabled });
    ollamaStatusEl.textContent = enabled ? 'Ollama enabled · connect to select a model' : 'Ollama disabled';
  });
  ollamaRefreshEl.addEventListener('click', async () => {
    ollamaStatusEl.textContent = 'Checking local Ollama…';
    ollamaRefreshEl.setAttribute('disabled', 'true');
    try {
      const originPattern = 'http://127.0.0.1:11434/*';
      const hasPermission = await browser.permissions.contains({ origins: [originPattern] });
      if (!hasPermission && !(await browser.permissions.request({ origins: [originPattern] }))) {
        throw new Error('Local Ollama access was not granted.');
      }
      const models = await sendMessage({ type: 'OLLAMA_LIST_MODELS' }) as unknown as Array<{ name: string }>;
      const previous = ollamaModelEl.dataset.selected ?? ollamaModelEl.value;
      ollamaModelEl.replaceChildren();
      if (!models.length) {
        ollamaModelEl.add(new Option('No models installed', ''));
        ollamaStatusEl.textContent = 'Ollama is running, but no local models were found. Install one with Ollama, then check again.';
      } else {
        ollamaModelEl.add(new Option('Select a model', ''));
        for (const model of models) ollamaModelEl.add(new Option(model.name, model.name));
        if (models.some((model) => model.name === previous)) ollamaModelEl.value = previous;
        ollamaModelEl.disabled = !ollamaEnabledEl.checked;
        ollamaStatusEl.textContent = `Ollama connected · ${models.length} installed model${models.length === 1 ? '' : 's'}`;
      }
    } catch (error) {
      ollamaStatusEl.textContent = error instanceof Error ? `Ollama unavailable · ${error.message}` : 'Ollama unavailable. Start the local server and allow the extension origin in OLLAMA_ORIGINS.';
    } finally {
      ollamaRefreshEl.removeAttribute('disabled');
    }
  });
  ollamaModelEl.addEventListener('change', () => {
    ollamaModelEl.dataset.selected = ollamaModelEl.value;
    saveSettings({ ollamaModel: ollamaModelEl.value });
    if (ollamaModelEl.value) ollamaStatusEl.textContent = `Ollama ready · ${ollamaModelEl.value}`;
  });
  slopTestRun.addEventListener('click', async () => {
    const text = slopTestText.value.trim();
    if (!text) {
      slopTestResult.textContent = 'Paste some text to analyze.';
      return;
    }
    const { score } = scoreTextHeuristicDetailed(text);
    if (score === 0 && text.length < 12) {
      slopTestResult.textContent = 'Need more text (or obvious AI clichés / promo patterns).';
      return;
    }
    const s = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
    const merged = await classifySlopMediaRemote(text);
    const quality = analyzeContentQuality({ text });
    let out = `Heuristic: ${merged.heuristic}\nCombined: ${merged.combined}\n`;
    out += `Quality — spam ${quality.spamLikelihood} · organic ${quality.organicLikelihood} · AI text ${quality.aiTextLikelihood} · slop ${quality.slopLikelihood} · conf ${Math.round(quality.confidence * 100)}%\n`;
    if (quality.topEvidence.length) {
      out += `Evidence: ${quality.topEvidence.slice(0, 3).map((e) => e.label).join('; ')}\n`;
    }
    if (quality.topCounterEvidence.length) {
      out += `Counter: ${quality.topCounterEvidence.slice(0, 2).map((e) => e.label).join('; ')}\n`;
    }
    if (merged.signals?.length) out += `Signals: ${merged.signals.join(', ')}\n`;
    if (merged.onnx != null) out += `ONNX text: ${merged.onnx} (${merged.onnxLabel ?? '—'})\n`;
    if (merged.model != null) out += `Wllama: ${merged.model} (${merged.modelLabel ?? '—'})\n`;
    if (merged.ollama != null) out += `Ollama: ${merged.ollama} (${merged.ollamaLabel ?? '—'}, ${merged.ollamaModel ?? 'model'})\n`;
    if (merged.image != null) out += `Image: ${merged.image}\n`;
    if (!s.slopOnnxEnabled && !s.aiSlopModelEnabled && !s.ollamaModelEnabled) {
      out += 'Enable an optional model in settings to compare model-backed signals.\n';
    }
    slopTestResult.textContent = out;
  });

  slopOnnxEnabledEl.addEventListener('change', () =>
    saveSettings({ slopOnnxEnabled: slopOnnxEnabledEl.checked }),
  );
  slopImageEnabledEl.addEventListener('change', () =>
    saveSettings({ slopImageModelEnabled: slopImageEnabledEl.checked }),
  );
  aiImageBadgeEnabledEl.addEventListener('change', () =>
    saveSettings({ aiImageBadgeEnabled: aiImageBadgeEnabledEl.checked }),
  );
  aiImageBadgeThresholdEl.addEventListener('input', () => {
    aiImageBadgeThresholdVal.textContent = aiImageBadgeThresholdEl.value;
    saveSettings({ aiImageBadgeThreshold: parseInt(aiImageBadgeThresholdEl.value, 10) || 35 });
  });
  manualAiImageMarkEl.addEventListener('change', () =>
    saveSettings({ manualAiImageMarkEnabled: manualAiImageMarkEl.checked }),
  );
  manualAiImageSlopEl.addEventListener('change', () =>
    saveSettings({ manualAiImageSlopScore: parseInt(manualAiImageSlopEl.value, 10) || 82 }),
  );
  promotedAdDimEl.addEventListener('change', () =>
    saveSettings({ promotedAdDimEnabled: promotedAdDimEl.checked }),
  );
  slopOnnxLoadBtn.addEventListener('click', async () => {
    slopOnnxStatusEl.textContent = 'ONNX text: loading…';
    await sendMessage({ type: 'INIT_SLOP_ONNX_MODEL' });
    void refreshSlopOnnxUi();
  });
  slopImageLoadBtn.addEventListener('click', async () => {
    slopImageStatusEl.textContent = 'Image model: loading…';
    await sendMessage({ type: 'INIT_SLOP_IMAGE_MODEL' });
    void refreshSlopImageUi();
  });
  slopTestImageRun.addEventListener('click', async () => {
    const url = slopTestImageUrl.value.trim();
    if (!url) {
      slopTestImageResult.textContent = 'Paste a pbs.twimg.com image URL.';
      return;
    }
    const res = await sendMessage<{
      success: boolean;
      result?: { score: number; label: string };
      error?: string;
    }>({ type: 'CLASSIFY_SLOP_IMAGE', imageUrl: url });
    if (res.success && res.result) {
      slopTestImageResult.textContent = `Image slop: ${res.result.score}\nLabel: ${res.result.label}`;
    } else {
      slopTestImageResult.textContent = res.error ?? 'Image classify failed.';
    }
  });

  toxicityEnabledEl.addEventListener('change', () =>
    saveSettings({ toxicityModelEnabled: toxicityEnabledEl.checked }),
  );
  toxicityAutoloadEl.addEventListener('change', () =>
    saveSettings({ toxicityModelAutoLoad: toxicityAutoloadEl.checked }),
  );
  toxicityThresholdEl.addEventListener('input', () => {
    toxicityThresholdVal.textContent = toxicityThresholdEl.value;
    saveSettings({ toxicityDisplayThreshold: parseInt(toxicityThresholdEl.value, 10) || 45 });
  });
  toxicityLoadBtn.addEventListener('click', async () => {
    toxicityStatusEl.textContent = 'Toxicity model: loading…';
    await initToxicityModel();
    void refreshToxicityModelUi();
  });
  toxicityTestRun.addEventListener('click', async () => {
    const text = toxicityTestText.value.trim();
    if (text.length < 8) {
      toxicityTestResult.textContent = 'Need at least 8 characters.';
      return;
    }
    const tox = await classifyToxicityRemote(text);
    if (!tox) {
      toxicityTestResult.textContent = 'Classification unavailable.';
      return;
    }
    let out = `Combined toxicity: ${tox.combined}\n`;
    if (tox.topLabels?.length) {
      out += 'Top labels:\n';
      for (const l of tox.topLabels) {
        out += `  ${l.label}: ${Math.round(l.score * 100)}%\n`;
      }
    }
    if (tox.source) out += `Source: ${tox.source}\n`;
    toxicityTestResult.textContent = out;
  });

  setInterval(() => void refreshSlopModelUi(), 3000);
  setInterval(() => void refreshToxicityModelUi(), 3000);
}

export function wireModelRuntimeMessages(): void {
  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'MODEL_PROGRESS') {
      slopProgressEl.style.width = `${msg.progress ?? 0}%`;
      slopStatusEl.textContent = `Model: loading… ${msg.progress ?? 0}%`;
    }
    if (msg?.type === 'MODEL_READY') void refreshSlopModelUi();
    if (msg?.type === 'MODEL_ERROR') {
      slopStatusEl.textContent = `Model: error — ${msg.error ?? 'unknown'}`;
    }
    if (msg?.type === 'TOXICITY_MODEL_PROGRESS') {
      toxicityProgressEl.style.width = `${msg.progress ?? 0}%`;
      toxicityStatusEl.textContent = `Toxicity model: loading… ${msg.progress ?? 0}%`;
    }
    if (msg?.type === 'TOXICITY_MODEL_READY') void refreshToxicityModelUi();
    if (msg?.type === 'TOXICITY_MODEL_ERROR') {
      toxicityStatusEl.textContent = `Toxicity model: error — ${msg.error ?? 'unknown'}`;
    }
  });
}
