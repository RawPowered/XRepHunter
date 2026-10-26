import { describe, expect, it } from 'vitest';
import { resolveDayLimit, applyRowFilters, pct, type DashboardRow } from '../src/lib/feed/dashboard/filters';
import { deriveProvenanceDisplayCategory } from '../src/lib/feed/dashboard/provenance-display';
import { buildOverview } from '../src/lib/feed/dashboard/overview';

describe('dashboard filters', () => {
  it('resolveDayLimit maps ranges', () => {
    expect(resolveDayLimit('session')).toBe(1);
    expect(resolveDayLimit('7d')).toBe(7);
    expect(resolveDayLimit('all')).toBe(0);
  });

  it('applyRowFilters filters by topic and slop', () => {
    const rows: DashboardRow[] = [
      {
        dayKey: '2026-05-23',
        postFingerprint: 'a',
        handle: 'alice',
        visibleMs: 0,
        focusedVisibleMs: 1000,
        maxVisibleRatio: 0,
        revisitCount: 0,
        pauseCount: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
        quotes: 0,
        topics: ['tech'],
        slopScore: 60,
      },
    ];
    const filtered = applyRowFilters(rows, { range: '30d', topic: 'tech', minSlop: 55 }, new Set());
    expect(filtered).toHaveLength(1);
    const none = applyRowFilters(rows, { range: '30d', topic: 'sports' }, new Set());
    expect(none).toHaveLength(0);
  });

  it('pct computes share', () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(0, 0)).toBe(0);
  });
});

describe('provenance display', () => {
  it('derives official ad from promoted flag', () => {
    expect(deriveProvenanceDisplayCategory({ isPromoted: true })).toBe('official_ad');
  });

  it('derives organic when scores low', () => {
    expect(
      deriveProvenanceDisplayCategory({
        likelihoodCategory: 'likely_organic',
        sponsorshipScore: 0.1,
        influencerAdScore: 0.1,
        copypastaScore: 0.1,
        aiAssistedScore: 0.2,
      }),
    ).toBe('organic_likely');
  });
});

describe('dashboard overview', () => {
  it('buildOverview computes feed quality percentages', () => {
    const rows: DashboardRow[] = [
      {
        dayKey: '2026-05-23',
        postFingerprint: 'a',
        handle: 'alice',
        visibleMs: 0,
        focusedVisibleMs: 5000,
        maxVisibleRatio: 0.5,
        revisitCount: 0,
        pauseCount: 0,
        likes: 1,
        reposts: 0,
        replies: 0,
        quotes: 0,
        slopScore: 60,
        displayCategory: 'ai_likely',
      },
      {
        dayKey: '2026-05-23',
        postFingerprint: 'b',
        handle: 'bob',
        visibleMs: 0,
        focusedVisibleMs: 2000,
        maxVisibleRatio: 0.5,
        revisitCount: 0,
        pauseCount: 0,
        likes: 0,
        reposts: 0,
        replies: 0,
        quotes: 0,
        displayCategory: 'organic_likely',
      },
    ];
    const overview = buildOverview(rows, { range: '30d' }, new Set());
    expect(overview.postsSeen).toBe(2);
    expect(overview.actions).toBe(1);
    expect(overview.exposurePct.aiSlop).toBeGreaterThan(0);
    expect(overview.feedQuality.length).toBeGreaterThan(0);
  });
});
