import type { DashboardView } from './filters';

export function dashboardToCsv(view: DashboardView, data: unknown): string {
  const rows: string[][] = [];
  const push = (...cells: (string | number | null | undefined)[]) => {
    rows.push(cells.map((c) => (c == null ? '' : String(c))));
  };

  switch (view) {
    case 'overview': {
      const d = data as { postsSeen: number; focusedDwellMs: number; actions: number };
      push('metric', 'value');
      push('posts_seen', d.postsSeen);
      push('focused_dwell_ms', d.focusedDwellMs);
      push('actions', d.actions);
      break;
    }
    case 'accounts': {
      const d = data as { accounts: Array<Record<string, unknown>> };
      push(
        'handle',
        'posts_seen',
        'focused_ms',
        'actions',
        'reputation',
        'avg_slop',
        'avg_toxicity',
      );
      for (const a of d.accounts ?? []) {
        push(
          a.handle as string,
          a.postsSeen as number,
          a.focusedMs as number,
          a.actions as number,
          a.reputationScore as number,
          a.avgSlop as number,
          a.avgToxicity as number,
        );
      }
      break;
    }
    default: {
      push('json');
      push(JSON.stringify(data));
    }
  }

  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function dashboardToSummaryJson(view: DashboardView, data: unknown): string {
  return JSON.stringify({ view, exportedAt: new Date().toISOString(), data }, null, 2);
}
