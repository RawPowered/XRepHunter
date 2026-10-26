import { describe, expect, it } from 'vitest';
import { detectCopypastaEvidence } from '../src/lib/provenance/copypasta';

describe('provenance copypasta', () => {
  const text =
    'This is a long enough tweet body for copypasta detection to run on normalized text fingerprint matching.';

  it('flags cross-author duplicate', () => {
    const fp = detectCopypastaEvidence(text, 'bob', [
      {
        textFingerprint: detectCopypastaEvidence(text, 'alice', []).textFingerprint,
        firstHandle: 'alice',
        seenCount: 1,
      },
    ]);
    expect(fp.score).toBeGreaterThan(0);
    expect(fp.evidence.some((e) => e.id === 'corpus_cross_author')).toBe(true);
  });

  it('flags high frequency same author', () => {
    const first = detectCopypastaEvidence(text, 'alice', []);
    const second = detectCopypastaEvidence(text, 'alice', [
      { textFingerprint: first.textFingerprint, firstHandle: 'alice', seenCount: 3 },
    ]);
    expect(second.evidence.some((e) => e.id === 'corpus_high_frequency')).toBe(true);
  });
});
