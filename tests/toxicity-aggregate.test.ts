import { describe, expect, it } from 'vitest';
import { computeCombinedToxicity, labelsToToxicityAnalysis } from '../src/lib/toxicity/aggregate';
import { isProfanityOnly, scoreTextToxicityHeuristic } from '../src/lib/detectors/toxicity-heuristic';

describe('toxicity aggregate', () => {
  it('ignores obscene and toxic alone (casual swearing)', () => {
    const combined = computeCombinedToxicity({
      obscene: 0.92,
      toxic: 0.88,
      insult: 0.08,
      threat: 0.05,
    });
    expect(combined).toBeLessThanOrEqual(8);
  });

  it('flags demeaning model labels', () => {
    const combined = computeCombinedToxicity({
      obscene: 0.1,
      toxic: 0.4,
      insult: 0.72,
    });
    expect(combined).toBe(72);
  });

  it('includes toxic when paired with demeaning context', () => {
    const combined = computeCombinedToxicity({
      insult: 0.3,
      toxic: 0.85,
    });
    expect(combined).toBe(85);
  });

  it('plant tweet example stays low', () => {
    const text =
      'not me going to the store for groceries and coming home with a big ass plant';
    expect(isProfanityOnly(text)).toBe(true);
    expect(scoreTextToxicityHeuristic(text).score).toBe(0);
    const analysis = labelsToToxicityAnalysis([
      { label: 'obscene', score: 0.9 },
      { label: 'toxic', score: 0.85 },
      { label: 'insult', score: 0.1 },
    ]);
    expect(analysis.combined).toBeLessThanOrEqual(10);
  });

  it('flags directed insults in heuristic', () => {
    const { score } = scoreTextToxicityHeuristic('you are so stupid and worthless');
    expect(score).toBeGreaterThanOrEqual(35);
  });
});
