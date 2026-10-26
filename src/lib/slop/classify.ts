import {
  labelToModelScore,
  mergeSlopAnalysisParts,
  scoreTextHeuristicDetailed,
} from '../detectors/ai-slop';
import { buildMediaEvidence } from '../detectors/media-evidence';
import type { ExtensionSettings, SlopAnalysis } from '../types';
import { classifySlopText, getSlopModelStatus } from './model-bridge';
import { checkSlopOnnxOffscreenStatus, classifySlopOnnxText } from './onnx-bridge';
import { checkSlopImageOffscreenStatus, classifySlopImage } from './image-bridge';
import { scoreMediaHeuristic } from './media-heuristic';
import type { TweetMediaInfo } from './extract-tweet-content';

let onnxReadyCache: boolean | null = null;
let onnxReadyAt = 0;
let imageReadyCache: boolean | null = null;
let imageReadyAt = 0;
let wllamaReadyCache: boolean | null = null;
let wllamaReadyAt = 0;
const READY_TTL_MS = 30_000;

async function isOnnxReady(): Promise<boolean> {
  if (onnxReadyCache != null && Date.now() - onnxReadyAt < READY_TTL_MS) return onnxReadyCache;
  const s = await checkSlopOnnxOffscreenStatus().catch(() => ({ isLoaded: false }));
  onnxReadyCache = Boolean(s.isLoaded);
  onnxReadyAt = Date.now();
  return onnxReadyCache;
}

async function isImageReady(): Promise<boolean> {
  if (imageReadyCache != null && Date.now() - imageReadyAt < READY_TTL_MS) return imageReadyCache;
  const s = await checkSlopImageOffscreenStatus().catch(() => ({ isLoaded: false }));
  imageReadyCache = Boolean(s.isLoaded);
  imageReadyAt = Date.now();
  return imageReadyCache;
}

async function isWllamaReady(): Promise<boolean> {
  if (wllamaReadyCache != null && Date.now() - wllamaReadyAt < READY_TTL_MS) return wllamaReadyCache;
  const s = await getSlopModelStatus().catch(() => ({ isLoaded: false }));
  wllamaReadyCache = Boolean(s.isLoaded);
  wllamaReadyAt = Date.now();
  return wllamaReadyCache;
}

export async function classifySlopMedia(
  text: string,
  media: TweetMediaInfo,
  settings: ExtensionSettings,
): Promise<SlopAnalysis> {
  const trimmed = text.trim();
  const { score: heuristicScore, signals } = scoreTextHeuristicDetailed(trimmed);
  const { boost, signals: mediaSignals } = scoreMediaHeuristic(media, heuristicScore);
  const heuristic = Math.min(100, heuristicScore + boost);

  let onnx: number | undefined;
  let onnxLabel: string | undefined;
  let model: number | undefined;
  let modelLabel: SlopAnalysis['modelLabel'];
  let image: number | undefined;
  let imageLabel: string | undefined;

  const mlTasks: Promise<void>[] = [];

  if (settings.slopOnnxEnabled !== false && trimmed.length >= 12) {
    mlTasks.push(
      (async () => {
        if (!(await isOnnxReady())) return;
        const res = await classifySlopOnnxText(trimmed);
        if (res.success && res.result) {
          onnx = res.result.score;
          onnxLabel = res.result.label;
        }
      })(),
    );
  }

  if (settings.aiSlopModelEnabled && trimmed.length >= 20) {
    mlTasks.push(
      (async () => {
        if (!(await isWllamaReady())) return;
        const res = await classifySlopText(trimmed);
        if (res.success && res.result?.label) {
          const mapped = labelToModelScore(res.result.label);
          if (mapped.score != null) {
            model = mapped.score;
            modelLabel = mapped.modelLabel;
          }
        }
      })(),
    );
  }

  if (settings.slopImageModelEnabled !== false && media.imageUrl) {
    mlTasks.push(
      (async () => {
        if (!(await isImageReady())) return;
        const res = await classifySlopImage(media.imageUrl!);
        if (res.success && res.result) {
          image = res.result.score;
          imageLabel = res.result.label;
        }
      })(),
    );
  }

  if (mlTasks.length) await Promise.allSettled(mlTasks);

  const merged = mergeSlopAnalysisParts({
    heuristic,
    signals,
    onnx,
    onnxLabel,
    model,
    modelLabel,
    image,
    imageLabel,
    mediaSignals,
  });

  const mediaEvidence = buildMediaEvidence({
    text: trimmed,
    media,
    imageScore: image,
    imageLabel,
    cardTitle: media.cardTitle,
  });

  return {
    ...merged,
    mediaEvidence,
  };
}
