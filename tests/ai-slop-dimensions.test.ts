import { describe, expect, it } from 'vitest';
import { analyzeTextSlop, scoreTextHeuristicDetailed } from '../src/lib/detectors/ai-slop';

describe('analyzeTextSlop dimensions', () => {
  it('separates AI text from slop rhetoric', () => {
    const stock = analyzeTextSlop(
      "It's worth noting that in today's fast-paced digital landscape, organizations must leverage holistic strategies.",
    );
    expect(stock.aiText.evidence.length).toBeGreaterThan(0);

    const rhetoric = analyzeTextSlop(`No hype.
No fluff.
Just results.`);
    expect(rhetoric.slop.evidence.some((e) => e.id === 'ai_rhetoric')).toBe(true);
  });

  it('legacy scoreTextHeuristicDetailed still works', () => {
    const r = scoreTextHeuristicDetailed('lol yeah wild game last night');
    expect(r.score).toBeLessThan(30);
  });
});
