import { localDayKey } from '../../browse/stats';
import { classifyAccountKind } from '../../provenance/account-kind';
import type { CopypastaCorpusEntry } from '../../provenance/copypasta';
import type {
  AccountKind,
  LikelihoodCategory,
  ProvenanceAssessment,
  ProvenanceEvidence,
} from '../../provenance/types';
import { dbQuery, dbRun } from '../bridge';

export interface ProvenanceRow {
  postFingerprint: string;
  handle: string;
  statusId?: string;
  likelihoodCategory: LikelihoodCategory;
  sponsorshipScore: number;
  influencerAdScore: number;
  copypastaScore: number;
  aiAssistedScore: number;
  evidence: ProvenanceEvidence[];
}

export interface AccountReachRow {
  handle: string;
  postsExposed: number;
  postsWithFocus: number;
  focusedWeightedMs: number;
  sponsoredExposure: number;
  aiAssistedExposure: number;
  copypastaExposure: number;
  actions: number;
  accountKind?: AccountKind;
}

function mapProvenanceRow(r: Record<string, unknown>): ProvenanceRow {
  let evidence: ProvenanceEvidence[] = [];
  try {
    evidence = JSON.parse(String(r.evidence_json ?? '[]')) as ProvenanceEvidence[];
  } catch {
    evidence = [];
  }
  return {
    postFingerprint: String(r.post_fingerprint),
    handle: String(r.handle ?? ''),
    statusId: r.status_id != null ? String(r.status_id) : undefined,
    likelihoodCategory: String(r.likelihood_category) as LikelihoodCategory,
    sponsorshipScore: Number(r.sponsorship_score) || 0,
    influencerAdScore: Number(r.influencer_ad_score) || 0,
    copypastaScore: Number(r.copypasta_score) || 0,
    aiAssistedScore: Number(r.ai_assisted_score) || 0,
    evidence,
  };
}

export async function loadCopypastaCorpus(): Promise<CopypastaCorpusEntry[]> {
  const { rows } = await dbQuery(
    'SELECT text_fingerprint, first_handle, seen_count FROM provenance_text_seen ORDER BY seen_count DESC LIMIT 500',
  );
  return rows.map((r) => ({
    textFingerprint: String(r.text_fingerprint),
    firstHandle: String(r.first_handle),
    seenCount: Number(r.seen_count) || 1,
  }));
}

export async function recordProvenanceAssessment(assessment: ProvenanceAssessment): Promise<void> {
  const dayKey = localDayKey();
  const now = Date.now();
  await dbRun(
    `INSERT INTO post_provenance_daily (
       day_key, post_fingerprint, handle, status_id, likelihood_category,
       sponsorship_score, influencer_ad_score, copypasta_score, ai_assisted_score, evidence_json
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day_key, post_fingerprint) DO UPDATE SET
       handle = CASE WHEN excluded.handle != '' THEN excluded.handle ELSE handle END,
       status_id = COALESCE(excluded.status_id, status_id),
       likelihood_category = excluded.likelihood_category,
       sponsorship_score = MAX(sponsorship_score, excluded.sponsorship_score),
       influencer_ad_score = MAX(influencer_ad_score, excluded.influencer_ad_score),
       copypasta_score = MAX(copypasta_score, excluded.copypasta_score),
       ai_assisted_score = MAX(ai_assisted_score, excluded.ai_assisted_score),
       evidence_json = excluded.evidence_json`,
    [
      dayKey,
      assessment.postFingerprint,
      assessment.handle,
      assessment.statusId ?? null,
      assessment.likelihoodCategory,
      assessment.sponsorshipScore,
      assessment.influencerAdScore,
      assessment.copypastaScore,
      assessment.aiAssistedScore,
      JSON.stringify(assessment.evidence),
    ],
  );

  const { rows } = await dbQuery(
    'SELECT first_handle, seen_count FROM provenance_text_seen WHERE text_fingerprint = ?',
    [assessment.textFingerprint],
  );
  if (rows.length) {
    await dbRun(
      `UPDATE provenance_text_seen SET seen_count = seen_count + 1, last_seen_at = ? WHERE text_fingerprint = ?`,
      [now, assessment.textFingerprint],
    );
  } else if (assessment.textFingerprint.length >= 24) {
    await dbRun(
      `INSERT INTO provenance_text_seen (text_fingerprint, first_handle, first_seen_at, seen_count, last_seen_at)
       VALUES (?, ?, ?, 1, ?)`,
      [assessment.textFingerprint, assessment.handle.toLowerCase(), now, now],
    );
  }

  await bumpAccountReachProvenance(dayKey, assessment);
}

