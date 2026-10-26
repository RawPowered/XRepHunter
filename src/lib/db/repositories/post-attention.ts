import { localDayKey } from '../../browse/stats';
import {
  rankAuthorsByFocusedMs,
  rankTopicsByFocusedMs,
  rollupAttentionRows,
  rollupAttentionRowsByDay,
  type AttentionDayRow,
  type AttentionLeaderRow,
  type AttentionSnapshot,
  type PostAttentionDelta,
  type PostAttentionRow,
} from '../../attention/aggregate';
import type { FeedSurface, MediaType } from '../../feed/surface-detect';
import { dbQuery, dbRun } from '../bridge';

function mapRow(r: Record<string, unknown>): PostAttentionRow {
  let topics: string[] | undefined;
  const rawTopics = r.topics_json;
  if (rawTopics) {
    try {
      topics = JSON.parse(String(rawTopics)) as string[];
    } catch {
      topics = undefined;
    }
  }
  return {
    postFingerprint: String(r.post_fingerprint),
    handle: String(r.handle ?? ''),
    statusId: r.status_id != null ? String(r.status_id) : undefined,
    visibleMs: Number(r.visible_ms) || 0,
    focusedVisibleMs: Number(r.focused_visible_ms) || 0,
    weightedVisibleMs: Number(r.weighted_visible_ms) || 0,
    focusedWeightedMs: Number(r.focused_weighted_ms) || 0,
    maxVisibleRatio: Number(r.max_visible_ratio) || 0,
    firstSeenAt: r.first_seen_at != null ? Number(r.first_seen_at) : undefined,
    lastSeenAt: r.last_seen_at != null ? Number(r.last_seen_at) : undefined,
    revisitCount: Number(r.revisit_count) || 0,
    pauseCount: Number(r.pause_count) || 0,
    likes: Number(r.likes) || 0,
    reposts: Number(r.reposts) || 0,
    replies: Number(r.replies) || 0,
    quotes: Number(r.quotes) || 0,
    slopScore: r.slop_score != null ? Number(r.slop_score) : undefined,
    spamScore: r.spam_score != null ? Number(r.spam_score) : undefined,
    toxicityScore: r.toxicity_score != null ? Number(r.toxicity_score) : undefined,
    topics,
    surface: r.surface != null ? (String(r.surface) as FeedSurface) : undefined,
    mediaType: r.media_type != null ? (String(r.media_type) as MediaType) : undefined,
    cardDomain: r.card_domain != null ? String(r.card_domain) : undefined,
    isPromoted: Number(r.is_promoted) === 1,
  };
}

const ACTION_COL: Record<'like' | 'repost' | 'reply' | 'quote', string> = {
  like: 'likes',
  repost: 'reposts',
  reply: 'replies',
  quote: 'quotes',
};

async function upsertAttentionDelta(dayKey: string, delta: PostAttentionDelta): Promise<void> {
  const topicsJson = delta.topics?.length ? JSON.stringify(delta.topics) : null;
  await dbRun(
    `INSERT INTO post_attention_daily (
       day_key, post_fingerprint, handle, status_id,
       visible_ms, focused_visible_ms, weighted_visible_ms, focused_weighted_ms,
       max_visible_ratio,
       first_seen_at, last_seen_at, revisit_count, pause_count,
       slop_score, spam_score, toxicity_score, topics_json,
       surface, media_type, card_domain, is_promoted
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day_key, post_fingerprint) DO UPDATE SET
       handle = CASE WHEN excluded.handle != '' THEN excluded.handle ELSE handle END,
       status_id = COALESCE(excluded.status_id, status_id),
       visible_ms = visible_ms + excluded.visible_ms,
       focused_visible_ms = focused_visible_ms + excluded.focused_visible_ms,
       weighted_visible_ms = weighted_visible_ms + excluded.weighted_visible_ms,
       focused_weighted_ms = focused_weighted_ms + excluded.focused_weighted_ms,
       max_visible_ratio = MAX(max_visible_ratio, excluded.max_visible_ratio),
       first_seen_at = MIN(first_seen_at, excluded.first_seen_at),
       last_seen_at = MAX(last_seen_at, excluded.last_seen_at),
       revisit_count = revisit_count + excluded.revisit_count,
       pause_count = pause_count + excluded.pause_count,
       slop_score = COALESCE(excluded.slop_score, slop_score),
       spam_score = COALESCE(excluded.spam_score, spam_score),
       toxicity_score = COALESCE(excluded.toxicity_score, toxicity_score),
       topics_json = COALESCE(excluded.topics_json, topics_json),
       surface = COALESCE(excluded.surface, surface),
       media_type = COALESCE(excluded.media_type, media_type),
       card_domain = COALESCE(excluded.card_domain, card_domain),
       is_promoted = MAX(is_promoted, excluded.is_promoted)`,
    [
      dayKey,
      delta.postFingerprint,
      delta.handle,
      delta.statusId ?? null,
      delta.visibleMs,
      delta.focusedVisibleMs,
      delta.weightedVisibleMs ?? 0,
      delta.focusedWeightedMs ?? 0,
      delta.maxVisibleRatio,
      delta.firstSeenAt ?? null,
      delta.lastSeenAt ?? null,
      delta.revisitCount,
      delta.pauseCount,
      delta.slopScore ?? null,
      delta.spamScore ?? null,
      delta.toxicityScore ?? null,
      topicsJson,
      delta.surface ?? null,
      delta.mediaType ?? null,
      delta.cardDomain ?? null,
      delta.isPromoted ? 1 : 0,
    ],
  );
}

