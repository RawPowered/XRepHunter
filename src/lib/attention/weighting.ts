export const REAL_FOCUS_RATIO_THRESHOLD = 0.15;

export function effectiveFocusRatio(
  intersectionRatio: number,
  threshold = REAL_FOCUS_RATIO_THRESHOLD,
): number {
  if (intersectionRatio <= 0 || intersectionRatio < threshold) return 0;
  return intersectionRatio;
}

export function weightedDeltaMs(
  deltaMs: number,
  intersectionRatio: number,
  threshold = REAL_FOCUS_RATIO_THRESHOLD,
  focused = false,
): { weightedVisibleMs: number; focusedWeightedMs: number } {
  const weightedVisibleMs = deltaMs * intersectionRatio;
  const effective = focused ? effectiveFocusRatio(intersectionRatio, threshold) : 0;
  return {
    weightedVisibleMs,
    focusedWeightedMs: deltaMs * effective,
  };
}
