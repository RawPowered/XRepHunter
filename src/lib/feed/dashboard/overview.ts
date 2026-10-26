import {
  rankAuthorsByFocusedMs,
  rankTopicsByFocusedMs,
  rollupAttentionRows,
  type AttentionSnapshot,
} from '../../attention/aggregate';
import type { BrowseStatsSnapshot } from '../../browse/stats';
import { applyRowFilters, focusedMs, pct, type DashboardFilters, type DashboardRow } from './filters';
import { deriveProvenanceDisplayCategory } from './provenance-display';
import { loadBrowseDailyRange } from './row-source';

export interface FeedQualityCard {
  id: string;
  label: string;
  pct: number;
  count: number;
}

export interface OverviewResponse {
  postsSeen: number;
  focusedDwellMs: number;
  avgFocusedDwellMs: number | null;
  actions: number;
  topTopicsByExposure: Array<{ key: string; postsSeen: number }>;
  topTopicsByDwell: Array<{ key: string; focusedMs: number }>;
  exposurePct: {
    aiSlop: number;
    toxicity: number;
    adsPromo: number;
    recycled: number;
  };
  feedQuality: FeedQualityCard[];
  topAccountsByDwell: Array<{ handle: string; focusedMs: number; postsSeen: number }>;
  topAccountsByReach: Array<{ handle: string; postsSeen: number; focusedMs: number }>;
}

function countByCategory(rows: DashboardRow[], pred: (r: DashboardRow) => boolean): number {
  return rows.filter(pred).length;
}

export function buildOverview(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles: Set<string>,
  sessionBrowse?: BrowseStatsSnapshot,
  sessionAttention?: AttentionSnapshot,
): OverviewResponse {
  const filtered = applyRowFilters(rows, filters, trustedHandles);
  const snap = rollupAttentionRows(filtered);
  const total = filtered.length || 1;

  const slopThreshold = 55;
  const toxThreshold = 45;
  const spamThreshold = 40;

  const aiCount = countByCategory(
    filtered,
    (r) =>
      (r.slopScore ?? 0) >= slopThreshold ||
      r.displayCategory === 'ai_likely' ||
      (r.aiAssistedScore ?? 0) >= 0.55,
  );
  const toxCount = countByCategory(filtered, (r) => (r.toxicityScore ?? 0) >= toxThreshold);
  const adCount = countByCategory(
    filtered,
    (r) =>
      r.isPromoted ||
      r.displayCategory === 'official_ad' ||
      r.displayCategory === 'affiliate_promo' ||
      r.displayCategory === 'disclosed_sponsor' ||
      (r.sponsorshipScore ?? 0) >= 0.5,
  );
  const recycledCount = countByCategory(
    filtered,
    (r) => r.displayCategory === 'recycled_likely' || (r.copypastaScore ?? 0) >= 0.5,
  );

  const topicExposure = new Map<string, number>();
  for (const r of filtered) {
    for (const t of r.topics ?? []) {
      const k = t.toLowerCase();
      topicExposure.set(k, (topicExposure.get(k) ?? 0) + 1);
    }
  }
  const topTopicsByExposure = [...topicExposure.entries()]
    .map(([key, postsSeen]) => ({ key, postsSeen }))
    .sort((a, b) => b.postsSeen - a.postsSeen)
    .slice(0, 8);

  const topTopicsByDwell = rankTopicsByFocusedMs(filtered, 8).map((t) => ({
    key: t.key,
    focusedMs: t.focusedWeightedMs,
  }));

  const reachByHandle = new Map<string, { postsSeen: number; focusedMs: number }>();
  for (const r of filtered) {
    const h = r.handle.toLowerCase();
    if (!h) continue;
    const cur = reachByHandle.get(h) ?? { postsSeen: 0, focusedMs: 0 };
    cur.postsSeen++;
    cur.focusedMs += focusedMs(r);
    reachByHandle.set(h, cur);
  }

  const topAccountsByDwell = [...reachByHandle.entries()]
    .map(([handle, v]) => ({ handle, ...v }))
    .sort((a, b) => b.focusedMs - a.focusedMs)
    .slice(0, 5);

  const topAccountsByReach = [...reachByHandle.entries()]
    .map(([handle, v]) => ({ handle, ...v }))
    .sort((a, b) => b.postsSeen - a.postsSeen)
    .slice(0, 5);

  const organicCount = countByCategory(
    filtered,
    (r) => deriveProvenanceDisplayCategory(r) === 'organic_likely',
  );

  let postsSeen = filtered.length;
  let focusedDwellMs = snap.focusedWeightedMs || snap.focusedVisibleMs;
  let actions = snap.actions;
  let avgFocusedDwellMs = snap.avgWeightedFocusedDwellMs ?? snap.avgFocusedDwellMs;

  if (filters.range === 'session' && sessionBrowse) {
    postsSeen = Math.max(postsSeen, sessionBrowse.postsSeen);
  }
  if (filters.range === 'session' && sessionAttention) {
    focusedDwellMs = sessionAttention.focusedWeightedMs || sessionAttention.focusedVisibleMs;
    actions = sessionAttention.actions;
    avgFocusedDwellMs =
      sessionAttention.avgWeightedFocusedDwellMs ?? sessionAttention.avgFocusedDwellMs;
  }

  return {
    postsSeen,
    focusedDwellMs,
    avgFocusedDwellMs,
    actions,
    topTopicsByExposure,
    topTopicsByDwell,
    exposurePct: {
      aiSlop: pct(aiCount, total),
      toxicity: pct(toxCount, total),
      adsPromo: pct(adCount, total),
      recycled: pct(recycledCount, total),
    },
    feedQuality: [
      { id: 'organic', label: 'Organic-looking', pct: pct(organicCount, total), count: organicCount },
      { id: 'ai', label: 'AI-heavy', pct: pct(aiCount, total), count: aiCount },
      {
        id: 'promo',
        label: 'Sponsored / promotional',
        pct: pct(adCount, total),
        count: adCount,
      },
      { id: 'tox', label: 'Toxicity', pct: pct(toxCount, total), count: toxCount },
      {
        id: 'spam',
        label: 'Spam / ad',
        pct: pct(countByCategory(filtered, (r) => (r.spamScore ?? 0) >= spamThreshold), total),
        count: countByCategory(filtered, (r) => (r.spamScore ?? 0) >= spamThreshold),
      },
      {
        id: 'recycled',
        label: 'Recycled / copypasta',
        pct: pct(recycledCount, total),
        count: recycledCount,
      },
    ],
    topAccountsByDwell,
    topAccountsByReach,
  };
}

export async function buildOverviewWithBrowse(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles: Set<string>,
  sessionBrowse?: BrowseStatsSnapshot,
  sessionAttention?: AttentionSnapshot,
): Promise<OverviewResponse> {
  const overview = buildOverview(rows, filters, trustedHandles, sessionBrowse, sessionAttention);
  if (!overview.postsSeen && filters.range !== 'session') {
    const browseDays = await loadBrowseDailyRange(filters);
    const postsSeen = browseDays.reduce((s, d) => s + d.postsSeen, 0);
    if (postsSeen > 0) overview.postsSeen = postsSeen;
  }
  return overview;
}
