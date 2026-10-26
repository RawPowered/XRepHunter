import { DEFAULT_SPAM_EXAMPLES } from '../../lib/examples/defaults';
import { initDb } from '../../lib/db/bridge';
import { migrateScoresFromStorageIfNeeded } from '../../lib/db/migrate-storage';
import {
  getAccountRollups,
  getLatestSnapshot,
  saveReputationSnapshot,
  upsertAccountFromScan,
} from '../../lib/db/repositories/accounts';
import { batchInsertFromProfilePosts } from '../../lib/db/repositories/posts';
import { buildSlopTextForModel } from '../../lib/detectors/ai-slop';
import { normalizeReputationResult } from '../../lib/scoring/normalize-result';
import { computePostSignalsRisk, postSignalHits } from '../../lib/scoring/post-signals';
import { computeReputation, mergeProfiles, shouldSuggestBlock } from '../../lib/scoring/reputation';
import { asyncRefineAndNotify } from '../../lib/slop/scan-pipeline';
import { mergeAuthorManualAiSlop } from '../../lib/slop/manual-ai-merge';
import { applySlopToResult } from '../../lib/slop/refine-reputation';
import { asyncToxicityRefineAndNotify } from '../../lib/toxicity/scan-pipeline';
import { buildToxicityTextForProfile } from '../../lib/toxicity/build-text';
import {
  addSpamExample,
  bumpStat,
  cacheScore,
  getCachedScore,
  getSettings,
  getSpamExamples,
  upsertQueueItem,
} from '../../lib/storage';
import type { AccountProfile, BlockSuggestion, ReputationResult } from '../../lib/types';

export const profileCache = new Map<string, Partial<AccountProfile>>();
const scanQueue: string[] = [];
let scanning = false;

export async function ensureDefaultExamples(): Promise<void> {
  const existing = await getSpamExamples();
  if (existing.length === 0) {
    for (const ex of DEFAULT_SPAM_EXAMPLES) {
      await addSpamExample(ex);
    }
  }
}

async function persistScanResult(
  result: ReputationResult,
  rollups: Awaited<ReturnType<typeof getAccountRollups>>,
): Promise<void> {
  try {
    await initDb();
    await migrateScoresFromStorageIfNeeded();
    const touched = { ...result, scannedAt: Date.now() };
    await upsertAccountFromScan(touched, rollups);
    const snap = await getLatestSnapshot(result.handle);
    if (!snap) await saveReputationSnapshot(touched);
  } catch {
    /* DB unavailable */
  }
}

export async function scanHandle(
  handle: string,
  partial?: Partial<AccountProfile>,
): Promise<ReputationResult> {
  const settings = await getSettings();
  if (!settings.enabled) {
    return normalizeReputationResult({
      handle: handle.toLowerCase(),
      score: 50,
      band: 'caution',
      hits: [],
      scannedAt: Date.now(),
      breakdown: { overall: 50, spamRisk: 0, generalRisk: 0, xWeightedSpamRisk: 0 },
      isTrusted: false,
    });
  }

  const merged = profileCache.get(handle.toLowerCase()) ?? {};
  if (partial) Object.assign(merged, partial);
  const profileEarly = mergeProfiles(merged, partial ?? {}, handle);

  const cached = await getCachedScore(handle, settings.scoreCacheTtlMs);
  if (cached && !partial) {
    try {
      await initDb();
      const rollups = await getAccountRollups(profileEarly.handle);
      await persistScanResult(cached, rollups);
    } catch {
      /* DB unavailable */
    }
    return normalizeReputationResult({ ...cached, scannedAt: Date.now() });
  }

  profileCache.set(handle.toLowerCase(), merged);

  const examples = await getSpamExamples();
  const profile = profileEarly;

  let rollups = null;
  try {
    await initDb();
    await migrateScoresFromStorageIfNeeded();
    if (profile.postsSample?.length) {
      await batchInsertFromProfilePosts(profile.handle, profile.postsSample);
    }
    rollups = await getAccountRollups(profile.handle);
  } catch {
    /* DB unavailable */
  }

  const postHits = postSignalHits(rollups).filter(
    (h) => settings.detectors[h.id]?.enabled !== false,
  );
  const postSignalsRisk = computePostSignalsRisk(rollups, settings);
  let result = computeReputation(profile, settings, examples, postHits, {
    postSignalsRisk,
    toxicityCombined: undefined,
  });

  const baseSlop = result.slop ?? { heuristic: 0, combined: 0 };
  const withManualAi = await mergeAuthorManualAiSlop(baseSlop, profile.handle);
  if (withManualAi.combined > baseSlop.combined || withManualAi.image != null) {
    result = applySlopToResult(result, withManualAi, profile, settings, {
      postSampleCount: profile.postsSample?.length ?? 0,
    });
  }

  await cacheScore(result);
  await persistScanResult(result, rollups);
  await saveReputationSnapshot({ ...result, scannedAt: Date.now() });

  const slopTextLen = buildSlopTextForModel(profile).length;
  const slopModelsOn =
    settings.slopOnnxEnabled !== false ||
    settings.aiSlopModelEnabled ||
    settings.slopImageModelEnabled !== false ||
    (settings.ollamaModelEnabled && Boolean(settings.ollamaModel));
  if (slopModelsOn && slopTextLen >= 12) {
    void asyncRefineAndNotify(handle, result, profile, settings);
  }
  if (settings.toxicityModelEnabled !== false && buildToxicityTextForProfile(profile).length >= 12) {
    void asyncToxicityRefineAndNotify(handle, result, profile, settings);
  }
  await bumpStat('scans');
  if (result.band === 'high_risk') await bumpStat('flags');

  if (shouldSuggestBlock(result, settings)) {
    const suggestion: BlockSuggestion = {
      id: `sug-${handle}-${Date.now()}`,
      handle: result.handle,
      score: result.score,
      hits: result.hits.slice(0, 5),
      status: 'pending',
      createdAt: Date.now(),
    };
    await upsertQueueItem(suggestion);
    try {
      const tabs = await browser.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
      for (const tab of tabs) {
        if (tab.id) {
          browser.tabs
            .sendMessage(tab.id, { type: 'SHOW_BLOCK_SUGGESTION', suggestion, result })
            .catch(() => {});
        }
      }
    } catch {
      /* no tab */
    }
  }

  return normalizeReputationResult(result);
}

async function processQueue(): Promise<void> {
  if (scanning || scanQueue.length === 0) return;
  scanning = true;
  while (scanQueue.length > 0) {
    const handle = scanQueue.shift()!;
    try {
      await scanHandle(handle);
    } catch {
      /* skip */
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  scanning = false;
}

export function enqueueScan(handle: string): void {
  const h = handle.toLowerCase();
  if (!scanQueue.includes(h)) scanQueue.push(h);
  void processQueue();
}
