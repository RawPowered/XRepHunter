import { describe, expect, it } from 'vitest';
import { computeBrowseFlags, snapshotFromCounts } from '../src/lib/browse/stats';

describe('browse-stats', () => {
  it('flags spam from author or tweet score', () => {
    const a = computeBrowseFlags(30, 20, 55, 55, 40);
    expect(a.flaggedSpam).toBe(true);
    const b = computeBrowseFlags(30, 20, 10, 55, 40);
    expect(b.flaggedSpam).toBe(false);
  });

  it('flags slop at threshold', () => {
    const a = computeBrowseFlags(55, 0, 0, 55, 40);
    expect(a.flaggedSlop).toBe(true);
  });

  it('computes average slop', () => {
    const s = snapshotFromCounts(10, 2, 3, 150, 3);
    expect(s.avgSlop).toBe(50);
  });

  it('flags toxicity at threshold', () => {
    const a = computeBrowseFlags(30, 0, 0, 55, 40, 50, 45);
    expect(a.flaggedToxicity).toBe(true);
    const b = computeBrowseFlags(30, 0, 0, 55, 40, 40, 45);
    expect(b.flaggedToxicity).toBe(false);
  });

  it('tracks ads and toxicity averages', () => {
    const s = snapshotFromCounts(20, 1, 2, 80, 4, 5, 3, 120, 6);
    expect(s.adsSeen).toBe(5);
    expect(s.avgToxicity).toBe(20);
  });
});
