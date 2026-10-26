import { describe, expect, it } from 'vitest';
import { computeBrowseFlagsForReport } from '../src/lib/browse/signal-report';

describe('computeBrowseFlagsForReport', () => {
  it('flags spam from author risk', () => {
    const f = computeBrowseFlagsForReport(10, 5, 55, 55, 40);
    expect(f.flaggedSpam).toBe(true);
  });
});
