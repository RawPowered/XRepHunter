import { generateAccountInsights } from './insights/generate-insights';
import type {
  AccountAnalyticsSnapshot,
  AnalyticsHistoryEntry,
  AccountInsights,
  BlockSuggestion,
  ExtensionSettings,
  ExportBundle,
  PrimaryAccount,
  ReputationResult,
  SpamExample,
  TrustedUser,
} from './types';
import { DEFAULT_SETTINGS, normalizeHandle } from './types';

function migrateTrustedUsers(s: Partial<ExtensionSettings>): TrustedUser[] {
  if (s.trustedUsers?.length) return s.trustedUsers;
  const legacy = s.whitelist ?? [];
  if (!legacy.length) return [];
  return legacy.map((handle) => ({
    handle: handle.toLowerCase(),
    addedAt: Date.now(),
  }));
}

const KEYS = {
  settings: 'settings',
  scores: 'scores',
  spamExamples: 'spamExamples',
  queue: 'queue',
  stats: 'stats',
  analyticsSnapshots: 'analyticsSnapshots',
} as const;

const MAX_SNAPSHOTS_PER_HANDLE = 24;

async function get<T>(key: string, fallback: T): Promise<T> {
  const r = await browser.storage.local.get(key);
  return (r[key] as T) ?? fallback;
}

async function set(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<ExtensionSettings> {
  const s = await get<Partial<ExtensionSettings>>(KEYS.settings, {});
  const trustedUsers = migrateTrustedUsers(s);
  const detectors = { ...DEFAULT_SETTINGS.detectors, ...(s.detectors ?? {}) };
  const legacyAi = s.detectors?.aiVoice;
  if (legacyAi && !s.detectors?.aiSlop) {
    detectors.aiSlop = { ...legacyAi };
  }

  const merged: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    ...s,
    xAlgorithmAlignment: s.xAlgorithmAlignment ?? DEFAULT_SETTINGS.xAlgorithmAlignment,
    spamBucketWeight: s.spamBucketWeight ?? DEFAULT_SETTINGS.spamBucketWeight,
    aiSlopModelEnabled: s.aiSlopModelEnabled ?? DEFAULT_SETTINGS.aiSlopModelEnabled,
    aiSlopModelAutoLoad: s.aiSlopModelAutoLoad ?? DEFAULT_SETTINGS.aiSlopModelAutoLoad,
    ollamaModelEnabled: s.ollamaModelEnabled ?? DEFAULT_SETTINGS.ollamaModelEnabled,
    ollamaModel: s.ollamaModel ?? DEFAULT_SETTINGS.ollamaModel,
    slopDisplayThreshold: s.slopDisplayThreshold ?? DEFAULT_SETTINGS.slopDisplayThreshold,
    slopPerTweetEnabled: s.slopPerTweetEnabled ?? DEFAULT_SETTINGS.slopPerTweetEnabled,
    slopOnnxEnabled: s.slopOnnxEnabled ?? DEFAULT_SETTINGS.slopOnnxEnabled,
    slopOnnxAutoLoad: s.slopOnnxAutoLoad ?? DEFAULT_SETTINGS.slopOnnxAutoLoad,
    slopImageModelEnabled: s.slopImageModelEnabled ?? DEFAULT_SETTINGS.slopImageModelEnabled,
    slopImageModelAutoLoad: s.slopImageModelAutoLoad ?? DEFAULT_SETTINGS.slopImageModelAutoLoad,
    toxicityModelEnabled: s.toxicityModelEnabled ?? DEFAULT_SETTINGS.toxicityModelEnabled,
    toxicityModelAutoLoad: s.toxicityModelAutoLoad ?? DEFAULT_SETTINGS.toxicityModelAutoLoad,
    toxicityDisplayThreshold:
      s.toxicityDisplayThreshold ?? DEFAULT_SETTINGS.toxicityDisplayThreshold,
    spamDisplayThreshold: s.spamDisplayThreshold ?? DEFAULT_SETTINGS.spamDisplayThreshold,
    aiImageBadgeEnabled: s.aiImageBadgeEnabled ?? DEFAULT_SETTINGS.aiImageBadgeEnabled,
    aiImageBadgeThreshold: s.aiImageBadgeThreshold ?? DEFAULT_SETTINGS.aiImageBadgeThreshold,
    manualAiImageMarkEnabled: s.manualAiImageMarkEnabled ?? DEFAULT_SETTINGS.manualAiImageMarkEnabled,
    manualAiImageSlopScore: s.manualAiImageSlopScore ?? DEFAULT_SETTINGS.manualAiImageSlopScore,
    promotedAdDimEnabled: s.promotedAdDimEnabled ?? DEFAULT_SETTINGS.promotedAdDimEnabled,
    browseTopicsEnabled: s.browseTopicsEnabled ?? DEFAULT_SETTINGS.browseTopicsEnabled,
    browseTopicClipEnabled: s.browseTopicClipEnabled ?? DEFAULT_SETTINGS.browseTopicClipEnabled,
    customBrowseInterests: s.customBrowseInterests ?? DEFAULT_SETTINGS.customBrowseInterests,
    reputationScoreCap: s.reputationScoreCap ?? DEFAULT_SETTINGS.reputationScoreCap,
    reputationBaselineRisk:
      s.reputationBaselineRisk ?? DEFAULT_SETTINGS.reputationBaselineRisk,
    trustedUsers,
    detectors,
    primaryAccount: s.primaryAccount,
  };
  if (trustedUsers.length && !s.trustedUsers?.length && (s.whitelist?.length ?? 0) > 0) {
    await set(KEYS.settings, merged);
  }
  return merged;
}

