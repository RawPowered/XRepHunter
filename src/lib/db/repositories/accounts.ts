import { dbQuery, dbRun } from '../bridge';
import type { ReputationResult } from '../../types';
import { normalizeReputationResult } from '../../scoring/normalize-result';
import { scoreToBand } from '../../scoring/reputation';

export interface AccountRow {
  handle: string;
  display_name: string | null;
  current_score: number;
  band: string;
  spam_risk: number;
  general_risk: number;
  note_rate: number;
  avg_post_spam: number;
  max_post_spam: number;
  avg_post_slop: number;
  max_post_slop: number;
  avg_post_toxicity: number;
  max_post_toxicity: number;
  posts_analyzed: number;
  posts_with_note: number;
  last_scanned_at: number;
}

export interface AccountPostRollups {
  postsAnalyzed: number;
  postsWithNote: number;
  noteRate: number;
  avgPostSpam: number;
  maxPostSpam: number;
  avgPostSlop: number;
  maxPostSlop: number;
  avgPostToxicity: number;
  maxPostToxicity: number;
}

export type LeaderboardKind = 'riskiest' | 'safest' | 'most_notes' | 'most_analyzed';

function rowToRollups(row: AccountRow | undefined): AccountPostRollups | null {
  if (!row || row.posts_analyzed <= 0) return null;
  return {
    postsAnalyzed: row.posts_analyzed,
    postsWithNote: row.posts_with_note,
    noteRate: row.note_rate,
    avgPostSpam: row.avg_post_spam,
    maxPostSpam: row.max_post_spam,
    avgPostSlop: row.avg_post_slop,
    maxPostSlop: row.max_post_slop,
    avgPostToxicity: row.avg_post_toxicity,
    maxPostToxicity: row.max_post_toxicity,
  };
}

function mapRow(r: Record<string, unknown>): AccountRow {
  return {
    handle: String(r.handle),
    display_name: r.display_name != null ? String(r.display_name) : null,
    current_score: Number(r.current_score),
    band: String(r.band),
    spam_risk: Number(r.spam_risk),
    general_risk: Number(r.general_risk),
    note_rate: Number(r.note_rate),
    avg_post_spam: Number(r.avg_post_spam),
    max_post_spam: Number(r.max_post_spam),
    avg_post_slop: Number(r.avg_post_slop),
    max_post_slop: Number(r.max_post_slop),
    avg_post_toxicity: Number(r.avg_post_toxicity),
    max_post_toxicity: Number(r.max_post_toxicity),
    posts_analyzed: Number(r.posts_analyzed),
    posts_with_note: Number(r.posts_with_note),
    last_scanned_at: Number(r.last_scanned_at),
  };
}

export async function getAccountRow(handle: string): Promise<AccountRow | null> {
  const { rows } = await dbQuery('SELECT * FROM accounts WHERE handle = ?', [handle.toLowerCase()]);
  if (!rows.length) return null;
  return mapRow(rows[0]);
}

export async function getAccountRollups(handle: string): Promise<AccountPostRollups | null> {
  const row = await getAccountRow(handle);
  return rowToRollups(row ?? undefined);
}

export async function upsertAccountFromScan(
  result: ReputationResult,
  rollups: AccountPostRollups | null,
): Promise<void> {
  const normalized = normalizeReputationResult(result);
  const h = normalized.handle.toLowerCase();
  const existing = await getAccountRow(h);
  const r = rollups ?? rowToRollups(existing ?? undefined);
  await dbRun(
    `INSERT INTO accounts (
      handle, display_name, current_score, band, spam_risk, general_risk,
      note_rate, avg_post_spam, max_post_spam, avg_post_slop, max_post_slop,
      avg_post_toxicity, max_post_toxicity, posts_analyzed, posts_with_note, last_scanned_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(handle) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, accounts.display_name),
      current_score = excluded.current_score,
      band = excluded.band,
      spam_risk = excluded.spam_risk,
      general_risk = excluded.general_risk,
      note_rate = excluded.note_rate,
      avg_post_spam = excluded.avg_post_spam,
      max_post_spam = excluded.max_post_spam,
      avg_post_slop = excluded.avg_post_slop,
      max_post_slop = excluded.max_post_slop,
      avg_post_toxicity = excluded.avg_post_toxicity,
      max_post_toxicity = excluded.max_post_toxicity,
      posts_analyzed = excluded.posts_analyzed,
      posts_with_note = excluded.posts_with_note,
      last_scanned_at = excluded.last_scanned_at`,
    [
      h,
      normalized.profile?.displayName ?? null,
      normalized.score,
      normalized.band,
      normalized.breakdown.spamRisk,
      normalized.breakdown.generalRisk,
      r?.noteRate ?? 0,
      r?.avgPostSpam ?? 0,
      r?.maxPostSpam ?? 0,
      r?.avgPostSlop ?? 0,
      r?.maxPostSlop ?? 0,
      r?.avgPostToxicity ?? 0,
      r?.maxPostToxicity ?? 0,
      r?.postsAnalyzed ?? 0,
      r?.postsWithNote ?? 0,
      normalized.scannedAt,
    ],
  );
}

export async function saveReputationSnapshot(result: ReputationResult): Promise<void> {
  const normalized = normalizeReputationResult(result);
  await dbRun(
    `INSERT INTO reputation_snapshots (handle, score, breakdown_json, hits_json, scanned_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      normalized.handle.toLowerCase(),
      normalized.score,
      JSON.stringify(normalized.breakdown),
      JSON.stringify(normalized.hits),
      normalized.scannedAt,
    ],
  );
}

export async function getLatestSnapshot(handle: string): Promise<{
  breakdown: ReputationResult['breakdown'];
  hits: ReputationResult['hits'];
  scannedAt: number;
  score: number;
} | null> {
  const { rows } = await dbQuery(
    `SELECT score, breakdown_json, hits_json, scanned_at FROM reputation_snapshots
     WHERE handle = ? ORDER BY scanned_at DESC LIMIT 1`,
    [handle.toLowerCase()],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    score: Number(row.score),
    breakdown: JSON.parse(String(row.breakdown_json)) as ReputationResult['breakdown'],
    hits: JSON.parse(String(row.hits_json)) as ReputationResult['hits'],
    scannedAt: Number(row.scanned_at),
  };
}

export async function getCachedReputationFromDb(
  handle: string,
  ttlMs: number,
): Promise<ReputationResult | null> {
  const account = await getAccountRow(handle);
  if (!account || !account.last_scanned_at) return null;
  if (Date.now() - account.last_scanned_at > ttlMs) return null;
  const snap = await getLatestSnapshot(handle);
  if (!snap) return null;
  return normalizeReputationResult({
    handle: handle.toLowerCase(),
    score: account.current_score,
    band: account.band as ReputationResult['band'],
    hits: snap.hits,
    scannedAt: account.last_scanned_at,
    breakdown: snap.breakdown,
    isTrusted: false,
  });
}

export async function queryLeaderboard(
  kind: LeaderboardKind,
  limit = 50,
  minPosts = 0,
): Promise<AccountRow[]> {
  const where = minPosts > 0 ? `WHERE posts_analyzed >= ${minPosts}` : '';
  let order = 'current_score ASC';
  if (kind === 'safest') order = 'current_score DESC';
  if (kind === 'most_notes') order = 'note_rate DESC, posts_with_note DESC';
  if (kind === 'most_analyzed') order = 'posts_analyzed DESC';
  const { rows } = await dbQuery(
    `SELECT * FROM accounts ${where} ORDER BY ${order} LIMIT ?`,
    [limit],
  );
  return rows.map(mapRow);
}

export { rowToRollups };
