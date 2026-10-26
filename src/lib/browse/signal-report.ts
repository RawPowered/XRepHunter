/** When to send REPORT_POST_SIGNALS again after async model scores arrive. */

export interface CorpusScoreSnapshot {
  slopScore: number;
  spamScore: number;
  toxicityScore?: number;
  flaggedSpam: boolean;
  flaggedSlop: boolean;
}

export function computeBrowseFlagsForReport(
  slopScore: number,
  tweetSpamScore: number,
  authorSpamRisk: number,
  slopThreshold: number,
  spamThreshold: number,
): { flaggedSpam: boolean; flaggedSlop: boolean } {
  const effectiveSpam = Math.max(tweetSpamScore, authorSpamRisk);
  return {
    flaggedSpam: effectiveSpam >= spamThreshold,
    flaggedSlop: slopScore >= slopThreshold,
  };
}

/** First report always; later only if scores materially improved or newly flagged. */
export function shouldReportCorpusUpdate(
  prev: CorpusScoreSnapshot | undefined,
  next: CorpusScoreSnapshot,
): boolean {
  if (!prev) return true;
  if (next.slopScore >= prev.slopScore + 5) return true;
  if (next.spamScore >= prev.spamScore + 5) return true;
  const nextTox = next.toxicityScore ?? 0;
  const prevTox = prev.toxicityScore ?? 0;
  if (nextTox >= prevTox + 5) return true;
  if (next.flaggedSlop && !prev.flaggedSlop) return true;
  if (next.flaggedSpam && !prev.flaggedSpam) return true;
  return false;
}
