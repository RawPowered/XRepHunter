import { describe, expect, it } from 'vitest';
import {
  detectCopypasta,
  normalizeTextFingerprint,
  shingleJaccard,
} from '../src/lib/detectors/copypasta';

describe('copypasta detector', () => {
  it('detects exact duplicate across authors', () => {
    const text = 'This is a long repeated message that should match exactly across authors in our corpus test case.';
    const fp = normalizeTextFingerprint(text);
    const r = detectCopypasta({
      text,
      handle: 'userb',
      corpus: [{ textFingerprint: fp, firstHandle: 'usera', seenCount: 1 }],
    });
    expect(r.score).toBeGreaterThan(0);
    expect(r.evidence.some((e) => e.id === 'exact_duplicate')).toBe(true);
  });

  it('shingle jaccard finds near duplicates', () => {
    const a = 'the quick brown fox jumps over the lazy dog repeatedly today';
    const b = 'the quick brown fox jumps over the lazy dog repeatedly tomorrow';
    expect(shingleJaccard(a, b)).toBeGreaterThan(0.7);
  });
});
