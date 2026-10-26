import { describe, expect, it } from 'vitest';
import { shouldReportCorpusUpdate } from '../src/lib/browse/signal-report';
import { postFingerprint } from '../src/lib/db/fingerprint';

describe('post signal reporting policy', () => {
  it('allows corpus update when slop rises materially', () => {
    const prev = {
      slopScore: 40,
      spamScore: 10,
      flaggedSpam: false,
      flaggedSlop: false,
    };
    const next = { ...prev, slopScore: 48 };
    expect(shouldReportCorpusUpdate(prev, next)).toBe(true);
  });

  it('skips corpus update when scores unchanged', () => {
    const snap = {
      slopScore: 40,
      spamScore: 10,
      flaggedSpam: false,
      flaggedSlop: false,
    };
    expect(shouldReportCorpusUpdate(snap, { ...snap })).toBe(false);
  });

  it('includes status id in fingerprint', () => {
    const a = postFingerprint('user', 'hello', undefined, '111');
    const b = postFingerprint('user', 'hello', undefined, '222');
    expect(a).not.toBe(b);
  });
});
