import { describe, expect, it } from 'vitest';
import { mergeManualAiSlopScores } from '../src/lib/slop/manual-ai-merge';

describe('manual-ai-merge', () => {
  it('raises combined and image when user marked', () => {
    const base = { heuristic: 20, combined: 20, image: 10 };
    const merged = mergeManualAiSlopScores(base, 82, 82);
    expect(merged.combined).toBe(82);
    expect(merged.image).toBe(82);
    expect(merged.imageLabel).toBe('user_marked_ai');
    expect(merged.signals).toContain('user_marked_ai');
  });
});
