import { dbQuery, dbRun } from '../bridge';
import { localDayKey, snapshotFromCounts, type BrowseDayRow, type BrowseStatsSnapshot } from '../../browse/stats';

function mapDailyRow(r: Record<string, unknown>): BrowseStatsSnapshot {
  const slopSum = Number(r.slop_sum) || 0;
  const slopCount = Number(r.slop_count) || 0;
  const toxicitySum = Number(r.toxicity_sum) || 0;
  const toxicityCount = Number(r.toxicity_count) || 0;
  return snapshotFromCounts(
    Number(r.posts_seen) || 0,
    Number(r.spam_flagged) || 0,
    Number(r.slop_flagged) || 0,
    slopSum,
    slopCount,
    Number(r.ads_seen) || 0,
    Number(r.toxicity_flagged) || 0,
    toxicitySum,
    toxicityCount,
  );
}

export async function recordBrowsePostDaily(
  postFingerprint: string,
  opts: {
    flaggedSpam: boolean;
    flaggedSlop: boolean;
    slopScore?: number;
    flaggedAd?: boolean;
    flaggedToxicity?: boolean;
    toxicityScore?: number;
  },
): Promise<boolean> {
  const dayKey = localDayKey();
  const { rows } = await dbQuery(
    'SELECT 1 FROM browse_posts_seen WHERE day_key = ? AND post_fingerprint = ?',
    [dayKey, postFingerprint],
  );
  if (rows.length) return false;

  await dbRun(
    'INSERT OR IGNORE INTO browse_posts_seen (day_key, post_fingerprint) VALUES (?, ?)',
    [dayKey, postFingerprint],
  );

  const slopInc = opts.slopScore != null && opts.slopScore > 0 ? 1 : 0;
  const slopAdd = slopInc ? opts.slopScore! : 0;
  const toxInc = opts.toxicityScore != null && opts.toxicityScore > 0 ? 1 : 0;
  const toxAdd = toxInc ? opts.toxicityScore! : 0;

  await dbRun(
    `INSERT INTO browse_daily (
       day_key, posts_seen, spam_flagged, slop_flagged, slop_sum, slop_count,
       ads_seen, toxicity_flagged, toxicity_sum, toxicity_count
     )
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day_key) DO UPDATE SET
       posts_seen = posts_seen + 1,
       spam_flagged = spam_flagged + excluded.spam_flagged,
       slop_flagged = slop_flagged + excluded.slop_flagged,
       slop_sum = slop_sum + excluded.slop_sum,
       slop_count = slop_count + excluded.slop_count,
       ads_seen = ads_seen + excluded.ads_seen,
       toxicity_flagged = toxicity_flagged + excluded.toxicity_flagged,
       toxicity_sum = toxicity_sum + excluded.toxicity_sum,
       toxicity_count = toxicity_count + excluded.toxicity_count`,
    [
      dayKey,
      opts.flaggedSpam ? 1 : 0,
      opts.flaggedSlop ? 1 : 0,
      slopAdd,
      slopInc,
      opts.flaggedAd ? 1 : 0,
      opts.flaggedToxicity ? 1 : 0,
      toxAdd,
      toxInc,
    ],
  );
  return true;
}

export async function getBrowseStatsToday(): Promise<BrowseStatsSnapshot> {
  const dayKey = localDayKey();
  const { rows } = await dbQuery('SELECT * FROM browse_daily WHERE day_key = ?', [dayKey]);
  if (!rows.length) return snapshotFromCounts(0, 0, 0, 0, 0, 0, 0, 0, 0);
  return mapDailyRow(rows[0]);
}

export async function getBrowseStatsRange(days: number): Promise<BrowseDayRow[]> {
  const limit = Math.max(1, Math.min(days, 90));
  const { rows } = await dbQuery(
    `SELECT * FROM browse_daily ORDER BY day_key DESC LIMIT ?`,
    [limit],
  );
  return rows
    .map((r) => ({
      dayKey: String(r.day_key),
      ...mapDailyRow(r),
    }))
    .reverse();
}
