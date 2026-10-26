import { describe, expect, it } from 'vitest';
import {
  aggregateConfidence,
  buildDetectorResult,
  buildEvidenceHit,
  confidenceFromTextLength,
  redactMatchedText,
  scoreFromEvidence,
  topEvidence,
} from '../src/lib/detectors/evidence';

describe('evidence model', () => {
  it('redacts URLs in matched text', () => {
    expect(redactMatchedText('see https://evil.com/path now')).toContain('[link]');
  });

  it('penalizes short text confidence', () => {
    expect(confidenceFromTextLength(5)).toBeLessThan(0.4);
    expect(confidenceFromTextLength(100)).toBe(1);
  });

  it('counter-evidence reduces score', () => {
    const evidence = [
      buildEvidenceHit({ id: 'a', label: 'spam', weight: 40, category: 'spam', source: 'text' }),
    ];
    const counter = [
      buildEvidenceHit({
        id: 'b',
        label: 'personal',
        weight: 30,
        category: 'organic',
        source: 'text',
      }),
    ];
    const withCounter = scoreFromEvidence(evidence, counter);
    const without = scoreFromEvidence(evidence, []);
    expect(withCounter).toBeLessThan(without);
  });

  it('buildDetectorResult includes summary', () => {
    const r = buildDetectorResult(
      'Spam',
      [buildEvidenceHit({ id: 'crypto', label: 'Crypto language', weight: 30, category: 'spam', source: 'text' })],
      [],
      120,
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.explanationSummary).toContain('Crypto');
  });

  it('topEvidence sorts by weight', () => {
    const hits = topEvidence(
      [
        buildEvidenceHit({ id: 'a', label: 'low', weight: 5, category: 'spam', source: 'text' }),
        buildEvidenceHit({ id: 'b', label: 'high', weight: 40, category: 'spam', source: 'text' }),
      ],
      1,
    );
    expect(hits[0].id).toBe('b');
  });
});
