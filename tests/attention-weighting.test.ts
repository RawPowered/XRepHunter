import { describe, expect, it } from 'vitest';
import {
  effectiveFocusRatio,
  REAL_FOCUS_RATIO_THRESHOLD,
  weightedDeltaMs,
} from '../src/lib/attention/weighting';

describe('attention weighting', () => {
  it('zeroes ratio below real-focus threshold', () => {
    expect(effectiveFocusRatio(0.1, REAL_FOCUS_RATIO_THRESHOLD)).toBe(0);
    expect(effectiveFocusRatio(0.15, REAL_FOCUS_RATIO_THRESHOLD)).toBe(0.15);
    expect(effectiveFocusRatio(0.5, REAL_FOCUS_RATIO_THRESHOLD)).toBe(0.5);
  });

  it('computes weighted deltas', () => {
    const unfocused = weightedDeltaMs(1000, 0.5, REAL_FOCUS_RATIO_THRESHOLD, false);
    expect(unfocused.weightedVisibleMs).toBe(500);
    expect(unfocused.focusedWeightedMs).toBe(0);

    const focused = weightedDeltaMs(1000, 0.5, REAL_FOCUS_RATIO_THRESHOLD, true);
    expect(focused.weightedVisibleMs).toBe(500);
    expect(focused.focusedWeightedMs).toBe(500);

    const sliver = weightedDeltaMs(1000, 0.05, REAL_FOCUS_RATIO_THRESHOLD, true);
    expect(sliver.focusedWeightedMs).toBe(0);
  });
});
