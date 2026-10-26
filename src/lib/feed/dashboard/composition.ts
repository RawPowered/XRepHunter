import {
  applyRowFilters,
  focusedMs,
  pct,
  rollupByKey,
  type DashboardFilters,
  type DashboardRow,
  type DimensionRow,
} from './filters';
import { FEED_SURFACE_LABELS, type FeedSurface } from '../surface-detect';
import { loadBrowseDailyRange } from './row-source';

export interface CompositionDayStack {
  dayKey: string;
  organic: number;
  ai: number;
  promo: number;
  recycled: number;
  other: number;
}

export interface CompositionResponse {
  dailyStack: CompositionDayStack[];
  byTopic: DimensionRow[];
  byAuthor: DimensionRow[];
  byDomain: DimensionRow[];
  byMediaType: DimensionRow[];
  bySurface: DimensionRow[];
  promotedVsOrganic: { promoted: number; organic: number };
  hourOfDay: Array<{ hour: number; postsSeen: number }>;
}

function classifyStackBucket(r: DashboardRow): keyof Omit<CompositionDayStack, 'dayKey'> {
  if (r.isPromoted || r.displayCategory === 'official_ad') return 'promo';
  if (r.displayCategory === 'ai_likely' || (r.slopScore ?? 0) >= 55) return 'ai';
  if (r.displayCategory === 'recycled_likely') return 'recycled';
  if (r.displayCategory === 'organic_likely') return 'organic';
  return 'other';
}

export function buildComposition(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles: Set<string>,
): CompositionResponse {
  const filtered = applyRowFilters(rows, filters, trustedHandles);

  const byDay = new Map<string, CompositionDayStack>();
  for (const r of filtered) {
    if (!byDay.has(r.dayKey)) {
      byDay.set(r.dayKey, {
        dayKey: r.dayKey,
        organic: 0,
        ai: 0,
        promo: 0,
        recycled: 0,
        other: 0,
      });
    }
    const bucket = classifyStackBucket(r);
    byDay.get(r.dayKey)![bucket]++;
  }

  const promoted = filtered.filter(
    (r) => r.isPromoted || r.displayCategory === 'official_ad' || r.displayCategory === 'affiliate_promo',
  ).length;
  const organic = filtered.length - promoted;

  const hourOfDay = new Array(24).fill(0).map((_, hour) => ({ hour, postsSeen: 0 }));
  for (const r of filtered) {
    const ts = r.lastSeenAt ?? r.firstSeenAt;
    if (!ts) continue;
    const h = new Date(ts).getHours();
    hourOfDay[h].postsSeen++;
  }

  return {
    dailyStack: [...byDay.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
    byTopic: rollupByKey(filtered, (r) => r.topics ?? []),
    byAuthor: rollupByKey(filtered, (r) => (r.handle ? r.handle.toLowerCase() : null)),
    byDomain: rollupByKey(filtered, (r) => (r.cardDomain ? r.cardDomain.toLowerCase() : 'none')),
    byMediaType: rollupByKey(filtered, (r) => r.mediaType ?? 'unknown'),
    bySurface: rollupByKey(filtered, (r) => r.surface ?? 'unknown').map((d) => ({
      ...d,
      key: FEED_SURFACE_LABELS[d.key as FeedSurface] ?? d.key,
    })),
    promotedVsOrganic: { promoted, organic },
    hourOfDay: hourOfDay.filter((h) => h.postsSeen > 0),
  };
}

export async function buildCompositionWithBrowseFallback(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles: Set<string>,
): Promise<CompositionResponse> {
  const comp = buildComposition(rows, filters, trustedHandles);
  if (!comp.dailyStack.length) {
    const browse = await loadBrowseDailyRange(filters);
    comp.dailyStack = browse.map((d) => ({
      dayKey: d.dayKey,
      organic: d.postsSeen,
      ai: d.slopFlagged,
      promo: d.adsSeen,
      recycled: 0,
      other: 0,
    }));
  }
  return comp;
}
