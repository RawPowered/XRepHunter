import type { AttentionResponse } from '../../lib/feed/dashboard/attention-breakdown';
import { fmtDwell, renderEmpty, renderSortableTable } from './chart-utils';

function dimTable(id: string, rows: AttentionResponse['byTopic']) {
  return renderSortableTable(
    id,
    [
      { key: 'key', label: 'Item' },
      { key: 'focusedMs', label: 'Focused dwell', align: 'right' },
      { key: 'attentionSharePct', label: 'Share %', align: 'right' },
      { key: 'postsSeen', label: 'Posts', align: 'right' },
    ],
    rows.map((r) => ({
      key: r.key,
      focusedMs: fmtDwell(r.focusedMs),
      attentionSharePct: `${r.attentionSharePct.toFixed(1)}%`,
      postsSeen: r.postsSeen,
    })),
  );
}

function postTable(id: string, title: string, rows: AttentionResponse['highDwellNoAction']) {
  if (!rows.length) return `<h2>${title}</h2><p class="hint">None in range.</p>`;
  return `<h2>${title}</h2>${renderSortableTable(
    id,
    [
      { key: 'handle', label: 'Account' },
      { key: 'focusedMs', label: 'Dwell', align: 'right' },
      { key: 'actions', label: 'Actions', align: 'right' },
      { key: 'revisitCount', label: 'Revisits', align: 'right' },
      { key: 'pauseCount', label: 'Pauses', align: 'right' },
    ],
    rows.map((r) => ({
      handle: `@${r.handle}`,
      focusedMs: fmtDwell(r.focusedMs),
      actions: r.actions,
      revisitCount: r.revisitCount,
      pauseCount: r.pauseCount,
    })),
  )}`;
}

export function renderAttentionView(data: AttentionResponse): string {
  if (!data.totalFocusedMs && !data.byTopic.length) return renderEmpty();

  return `
    <p class="stat-line">Total focused dwell: <strong>${fmtDwell(data.totalFocusedMs)}</strong></p>
    <h2>By topic</h2>
    ${dimTable('att-topic', data.byTopic)}
    <h2>By author</h2>
    ${dimTable('att-author', data.byAuthor)}
    <h2>By domain</h2>
    ${dimTable('att-domain', data.byDomain)}
    <h2>By provenance</h2>
    ${dimTable('att-prov', data.byProvenance)}
    ${postTable('att-high-dwell', 'High dwell, no interaction', data.highDwellNoAction)}
    ${postTable('att-quick-skip', 'Quick skips', data.quickSkip)}
    ${postTable('att-revisit', 'Revisit-heavy', data.revisitHeavy)}
    ${postTable('att-pause', 'Pause-heavy', data.pauseHeavy)}
  `;
}
