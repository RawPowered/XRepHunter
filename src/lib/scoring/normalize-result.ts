import type { ReputationResult, ScoreBreakdown } from '../types';

export function defaultScoreBreakdown(overall = 50): ScoreBreakdown {
  return {
    overall,
    spamRisk: 0,
    generalRisk: 0,
    xWeightedSpamRisk: 0,
  };
}

/** Merge partial breakdown objects from legacy cache / DB rows. */
export function coerceScoreBreakdown(
  raw: Partial<ScoreBreakdown> | null | undefined,
  score: number,
): ScoreBreakdown {
  const d = defaultScoreBreakdown(score);
  if (!raw || typeof raw !== 'object') return d;
  return {
    overall: typeof raw.overall === 'number' ? raw.overall : d.overall,
    spamRisk: typeof raw.spamRisk === 'number' ? raw.spamRisk : d.spamRisk,
    generalRisk: typeof raw.generalRisk === 'number' ? raw.generalRisk : d.generalRisk,
    xWeightedSpamRisk:
      typeof raw.xWeightedSpamRisk === 'number' ? raw.xWeightedSpamRisk : d.xWeightedSpamRisk,
  };
}

/** Ensures breakdown/hits exist — old cache rows and partial DB snapshots may omit them. */
export function normalizeReputationResult(
  raw: Partial<ReputationResult> & { handle: string },
): ReputationResult {
  const score = raw.score ?? 50;
  return {
    handle: raw.handle.toLowerCase(),
    score,
    band: raw.band ?? (score >= 70 ? 'trusted' : score >= 40 ? 'caution' : 'high_risk'),
    hits: raw.hits ?? [],
    scannedAt: raw.scannedAt ?? Date.now(),
    breakdown: coerceScoreBreakdown(raw.breakdown, score),
    isTrusted: raw.isTrusted ?? false,
    profile: raw.profile,
    slop: raw.slop,
    toxicity: raw.toxicity,
    trustedNote: raw.trustedNote,
  };
}

export function authorSpamRisk(result: ReputationResult): number {
  return result.breakdown?.spamRisk ?? 0;
}
