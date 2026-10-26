import type { TrendsResponse } from '../../lib/feed/dashboard/trends';
import { fmtDwell, fmtNum, renderEmpty, renderSparklinesFromValues } from './chart-utils';

export function renderTrendsView(data: TrendsResponse): string {
  if (!data.series.length) return renderEmpty();

  const spark = renderSparklinesFromValues([
    { label: 'Posts seen', values: data.series.map((p) => p.postsSeen) },
    { label: 'Focused dwell', values: data.series.map((p) => p.focusedMs), format: fmtDwell },
    { label: 'Actions', values: data.series.map((p) => p.actions) },
    { label: 'Slop exposure %', values: data.series.map((p) => p.slopExposurePct) },
    { label: 'Toxicity exposure %', values: data.series.map((p) => p.toxicityExposurePct) },
    { label: 'AI exposure %', values: data.series.map((p) => p.aiExposurePct) },
  ]);

  const topicLines = data.topicTrends
    .map((t) => {
      const vals = t.points.map((p) => p.count).join(', ');
      return `<p class="stat-line"><strong>${t.topic}</strong>: ${vals || '—'}</p>`;
    })
    .join('');

  const periodLabels = data.series.map((p) => p.periodKey).join(' · ');

  return `
    <p class="stat-line">Granularity: <strong>${data.granularity}</strong> · Periods: ${periodLabels}</p>
    <h2>Trend lines</h2>
    ${spark}
    <h2>Topic trends</h2>
    ${topicLines || '<p class="hint">No topic data.</p>'}
    <h2>Period summary</h2>
    <table class="lb-table obs-table"><thead><tr><th>Period</th><th>Posts</th><th>Dwell</th><th>Actions</th><th>Slop %</th><th>Tox %</th><th>AI %</th></tr></thead><tbody>
      ${data.series
        .map(
          (p) =>
            `<tr><td>${p.periodKey}</td><td class="num">${fmtNum(p.postsSeen)}</td><td class="num">${fmtDwell(p.focusedMs)}</td><td class="num">${p.actions}</td><td class="num">${p.slopExposurePct}%</td><td class="num">${p.toxicityExposurePct}%</td><td class="num">${p.aiExposurePct}%</td></tr>`,
        )
        .join('')}
    </tbody></table>
  `;
}