export async function recordPostAttentionBatch(records: PostAttentionDelta[]): Promise<void> {
  if (!records.length) return;
  const dayKey = localDayKey();
  for (const delta of records) {
    await upsertAttentionDelta(dayKey, delta);
  }
}

export async function recordPostActionDaily(
  postFingerprint: string,
  handle: string,
  statusId: string | undefined,
  kind: 'like' | 'repost' | 'reply' | 'quote',
): Promise<void> {
  const dayKey = localDayKey();
  const col = ACTION_COL[kind];
  await dbRun(
    `INSERT INTO post_attention_daily (day_key, post_fingerprint, handle, status_id, ${col})
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(day_key, post_fingerprint) DO UPDATE SET
       handle = CASE WHEN excluded.handle != '' THEN excluded.handle ELSE handle END,
       status_id = COALESCE(excluded.status_id, status_id),
       ${col} = ${col} + 1`,
    [dayKey, postFingerprint, handle, statusId ?? null],
  );
}

export async function getAttentionRowsToday(): Promise<PostAttentionRow[]> {
  const dayKey = localDayKey();
  const { rows } = await dbQuery('SELECT * FROM post_attention_daily WHERE day_key = ?', [dayKey]);
  return rows.map(mapRow);
}

export async function getAttentionToday(): Promise<AttentionSnapshot> {
  return rollupAttentionRows(await getAttentionRowsToday());
}

export async function getAttentionRange(days: number): Promise<AttentionDayRow[]> {
  const limit = Math.max(1, Math.min(days, 90));
  const { rows: dayRows } = await dbQuery(
    `SELECT DISTINCT day_key FROM post_attention_daily ORDER BY day_key DESC LIMIT ?`,
    [limit],
  );
  const dayKeys = dayRows.map((r) => String(r.day_key)).reverse();
  if (!dayKeys.length) return [];

  const { rows } = await dbQuery(
    `SELECT * FROM post_attention_daily WHERE day_key IN (${dayKeys.map(() => '?').join(',')}) ORDER BY day_key ASC`,
    dayKeys,
  );
  const mapped = rows.map((r) => ({
    dayKey: String(r.day_key),
    ...mapRow(r),
  }));
  return rollupAttentionRowsByDay(mapped);
}

export async function getAttentionLeaders(
  days: number,
  limit = 10,
): Promise<{ topAuthors: AttentionLeaderRow[]; topTopics: AttentionLeaderRow[] }> {
  const limitDays = Math.max(1, Math.min(days, 90));
  const { rows } = await dbQuery(
    `SELECT * FROM post_attention_daily
     WHERE day_key IN (
       SELECT DISTINCT day_key FROM post_attention_daily ORDER BY day_key DESC LIMIT ?
     )`,
    [limitDays],
  );
  const allRows = rows.map(mapRow);
  return {
    topAuthors: rankAuthorsByFocusedMs(allRows, limit),
    topTopics: rankTopicsByFocusedMs(allRows, limit),
  };
}

export async function getAttentionRowsForRange(days: number): Promise<PostAttentionRow[]> {
  const limitDays = Math.max(1, Math.min(days, 90));
  const { rows } = await dbQuery(
    `SELECT * FROM post_attention_daily
     WHERE day_key IN (
       SELECT DISTINCT day_key FROM post_attention_daily ORDER BY day_key DESC LIMIT ?
     )`,
    [limitDays],
  );
  return rows.map(mapRow);
}

export async function getAttentionMetricsResponse(days: number): Promise<{
  today: AttentionSnapshot;
  range: AttentionDayRow[];
  topAuthors: AttentionLeaderRow[];
  topTopics: AttentionLeaderRow[];
}> {
  const [today, range, leaders] = await Promise.all([
    getAttentionToday(),
    getAttentionRange(days),
    getAttentionLeaders(days),
  ]);
  return { today, range, ...leaders };
}
