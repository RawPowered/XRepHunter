import { emptyBrowseStats, snapshotFromCounts, type BrowseStatsSnapshot } from '../../lib/browse/stats';

const sessionBrowseSeen = new Set<string>();
let sessionBrowse = emptyBrowseStats();

export function recordSessionBrowse(
  postFingerprint: string,
  opts: {
    flaggedSpam: boolean;
    flaggedSlop: boolean;
    slopScore?: number;
    flaggedAd?: boolean;
    flaggedToxicity?: boolean;
    toxicityScore?: number;
  },
): boolean {
  if (sessionBrowseSeen.has(postFingerprint)) return false;
  sessionBrowseSeen.add(postFingerprint);
  const slopInc = opts.slopScore != null && opts.slopScore > 0 ? 1 : 0;
  const slopAdd = slopInc ? opts.slopScore! : 0;
  const toxInc = opts.toxicityScore != null && opts.toxicityScore > 0 ? 1 : 0;
  const toxAdd = toxInc ? opts.toxicityScore! : 0;
  sessionBrowse = snapshotFromCounts(
    sessionBrowse.postsSeen + 1,
    sessionBrowse.spamFlagged + (opts.flaggedSpam ? 1 : 0),
    sessionBrowse.slopFlagged + (opts.flaggedSlop ? 1 : 0),
    sessionBrowse.slopSum + slopAdd,
    sessionBrowse.slopCount + slopInc,
    sessionBrowse.adsSeen + (opts.flaggedAd ? 1 : 0),
    sessionBrowse.toxicityFlagged + (opts.flaggedToxicity ? 1 : 0),
    sessionBrowse.toxicitySum + toxAdd,
    sessionBrowse.toxicityCount + toxInc,
  );
  return true;
}

export function resetSessionBrowse(): void {
  sessionBrowseSeen.clear();
  sessionBrowse = emptyBrowseStats();
}

export function getSessionBrowse(): BrowseStatsSnapshot {
  return sessionBrowse;
}
