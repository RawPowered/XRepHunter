import { localDayKey } from '../../browse/stats';
import type { FeedEventInput } from '../../feed/event-kinds';
import { dbQuery, dbRun } from '../bridge';

export interface FeedEventRow {
  id: number;
  eventAt: number;
  dayKey: string;
  eventKind: string;
  postFingerprint?: string;
  handle?: string;
  statusId?: string;
  payload?: Record<string, unknown>;
}

function mapRow(r: Record<string, unknown>): FeedEventRow {
  let payload: Record<string, unknown> | undefined;
  if (r.payload_json) {
    try {
      payload = JSON.parse(String(r.payload_json)) as Record<string, unknown>;
    } catch {
      payload = undefined;
    }
  }
  return {
    id: Number(r.id),
    eventAt: Number(r.event_at),
    dayKey: String(r.day_key),
    eventKind: String(r.event_kind),
    postFingerprint: r.post_fingerprint != null ? String(r.post_fingerprint) : undefined,
    handle: r.handle != null ? String(r.handle) : undefined,
    statusId: r.status_id != null ? String(r.status_id) : undefined,
    payload,
  };
}

export async function appendFeedEvent(input: FeedEventInput): Promise<void> {
  const eventAt = input.eventAt ?? Date.now();
  const dayKey = localDayKey(new Date(eventAt));
  await dbRun(
    `INSERT INTO feed_events (event_at, day_key, event_kind, post_fingerprint, handle, status_id, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      eventAt,
      dayKey,
      input.eventKind,
      input.postFingerprint ?? null,
      input.handle ?? null,
      input.statusId ?? null,
      input.payload ? JSON.stringify(input.payload) : null,
    ],
  );
}

export async function appendFeedEventBatch(events: FeedEventInput[]): Promise<void> {
  for (const e of events) await appendFeedEvent(e);
}

export async function queryFeedEventsByDay(dayKey: string, limit = 500): Promise<FeedEventRow[]> {
  const { rows } = await dbQuery(
    `SELECT * FROM feed_events WHERE day_key = ? ORDER BY event_at DESC LIMIT ?`,
    [dayKey, limit],
  );
  return rows.map(mapRow);
}

export async function queryFeedEventsRange(days: number): Promise<FeedEventRow[]> {
  const limit = Math.max(1, Math.min(days, 90));
  const { rows: dayRows } = await dbQuery(
    `SELECT DISTINCT day_key FROM feed_events ORDER BY day_key DESC LIMIT ?`,
    [limit],
  );
  const dayKeys = dayRows.map((r) => String(r.day_key));
  if (!dayKeys.length) return [];
  const { rows } = await dbQuery(
    `SELECT * FROM feed_events WHERE day_key IN (${dayKeys.map(() => '?').join(',')}) ORDER BY event_at ASC`,
    dayKeys,
  );
  return rows.map(mapRow);
}

export interface HandleReachRollup {
  handle: string;
  eventCount: number;
  exposures: number;
  actions: number;
}

export async function rollupFeedEventsByHandle(days: number, limit = 50): Promise<HandleReachRollup[]> {
  const limitDays = Math.max(1, Math.min(days, 90));
  const { rows } = await dbQuery(
    `SELECT handle, event_kind, COUNT(*) AS c
     FROM feed_events
     WHERE day_key IN (
       SELECT DISTINCT day_key FROM feed_events ORDER BY day_key DESC LIMIT ?
     )
     AND handle IS NOT NULL AND handle != ''
     GROUP BY handle, event_kind`,
    [limitDays],
  );
  const byHandle = new Map<string, HandleReachRollup>();
  for (const r of rows) {
    const handle = String(r.handle).toLowerCase();
    const kind = String(r.event_kind);
    const c = Number(r.c) || 0;
    if (!byHandle.has(handle)) {
      byHandle.set(handle, { handle, eventCount: 0, exposures: 0, actions: 0 });
    }
    const entry = byHandle.get(handle)!;
    entry.eventCount += c;
    if (kind === 'post_exposure') entry.exposures += c;
    if (kind === 'like' || kind === 'repost' || kind === 'reply' || kind === 'quote') {
      entry.actions += c;
    }
  }
  return [...byHandle.values()].sort((a, b) => b.eventCount - a.eventCount).slice(0, limit);
}
