/** Pure helpers for browse session / daily counters. */

export interface BrowsePostMetrics {
  slopScore?: number;
  spamScore?: number;
  authorSpamRisk?: number;
  toxicityScore?: number;
  flaggedSpam: boolean;
  flaggedSlop: boolean;
  flaggedAd?: boolean;
  flaggedToxicity?: boolean;
}

export function computeBrowseFlags(
  slopScore: number | undefined,
  spamScore: number | undefined,
  authorSpamRisk: number | undefined,
  slopThreshold: number,
  spamThreshold: number,
  toxicityScore?: number,
  toxicityThreshold = 45,
): { flaggedSpam: boolean; flaggedSlop: boolean; flaggedToxicity: boolean } {
  const effectiveSpam = Math.max(spamScore ?? 0, authorSpamRisk ?? 0);
  return {
    flaggedSpam: effectiveSpam >= spamThreshold,
    flaggedSlop: (slopScore ?? 0) >= slopThreshold,
    flaggedToxicity: (toxicityScore ?? 0) >= toxicityThreshold,
  };
}

export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface BrowseStatsSnapshot {
  postsSeen: number;
  spamFlagged: number;
  slopFlagged: number;
  slopSum: number;
  slopCount: number;
  avgSlop: number | null;
  adsSeen: number;
  toxicityFlagged: number;
  toxicitySum: number;
  toxicityCount: number;
  avgToxicity: number | null;
}

export interface BrowseDayRow extends BrowseStatsSnapshot {
  dayKey: string;
}

export function snapshotFromCounts(
  postsSeen: number,
  spamFlagged: number,
  slopFlagged: number,
  slopSum: number,
  slopCount: number,
  adsSeen = 0,
  toxicityFlagged = 0,
  toxicitySum = 0,
  toxicityCount = 0,
): BrowseStatsSnapshot {
  return {
    postsSeen,
    spamFlagged,
    slopFlagged,
    slopSum,
    slopCount,
    avgSlop: slopCount > 0 ? Math.round(slopSum / slopCount) : null,
    adsSeen,
    toxicityFlagged,
    toxicitySum,
    toxicityCount,
    avgToxicity: toxicityCount > 0 ? Math.round(toxicitySum / toxicityCount) : null,
  };
}

export const emptyBrowseStats = (): BrowseStatsSnapshot =>
  snapshotFromCounts(0, 0, 0, 0, 0, 0, 0, 0, 0);

export function pctOf(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}
