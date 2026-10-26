import { describe, expect, it } from 'vitest';
import {
  emptyAttentionSnapshot,
  formatDwellMs,
  mergeAttentionDelta,
  rankAuthorsByFocusedMs,
  rankTopicsByFocusedMs,
  rollupAttentionRows,
  type PostAttentionDelta,
  type PostAttentionRow,
} from '../src/lib/attention/aggregate';

const baseDelta = (over: Partial<PostAttentionDelta> = {}): PostAttentionDelta => ({
  postFingerprint: 'abc123',
  handle: 'alice',
  visibleMs: 100,
  focusedVisibleMs: 80,
  maxVisibleRatio: 0.5,
  firstSeenAt: 1000,
  lastSeenAt: 1100,
  revisitCount: 1,
  pauseCount: 0,
  ...over,
});

describe('attention aggregate', () => {
  it('merges attention deltas additively with min/max timestamps', () => {
    const a = baseDelta();
    const b = baseDelta({
      visibleMs: 200,
      focusedVisibleMs: 150,
      maxVisibleRatio: 0.75,
      firstSeenAt: 900,
      lastSeenAt: 1200,
      revisitCount: 2,
      pauseCount: 1,
      slopScore: 55,
    });
    const merged = mergeAttentionDelta(a, b);
    expect(merged.visibleMs).toBe(300);
    expect(merged.focusedVisibleMs).toBe(230);
    expect(merged.maxVisibleRatio).toBe(0.75);
    expect(merged.firstSeenAt).toBe(900);
    expect(merged.lastSeenAt).toBe(1200);
    expect(merged.revisitCount).toBe(3);
    expect(merged.pauseCount).toBe(1);
    expect(merged.slopScore).toBe(55);
  });

  it('rolls up attention rows into snapshot totals', () => {
    const rows: PostAttentionRow[] = [
      { ...baseDelta({ postFingerprint: 'a', focusedVisibleMs: 1000 }), likes: 1, reposts: 0, replies: 0, quotes: 0 },
      { ...baseDelta({ postFingerprint: 'b', focusedVisibleMs: 0 }), likes: 0, reposts: 1, replies: 1, quotes: 0 },
      { ...baseDelta({ postFingerprint: 'c', focusedVisibleMs: 500 }), likes: 0, reposts: 0, replies: 0, quotes: 1 },
    ];
    const snap = rollupAttentionRows(rows);
    expect(snap.postsSeen).toBe(2);
    expect(snap.focusedVisibleMs).toBe(1500);
    expect(snap.avgFocusedDwellMs).toBe(750);
    expect(snap.actions).toBe(4);
  });

  it('returns empty snapshot for no rows', () => {
    expect(rollupAttentionRows([])).toEqual(emptyAttentionSnapshot());
  });

  it('ranks authors by focused dwell time', () => {
    const rows: PostAttentionRow[] = [
      { ...baseDelta({ handle: 'alice', focusedVisibleMs: 500 }), likes: 0, reposts: 0, replies: 0, quotes: 0 },
      {
        ...baseDelta({ handle: 'bob', focusedVisibleMs: 1200, focusedWeightedMs: 900 }),
        likes: 0,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
      {
        ...baseDelta({ handle: 'alice', postFingerprint: 'x2', focusedVisibleMs: 300, focusedWeightedMs: 200 }),
        likes: 1,
        reposts: 0,
        replies: 0,
        quotes: 0,
      },
    ];
    const ranked = rankAuthorsByFocusedMs(rows, 5);
    expect(ranked[0].key).toBe('bob');
    expect(ranked[1].key).toBe('alice');
    expect(ranked[1].focusedWeightedMs).toBe(200);
    expect(ranked[1].postsSeen).toBe(2);
  });

  it('ranks topics by focused dwell time', () => {
    const rows: PostAttentionRow[] = [
      { ...baseDelta({ topics: ['news'], focusedVisibleMs: 400 }), likes: 0, reposts: 0, replies: 0, quotes: 0 },
      { ...baseDelta({ topics: ['tech', 'news'], focusedVisibleMs: 600 }), likes: 0, reposts: 0, replies: 0, quotes: 0 },
    ];
    const ranked = rankTopicsByFocusedMs(rows, 5);
    expect(ranked[0].key).toBe('news');
    expect(ranked[0].focusedVisibleMs).toBe(1000);
    expect(ranked[1].key).toBe('tech');
  });

  it('formats dwell milliseconds', () => {
    expect(formatDwellMs(500)).toBe('500ms');
    expect(formatDwellMs(5000)).toBe('5s');
    expect(formatDwellMs(65000)).toBe('1m 5s');
  });
});
