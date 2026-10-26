import {
  emptyAttentionSnapshot,
  mergeAttentionDelta,
  rollupAttentionRows,
  type AttentionSnapshot,
  type PostAttentionDelta,
  type PostAttentionRow,
} from '../../lib/attention/aggregate';

const sessionRows = new Map<string, PostAttentionRow>();

function deltaToRow(delta: PostAttentionDelta): PostAttentionRow {
  return {
    ...delta,
    likes: 0,
    reposts: 0,
    replies: 0,
    quotes: 0,
  };
}

export function recordSessionAttention(records: PostAttentionDelta[]): void {
  for (const delta of records) {
    const existing = sessionRows.get(delta.postFingerprint);
    if (existing) {
      sessionRows.set(delta.postFingerprint, {
        ...mergeAttentionDelta(existing, delta),
        likes: existing.likes,
        reposts: existing.reposts,
        replies: existing.replies,
        quotes: existing.quotes,
      });
    } else {
      sessionRows.set(delta.postFingerprint, deltaToRow(delta));
    }
  }
}

export function recordSessionPostAction(
  postFingerprint: string,
  handle: string,
  statusId: string | undefined,
  kind: 'like' | 'repost' | 'reply' | 'quote',
): void {
  let row = sessionRows.get(postFingerprint);
  if (!row) {
    row = {
      postFingerprint,
      handle,
      statusId,
      visibleMs: 0,
      focusedVisibleMs: 0,
      weightedVisibleMs: 0,
      focusedWeightedMs: 0,
      maxVisibleRatio: 0,
      revisitCount: 0,
      pauseCount: 0,
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
    };
    sessionRows.set(postFingerprint, row);
  }
  if (kind === 'like') row.likes++;
  else if (kind === 'repost') row.reposts++;
  else if (kind === 'reply') row.replies++;
  else row.quotes++;
}

export function resetSessionAttention(): void {
  sessionRows.clear();
}

export function getSessionAttention(): AttentionSnapshot {
  return rollupAttentionRows([...sessionRows.values()]);
}

export function getSessionAttentionRows(): PostAttentionRow[] {
  return [...sessionRows.values()];
}

export { emptyAttentionSnapshot };
