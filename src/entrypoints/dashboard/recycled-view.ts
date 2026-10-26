import type { CopypastaResponse } from '../../lib/feed/dashboard/copypasta-clusters';
import { fmtNum, renderEmpty, renderSortableTable } from './chart-utils';

export function renderRecycledView(data: CopypastaResponse): string {
  if (!data.clusters.length) return renderEmpty('No repeated text clusters yet.');

  const clusters = renderSortableTable(
    'copy-clusters',
    [
      { key: 'fingerprint', label: 'Text fingerprint' },
      { key: 'appearances', label: 'Appearances', align: 'right' },
      { key: 'authors', label: 'Authors', align: 'right' },
      { key: 'firstHandle', label: 'First handle' },
      { key: 'firstSeen', label: 'First seen' },
      { key: 'lastSeen', label: 'Last seen' },
    ],
    data.clusters.map((c) => ({
      fingerprint: c.textFingerprint.slice(0, 16) + '…',
      appearances: c.appearances,
      authors: c.authorCount,
      firstHandle: `@${c.firstHandle}`,
      firstSeen: new Date(c.firstSeenAt).toLocaleDateString(),
      lastSeen: new Date(c.lastSeenAt).toLocaleDateString(),
    })),
  );

  const stale =
    data.staleRecycled.length > 0
      ? `<h2>Stale recycled (30d+ since last seen)</h2>${renderSortableTable(
          'copy-stale',
          [
            { key: 'fingerprint', label: 'Fingerprint' },
            { key: 'appearances', label: 'Appearances', align: 'right' },
            { key: 'lastSeen', label: 'Last seen' },
          ],
          data.staleRecycled.map((c) => ({
            fingerprint: c.textFingerprint.slice(0, 16) + '…',
            appearances: c.appearances,
            lastSeen: new Date(c.lastSeenAt).toLocaleDateString(),
          })),
        )}`
      : '';

  return `<p class="stat-line">${fmtNum(data.clusters.length)} cluster(s)</p>${clusters}${stale}`;
}
