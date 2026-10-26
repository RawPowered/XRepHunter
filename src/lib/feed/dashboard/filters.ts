import type { PostAttentionRow } from '../../attention/aggregate';
import type { ProvenanceEvidence } from '../../provenance/types';
import type { FeedSurface } from '../surface-detect';

export type DashboardRange = 'session' | 'today' | '7d' | '30d' | '90d' | 'all';

export type DashboardView =
  | 'overview'
  | 'composition'
  | 'attention'
  | 'interaction'
  | 'accounts'
  | 'provenance'
  | 'copypasta'
  | 'trends';

export type AccountIntelFilter =
  | 'all'
  | 'non_trusted'
  | 'high_dwell'
  | 'high_interaction'
  | 'high_slop'
  | 'high_toxicity'
  | 'suspected_promo'
  | 'automation_like';

export type TrendsGranularity = 'daily' | 'weekly' | 'monthly';

export interface DashboardFilters {
  range: DashboardRange;
  surface?: FeedSurface | string;
  topic?: string;
  handle?: string;
  provenanceCategory?: string;
  minSlop?: number;
  minSpam?: number;
  minToxicity?: number;
  interactionOnly?: boolean;
  nonTrustedOnly?: boolean;
  accountFilter?: AccountIntelFilter;
  trendsGranularity?: TrendsGranularity;
}

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  range: '30d',
  trendsGranularity: 'daily',
};

/** Max days for ranged queries; 0 = no limit (all time). */
export function resolveDayLimit(range: DashboardRange): number {
  switch (range) {
    case 'session':
    case 'today':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case 'all':
      return 0;
    default:
      return 30;
  }
}

export const MAX_DASHBOARD_DAYS = 366;

export function clampDayLimit(days: number): number {
  if (days <= 0) return 0;
  return Math.max(1, Math.min(days, MAX_DASHBOARD_DAYS));
}

export function actionTotal(row: Pick<PostAttentionRow, 'likes' | 'reposts' | 'replies' | 'quotes'>): number {
  return (row.likes ?? 0) + (row.reposts ?? 0) + (row.replies ?? 0) + (row.quotes ?? 0);
}

export function focusedMs(row: PostAttentionRow): number {
  return row.focusedWeightedMs ?? row.focusedVisibleMs;
}

export function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 1000) / 10;
}

export interface DashboardRow extends PostAttentionRow {
  dayKey: string;
  likelihoodCategory?: string;
  sponsorshipScore?: number;
  influencerAdScore?: number;
  copypastaScore?: number;
  aiAssistedScore?: number;
  evidence?: ProvenanceEvidence[];
  displayCategory?: string;
}

export function applyRowFilters(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles?: Set<string>,
): DashboardRow[] {
  return rows.filter((r) => {
    if (filters.surface && filters.surface !== 'unknown') {
      const s = r.surface ?? 'unknown';
      if (s !== filters.surface) return false;
    }
    if (filters.handle && r.handle.toLowerCase() !== filters.handle.toLowerCase()) return false;
    if (filters.topic) {
      const topics = r.topics ?? [];
      if (!topics.some((t) => t.toLowerCase() === filters.topic!.toLowerCase())) return false;
    }
    if (filters.provenanceCategory && r.displayCategory !== filters.provenanceCategory) return false;
    if (filters.minSlop != null && (r.slopScore ?? 0) < filters.minSlop) return false;
    if (filters.minSpam != null && (r.spamScore ?? 0) < filters.minSpam) return false;
    if (filters.minToxicity != null && (r.toxicityScore ?? 0) < filters.minToxicity) return false;
    if (filters.interactionOnly && actionTotal(r) === 0) return false;
    if (filters.nonTrustedOnly && trustedHandles?.has(r.handle.toLowerCase())) return false;
    return true;
  });
}

export interface DimensionRow {
  key: string;
  postsSeen: number;
  focusedMs: number;
  actions: number;
  attentionSharePct: number;
  interactionRatePct: number;
  avgFocusedDwellMs: number | null;
}

export function rollupByKey(
  rows: DashboardRow[],
  keyFn: (r: DashboardRow) => string | string[] | null,
): DimensionRow[] {
  const totalFocus = rows.reduce((s, r) => s + focusedMs(r), 0);
  const byKey = new Map<string, DashboardRow[]>();

  for (const r of rows) {
    const keys = keyFn(r);
    if (!keys) continue;
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      const key = k.toLowerCase();
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(r);
    }
  }

  return [...byKey.entries()]
    .map(([key, group]) => {
      const focus = group.reduce((s, r) => s + focusedMs(r), 0);
      const actions = group.reduce((s, r) => s + actionTotal(r), 0);
      const postsWithFocus = group.filter((r) => focusedMs(r) > 0).length;
      return {
        key,
        postsSeen: group.length,
        focusedMs: focus,
        actions,
        attentionSharePct: pct(focus, totalFocus),
        interactionRatePct: pct(actions, group.length),
        avgFocusedDwellMs: postsWithFocus > 0 ? Math.round(focus / postsWithFocus) : null,
      };
    })
    .sort((a, b) => b.focusedMs - a.focusedMs);
}