export async function addTrustedUser(handle: string, note?: string): Promise<TrustedUser> {
  const settings = await getSettings();
  const h = handle.toLowerCase();
  const existing = settings.trustedUsers.filter((t) => t.handle !== h);
  const entry: TrustedUser = { handle: h, note, addedAt: Date.now() };
  await saveSettings({ trustedUsers: [...existing, entry] });
  return entry;
}

export async function removeTrustedUser(handle: string): Promise<void> {
  const settings = await getSettings();
  const h = handle.toLowerCase();
  await saveSettings({
    trustedUsers: settings.trustedUsers.filter((t) => t.handle !== h),
  });
}

export async function getTrustedUsers(): Promise<TrustedUser[]> {
  return (await getSettings()).trustedUsers;
}

export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  if (partial.detectors) {
    next.detectors = { ...current.detectors, ...partial.detectors };
  }
  await set(KEYS.settings, next);
  return next;
}

export async function getScoreCache(): Promise<Record<string, ReputationResult>> {
  return get(KEYS.scores, {});
}

export async function cacheScore(result: ReputationResult): Promise<void> {
  const scores = await getScoreCache();
  scores[result.handle.toLowerCase()] = result;
  await set(KEYS.scores, scores);
  try {
    const { upsertAccountFromScan, saveReputationSnapshot } = await import('./db/repositories/accounts');
    const { getAccountRollups } = await import('./db/repositories/accounts');
    const rollups = await getAccountRollups(result.handle);
    await upsertAccountFromScan(result, rollups);
    await saveReputationSnapshot(result);
  } catch {
    /* DB not ready */
  }
}

export async function getCachedScoresBatch(
  handles: string[],
  ttlMs: number,
): Promise<Record<string, ReputationResult>> {
  const { normalizeReputationResult } = await import('./scoring/normalize-result');
  const out: Record<string, ReputationResult> = {};
  const unique = [...new Set(handles.map((h) => h.toLowerCase()))];
  await Promise.all(
    unique.map(async (handle) => {
      const hit = await getCachedScore(handle, ttlMs);
      if (hit) out[handle] = normalizeReputationResult(hit);
    }),
  );
  return out;
}

export async function getCachedScore(handle: string, ttlMs: number): Promise<ReputationResult | null> {
  try {
    const { getCachedReputationFromDb } = await import('./db/repositories/accounts');
    const { initDb } = await import('./db/bridge');
    const { migrateScoresFromStorageIfNeeded } = await import('./db/migrate-storage');
    await initDb();
    await migrateScoresFromStorageIfNeeded();
    const fromDb = await getCachedReputationFromDb(handle, ttlMs);
    if (fromDb) return fromDb;
  } catch {
    /* fallback */
  }
  const scores = await getScoreCache();
  const hit = scores[handle.toLowerCase()];
  if (!hit) return null;
  if (Date.now() - hit.scannedAt > ttlMs) return null;
  const { normalizeReputationResult } = await import('./scoring/normalize-result');
  return normalizeReputationResult(hit);
}

export async function getSpamExamples(): Promise<SpamExample[]> {
  return get(KEYS.spamExamples, []);
}

export async function addSpamExample(example: SpamExample): Promise<void> {
  const list = await getSpamExamples();
  list.push(example);
  await set(KEYS.spamExamples, list);
}

export async function deleteSpamExample(id: string): Promise<void> {
  const list = await getSpamExamples();
  await set(
    KEYS.spamExamples,
    list.filter((e) => e.id !== id),
  );
}

export async function getQueue(): Promise<BlockSuggestion[]> {
  return get(KEYS.queue, []);
}

export async function upsertQueueItem(item: BlockSuggestion): Promise<void> {
  const q = await getQueue();
  const idx = q.findIndex((x) => x.id === item.id);
  if (idx >= 0) q[idx] = item;
  else q.unshift(item);
  await set(KEYS.queue, q.slice(0, 200));
}

export async function updateQueueStatus(
  id: string,
  status: BlockSuggestion['status'],
): Promise<void> {
  const q = await getQueue();
  const item = q.find((x) => x.id === id);
  if (item) {
    item.status = status;
    await set(KEYS.queue, q);
  }
}

export async function getPrimaryAccount(): Promise<PrimaryAccount | undefined> {
  return (await getSettings()).primaryAccount;
}

export async function setPrimaryAccount(
  handle: string,
  displayLabel?: string,
): Promise<PrimaryAccount> {
  const entry: PrimaryAccount = {
    handle: normalizeHandle(handle),
    displayLabel,
    addedAt: Date.now(),
  };
  await saveSettings({ primaryAccount: entry });
  return entry;
}

