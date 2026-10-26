import { sendMessage } from '../../lib/messaging';
import type { AccountIntelligenceResponse } from '../../lib/feed/dashboard/account-intelligence';
import { fmtDwell, fmtNum, renderEmpty, renderSortableTable } from './chart-utils';

export function renderAccountIntelligenceView(data: AccountIntelligenceResponse): string {
  const toolbar = `
    <div class="obs-account-toolbar actions">
      <label>Filter
        <select id="obs-account-filter">
          <option value="all">All accounts</option>
          <option value="non_trusted">Not in trusted list</option>
          <option value="high_dwell">High dwell</option>
          <option value="high_interaction">High interaction</option>
          <option value="high_slop">High slop</option>
          <option value="high_toxicity">High toxicity</option>
          <option value="suspected_promo">Suspected promo</option>
          <option value="automation_like">Automation-like</option>
        </select>
      </label>
      <button type="button" id="obs-db-export">Export .db</button>
      <label class="file-btn">Import .db<input type="file" id="obs-db-import" accept=".db,application/octet-stream" hidden /></label>
      <span id="obs-account-status" class="hint"></span>
    </motionless>
  `.replace(/motionless/g, 'div');

  if (!data.accounts.length) {
    return `${toolbar}<p class="hint">Browse X to populate account reach data.</p>`;
  }

  const table = renderSortableTable(
    'acct-intel',
    [
      { key: 'handle', label: 'Handle' },
      { key: 'postsSeen', label: 'Seen', align: 'right' },
      { key: 'focusedMs', label: 'Focused dwell', align: 'right' },
      { key: 'actions', label: 'Actions', align: 'right' },
      { key: 'reputation', label: 'Score', align: 'right' },
      { key: 'avgSlop', label: 'Slop', align: 'right' },
      { key: 'avgTox', label: 'Tox', align: 'right' },
      { key: 'aiRate', label: 'AI %', align: 'right' },
      { key: 'recycledRate', label: 'Recycled %', align: 'right' },
      { key: 'trusted', label: 'Trusted' },
      { key: 'lastSeen', label: 'Last seen' },
    ],
    data.accounts.map((a) => ({
      handle: `@${a.handle}`,
      postsSeen: a.postsSeen,
      focusedMs: fmtDwell(a.focusedMs),
      actions: a.actions,
      reputation: a.reputationScore ?? '—',
      avgSlop: a.avgSlop ?? '—',
      avgTox: a.avgToxicity ?? '—',
      aiRate: a.aiRatePct ? `${a.aiRatePct}%` : '—',
      recycledRate: a.recycledRatePct ? `${a.recycledRatePct}%` : '—',
      trusted: a.isTrusted ? 'yes' : '—',
      lastSeen: a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleDateString() : '—',
    })),
  );

  return `${toolbar}<p class="stat-line">${fmtNum(data.total)} account(s)</p>${table}`;
}

export function wireAccountIntelligenceToolbar(onReload: () => void): void {
  document.getElementById('obs-db-export')?.addEventListener('click', async () => {
    const res = await sendMessage<{ bytes: number[]; filename: string }>({ type: 'EXPORT_DB' });
    const blob = new Blob([new Uint8Array(res.bytes)], { type: 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = res.filename;
    a.click();
  });

  document.getElementById('obs-db-import')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const mode = window.confirm(
      'Merge keeps the richer row per handle. Cancel = Replace (wipe local DB and load file).',
    )
      ? 'merge'
      : 'replace';
    const buf = await file.arrayBuffer();
    await sendMessage({ type: 'IMPORT_DB', bytes: Array.from(new Uint8Array(buf)), mode });
    alert(mode === 'replace' ? 'Database replaced. Reload the extension.' : 'Database merged.');
    onReload();
  });
}
