import { describe, expect, it } from 'vitest';
import {
  computePostSignalsRisk,
  detectCommunityNotes,
  detectPostSpamSignals,
} from '../src/lib/scoring/post-signals';
import { DEFAULT_SETTINGS } from '../src/lib/types';
import type { AccountPostRollups } from '../src/lib/db/repositories/accounts';

const baseRollups: AccountPostRollups = {
  postsAnalyzed: 10,
  postsWithNote: 0,
  noteRate: 0,
  avgPostSpam: 20,
  maxPostSpam: 35,
  avgPostSlop: 30,
  maxPostSlop: 45,
  avgPostToxicity: 15,
  maxPostToxicity: 25,
};

describe('post-signals', () => {
  it('returns zero risk with no rollups', () => {
    expect(computePostSignalsRisk(null, DEFAULT_SETTINGS)).toBe(0);
  });

  it('raises risk for high note rate', () => {
    const rollups = { ...baseRollups, postsWithNote: 3, noteRate: 0.3 };
    expect(computePostSignalsRisk(rollups, DEFAULT_SETTINGS)).toBeGreaterThanOrEqual(0.75);
    expect(detectCommunityNotes(rollups)?.id).toBe('communityNotes');
  });

  it('detects elevated per-post spam', () => {
    const rollups = { ...baseRollups, avgPostSpam: 60, maxPostSpam: 72 };
    expect(detectPostSpamSignals(rollups)?.id).toBe('postSpamSignals');
  });
});
