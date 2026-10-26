import type { AccountProfile, ExtensionSettings, ReputationResult, SlopAnalysis } from '../types';
import { detectAiSlop } from '../detectors/index';
import { labelToModelScore, mergeSlopScores } from '../detectors/ai-slop';
import { enrichHitsAndBreakdown } from '../scoring/reputation';

export function applySlopToResult(
  result: ReputationResult,
  slop: SlopAnalysis,
  profile: AccountProfile,
  settings: ExtensionSettings,
  opts?: { postSampleCount?: number },
): ReputationResult {
  const slopHit = detectAiSlop(profile, slop);
  let hits = result.hits.filter((h) => h.id !== 'aiSlop' && h.id !== 'aiVoice');
  if (slopHit && settings.detectors.aiSlop?.enabled !== false) {
    hits = [...hits, slopHit];
  }
  const postCount = opts?.postSampleCount ?? profile.postsSample?.length ?? 0;
  return enrichHitsAndBreakdown(
    { ...result, slop },
    hits,
    settings,
    { postSampleCount: postCount, slopCombined: slop.combined },
  );
}

export function refineWithModelSlop(
  result: ReputationResult,
  profile: AccountProfile,
  settings: ExtensionSettings,
  label: string,
): ReputationResult {
  const { score, modelLabel } = labelToModelScore(label);
  if (score == null || !result.slop) return result;
  const slop = mergeSlopScores(result.slop, score, modelLabel);
  return applySlopToResult(result, slop, profile, settings);
}
