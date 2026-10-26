import { describe, expect, it } from 'vitest';
import { formatAiImageTooltip, isAiGeneratedImage } from '../src/lib/slop/ai-image-flag';
import type { SlopAnalysis } from '../src/lib/types';

describe('isAiGeneratedImage', () => {
  it('flags when image score meets threshold', () => {
    const slop: SlopAnalysis = { heuristic: 0, combined: 48, image: 48 };
    expect(isAiGeneratedImage(slop, 35)).toBe(true);
    expect(isAiGeneratedImage(slop, 55)).toBe(false);
  });

  it('flags on AI label even below slop highlight threshold', () => {
    const slop: SlopAnalysis = {
      heuristic: 0,
      combined: 48,
      image: 48,
      imageLabel: 'AI generated promotional marketing graphic',
    };
    expect(isAiGeneratedImage(slop, 35)).toBe(true);
  });

  it('does not flag authentic labels with low score', () => {
    const slop: SlopAnalysis = {
      heuristic: 0,
      combined: 20,
      image: 20,
      imageLabel: 'authentic photograph of a real scene',
    };
    expect(isAiGeneratedImage(slop, 35)).toBe(false);
  });
});

describe('formatAiImageTooltip', () => {
  it('includes score and label', () => {
    const tip = formatAiImageTooltip({
      heuristic: 0,
      combined: 48,
      image: 48,
      imageLabel: 'AI generated promotional marketing graphic',
    });
    expect(tip).toContain('48');
    expect(tip).toContain('AI generated');
  });
});
