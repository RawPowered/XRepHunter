import { computeInteractionMismatch } from '../interaction-mismatch';
import {
  actionTotal,
  applyRowFilters,
  focusedMs,
  rollupByKey,
  type DashboardFilters,
  type DashboardRow,
} from './filters';
import { PROVENANCE_CATEGORY_LABELS } from './provenance-display';

export interface InteractionPostRef {
  postFingerprint: string;
  handle: string;
  focusedMs: number;
  actions: number;
  slopScore?: number;
  toxicityScore?: number;
  displayCategory?: string;
}

export interface InteractionResponse {
  byTopic: ReturnType<typeof rollupByKey>;
  byAuthor: ReturnType<typeof rollupByKey>;
  byProvenance: ReturnType<typeof rollupByKey>;
  dwellWithoutEngage: InteractionPostRef[];
  engageDespiteLowDwell: InteractionPostRef[];
  highRiskInteracted: InteractionPostRef[];
  rewardedSuspicious: InteractionPostRef[];
  mismatch: ReturnType<typeof computeInteractionMismatch>;
}

const LOW_DWELL_MS = 2000;
const HIGH_RISK_TOX = 45;
const HIGH_RISK_SLOP = 55;

export function buildInteractionBreakdown(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles: Set<string>,
): InteractionResponse {
  const filtered = applyRowFilters(rows, filters, trustedHandles);
  const mismatch = computeInteractionMismatch(filtered);

  const toRef = (r: DashboardRow): InteractionPostRef => ({
    postFingerprint: r.postFingerprint,
    handle: r.handle,
    focusedMs: focusedMs(r),
    actions: actionTotal(r),
    slopScore: r.slopScore,
    toxicityScore: r.toxicityScore,
    displayCategory: r.displayCategory,
  });

  const dwellWithoutEngage = mismatch.dwelledWithoutReward.map((m) => {
    const row = filtered.find((r) => r.postFingerprint === m.postFingerprint);
    return {
      postFingerprint: m.postFingerprint,
      handle: m.handle,
      focusedMs: m.focusedWeightedMs,
      actions: m.actions,
      slopScore: row?.slopScore,
      toxicityScore: row?.toxicityScore,
      displayCategory: row?.displayCategory,
    };
  });

  const engageDespiteLowDwell = mismatch.rewardedWithoutDwell.map((m) => {
    const row = filtered.find((r) => r.postFingerprint === m.postFingerprint);
    return {
      postFingerprint: m.postFingerprint,
      handle: m.handle,
      focusedMs: m.focusedWeightedMs,
      actions: m.actions,
      slopScore: row?.slopScore,
      toxicityScore: row?.toxicityScore,
      displayCategory: row?.displayCategory,
    };
  });

  const highRiskInteracted = filtered
    .filter(
      (r) =>
        actionTotal(r) > 0 &&
        ((r.toxicityScore ?? 0) >= HIGH_RISK_TOX || (r.spamScore ?? 0) >= 50),
    )
    .sort((a, b) => actionTotal(b) - actionTotal(a))
    .slice(0, 15)
    .map(toRef);

  const rewardedSuspicious = filtered
    .filter(
      (r) =>
        actionTotal(r) > 0 &&
        (r.isPromoted ||
          r.displayCategory === 'ai_likely' ||
          r.displayCategory === 'recycled_likely' ||
          r.displayCategory === 'affiliate_promo' ||
          (r.slopScore ?? 0) >= HIGH_RISK_SLOP),
    )
    .sort((a, b) => actionTotal(b) - actionTotal(a))
    .slice(0, 15)
    .map(toRef);

  const byProvenance = rollupByKey(filtered, (r) => r.displayCategory ?? 'unknown').map((d) => ({
    ...d,
    key: PROVENANCE_CATEGORY_LABELS[d.key as keyof typeof PROVENANCE_CATEGORY_LABELS] ?? d.key,
  }));

  return {
    byTopic: rollupByKey(filtered, (r) => r.topics ?? []),
    byAuthor: rollupByKey(filtered, (r) => (r.handle ? r.handle.toLowerCase() : null)),
    byProvenance,
    dwellWithoutEngage,
    engageDespiteLowDwell,
    highRiskInteracted,
    rewardedSuspicious,
    mismatch,
  };
}

export function filterLowDwellHighAction(rows: DashboardRow[]): DashboardRow[] {
  return rows.filter((r) => actionTotal(r) > 0 && focusedMs(r) < LOW_DWELL_MS);
}
