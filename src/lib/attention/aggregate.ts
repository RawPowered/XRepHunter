import type { FeedSurface, MediaType } from '../feed/surface-detect';

export interface PostAttentionDelta {
  postFingerprint: string;
  handle: string;
  statusId?: string;
  visibleMs: number;
  focusedVisibleMs: number;
  weightedVisibleMs?: number;
  focusedWeightedMs?: number;
  maxVisibleRatio: number;
  firstSeenAt?: number;
  lastSeenAt?: number;
  revisitCount: number;
  pauseCount: number;
  slopScore?: number;
  spamScore?: number;
  toxicityScore?: number;
  topics?: string[];
  surface?: FeedSurface;
  mediaType?: MediaType;
  cardDomain?: string;
  isPromoted?: boolean;
}

export interface PostAttentionRow extends PostAttentionDelta {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

export interface AttentionSnapshot {
  postsSeen: number;
  visibleMs: number;
  focusedVisibleMs: number;
  weightedVisibleMs: number;
  focusedWeightedMs: number;
  avgFocusedDwellMs: number | null;
  avgWeightedFocusedDwellMs: number | null;
  revisitCount: number;
  pauseCount: number;
  actions: number;
}

export interface AttentionDayRow extends AttentionSnapshot {
  dayKey: string;
}

export interface AttentionLeaderRow {
  key: string;
  focusedVisibleMs: number;
  focusedWeightedMs: number;
  postsSeen: number;
  avgFocusedDwellMs: number | null;
  actions: number;
}

export const emptyAttentionSnapshot = (): AttentionSnapshot => ({
  postsSeen: 0,
  visibleMs: 0,
  focusedVisibleMs: 0,
  weightedVisibleMs: 0,
  focusedWeightedMs: 0,
  avgFocusedDwellMs: null,
  avgWeightedFocusedDwellMs: null,
  revisitCount: 0,
  pauseCount: 0,
  actions: 0,
});

export function mergeAttentionDelta(
  existing: PostAttentionDelta,
  delta: PostAttentionDelta,
): PostAttentionDelta {
  return {
    postFingerprint: existing.postFingerprint,
    handle: delta.handle || existing.handle,
    statusId: delta.statusId ?? existing.statusId,
    visibleMs: existing.visibleMs + delta.visibleMs,
    focusedVisibleMs: existing.focusedVisibleMs + delta.focusedVisibleMs,
    weightedVisibleMs: (existing.weightedVisibleMs ?? 0) + (delta.weightedVisibleMs ?? 0),
    focusedWeightedMs: (existing.focusedWeightedMs ?? 0) + (delta.focusedWeightedMs ?? 0),
    maxVisibleRatio: Math.max(existing.maxVisibleRatio, delta.maxVisibleRatio),
    firstSeenAt:
      existing.firstSeenAt != null && delta.firstSeenAt != null
        ? Math.min(existing.firstSeenAt, delta.firstSeenAt)
        : (existing.firstSeenAt ?? delta.firstSeenAt),
    lastSeenAt:
      existing.lastSeenAt != null && delta.lastSeenAt != null
        ? Math.max(existing.lastSeenAt, delta.lastSeenAt)
        : (existing.lastSeenAt ?? delta.lastSeenAt),
    revisitCount: existing.revisitCount + delta.revisitCount,
    pauseCount: existing.pauseCount + delta.pauseCount,
    slopScore: delta.slopScore ?? existing.slopScore,
    spamScore: delta.spamScore ?? existing.spamScore,
    toxicityScore: delta.toxicityScore ?? existing.toxicityScore,
    topics: delta.topics ?? existing.topics,
    surface: delta.surface ?? existing.surface,
    mediaType: delta.mediaType ?? existing.mediaType,
    cardDomain: delta.cardDomain ?? existing.cardDomain,
    isPromoted: delta.isPromoted ?? existing.isPromoted,
  };
}

function actionTotal(row: Pick<PostAttentionRow, 'likes' | 'reposts' | 'replies' | 'quotes'>): number {
  return (row.likes ?? 0) + (row.reposts ?? 0) + (row.replies ?? 0) + (row.quotes ?? 0);
}

export function rollupAttentionRows(rows: PostAttentionRow[]): AttentionSnapshot {
  if (!rows.length) return emptyAttentionSnapshot();
  let visibleMs = 0;
  let focusedVisibleMs = 0;
  let weightedVisibleMs = 0;
  let focusedWeightedMs = 0;
  let revisitCount = 0;
  let pauseCount = 0;
  let actions = 0;
  let postsWithFocus = 0;
  for (const r of rows) {
    visibleMs += r.visibleMs;
    focusedVisibleMs += r.focusedVisibleMs;
    weightedVisibleMs += r.weightedVisibleMs ?? 0;
    focusedWeightedMs += r.focusedWeightedMs ?? 0;
    revisitCount += r.revisitCount;
    pauseCount += r.pauseCount;
    actions += actionTotal(r);
    const fw = r.focusedWeightedMs ?? r.focusedVisibleMs;
    if (fw > 0) postsWithFocus++;
  }
  return {
    postsSeen: postsWithFocus,
    visibleMs,
    focusedVisibleMs,
    weightedVisibleMs,
    focusedWeightedMs,
    avgFocusedDwellMs: postsWithFocus > 0 ? Math.round(focusedVisibleMs / postsWithFocus) : null,
    avgWeightedFocusedDwellMs:
      postsWithFocus > 0 ? Math.round(focusedWeightedMs / postsWithFocus) : null,
    revisitCount,
    pauseCount,
    actions,
  };
}

export function rollupAttentionRowsByDay(
  rows: (PostAttentionRow & { dayKey: string })[],
): AttentionDayRow[] {
  const byDay = new Map<string, PostAttentionRow[]>();
  for (const { dayKey, ...row } of rows) {
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(row);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, dayRows]) => ({ dayKey, ...rollupAttentionRows(dayRows) }));
}

