import { formatDwellMs } from '../../lib/attention/aggregate';

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function fmtDwell(ms: number): string {
  return formatDwellMs(ms);
}

export function renderSummaryCards(
  cards: Array<{ label: string; value: string; sub?: string }>,
): string {
  const inner = cards
    .map(
      (c) =>
        `<div class="obs-summary-card"><span class="obs-summary-val">${c.value}</span><span class="obs-summary-lbl">${c.label}</span>${c.sub ? `<span class="obs-summary-sub">${c.sub}</span>` : ''}</div>`,
    )
    .join('');
  return `<div class="obs-summary-grid">${inner}</div>`;
}

export function renderEmpty(message = 'No data for selected range.'): string {
  return `<p class="hint obs-empty">${message}</p>`;
}

export function sparkRow(values: number[], label: string, format: (v: number) => string): string {
  if (values.length < 2) {
    return `<p class="hint">Need more periods for ${label.toLowerCase()}.</p>`;
  }
  const max = Math.max(...values, 1);
  const cells = values
    .map((v) => {
      const pct = Math.round((v / max) * 100);
      const h = Math.max(pct, 4);
      return `<div class="spark-bar" title="${format(v)}"><div class="fill" style="height:${h}%"></div></div>`;
    })
    .join('');
  return `<div class="spark-group"><span class="spark-label">${label}</span><div class="spark-row">${cells}</div></div>`;
}

export function renderStackedBar(
  days: Array<{
    dayKey: string;
    organic: number;
    ai: number;
    promo: number;
    recycled: number;
    other: number;
  }>,
): string {
  if (!days.length) return renderEmpty();
  const max = Math.max(...days.map((d) => d.organic + d.ai + d.promo + d.recycled + d.other), 1);
  const bars = days
    .map((d) => {
      const total = d.organic + d.ai + d.promo + d.recycled + d.other;
      const h = Math.max(Math.round((total / max) * 100), 4);
      const segments = [
        { cls: 'seg-organic', v: d.organic },
        { cls: 'seg-ai', v: d.ai },
        { cls: 'seg-promo', v: d.promo },
        { cls: 'seg-recycled', v: d.recycled },
        { cls: 'seg-other', v: d.other },
      ];
      const inner = segments
        .filter((s) => s.v > 0)
        .map((s) => {
          const sh = total > 0 ? Math.round((s.v / total) * h) : 0;
          return `<div class="stack-seg ${s.cls}" style="height:${sh}%" title="${s.v}"></div>`;
        })
        .join('');
      return `<div class="stack-bar" title="${d.dayKey}: ${total}"><div class="stack-inner" style="height:${h}%">${inner}</div></div>`;
    })
    .join('');
  return `<div class="stack-chart">${bars}</div>`;
}

export interface SortableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export function renderSortableTable(
  id: string,
  columns: SortableColumn[],
  rows: Record<string, string | number>[],
  emptyHint?: string,
): string {
  if (!rows.length) return renderEmpty(emptyHint);
  const thead = columns.map((c) => `<th data-col="${c.key}">${c.label}</th>`).join('');
  const tbody = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const v = row[c.key];
          const cls = c.align === 'right' ? ' class="num"' : '';
          return `<td${cls}>${v ?? '—'}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<div class="obs-table-wrap"><table class="lb-table obs-table" data-sort-table="${id}"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;
}

export function wireSortableTables(root: ParentNode): void {
  root.querySelectorAll<HTMLTableElement>('table[data-sort-table]').forEach((table) => {
    table.querySelectorAll('th[data-col]').forEach((th) => {
      th.addEventListener('click', () => {
        const tbody = table.querySelector('tbody')!;
        const rows = [...tbody.querySelectorAll('tr')];
        const idx = [...table.querySelectorAll('th')].indexOf(th as HTMLTableCellElement);
        const asc = th.classList.toggle('sort-asc');
        th.classList.toggle('sort-desc', !asc);
        rows.sort((a, b) => {
          const av = a.children[idx]?.textContent ?? '';
          const bv = b.children[idx]?.textContent ?? '';
          const an = parseFloat(av.replace(/[^0-9.-]/g, ''));
          const bn = parseFloat(bv.replace(/[^0-9.-]/g, ''));
          const cmp = !Number.isNaN(an) && !Number.isNaN(bn) ? an - bn : av.localeCompare(bv);
          return asc ? cmp : -cmp;
        });
        rows.forEach((r) => tbody.appendChild(r));
      });
    });
  });
}

export function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function renderSparklinesFromValues(
  series: Array<{ label: string; values: number[]; format?: (v: number) => string }>,
): string {
  const parts = series.map((s) => sparkRow(s.values, s.label, s.format ?? String));
  return `<div class="sparklines">${parts.join('')}</div>`;
}