async function bumpAccountReachProvenance(
  dayKey: string,
  assessment: ProvenanceAssessment,
): Promise<void> {
  const handle = assessment.handle.toLowerCase();
  const sponsoredInc =
    assessment.likelihoodCategory === 'likely_sponsored' || assessment.sponsorshipScore >= 0.5
      ? 1
      : 0;
  const aiInc =
    assessment.likelihoodCategory === 'likely_ai_assisted' || assessment.aiAssistedScore >= 0.55
      ? 1
      : 0;
  const copyInc =
    assessment.likelihoodCategory === 'likely_recycled' || assessment.copypastaScore >= 0.5 ? 1 : 0;

  await dbRun(
    `INSERT INTO account_reach_daily (
       day_key, handle, posts_exposed, sponsored_exposure, ai_assisted_exposure, copypasta_exposure
     )
     VALUES (?, ?, 1, ?, ?, ?)
     ON CONFLICT(day_key, handle) DO UPDATE SET
       posts_exposed = posts_exposed + 1,
       sponsored_exposure = sponsored_exposure + excluded.sponsored_exposure,
       ai_assisted_exposure = ai_assisted_exposure + excluded.ai_assisted_exposure,
       copypasta_exposure = copypasta_exposure + excluded.copypasta_exposure`,
    [dayKey, handle, sponsoredInc, aiInc, copyInc],
  );
}

export async function bumpAccountReachFocus(
  handle: string,
  focusedWeightedMs: number,
  hasFocus: boolean,
): Promise<void> {
  const dayKey = localDayKey();
  const h = handle.toLowerCase();
  await dbRun(
    `INSERT INTO account_reach_daily (day_key, handle, posts_with_focus, focused_weighted_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day_key, handle) DO UPDATE SET
       posts_with_focus = posts_with_focus + excluded.posts_with_focus,
       focused_weighted_ms = focused_weighted_ms + excluded.focused_weighted_ms`,
    [dayKey, h, hasFocus ? 1 : 0, focusedWeightedMs],
  );
}

export async function bumpAccountReachAction(handle: string): Promise<void> {
  const dayKey = localDayKey();
  await dbRun(
    `INSERT INTO account_reach_daily (day_key, handle, actions) VALUES (?, ?, 1)
     ON CONFLICT(day_key, handle) DO UPDATE SET actions = actions + 1`,
    [dayKey, handle.toLowerCase()],
  );
}

async function getProvenanceRowsForDays(days: number): Promise<ProvenanceRow[]> {
  const limitDays = Math.max(1, Math.min(days, 90));
  const { rows } = await dbQuery(
    `SELECT * FROM post_provenance_daily
     WHERE day_key IN (
       SELECT DISTINCT day_key FROM post_provenance_daily ORDER BY day_key DESC LIMIT ?
     )`,
    [limitDays],
  );
  return rows.map(mapProvenanceRow);
}

