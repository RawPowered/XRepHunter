import {
  applyRowFilters,
  type DashboardFilters,
  type DashboardRow,
  type TrendsGranularity,
} from './filters';
import { loadBrowseDailyRange, loadUserActionsRange } from './row-source';

export interface TrendPoint {
  periodKey: string;
  postsSeen: number;
  focusedMs: number;
  actions: number;
  slopExposurePct: number;
  toxicityExposurePct: number;
  aiExposurePct: number;
}

export interface TrendsResponse {
  granularity: TrendsGranularity;
  series: TrendPoint[];
  topicTrends: Array<{ topic: string; points: Array<{ periodKey: string; count: number }> }>;
}

function periodKey(dayKey: string, granularity: TrendsGranularity): string {
  if (granularity === 'daily') return dayKey;
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (granularity === 'weekly') {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    return start.toISOString().slice(0, 10);
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export async function buildTrends(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles: Set<string>,
): Promise<TrendsResponse> {
  const filtered = applyRowFilters(rows, filters, trustedHandles);
  const granularity = filters.trendsGranularity ?? 'daily';

  const byPeriod = new Map<
    string,
    { postsSeen: number; focusedMs: number; actions: number; slop: number; tox: number; ai: number }
  >();

  for (const r of filtered) {
    const pk = periodKey(r.dayKey, granularity);
    if (!byPeriod.has(pk)) {
      byPeriod.set(pk, { postsSeen: 0, focusedMs: 0, actions: 0, slop: 0, tox: 0, ai: 0 });
    }
    const p = byPeriod.get(pk)!;
    p.postsSeen++;
    p.focusedMs += r.focusedWeightedMs ?? r.focusedVisibleMs;
    p.actions += (r.likes ?? 0) + (r.reposts ?? 0) + (r.replies ?? 0) + (r.quotes ?? 0);
    if ((r.slopScore ?? 0) >= 55) p.slop++;
    if ((r.toxicityScore ?? 0) >= 45) p.tox++;
    if (r.displayCategory === 'ai_likely' || (r.aiAssistedScore ?? 0) >= 0.55) p.ai++;
  }

  let series: TrendPoint[] = [...byPeriod.entries()]
    .map(([periodKey, p]) => ({
      periodKey,
      postsSeen: p.postsSeen,
      focusedMs: p.focusedMs,
      actions: p.actions,
      slopExposurePct: p.postsSeen > 0 ? Math.round((p.slop / p.postsSeen) * 1000) / 10 : 0,
      toxicityExposurePct: p.postsSeen > 0 ? Math.round((p.tox / p.postsSeen) * 1000) / 10 : 0,
      aiExposurePct: p.postsSeen > 0 ? Math.round((p.ai / p.postsSeen) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  if (!series.length) {
    const [browse, actions] = await Promise.all([
      loadBrowseDailyRange(filters),
      loadUserActionsRange(filters),
    ]);
    const actionByDay = new Map(actions.map((a) => [a.dayKey, a]));
    series = browse.map((b) => {
      const pk = periodKey(b.dayKey, granularity);
      const act = actionByDay.get(b.dayKey);
      const totalActions = act
        ? act.likes + act.reposts + act.replies + act.quotes
        : 0;
      return {
        periodKey: pk,
        postsSeen: b.postsSeen,
        focusedMs: 0,
        actions: totalActions,
        slopExposurePct:
          b.postsSeen > 0 ? Math.round((b.slopFlagged / b.postsSeen) * 1000) / 10 : 0,
        toxicityExposurePct:
          b.postsSeen > 0 ? Math.round((b.toxicityFlagged / b.postsSeen) * 1000) / 10 : 0,
        aiExposurePct:
          b.postsSeen > 0 ? Math.round((b.slopFlagged / b.postsSeen) * 1000) / 10 : 0,
      };
    });
  }

  const topicByPeriod = new Map<string, Map<string, number>>();
  for (const r of filtered) {
    const pk = periodKey(r.dayKey, granularity);
    for (const t of r.topics ?? []) {
      const topic = t.toLowerCase();
      if (!topicByPeriod.has(topic)) topicByPeriod.set(topic, new Map());
      const m = topicByPeriod.get(topic)!;
      m.set(pk, (m.get(pk) ?? 0) + 1);
    }
  }

  const topicTrends = [...topicByPeriod.entries()]
    .map(([topic, periods]) => ({
      topic,
      points: [...periods.entries()]
        .map(([periodKey, count]) => ({ periodKey, count }))
        .sort((a, b) => a.periodKey.localeCompare(b.periodKey)),
    }))
    .sort((a, b) => {
      const totalA = a.points.reduce((s, p) => s + p.count, 0);
      const totalB = b.points.reduce((s, p) => s + p.count, 0);
      return totalB - totalA;
    })
    .slice(0, 8);

  return { granularity, series, topicTrends };
}
