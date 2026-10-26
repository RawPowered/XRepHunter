import { dbQuery } from '../../db/bridge';
import { clampDayLimit, resolveDayLimit, type DashboardFilters } from './filters';

export interface CopypastaCluster {
  textFingerprint: string;
  firstHandle: string;
  firstSeenAt: number;
  lastSeenAt: number;
  appearances: number;
  authorCount: number;
  relatedHandles: string[];
}

export interface CopypastaResponse {
  clusters: CopypastaCluster[];
  staleRecycled: CopypastaCluster[];
}

export async function buildCopypastaClusters(filters: DashboardFilters): Promise<CopypastaResponse> {
  const dayLimit = clampDayLimit(resolveDayLimit(filters.range));
  const { rows: corpusRows } = await dbQuery(
    `SELECT text_fingerprint, first_handle, first_seen_at, last_seen_at, seen_count
     FROM provenance_text_seen
     WHERE seen_count >= 2
     ORDER BY seen_count DESC
     LIMIT 50`,
  );

  const clusters: CopypastaCluster[] = [];
  for (const r of corpusRows) {
    const textFingerprint = String(r.text_fingerprint);
    const { rows: provRows } = await dbQuery(
      dayLimit <= 0
        ? `SELECT DISTINCT handle FROM post_provenance_daily
           WHERE copypasta_score >= 0.45`
        : `SELECT DISTINCT handle FROM post_provenance_daily
           WHERE copypasta_score >= 0.45
           AND day_key IN (
             SELECT DISTINCT day_key FROM post_provenance_daily ORDER BY day_key DESC LIMIT ?
           )`,
      dayLimit <= 0 ? [] : [dayLimit],
    );
    const handles = provRows.map((p) => String(p.handle).toLowerCase()).filter(Boolean);
    const uniqueHandles = [...new Set(handles)];

    clusters.push({
      textFingerprint,
      firstHandle: String(r.first_handle),
      firstSeenAt: Number(r.first_seen_at),
      lastSeenAt: Number(r.last_seen_at),
      appearances: Number(r.seen_count) || 1,
      authorCount: uniqueHandles.length || 1,
      relatedHandles: uniqueHandles.slice(0, 10),
    });
  }

  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const staleRecycled = clusters.filter(
    (c) => c.appearances >= 3 && c.lastSeenAt < thirtyDaysAgo,
  );

  return { clusters, staleRecycled };
}
