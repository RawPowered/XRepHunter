import { scoreTextToxicityHeuristic } from '../detectors/toxicity-heuristic';
import type { ExtensionSettings, ToxicityAnalysis } from '../types';
import { labelsToToxicityAnalysis } from './aggregate';
import { classifyToxicityText } from './model-bridge';

export async function classifyToxicityWithFallback(
  text: string,
  settings: ExtensionSettings,
): Promise<ToxicityAnalysis | null> {
  const trimmed = text.trim();
  if (trimmed.length < 8) return null;

  if (settings.toxicityModelEnabled !== false) {
    const res = await classifyToxicityText(trimmed);
    if (res.success && res.result) {
      return { ...res.result, source: 'model' };
    }
  }

  const { score, signals } = scoreTextToxicityHeuristic(trimmed);
  if (score <= 0 && signals.length === 0) return { combined: 0, source: 'heuristic' };
  return labelsToToxicityAnalysis(
    signals.length
      ? [{ label: 'toxic', score: score / 100 }]
      : [{ label: 'toxic', score: score / 100 }],
  );
}
