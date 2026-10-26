import { getManualSlopForImage, getMaxManualAiSlopForHandle } from '../db/repositories/manual-ai-images';
import { mergeSlopAnalysisParts } from '../detectors/ai-slop';
import type { SlopAnalysis } from '../types';

export function mergeManualAiSlopScores(
  slop: SlopAnalysis,
  manualMax: number,
  imageManual?: number | null,
): SlopAnalysis {
  const imageScore = Math.max(slop.image ?? 0, manualMax, imageManual ?? 0);
  if (imageScore <= (slop.image ?? 0) && manualMax <= 0 && !imageManual) return slop;
  const signals = [...(slop.signals ?? [])];
  if (manualMax > 0 || imageManual) {
    if (!signals.includes('user_marked_ai')) signals.push('user_marked_ai');
  }
  return mergeSlopAnalysisParts({
    heuristic: slop.heuristic,
    signals,
    onnx: slop.onnx,
    onnxLabel: slop.onnxLabel,
    model: slop.model,
    modelLabel: slop.modelLabel,
    image: imageScore || undefined,
    imageLabel: slop.imageLabel ?? (imageScore ? 'user_marked_ai' : undefined),
    mediaSignals: slop.mediaSignals,
  });
}

export async function mergeAuthorManualAiSlop(
  slop: SlopAnalysis,
  handle: string,
): Promise<SlopAnalysis> {
  const maxManual = await getMaxManualAiSlopForHandle(handle);
  if (maxManual <= 0) return slop;
  return mergeManualAiSlopScores(slop, maxManual, null);
}

export async function mergeTweetManualAiSlop(
  slop: SlopAnalysis,
  handle: string,
  imageUrl?: string,
): Promise<SlopAnalysis> {
  if (!imageUrl) return mergeAuthorManualAiSlop(slop, handle);
  const perImage = await getManualSlopForImage(handle, imageUrl);
  const maxManual = await getMaxManualAiSlopForHandle(handle);
  if (!perImage && maxManual <= 0) return slop;
  return mergeManualAiSlopScores(slop, maxManual, perImage);
}
