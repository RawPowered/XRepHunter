import { describe, expect, it } from 'vitest';
import { detectOrganic } from '../src/lib/detectors/organic';

describe('detectOrganic', () => {
  it('scores high on personal detail', () => {
    const r = detectOrganic({
      text: 'On Tuesday I fixed the leaky sink myself — took three trips to the hardware store but it works now.',
    });
    expect(r.score).toBeGreaterThanOrEqual(20);
    expect(r.evidence.some((e) => e.id === 'lived_detail' || e.id === 'original_wording')).toBe(
      true,
    );
  });

  it('low confidence on very short text', () => {
    const r = detectOrganic({ text: 'ok' });
    expect(r.confidence).toBeLessThan(0.4);
  });
});
