import type { ProvenanceBreakdownResponse } from '../../lib/feed/dashboard/provenance-breakdown';
import { fmtDwell, fmtNum, renderEmpty, renderSortableTable } from './chart-utils';

export function renderProvenanceView(data: ProvenanceBreakdownResponse): string {
  if (!data.categories.length) return renderEmpty();

  const blocks = data.categories
    .map((c) => {
      const evidence =
        c.topEvidence.length > 0
          ? `<ul class="obs-evidence">${c.topEvidence
              .map(
                (e) =>
                  `<li><code>${e.id}</code> ${e.label} · ${e.count}× · conf ${(e.maxConfidence * 100).toFixed(0)}%</li>`,
              )
              .join('')}</ul>`
          : '<p class="hint">No matched signals in range.</p>';

      const examples =
        c.examples.length > 0
          ? `<ul class="obs-examples">${c.examples
              .map(
                (ex) =>
                  `<li>@${ex.handle}${ex.statusId ? ` / ${ex.statusId}` : ''} — signals suggest: ${ex.signals.join(', ') || 'uncertain'} (${(ex.confidence * 100).toFixed(0)}% conf)</li>`,
              )
              .join('')}</ul>`
          : '';

      const authors = renderSortableTable(
        `prov-${c.category}-auth`,
        [
          { key: 'key', label: 'Author' },
          { key: 'postsSeen', label: 'Posts', align: 'right' },
        ],
        c.topAuthors.map((a) => ({ key: `@${a.key}`, postsSeen: a.postsSeen })),
      );

      return `
        <section class="obs-prov-block">
          <h2>${c.label}</h2>
          <p class="stat-line">Seen: <strong>${fmtNum(c.postsSeen)}</strong> · Dwell: <strong>${fmtDwell(c.focusedMs)}</strong> · Actions: <strong>${fmtNum(c.actions)}</strong></p>
          <h3>Matched signals</h3>
          ${evidence}
          <h3>Top authors</h3>
          ${authors}
          ${examples ? `<h3>Examples (signals only — not claims of fact)</h3>${examples}` : ''}
        </section>
      `;
    })
    .join('');

  return `<p class="stat-line">${fmtNum(data.totalPosts)} posts in range</p>${blocks}`;
}
