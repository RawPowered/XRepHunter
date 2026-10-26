import { buildToxicityTextForProfile } from './build-text';
import { classifyToxicityWithFallback } from './classify';
import { applyToxicityToResult } from './refine-reputation';
import type { AccountProfile, ExtensionSettings, ReputationResult } from '../types';

export async function refineReputationWithToxicity(
  result: ReputationResult,
  profile: AccountProfile,
  settings: ExtensionSettings,
): Promise<ReputationResult | null> {
  const text = buildToxicityTextForProfile(profile);
  if (text.length < 12) return null;

  const toxicity = await classifyToxicityWithFallback(text, settings);
  if (!toxicity) return null;

  return applyToxicityToResult(result, toxicity, profile, settings);
}
