import { describe, expect, it } from 'vitest';
import { deriveCombined, joinCombinedHistory } from '../src/lib/browse/combined-metrics';
import { snapshotFromCounts } from '../src/lib/browse/stats';

describe('combined-metrics', () => {
  it('computes support and reply rates', () => {
    const browse = snapshotFromCounts(100, 5, 10, 500, 10, 3, 2, 80, 8);
    const actions = { likes: 12, reposts: 3, replies: 4, quotes: 1 };
    const c = deriveCombined(browse, actions);
    expect(c.supportRate).toBe(15);
    expect(c.replyRate).toBe(4);
    expect(c.slopExposure).toBe(10);
    expect(c.junkExposure).toBe(8);
    expect(c.participationIndex).toBe(10.6);
  });

  it('joins browse and action history by day', () => {
    const history = joinCombinedHistory(
      [
        {
          dayKey: '2026-05-17',
          ...snapshotFromCounts(50, 1, 2, 100, 2),
        },
      ],
      [{ dayKey: '2026-05-17', likes: 5, reposts: 1, replies: 0, quotes: 0 }],
    );
    expect(history).toHaveLength(1);
    expect(history[0].supportRate).toBe(12);
  });
});
