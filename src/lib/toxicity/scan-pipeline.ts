import { normalizeReputationResult } from '../scoring/normalize-result';
import { cacheScore } from '../storage';
import type { AccountProfile, ExtensionSettings, ReputationResult } from '../types';
import { refineReputationWithToxicity } from './async-refine';

export async function asyncToxicityRefineAndNotify(
  handle: string,
  result: ReputationResult,
  profile: AccountProfile,
  settings: ExtensionSettings,
): Promise<void> {
  const refined = await refineReputationWithToxicity(result, profile, settings);
  if (!refined) return;

  const normalized = normalizeReputationResult(refined);
  await cacheScore(normalized);

  try {
    const tabs = await browser.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        browser.tabs
          .sendMessage(tab.id, { type: 'TOXICITY_UPDATED', handle, result: normalized })
          .catch(() => {});
        browser.tabs
          .sendMessage(tab.id, { type: 'SLOP_UPDATED', handle, result: normalized })
          .catch(() => {});
      }
    }
  } catch {
    /* no tab */
  }
}
