import { dbQuery, dbRun } from '../bridge';
import { postFingerprint } from '../fingerprint';
import type { PostSample } from '../../types';

export interface ObservedPostInput {
  handle: string;
  source: 'timeline' | 'profile';
  text: string;
  imageUrl?: string;
  statusId?: string;
  slopScore?: number;
  spamScore?: number;
  toxicityScore?: number;
  hasCommunityNote?: boolean;
  qualityJson?: string;
}

function fingerprintFor(input: ObservedPostInput): string {
  return postFingerprint(input.handle, input.text, input.imageUrl, input.statusId);
}

async function recomputeAccountRollups(handle: string): Promise<void> {
  const h = handle.toLowerCase();
  const { rows } = await dbQuery(
    `SELECT
      COUNT(*) AS posts_analyzed,
      SUM(CASE WHEN has_community_note = 1 THEN 1 ELSE 0 END) AS posts_with_note,
      AVG(COALESCE(spam_score, 0)) AS avg_post_spam,
      MAX(COALESCE(spam_score, 0)) AS max_post_spam,
      AVG(COALESCE(slop_score, 0)) AS avg_post_slop,
      MAX(COALESCE(slop_score, 0)) AS max_post_slop,
      AVG(COALESCE(toxicity_score, 0)) AS avg_post_toxicity,
      MAX(COALESCE(toxicity_score, 0)) AS max_post_toxicity
     FROM posts_observed WHERE handle = ?`,
    [h],
  );
  if (!rows.length) return;
  const r = rows[0];
  const postsAnalyzed = Number(r.posts_analyzed) || 0;
  const postsWithNote = Number(r.posts_with_note) || 0;
  const noteRate = postsAnalyzed > 0 ? postsWithNote / postsAnalyzed : 0;
  await dbRun(
    `INSERT OR IGNORE INTO accounts (
      handle, current_score, band, spam_risk, general_risk, last_scanned_at,
      posts_analyzed, posts_with_note, note_rate,
      avg_post_spam, max_post_spam, avg_post_slop, max_post_slop,
      avg_post_toxicity, max_post_toxicity
    ) VALUES (?, 50, 'caution', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
    [h],
  );
  await dbRun(
    `UPDATE accounts SET
      posts_analyzed = ?,
      posts_with_note = ?,
      note_rate = ?,
      avg_post_spam = ?,
      max_post_spam = ?,
      avg_post_slop = ?,
      max_post_slop = ?,
      avg_post_toxicity = ?,
      max_post_toxicity = ?
     WHERE handle = ?`,
    [
      postsAnalyzed,
      postsWithNote,
      noteRate,
      Number(r.avg_post_spam) || 0,
      Number(r.max_post_spam) || 0,
      Number(r.avg_post_slop) || 0,
      Number(r.max_post_slop) || 0,
      Number(r.avg_post_toxicity) || 0,
      Number(r.max_post_toxicity) || 0,
      h,
    ],
  );
}

/** True when account has post rollups but no full reputation scan yet. */
export async function accountNeedsFullScan(handle: string): Promise<boolean> {
  const { rows } = await dbQuery(
    'SELECT last_scanned_at FROM accounts WHERE handle = ?',
    [handle.toLowerCase()],
  );
  if (!rows.length) return true;
  return Number(rows[0].last_scanned_at) === 0;
}

export async function insertObservedPost(input: ObservedPostInput): Promise<boolean> {
  const fp = fingerprintFor(input);
  const before = await dbQuery(
    'SELECT id FROM posts_observed WHERE handle = ? AND text_fingerprint = ?',
    [input.handle.toLowerCase(), fp],
  );
  if (before.rows.length) return false;

  await dbRun(
    `INSERT OR IGNORE INTO posts_observed (
      handle, observed_at, source, text_fingerprint,
      slop_score, spam_score, toxicity_score, has_community_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.handle.toLowerCase(),
      Date.now(),
      input.source,
      fp,
      input.slopScore ?? null,
      input.spamScore ?? null,
      input.toxicityScore ?? null,
      input.hasCommunityNote ? 1 : 0,
    ],
  );
  await recomputeAccountRollups(input.handle);
  return true;
}

