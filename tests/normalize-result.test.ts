import { describe, expect, it } from 'vitest';
import {
  authorSpamRisk,
  coerceScoreBreakdown,
  normalizeReputationResult,
} from '../src/lib/scoring/normalize-result';

describe('normalizeReputationResult', () => {
  it('fills missing breakdown', () => {
    const r = normalizeReputationResult({
      handle: 'testuser',
      score: 42,
      band: 'caution',
      hits: [],
      scannedAt: 1,
      isTrusted: false,
    });
    expect(r.breakdown.spamRisk).toBe(0);
    expect(authorSpamRisk(r)).toBe(0);
  });

  it('fills partial breakdown objects', () => {
    const b = coerceScoreBreakdown({ overall: 40 }, 42);
    expect(b.spamRisk).toBe(0);
    expect(b.overall).toBe(40);
  });
});
