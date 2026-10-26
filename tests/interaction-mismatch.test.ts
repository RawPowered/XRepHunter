import { describe, expect, it } from 'vitest';
import { computeInteractionMismatch } from '../src/lib/feed/interaction-mismatch';
import type { PostAttentionRow } from '../src/lib/attention/aggregate';

describe('interaction mismatch', () => {
  it('finds dwell without reward and reward without dwell', () => {
    const rows: PostAttentionRow[] = [
      {
        postFingerprint: 'dwell-only',
        handle: 'a',
        visibleMs: 1000,
        focusedVisibleMs: 800,
        focusedWeightedMs: 600,
        maxVisibleRatio: 1,
        revisitCount: 0,
        pauseCount: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
      {
        postFingerprint: 'action-only',
        handle: 'b',
        visibleMs: 100,
        focusedVisibleMs: 50,
        focusedWeightedMs: 10,
        maxVisibleRatio: 0.2,
        revisitCount: 0,
        pauseCount: 0,
        likes: 3,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
      {
        postFingerprint: 'both',
        handle: 'c',
        visibleMs: 500,
        focusedVisibleMs: 400,
        focusedWeightedMs: 350,
        maxVisibleRatio: 0.8,
        revisitCount: 0,
        pauseCount: 0,
        likes: 1,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
    ];
    const report = computeInteractionMismatch(rows, 2);
    expect(report.overlapCount).toBe(1);
    expect(report.dwelledWithoutReward.some((r) => r.postFingerprint === 'dwell-only')).toBe(true);
    expect(report.rewardedWithoutDwell.some((r) => r.postFingerprint === 'action-only')).toBe(true);
  });
});