export interface UpsertSignalsResult {
  inserted: boolean;
  updated: boolean;
  scoresImproved: boolean;
}

/** Insert or raise per-post signal columns; always refresh account rollups. */
export async function upsertObservedPostSignals(
  input: ObservedPostInput,
): Promise<UpsertSignalsResult> {
  const fp = fingerprintFor(input);
  const h = input.handle.toLowerCase();
  const { rows: before } = await dbQuery(
    `SELECT slop_score, spam_score, toxicity_score, has_community_note
     FROM posts_observed WHERE handle = ? AND text_fingerprint = ?`,
    [h, fp],
  );
  const existed = before.rows.length > 0;
  const prev = existed
    ? {
        slop: Number(before.rows[0].slop_score) || 0,
        spam: Number(before.rows[0].spam_score) || 0,
        tox: Number(before.rows[0].toxicity_score) || 0,
      }
    : null;

  const slop = input.slopScore ?? null;
  const spam = input.spamScore ?? null;
  const tox = input.toxicityScore ?? null;
  const note = input.hasCommunityNote ? 1 : 0;

  const qualityJson = input.qualityJson ?? null;

  await dbRun(
    `INSERT INTO posts_observed (
      handle, observed_at, source, text_fingerprint,
      slop_score, spam_score, toxicity_score, has_community_note, quality_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(handle, text_fingerprint) DO UPDATE SET
      observed_at = excluded.observed_at,
      source = excluded.source,
      slop_score = MAX(COALESCE(posts_observed.slop_score, 0), COALESCE(excluded.slop_score, 0)),
      spam_score = MAX(COALESCE(posts_observed.spam_score, 0), COALESCE(excluded.spam_score, 0)),
      toxicity_score = MAX(COALESCE(posts_observed.toxicity_score, 0), COALESCE(excluded.toxicity_score, 0)),
      has_community_note = MAX(posts_observed.has_community_note, excluded.has_community_note),
      quality_json = COALESCE(excluded.quality_json, posts_observed.quality_json)`,
    [h, Date.now(), input.source, fp, slop, spam, tox, note, qualityJson],
  );

  const { rows: after } = await dbQuery(
    `SELECT slop_score, spam_score, toxicity_score FROM posts_observed WHERE handle = ? AND text_fingerprint = ?`,
    [h, fp],
  );
  const next = {
    slop: Number(after.rows[0]?.slop_score) || 0,
    spam: Number(after.rows[0]?.spam_score) || 0,
    tox: Number(after.rows[0]?.toxicity_score) || 0,
  };
  const scoresImproved =
    !prev ||
    next.slop > prev.slop ||
    next.spam > prev.spam ||
    next.tox > prev.tox;

  await recomputeAccountRollups(input.handle);
  return {
    inserted: !existed,
    updated: existed,
    scoresImproved,
  };
}

/** Insert or raise slop_score when user marks media as AI. */
export async function upsertObservedPostSlop(input: ObservedPostInput): Promise<void> {
  const fp = fingerprintFor(input);
  const slop = input.slopScore ?? null;
  await dbRun(
    `INSERT INTO posts_observed (
      handle, observed_at, source, text_fingerprint,
      slop_score, spam_score, toxicity_score, has_community_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(handle, text_fingerprint) DO UPDATE SET
      slop_score = MAX(COALESCE(posts_observed.slop_score, 0), COALESCE(excluded.slop_score, 0)),
      observed_at = excluded.observed_at`,
    [
      input.handle.toLowerCase(),
      Date.now(),
      input.source,
      fp,
      slop,
      input.spamScore ?? null,
      input.toxicityScore ?? null,
      input.hasCommunityNote ? 1 : 0,
    ],
  );
  await recomputeAccountRollups(input.handle);
}

export async function batchInsertFromProfilePosts(
  handle: string,
  posts: PostSample[],
): Promise<void> {
  for (const p of posts) {
    await insertObservedPost({
      handle,
      source: 'profile',
      text: p.text,
      imageUrl: p.imageUrl,
      slopScore: p.slopScore,
      spamScore: p.spamScore,
      toxicityScore: p.toxicityScore,
      hasCommunityNote: p.hasCommunityNote,
    });
  }
}