export function rankAuthorsByFocusedMs(rows: PostAttentionRow[], limit = 10): AttentionLeaderRow[] {
  const byHandle = new Map<string, PostAttentionRow[]>();
  for (const r of rows) {
    const h = r.handle.toLowerCase();
    if (!h) continue;
    if (!byHandle.has(h)) byHandle.set(h, []);
    byHandle.get(h)!.push(r);
  }
  return [...byHandle.entries()]
    .map(([key, handleRows]) => {
      const snap = rollupAttentionRows(handleRows);
      return {
        key,
        focusedVisibleMs: snap.focusedVisibleMs,
        focusedWeightedMs: snap.focusedWeightedMs,
        postsSeen: snap.postsSeen,
        avgFocusedDwellMs: snap.avgFocusedDwellMs,
        actions: snap.actions,
      };
    })
    .sort((a, b) => b.focusedWeightedMs - a.focusedWeightedMs)
    .slice(0, limit);
}

export function rankTopicsByFocusedMs(rows: PostAttentionRow[], limit = 10): AttentionLeaderRow[] {
  const byTopic = new Map<string, PostAttentionRow[]>();
  for (const r of rows) {
    const topics = r.topics ?? [];
    for (const t of topics) {
      const key = t.toLowerCase();
      if (!key) continue;
      if (!byTopic.has(key)) byTopic.set(key, []);
      byTopic.get(key)!.push(r);
    }
  }
  return [...byTopic.entries()]
    .map(([key, topicRows]) => {
      const snap = rollupAttentionRows(topicRows);
      return {
        key,
        focusedVisibleMs: snap.focusedVisibleMs,
        focusedWeightedMs: snap.focusedWeightedMs,
        postsSeen: snap.postsSeen,
        avgFocusedDwellMs: snap.avgFocusedDwellMs,
        actions: snap.actions,
      };
    })
    .sort((a, b) => b.focusedWeightedMs - a.focusedWeightedMs)
    .slice(0, limit);
}

export function formatDwellMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
}
