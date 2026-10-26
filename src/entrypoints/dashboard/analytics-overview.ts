import type { OverviewResponse } from '../../lib/feed/dashboard/overview';
import { fmtDwell, fmtNum, renderEmpty, renderSortableTable, renderSummaryCards } from './chart-utils';

const dimCols = [
  { key: 'key', label: 'Item' },
  { key: 'postsSeen', label: 'Posts', align: 'right' as const },
  { key: 'focusedMs', label: 'Focused dwell', align: 'right' as const },
  { key: 'actions', label: 'Actions', align: 'right' as const },
  { key: 'attentionSharePct', label: 'Attention %', align: 'right' as const },
];

export function renderOverviewView(data: OverviewResponse): string {
  if (!data.postsSeen && !data.focusedDwellMs) return renderEmpty();

  const cards = renderSummaryCards([
    { label: 'Posts seen', value: fmtNum(data.postsSeen) },
    {
      label: 'Focused dwell',
      value: fmtDwell(data.focusedDwellMs),
      sub: data.avgFocusedDwellMs != null ? `avg ${fmtDwell(data.avgFocusedDwellMs)}` : undefined,
    },
    { label: 'Actions', value: fmtNum(data.actions) },
    { label: 'AI / slop exposure', value: fmtPct(data.exposurePct.aiSlop) },
    { label: 'Toxicity exposure', value: fmtPct(data.exposurePct.toxicity) },
    { label: 'Ads / promo exposure', value: fmtPct(data.exposurePct.adsPromo) },
  ]);

  const quality = renderSummaryCards(
    data.feedQuality.map((q) => ({
      label: q.label,
      value: fmtPct(q.pct),
      sub: `${q.count} posts`,
    })),
  );

  const topicExposure = renderSortableTable(
    'ov-topics-exp',
    [
      { key: 'key', label: 'Topic' },
      { key: 'postsSeen', label: 'Posts', align: 'right' },
    ],
    data.topTopicsByExposure.map((t) => ({ key: t.key, postsSeen: t.postsSeen })),
  );

  const topicDwell = renderSortableTable(
    'ov-topics-dwell',
    [
      { key: 'key', label: 'Topic' },
      { key: 'focusedMs', label: 'Focused dwell', align: 'right' },
    ],
    data.topTopicsByDwell.map((t) => ({ key: t.key, focusedMs: fmtDwell(t.focusedMs) })),
  );

  const accountsDwell = renderSortableTable(
    'ov-acct-dwell',
    [
      { key: 'handle', label: 'Account' },
      { key: 'focusedMs', label: 'Focused dwell', align: 'right' },
      { key: 'postsSeen', label: 'Posts', align: 'right' },
    ],
    data.topAccountsByDwell.map((a) => ({
      handle: `@${a.handle}`,
      focusedMs: fmtDwell(a.focusedMs),
      postsSeen: a.postsSeen,
    })),
  );

  const accountsReach = renderSortableTable(
    'ov-acct-reach',
    [
      { key: 'handle', label: 'Account' },
      { key: 'postsSeen', label: 'Posts seen', align: 'right' },
      { key: 'focusedMs', label: 'Focused dwell', align: 'right' },
    ],
    data.topAccountsByReach.map((a) => ({
      handle: `@${a.handle}`,
      postsSeen: a.postsSeen,
      focusedMs: fmtDwell(a.focusedMs),
    })),
  );

  return `
    <h2>Summary</h2>
    ${cards}
    <h2>Feed quality</h2>
    ${quality}
    <h2>Top topics — exposure</h2>
    ${topicExposure}
    <h2>Top topics — focused dwell</h2>
    ${topicDwell}
    <h2>Top accounts — focused dwell</h2>
    ${accountsDwell}
    <h2>Top accounts — repeated reach</h2>
    ${accountsReach}
  `;
}