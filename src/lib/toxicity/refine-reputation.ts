import { detectContentToxicity } from '../detectors/toxicity';
import type { AccountProfile, ExtensionSettings, ReputationResult, ToxicityAnalysis } from '../types';
import { enrichHitsAndBreakdown } from '../scoring/reputation';

export function applyToxicityToResult(
  result: ReputationResult,
  toxicity: ToxicityAnalysis,
  profile: AccountProfile,
  settings: ExtensionSettings,
): ReputationResult {
  const toxHit = detectContentToxicity(toxicity);
  let hits = result.hits.filter((h) => h.id !== 'contentToxicity');
  if (toxHit && settings.detectors.contentToxicity?.enabled !== false) {
    hits = [...hits, toxHit];
  }
  const postCount = profile.postsSample?.length ?? 0;
  return enrichHitsAndBreakdown(
    { ...result, toxicity },
    hits,
    settings,
    { postSampleCount: postCount, toxicityCombined: toxicity.combined },
  );
}
