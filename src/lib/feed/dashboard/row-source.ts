import type { PostAttentionRow } from '../../attention/aggregate';
import type { ProvenanceEvidence } from '../../provenance/types';
import { dbQuery } from '../../db/bridge';
import { clampDayLimit, type DashboardFilters, type DashboardRow, resolveDayLimit } from './filters';
import { deriveProvenanceDisplayCategory } from './provenance-display';

function mapJoinedRow(r: Record<string, unknown>): DashboardRow {
  let topics: string[] | undefined;
  const rawTopics = r.topics_json;
  if (rawTopics) {
    try {
      topics = JSON.parse(String(rawTopics)) as string[];
    } catch {
      topics = undefined;
    }
  }
  let evidence: ProvenanceEvidence[] | undefined;
  if (r.evidence_json) {
    try {
      evidence = JSON.parse(String(r.evidence_json)) as ProvenanceEvidence[];
    } catch {
      evidence = undefined;
    }
  }
  const row: DashboardRow = {
    dayKey: String(r.day_key),
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
    surface: r.surface != null ? String(r.surface) : undefined,
    mediaType: r.media_type != null ? String(r.media_type) : undefined,
    cardDomain: r.card_domain != null ? String(r.card_domain) : undefined,
    isPromoted: Number(r.is_promoted) === 1,
    likelihoodCategory: r.likelihood_category != null ? String(r.likelihood_category) : undefined,
    sponsorshipScore: r.sponsorship_score != null ? Number(r.sponsorship_score) : undefined,
    influencerAdScore: r.influencer_ad_score != null ? Number(r.influencer_ad_score) : undefined,
    copypastaScore: r.copypasta_score != null ? Number(r.copypasta_score) : undefined,
    aiAssistedScore: r.ai_assisted_score != null ? Number(r.ai_assisted_score) : undefined,
    evidence,
  };
  row.displayCategory = deriveProvenanceDisplayCategory({
    likelihoodCategory: row.likelihoodCategory,
    sponsorshipScore: row.sponsorshipScore,
    influencerAdScore: row.influencerAdScore,
    copypastaScore: row.copypastaScore,
    aiAssistedScore: row.aiAssistedScore,
    isPromoted: row.isPromoted,
    slopScore: row.slopScore,
    spamScore: row.spamScore,
    evidence: row.evidence,
  });
  return row;
}

async function fetchDayKeys(dayLimit: number): Promise<string[]> {
  if (dayLimit <= 0) {
    const { rows } = await dbQuery(
      'SELECT DISTINCT day_key FROM post_attention_daily ORDER BY day_key ASC',
    );
    return rows.map((r) => String(r.day_key));
  }
  const { rows } = await dbQuery(
    `SELECT DISTINCT day_key FROM post_attention_daily ORDER BY day_key DESC LIMIT ?`,
    [dayLimit],
  );
  return rows.map((r) => String(r.day_key)).reverse();
}

export async function loadDashboardRows(filters: DashboardFilters): Promise<DashboardRow[]> {
  const dayLimit = clampDayLimit(resolveDayLimit(filters.range));
  const dayKeys = await fetchDayKeys(dayLimit);
  if (!dayKeys.length) return [];

  const placeholders = dayKeys.map(() => '?').join(',');
  const { rows } = await dbQuery(
    `SELECT pad.*,
            ppd.likelihood_category, ppd.sponsorship_score, ppd.influencer_ad_score,
            ppd.copypasta_score, ppd.ai_assisted_score, ppd.evidence_json
     FROM post_attention_daily pad
     LEFT JOIN post_provenance_daily ppd
       ON pad.day_key = ppd.day_key AND pad.post_fingerprint = ppd.post_fingerprint
     WHERE pad.day_key IN (${placeholders})
     ORDER BY pad.day_key ASC`,
    dayKeys,
  );
  return rows.map(mapJoinedRow);
}

export function sessionRowsToDashboardRows(sessionRows: PostAttentionRow[]): DashboardRow[] {
  return sessionRows.map((r) => {
    const row: DashboardRow = { ...r, dayKey: 'session' };
    row.displayCategory = deriveProvenanceDisplayCategory({
      isPromoted: r.isPromoted,
      slopScore: r.slopScore,
      spamScore: r.spamScore,
    });
    return row;
  });
}

export async function loadBrowseDailyRange(filters: DashboardFilters) {
  const dayLimit = clampDayLimit(resolveDayLimit(filters.range));
  const sql =
    dayLimit <= 0
      ? 'SELECT * FROM browse_daily ORDER BY day_key ASC'
      : 'SELECT * FROM browse_daily ORDER BY day_key DESC LIMIT ?';
  const params = dayLimit <= 0 ? [] : [dayLimit];
  const { rows } = await dbQuery(sql, params);
  const mapped = rows.map((r) => ({
    dayKey: String(r.day_key),
    postsSeen: Number(r.posts_seen) || 0,
    spamFlagged: Number(r.spam_flagged) || 0,
    slopFlagged: Number(r.slop_flagged) || 0,
    adsSeen: Number(r.ads_seen) || 0,
    toxicityFlagged: Number(r.toxicity_flagged) || 0,
  }));
  return dayLimit <= 0 ? mapped : mapped.reverse();
}

export async function loadUserActionsRange(filters: DashboardFilters) {
  const dayLimit = clampDayLimit(resolveDayLimit(filters.range));
  const sql =
    dayLimit <= 0
      ? 'SELECT * FROM user_actions_daily ORDER BY day_key ASC'
      : 'SELECT * FROM user_actions_daily ORDER BY day_key DESC LIMIT ?';
  const params = dayLimit <= 0 ? [] : [dayLimit];
  const { rows } = await dbQuery(sql, params);
  const mapped = rows.map((r) => ({
    dayKey: String(r.day_key),
    likes: Number(r.likes) || 0,
    reposts: Number(r.reposts) || 0,
    replies: Number(r.replies) || 0,
    quotes: Number(r.quotes) || 0,
  }));
  return dayLimit <= 0 ? mapped : mapped.reverse();
}
