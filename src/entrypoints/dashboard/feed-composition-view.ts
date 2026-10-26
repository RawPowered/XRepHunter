import type { CompositionResponse } from '../../lib/feed/dashboard/composition';
import {
  fmtNum,
  renderEmpty,
  renderSortableTable,
  renderStackedBar,
} from './chart-utils';

function dimTable(id: string, rows: CompositionResponse['byTopic']) {
  return renderSortableTable(
    id,
    [
      { key: 'key', label: 'Item' },
      { key: 'postsSeen', label: 'Posts', align: 'right' },
      { key: 'focusedMs', label: 'Focused dwell', align: 'right' },
      { key: 'actions', label: 'Actions', align: 'right' },
    ],
    rows.map((r) => ({
      key: r.key,
      postsSeen: r.postsSeen,
      focusedMs: r.focusedMs,
      actions: r.actions,
    })),
  );
}

export function renderCompositionView(data: CompositionResponse): string {
  if (!data.dailyStack.length && !data.byTopic.length) return renderEmpty();

  const stack = renderStackedBar(data.dailyStack);
  const promoted = `<p class="stat-line">Promoted: <strong>${fmtNum(data.promotedVsOrganic.promoted)}</strong> · Organic: <strong>${fmtNum(data.promotedVsOrganic.organic)}</strong></p>`;

  const hourRows = data.hourOfDay.map((h) => ({
    key: `${String(h.hour).padStart(2, '0')}:00`,
    postsSeen: h.postsSeen,
    focusedMs: '—',
    actions: '—',
  }));

  return `
    <h2>Daily composition</h2>
  ${stack}
    <p class="hint obs-legend">Stack: organic · AI · promo · recycled · other</p>
    <h2>Promoted vs organic</h2>
    ${promoted}
    <h2>By topic</h2>
    ${dimTable('comp-topic', data.byTopic)}
    <h2>By author</h2>
    ${dimTable('comp-author', data.byAuthor)}
    <h2>By domain</h2>
    ${dimTable('comp-domain', data.byDomain)}
    <h2>By media type</h2>
    ${dimTable('comp-media', data.byMediaType)}
    <h2>By surface</h2>
    ${dimTable('comp-surface', data.bySurface)}
    <h2>Time of day</h2>
    ${renderSortableTable('comp-hour', [{ key: 'key', label: 'Hour' }, { key: 'postsSeen', label: 'Posts', align: 'right' }], hourRows)}
  `;
}
