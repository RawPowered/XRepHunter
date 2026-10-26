import type {
  AccountAnalyticsSnapshot,
  AccountInsights,
  AnalyticsHistoryEntry,
  TweetAnalytics,
} from '../../lib/types';

const D = 'div';

export function fmt(n: number | undefined): string {
  return n != null ? n.toLocaleString() : '—';
}

export function renderMetricCards(snapshot: AccountAnalyticsSnapshot): string {
  const rate =
    snapshot.impressions && snapshot.engagements
      ? ((snapshot.engagements / snapshot.impressions) * 100).toFixed(2) + '%'
      : '—';
  const period = snapshot.periodLabel ? ` · ${snapshot.periodLabel}` : '';
  return `
    <${D} class="metric-cards">
      <${D} class="metric-card"><span class="metric-val">${fmt(snapshot.impressions)}</span><span class="metric-lbl">Impressions</span></${D}>
      <${D} class="metric-card"><span class="metric-val">${fmt(snapshot.engagements)}</span><span class="metric-lbl">Engagements</span></${D}>
      <${D} class="metric-card"><span class="metric-val">${rate}</span><span class="metric-lbl">Eng. rate</span></${D}>
      <${D} class="metric-card"><span class="metric-val">${fmt(snapshot.profileVisits)}</span><span class="metric-lbl">Profile visits</span></${D}>
      <${D} class="metric-card"><span class="metric-val">${fmt(snapshot.newFollowers)}</span><span class="metric-lbl">New followers</span></${D}>
      <p class="meta">Synced ${new Date(snapshot.capturedAt).toLocaleString()} (${snapshot.source})${period}</p>
    </${D}>
  `;
}

export function renderPostsTable(
  tweets: TweetAnalytics[],
  emptyHint = 'No per-post metrics in last capture.',
): string {
  if (!tweets.length) return `<p class="hint">${emptyHint}</p>`;
  const rows = [...tweets]
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
    .slice(0, 15)
    .map(
      (t) =>
        `<tr><td>${(t.textPreview ?? t.tweetId).slice(0, 60)}</td><td>${fmt(t.impressions)}</td><td>${fmt(t.engagements)}</td><td>${t.engagementRate != null ? t.engagementRate.toFixed(1) + '%' : '—'}</td></tr>`,
    )
    .join('');
  return `<table class="posts-table"><thead><tr><th>Post</th><th>Impr.</th><th>Eng.</th><th>Rate</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function deltaCell(current: number | undefined, previous: number | undefined): string {
  if (current == null || previous == null) return '—';
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  const cls = pct >= 0 ? 'delta-up' : 'delta-down';
  return `<span class="${cls}">${sign}${pct.toFixed(0)}%</span>`;
}

export function renderHistoryTable(history: AnalyticsHistoryEntry[]): string {
  if (!history.length) {
    return '<p class="hint">No snapshots yet — import CSV or visit X Account analytics.</p>';
  }
  const rows = history
    .map((entry, i) => {
      const prev = history[i + 1];
      return `<tr>
        <td>${new Date(entry.capturedAt).toLocaleString()}</td>
        <td>${entry.source}</td>
        <td>${entry.periodLabel ?? '—'}</td>
        <td>${fmt(entry.impressions)}</td>
        <td>${deltaCell(entry.impressions, prev?.impressions)}</td>
        <td>${fmt(entry.engagements)}</td>
        <td>${entry.tweetCount}</td>
      </tr>`;
    })
    .join('');
  return `<table class="history-table"><thead><tr><th>Date</th><th>Source</th><th>Period</th><th>Impr.</th><th>Δ Impr.</th><th>Eng.</th><th>Posts</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function renderSparklines(history: AnalyticsHistoryEntry[]): string {
  const ordered = [...history].reverse().slice(-12);
  if (ordered.length < 2) {
    return '<p class="hint">Need at least two snapshots for trends.</p>';
  }
  const sparkBars = (
    values: number[],
    max: number,
    label: string,
    format: (v: number) => string,
    fillClass = '',
  ) => {
    const cells = values
      .map((v) => {
        const pct = max > 0 ? Math.round((v / max) * 100) : 0;
        const h = Math.max(pct, 4);
        return `<${D} class="spark-bar" title="${format(v)}"><${D} class="fill ${fillClass}" style="height:${h}%"></${D}></${D}>`;
      })
      .join('');
    return `<${D} class="spark-group"><span class="spark-label">${label}</span><${D} class="spark-row">${cells}</${D}></${D}>`;
  };
  const impressions = ordered.map((e) => e.impressions ?? 0);
  const engagements = ordered.map((e) => e.engagements ?? 0);
  const rates = ordered.map((e) =>
    e.impressions && e.engagements ? (e.engagements / e.impressions) * 100 : 0,
  );
  return `<${D} class="sparklines">
    ${sparkBars(impressions, Math.max(...impressions, 1), 'Impressions', (v) => fmt(v))}
    ${sparkBars(engagements, Math.max(...engagements, 1), 'Engagements', (v) => fmt(v))}
    ${sparkBars(rates, Math.max(...rates, 0.01), 'Eng. rate', (v) => `${v.toFixed(2)}%`, 'slop')}
  </${D}>`;
}

export function renderInsightsBlock(insights: AccountInsights | null): string {
  if (!insights) {
    return '<p class="hint">Save your @handle on My account to generate insights.</p>';
  }
  return `
    ${insights.risks.length ? `<h3>Risks</h3><ul>${insights.risks.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${insights.opportunities.length ? `<h3>Opportunities</h3><ul>${insights.opportunities.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${insights.algorithmNotes.length ? `<h3>Algorithm notes</h3><ul>${insights.algorithmNotes.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${insights.summary.length ? `<h3>Summary</h3><ul>${insights.summary.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
  `;
}
