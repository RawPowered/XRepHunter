import { dbQuery, dbRun } from '../bridge';
import { localDayKey } from '../../browse/stats';

export interface UserActionsSnapshot {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}

export interface UserActionsDayRow extends UserActionsSnapshot {
  dayKey: string;
}

export const emptyUserActions = (): UserActionsSnapshot => ({
  likes: 0,
  reposts: 0,
  replies: 0,
  quotes: 0,
});

function mapRow(r: Record<string, unknown>): UserActionsSnapshot {
  return {
    likes: Number(r.likes) || 0,
    reposts: Number(r.reposts) || 0,
    replies: Number(r.replies) || 0,
    quotes: Number(r.quotes) || 0,
  };
}

const COL: Record<'like' | 'repost' | 'reply' | 'quote', keyof UserActionsSnapshot> = {
  like: 'likes',
  repost: 'reposts',
  reply: 'replies',
  quote: 'quotes',
};

export async function recordUserActionDaily(kind: 'like' | 'repost' | 'reply' | 'quote'): Promise<void> {
  const dayKey = localDayKey();
  const col = COL[kind];
  await dbRun(
    `INSERT INTO user_actions_daily (day_key, ${col}) VALUES (?, 1)
     ON CONFLICT(day_key) DO UPDATE SET ${col} = ${col} + 1`,
    [dayKey],
  );
}

export async function getUserActionsToday(): Promise<UserActionsSnapshot> {
  const dayKey = localDayKey();
  const { rows } = await dbQuery('SELECT * FROM user_actions_daily WHERE day_key = ?', [dayKey]);
  if (!rows.length) return emptyUserActions();
  return mapRow(rows[0]);
}

export async function getUserActionsRange(days: number): Promise<UserActionsDayRow[]> {
  const limit = Math.max(1, Math.min(days, 90));
  const { rows } = await dbQuery(
    `SELECT * FROM user_actions_daily ORDER BY day_key DESC LIMIT ?`,
    [limit],
  );
  return rows
    .map((r) => ({
      dayKey: String(r.day_key),
      ...mapRow(r),
    }))
    .reverse();
}