export async function getProvenanceSummary(days: number): Promise<{
  byCategory: Record<string, number>;
  topEvidence: Array<{ id: string; count: number }>;
}> {
  const rows = await getProvenanceRowsForDays(days);
  const byCategory: Record<string, number> = {};
  const evidenceCounts = new Map<string, number>();
  for (const r of rows) {
    byCategory[r.likelihoodCategory] = (byCategory[r.likelihoodCategory] ?? 0) + 1;
    for (const e of r.evidence) {
      evidenceCounts.set(e.id, (evidenceCounts.get(e.id) ?? 0) + 1);
    }
  }
  const topEvidence = [...evidenceCounts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  return { byCategory, topEvidence };
}

export async function getAccountReachLeaders(days: number, limit = 20): Promise<AccountReachRow[]> {
  const limitDays = Math.max(1, Math.min(days, 90));
  const { rows } = await dbQuery(
    `SELECT handle,
            SUM(posts_exposed) AS posts_exposed,
            SUM(posts_with_focus) AS posts_with_focus,
            SUM(focused_weighted_ms) AS focused_weighted_ms,
            SUM(sponsored_exposure) AS sponsored_exposure,
            SUM(ai_assisted_exposure) AS ai_assisted_exposure,
            SUM(copypasta_exposure) AS copypasta_exposure,
            SUM(actions) AS actions
     FROM account_reach_daily
     WHERE day_key IN (
       SELECT DISTINCT day_key FROM account_reach_daily ORDER BY day_key DESC LIMIT ?
     )
     GROUP BY handle
     ORDER BY focused_weighted_ms DESC
     LIMIT ?`,
    [limitDays, limit],
  );
  return rows.map((r) => ({
    handle: String(r.handle),
    postsExposed: Number(r.posts_exposed) || 0,
    postsWithFocus: Number(r.posts_with_focus) || 0,
    focusedWeightedMs: Number(r.focused_weighted_ms) || 0,
    sponsoredExposure: Number(r.sponsored_exposure) || 0,
    aiAssistedExposure: Number(r.ai_assisted_exposure) || 0,
    copypastaExposure: Number(r.copypasta_exposure) || 0,
    actions: Number(r.actions) || 0,
  }));
}

export async function recomputeAccountKinds(days: number): Promise<void> {
  const dayKey = localDayKey();
  const { rows: handles } = await dbQuery(
    `SELECT DISTINCT handle FROM account_reach_daily WHERE day_key = ?`,
    [dayKey],
  );
  for (const h of handles) {
    const handle = String(h.handle);
    const { rows } = await dbQuery(
      `SELECT sponsorship_score, influencer_ad_score, copypasta_score, ai_assisted_score
       FROM post_provenance_daily WHERE day_key = ? AND handle = ?`,
      [dayKey, handle],
    );
    let sponsorshipHits = 0;
    let influencerAdHits = 0;
    let copypastaHits = 0;
    let aiAssistedHits = 0;
    for (const r of rows) {
      if (Number(r.sponsorship_score) >= 0.5) sponsorshipHits++;
      if (Number(r.influencer_ad_score) >= 0.5) influencerAdHits++;
      if (Number(r.copypasta_score) >= 0.5) copypastaHits++;
      if (Number(r.ai_assisted_score) >= 0.55) aiAssistedHits++;
    }
    const { rows: reachRow } = await dbQuery(
      'SELECT posts_exposed FROM account_reach_daily WHERE day_key = ? AND handle = ?',
      [dayKey, handle],
    );
    const postsExposed = Number(reachRow[0]?.posts_exposed) || rows.length || 1;
    const { kind } = classifyAccountKind({
      sponsorshipHits,
      influencerAdHits,
      copypastaHits,
      aiAssistedHits,
      postsExposed,
    });
    await dbRun(
      `UPDATE account_reach_daily SET account_kind = ? WHERE day_key = ? AND handle = ?`,
      [kind, dayKey, handle],
    );
  }
}

export async function getSponsoredExposure(days: number): Promise<{
  sponsoredPosts: number;
  totalPosts: number;
  promotedDom: number;
  disclosureText: number;
}> {
  const rows = await getProvenanceRowsForDays(days);
  let sponsoredPosts = 0;
  let promotedDom = 0;
  let disclosureText = 0;
  for (const r of rows) {
    if (r.sponsorshipScore >= 0.5 || r.likelihoodCategory === 'likely_sponsored') {
      sponsoredPosts++;
    }
    if (r.evidence.some((e) => e.id === 'dom_promoted')) promotedDom++;
    if (r.evidence.some((e) => e.id.startsWith('disclosure_'))) disclosureText++;
  }
  return {
    sponsoredPosts,
    totalPosts: rows.length,
    promotedDom,
    disclosureText,
  };
}

export async function getAiOrganicSplit(days: number): Promise<{
  aiAssisted: number;
  likelyOrganic: number;
  uncertain: number;
}> {
  const rows = await getProvenanceRowsForDays(days);
  let aiAssisted = 0;
  let likelyOrganic = 0;
  let uncertain = 0;
  for (const r of rows) {
    if (r.likelihoodCategory === 'likely_ai_assisted' || r.aiAssistedScore >= 0.55) aiAssisted++;
    else if (r.likelihoodCategory === 'likely_organic') likelyOrganic++;
    else uncertain++;
  }
  return { aiAssisted, likelyOrganic, uncertain };
}

export async function getCopypastaLeaders(days: number, limit = 15): Promise<ProvenanceRow[]> {
  const rows = await getProvenanceRowsForDays(days);
  return rows
    .filter((r) => r.copypastaScore >= 0.45 || r.likelihoodCategory === 'likely_recycled')
    .sort((a, b) => b.copypastaScore - a.copypastaScore)
    .slice(0, limit);
}
