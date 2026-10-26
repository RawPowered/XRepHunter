import type { PostAttentionRow } from '../attention/aggregate';

export interface MismatchPostRef {
  postFingerprint: string;
  handle: string;
  focusedWeightedMs: number;
  actions: number;
}

export interface InteractionMismatchReport {
  overlapCount: number;
  topDwellCount: number;
  topActionCount: number;
  rewardedWithoutDwell: MismatchPostRef[];
  dwelledWithoutReward: MismatchPostRef[];
}

function actionTotal(row: PostAttentionRow): number {
  return (row.likes ?? 0) + (row.reposts ?? 0) + (row.replies ?? 0) + (row.quotes ?? 0);
}

export function computeInteractionMismatch(
  rows: PostAttentionRow[],
  limit = 10,
): InteractionMismatchReport {
  const withFocus = rows.filter((r) => (r.focusedWeightedMs ?? 0) > 0 || r.focusedVisibleMs > 0);
  const topDwell = [...withFocus]
    .sort(
      (a, b) =>
        (b.focusedWeightedMs ?? b.focusedVisibleMs) - (a.focusedWeightedMs ?? a.focusedVisibleMs),
    )
    .slice(0, limit);
  const topAction = [...rows]
    .filter((r) => actionTotal(r) > 0)
    .sort((a, b) => actionTotal(b) - actionTotal(a))
    .slice(0, limit);

  const dwellSet = new Set(topDwell.map((r) => r.postFingerprint));
  const actionSet = new Set(topAction.map((r) => r.postFingerprint));
  let overlapCount = 0;
  for (const fp of dwellSet) {
    if (actionSet.has(fp)) overlapCount++;
  }

  const toRef = (r: PostAttentionRow): MismatchPostRef => ({
    postFingerprint: r.postFingerprint,
    handle: r.handle,
    focusedWeightedMs: r.focusedWeightedMs ?? r.focusedVisibleMs,
    actions: actionTotal(r),
  });

  const rewardedWithoutDwell = topAction
    .filter((r) => !dwellSet.has(r.postFingerprint))
    .map(toRef);
  const dwelledWithoutReward = topDwell
    .filter((r) => !actionSet.has(r.postFingerprint))
    .map(toRef);

  return {
    overlapCount,
    topDwellCount: topDwell.length,
    topActionCount: topAction.length,
    rewardedWithoutDwell,
    dwelledWithoutReward,
  };
}
