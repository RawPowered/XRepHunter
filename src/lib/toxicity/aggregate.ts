import type { ToxicityAnalysis } from '../types';

/** Demeaning / harmful — drives the displayed T score. */
export const DEMEANING_LABELS = [
  'identity_hate',
  'threat',
  'insult',
  'severe_toxic',
] as const;

/** Profanity or vague rudeness — tracked but not counted alone. */
export const PROFANITY_LABELS = ['toxic', 'obscene'] as const;

export const HATE_LABELS = [...DEMEANING_LABELS, ...PROFANITY_LABELS] as const;

export type ToxicityLabel = (typeof HATE_LABELS)[number];

export interface LabelScore {
  label: string;
  score: number;
}

/** Combined score: demeaning labels only; generic toxic counts with demeaning context. */
export function computeCombinedToxicity(labelScores: Record<string, number>): number {
  const demeaningMax = Math.max(...DEMEANING_LABELS.map((l) => labelScores[l] ?? 0), 0);
  let combined = demeaningMax;
  const toxic = labelScores.toxic ?? 0;
  if (toxic > 0 && demeaningMax >= 0.25) {
    combined = Math.max(combined, toxic);
  }
  return Math.round(100 * combined);
}

export function labelsToToxicityAnalysis(items: LabelScore[]): ToxicityAnalysis {
  const labelScores: Record<string, number> = {};
  for (const item of items) {
    const key = item.label.toLowerCase().replace(/\s+/g, '_');
    labelScores[key] = Math.max(labelScores[key] ?? 0, item.score);
  }
  const combined = computeCombinedToxicity(labelScores);
  const topLabels = [...items]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => ({ label: x.label, score: Math.round(x.score * 1000) / 1000 }));
  return { combined, labelScores, topLabels };
}
