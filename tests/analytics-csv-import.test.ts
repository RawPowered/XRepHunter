import { describe, expect, it } from 'vitest';
import { parseAnalyticsCsv } from '../src/lib/x-api/analytics-csv-import';

describe('parseAnalyticsCsv', () => {
  it('parses account overview row', () => {
    const csv = `Period,Impressions,Engagements,Profile Visits
Jan 2026,10000,450,120`;
    const r = parseAnalyticsCsv(csv, 'testuser');
    expect(r.ok).toBe(true);
    expect(r.snapshot?.impressions).toBe(10000);
    expect(r.snapshot?.engagements).toBe(450);
    expect(r.snapshot?.profileVisits).toBe(120);
    expect(r.snapshot?.source).toBe('import');
    expect(r.snapshot?.periodLabel).toBe('Jan 2026');
  });

  it('parses per-tweet rows and aggregates totals', () => {
    const csv = `Tweet ID,Post Text,Impressions,Likes,Reposts,Replies
111,Hello world post here,5000,100,20,5
222,Another longer post text here,3000,50,10,2`;
    const r = parseAnalyticsCsv(csv, 'creator');
    expect(r.ok).toBe(true);
    expect(r.snapshot?.tweets?.length).toBe(2);
    expect(r.snapshot?.impressions).toBe(8000);
    expect(r.snapshot?.tweets?.[0].engagementRate).toBeGreaterThan(0);
  });

  it('handles messy headers', () => {
    const csv = `post id,Views,Total Engagements
999,1200,88`;
    const r = parseAnalyticsCsv(csv, 'u');
    expect(r.ok).toBe(true);
    expect(r.snapshot?.tweets?.[0].tweetId).toBe('999');
    expect(r.snapshot?.tweets?.[0].impressions).toBe(1200);
  });

  it('fails without metrics', () => {
    const r = parseAnalyticsCsv('A,B\nx,y', 'u');
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
