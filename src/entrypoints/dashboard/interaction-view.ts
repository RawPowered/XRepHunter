import type { InteractionResponse } from '../../lib/feed/dashboard/interaction-breakdown';
import { fmtDwell, renderEmpty, renderSortableTable } from './chart-utils';

function dimTable(id: string, rows: InteractionResponse['byTopic']) {
  return renderSortableTable(
    id,
    [
      { key: 'key', label: 'Item' },
      { key: 'actions', label: 'Actions', align: 'right' },
      { key: 'interactionRatePct', label: 'Rate %', align: 'right' },
      { key: 'focusedMs', label: 'Focused dwell', align: 'right' },
    ],
    rows.map((r) => ({
      key: r.key,
      actions: r.actions,
      interactionRatePct: `${r.interactionRatePct.toFixed(1)}%`,
      focusedMs: fmtDwell(r.focusedMs),
    })),
  );
}

function mismatchTable(
  id: string,
  title: string,
  rows: InteractionResponse['dwellWithoutEngage'],
) {
  if (!rows.length) return `<h2>${title}</h2><p class="hint">None in range.</p>`;
  return `<h2>${title}</h2>${renderSortableTable(
    id,
    [
      { key: 'handle', label: 'Account' },
      { key: 'focusedMs', label: 'Dwell', align: 'right' },
      { key: 'actions', label: 'Actions', align: 'right' },
    ],
    rows.map((r) => ({
      handle: `@${r.handle}`,
      focusedMs: fmtDwell(r.focusedMs),
      actions: r.actions,
    })),
  )}`;
}

function riskTable(id: string, title: string, rows: InteractionResponse['highRiskInteracted']) {
  if (!rows.length) return `<h2>${title}</h2><p class="hint">None in range.</p>`;
  return `<h2>${title}</h2>${renderSortableTable(
    id,
    [
      { key: 'handle', label: 'Account' },
      { key: 'actions', label: 'Actions', align: 'right' },
      { key: 'toxicityScore', label: 'Tox', align: 'right' },
      { key: 'slopScore', label: 'Slop', align: 'right' },
      { key: 'category', label: 'Signals' },
    ],
    rows.map((r) => ({
      handle: `@${r.handle}`,
      actions: r.actions,
      toxicityScore: r.toxicityScore ?? '—',
      slopScore: r.slopScore ?? '—',
      category: r.displayCategory ?? '—',
    })),
  )}`;
}

export function renderInteractionView(data: InteractionResponse): string {
  if (!data.byTopic.length && !data.mismatch.overlapCount) return renderEmpty();

  return `
    <p class="stat-line">Attention–action overlap (top sets): <strong>${data.mismatch.overlapCount}</strong></p>
    <h2>Actions by topic</h2>
    ${dimTable('int-topic', data.byTopic)}
    <h2>Actions by author</h2>
    ${dimTable('int-author', data.byAuthor)}
    <h2>Actions by provenance</h2>
    ${dimTable('int-prov', data.byProvenance)}
    ${mismatchTable('int-dwell-no-act', 'Dwell on these, rarely engage', data.dwellWithoutEngage)}
    ${mismatchTable('int-act-low-dwell', 'Engage despite low dwell', data.engageDespiteLowDwell)}
    ${riskTable('int-high-risk', 'High-risk content interacted with', data.highRiskInteracted)}
    ${riskTable('int-rewarded-sus', 'Sponsored / AI / recycled rewarded', data.rewardedSuspicious)}
  `;
}
