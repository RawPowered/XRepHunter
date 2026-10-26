import { dbQuery, dbRun } from '../bridge';
import { localDayKey } from '../../browse/stats';

export interface BrowseTopicsSnapshot {
  totalPosts: number;
  byTopic: Record<string, number>;
}

export interface BrowseTopicsDayRow {
  dayKey: string;
  byTopic: Record<string, number>;
  totalPosts: number;
}

async function bumpTopic(dayKey: string, topic: string, delta: number): Promise<void> {
  if (delta === 0) return;
  if (delta > 0) {
    await dbRun(
      `INSERT INTO browse_topics_daily (day_key, topic, posts_seen) VALUES (?, ?, ?)
       ON CONFLICT(day_key, topic) DO UPDATE SET posts_seen = posts_seen + excluded.posts_seen`,
      [dayKey, topic, delta],
    );
  } else {
    await dbRun(
      `UPDATE browse_topics_daily SET posts_seen = MAX(0, posts_seen + ?) WHERE day_key = ? AND topic = ?`,
      [delta, dayKey, topic],
    );
  }
}

export async function recordBrowseTopicsDaily(
  postFingerprint: string,
  labels: string[],
): Promise<boolean> {
  const dayKey = localDayKey();
  const normalized = [...new Set(labels.map((l) => l.toLowerCase()).filter(Boolean))].sort();
  const newJson = JSON.stringify(normalized);

  const { rows } = await dbQuery(
    'SELECT topics_json FROM browse_topics_posts_seen WHERE day_key = ? AND post_fingerprint = ?',
    [dayKey, postFingerprint],
  );

  if (rows.length) {
    const oldJson = String(rows[0].topics_json ?? '[]');
    if (oldJson === newJson) return false;
    let oldLabels: string[] = [];
    try {
      oldLabels = JSON.parse(oldJson) as string[];
    } catch {
      oldLabels = [];
    }
    for (const t of oldLabels) await bumpTopic(dayKey, t, -1);
    await dbRun(
      'UPDATE browse_topics_posts_seen SET topics_json = ? WHERE day_key = ? AND post_fingerprint = ?',
      [newJson, dayKey, postFingerprint],
    );
  } else {
    await dbRun(
      'INSERT INTO browse_topics_posts_seen (day_key, post_fingerprint, topics_json) VALUES (?, ?, ?)',
      [dayKey, postFingerprint, newJson],
    );
  }

  for (const t of normalized) await bumpTopic(dayKey, t, 1);
  return true;
}

export async function getBrowseTopicsToday(): Promise<BrowseTopicsSnapshot> {
  const dayKey = localDayKey();
  const { rows: postRows } = await dbQuery(
    'SELECT COUNT(*) AS c FROM browse_topics_posts_seen WHERE day_key = ?',
    [dayKey],
  );
  const totalPosts = Number(postRows[0]?.c) || 0;
  const { rows } = await dbQuery(
    'SELECT topic, posts_seen FROM browse_topics_daily WHERE day_key = ?',
    [dayKey],
  );
  const byTopic: Record<string, number> = {};
  for (const r of rows) {
    byTopic[String(r.topic)] = Number(r.posts_seen) || 0;
  }
  return { totalPosts, byTopic };
}

export async function getBrowseTopicsRange(days: number): Promise<BrowseTopicsDayRow[]> {
  const limit = Math.max(1, Math.min(days, 90));
  const { rows: dayRows } = await dbQuery(
    `SELECT DISTINCT day_key FROM browse_topics_daily ORDER BY day_key DESC LIMIT ?`,
    [limit],
  );
  const dayKeys = dayRows.map((r) => String(r.day_key)).reverse();
  if (!dayKeys.length) return [];

  const { rows } = await dbQuery(
    `SELECT day_key, topic, posts_seen FROM browse_topics_daily WHERE day_key IN (${dayKeys.map(() => '?').join(',')}) ORDER BY day_key ASC`,
    dayKeys,
  );
  const byDay = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const dayKey = String(r.day_key);
    const topic = String(r.topic);
    const n = Number(r.posts_seen) || 0;
    if (!byDay.has(dayKey)) byDay.set(dayKey, {});
    byDay.get(dayKey)![topic] = n;
  }
  return dayKeys.map((dayKey) => {
    const byTopic = byDay.get(dayKey) ?? {};
    return {
      dayKey,
      byTopic,
      totalPosts: Object.values(byTopic).reduce((a, b) => a + b, 0),
    };
  });
}