export async function touchPrimaryScanned(handle: string): Promise<void> {
  const settings = await getSettings();
  const h = normalizeHandle(handle);
  if (settings.primaryAccount?.handle !== h) return;
  await saveSettings({
    primaryAccount: { ...settings.primaryAccount, lastScannedAt: Date.now() },
  });
}

export async function getAnalyticsSnapshots(): Promise<
  Record<string, AccountAnalyticsSnapshot[]>
> {
  return get(KEYS.analyticsSnapshots, {});
}

export async function saveAnalyticsSnapshot(
  snapshot: AccountAnalyticsSnapshot,
): Promise<AccountAnalyticsSnapshot> {
  const all = await getAnalyticsSnapshots();
  const h = normalizeHandle(snapshot.handle);
  const list = all[h] ?? [];
  const merged = mergeAnalyticsSnapshot(list[list.length - 1], snapshot);
  const next = [...list.filter((s) => s.capturedAt !== merged.capturedAt), merged]
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, MAX_SNAPSHOTS_PER_HANDLE);
  all[h] = next;
  await set(KEYS.analyticsSnapshots, all);
  return merged;
}

function mergeAnalyticsSnapshot(
  prev: AccountAnalyticsSnapshot | undefined,
  next: AccountAnalyticsSnapshot,
): AccountAnalyticsSnapshot {
  if (!prev) return next;
  const tweetMap = new Map<string, import('./types').TweetAnalytics>();
  for (const t of prev.tweets ?? []) tweetMap.set(t.tweetId, t);
  for (const t of next.tweets ?? []) {
    const existing = tweetMap.get(t.tweetId);
    tweetMap.set(t.tweetId, existing ? { ...existing, ...t } : t);
  }
  return {
    handle: next.handle,
    periodLabel: next.periodLabel ?? prev.periodLabel,
    impressions: next.impressions ?? prev.impressions,
    engagements: next.engagements ?? prev.engagements,
    profileVisits: next.profileVisits ?? prev.profileVisits,
    mentions: next.mentions ?? prev.mentions,
    newFollowers: next.newFollowers ?? prev.newFollowers,
    tweets: [...tweetMap.values()].sort((a, b) => b.capturedAt - a.capturedAt),
    capturedAt: Math.max(prev.capturedAt, next.capturedAt),
    source: next.source,
  };
}

export async function getLatestAnalytics(
  handle: string,
): Promise<AccountAnalyticsSnapshot | undefined> {
  const all = await getAnalyticsSnapshots();
  const list = all[normalizeHandle(handle)];
  if (!list?.length) return undefined;
  return list[0];
}

export async function listAnalyticsHistory(handle: string): Promise<AnalyticsHistoryEntry[]> {
  const all = await getAnalyticsSnapshots();
  const list = all[normalizeHandle(handle)] ?? [];
  return list.map((s) => ({
    handle: s.handle,
    capturedAt: s.capturedAt,
    source: s.source,
    periodLabel: s.periodLabel,
    impressions: s.impressions,
    engagements: s.engagements,
    tweetCount: s.tweets?.length ?? 0,
  }));
}

export async function getAccountInsights(): Promise<AccountInsights | null> {
  const primary = await getPrimaryAccount();
  if (!primary) return null;
  const settings = await getSettings();
  const raw =
    (await getCachedScore(primary.handle, settings.scoreCacheTtlMs)) ??
    (await getScoreCache())[primary.handle];
  const { normalizeReputationResult } = await import('./scoring/normalize-result');
  const reputation = raw
    ? normalizeReputationResult({ ...raw, handle: primary.handle })
    : null;
  const all = await getAnalyticsSnapshots();
  const list = all[primary.handle] ?? [];
  const analytics = list[0];
  const previous = list[1];
  return generateAccountInsights(primary.handle, reputation, analytics, previous);
}

export async function exportBundle(): Promise<ExportBundle> {
  const [settings, scores, spamExamples, queue, analyticsSnapshots] = await Promise.all([
    getSettings(),
    getScoreCache(),
    getSpamExamples(),
    getQueue(),
    getAnalyticsSnapshots(),
  ]);
  return { version: 1, settings, scores, spamExamples, queue, analyticsSnapshots };
}

export async function importBundle(data: ExportBundle): Promise<void> {
  await set(KEYS.settings, data.settings);
  await set(KEYS.scores, data.scores);
  await set(KEYS.spamExamples, data.spamExamples);
  await set(KEYS.queue, data.queue);
  if (data.analyticsSnapshots) {
    await set(KEYS.analyticsSnapshots, data.analyticsSnapshots);
  }
}

export async function bumpStat(key: 'scans' | 'flags' | 'blocks'): Promise<number> {
  const stats = await get<Record<string, number>>(KEYS.stats, { scans: 0, flags: 0, blocks: 0 });
  stats[key] = (stats[key] ?? 0) + 1;
  await set(KEYS.stats, stats);
  return stats[key];
}

export async function getStats(): Promise<Record<string, number>> {
  return get(KEYS.stats, { scans: 0, flags: 0, blocks: 0 });
}
