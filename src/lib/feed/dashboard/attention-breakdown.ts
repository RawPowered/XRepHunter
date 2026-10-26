import {
  actionTotal,
  applyRowFilters,
  focusedMs,
  pct,
  rollupByKey,
  type DashboardFilters,
  type DashboardRow,
} from './filters';
import { PROVENANCE_CATEGORY_LABELS } from './provenance-display';

export interface AttentionPostRef {
  postFingerprint: string;
  handle: string;
  statusId?: string;
  focusedMs: number;
  actions: number;
  revisitCount: number;
  pauseCount: number;
}

export interface AttentionResponse {
  byTopic: ReturnType<typeof rollupByKey>;
  byAuthor: ReturnType<typeof rollupByKey>;
  byDomain: ReturnType<typeof rollupByKey>;
  byProvenance: ReturnType<typeof rollupByKey>;
  highDwellNoAction: AttentionPostRef[];
  quickSkip: AttentionPostRef[];
  revisitHeavy: AttentionPostRef[];
  pauseHeavy: AttentionPostRef[];
  totalFocusedMs: number;
}

const QUICK_SKIP_MS = 1500;
const HEAVY_REVISIT = 2;
const HEAVY_PAUSE = 2;

export function buildAttentionBreakdown(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles: Set<string>,
): AttentionResponse {
  const filtered = applyRowFilters(rows, filters, trustedHandles);
  const totalFocusedMs = filtered.reduce((s, r) => s + focusedMs(r), 0);

  const toRef = (r: DashboardRow): AttentionPostRef => ({
    postFingerprint: r.postFingerprint,
    handle: r.handle,
    statusId: r.statusId,
    focusedMs: focusedMs(r),
    actions: actionTotal(r),
    revisitCount: r.revisitCount,
    pauseCount: r.pauseCount,
  });

  const highDwellNoAction = [...filtered]
    .filter((r) => focusedMs(r) >= 3000 && actionTotal(r) === 0)
    .sort((a, b) => focusedMs(b) - focusedMs(a))
    .slice(0, 15)
    .map(toRef);

  const quickSkip = [...filtered]
    .filter((r) => focusedMs(r) > 0 && focusedMs(r) < QUICK_SKIP_MS)
    .sort((a, b) => focusedMs(a) - focusedMs(b))
    .slice(0, 15)
    .map(toRef);

  const revisitHeavy = [...filtered]
    .filter((r) => r.revisitCount >= HEAVY_REVISIT)
    .sort((a, b) => b.revisitCount - a.revisitCount)
    .slice(0, 15)
    .map(toRef);

  const pauseHeavy = [...filtered]
    .filter((r) => r.pauseCount >= HEAVY_PAUSE)
    .sort((a, b) => b.pauseCount - a.pauseCount)
    .slice(0, 15)
    .map(toRef);

  const byProvenance = rollupByKey(filtered, (r) => r.displayCategory ?? 'unknown').map((d) => ({
    ...d,
    key: PROVENANCE_CATEGORY_LABELS[d.key as keyof typeof PROVENANCE_CATEGORY_LABELS] ?? d.key,
    attentionSharePct: pct(d.focusedMs, totalFocusedMs),
  }));

  return {
    byTopic: rollupByKey(filtered, (r) => r.topics ?? []),
    byAuthor: rollupByKey(filtered, (r) => (r.handle ? r.handle.toLowerCase() : null)),
    byDomain: rollupByKey(filtered, (r) => (r.cardDomain ? r.cardDomain.toLowerCase() : null)),
    byProvenance,
    highDwellNoAction,
    quickSkip,
    revisitHeavy,
    pauseHeavy,
    totalFocusedMs,
  };
}
