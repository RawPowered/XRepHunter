import { describe, expect, it } from 'vitest';
import { scoreTextHeuristicDetailed } from '../src/lib/detectors/ai-slop';

describe('scoreTextHeuristicDetailed', () => {
  it('does not flag a normal bullet list as slop', () => {
    const text = `Meeting notes from today:
- Budget approved for Q3
- Hire two engineers by August
- Ship the dashboard refresh next sprint
- Review security audit findings`;
    const r = scoreTextHeuristicDetailed(text);
    expect(r.score).toBeLessThan(35);
    expect(r.signals.some((s) => s.startsWith('bullets×'))).toBe(false);
  });

  it('flags stock AI phrases and uniform cadence', () => {
    const text = `It's worth noting that in today's fast-paced digital landscape, organizations must leverage holistic strategies. Furthermore, seamless integration remains a game-changer. In conclusion, this comprehensive approach underscores the paradigm shift we are navigating.`;
    const r = scoreTextHeuristicDetailed(text);
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.signals.some((s) => s.startsWith('phrases×'))).toBe(true);
  });

  it('flags No/Just rhetorical stacks (not generic bullets)', () => {
    const text = `No hype.
No fluff.
Just results.
Only what works.`;
    const r = scoreTextHeuristicDetailed(text);
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.signals.some((s) => s.startsWith('ai_rhetoric×'))).toBe(true);
  });

  it('scores low on casual human tweet', () => {
    const r = scoreTextHeuristicDetailed(
      'lol yeah the game was wild — we stayed up way too late but worth it',
    );
    expect(r.score).toBeLessThan(30);
  });
});
