/**
 * Rules derived from X's open For You feed algorithm (Apache-2.0).
 * @see https://github.com/xai-org/x-algorithm
 */

import type { DetectorId } from '../types';

export type XPipelineStage =
  | 'pre_scoring_filter'
  | 'post_selection_filter'
  | 'scoring_positive'
  | 'scoring_negative'
  | 'grox'
  | 'diversity';

export interface XAlgorithmRule {
  id: string;
  stage: XPipelineStage;
  name: string;
  purpose: string;
  /** Detectors that approximate this rule in XRepHunter */
  detectorIds: DetectorId[];
}

/** Pre-scoring filters from home-mixer candidate pipeline */
export const PRE_SCORING_FILTERS: XAlgorithmRule[] = [
  {
    id: 'DropDuplicatesFilter',
    stage: 'pre_scoring_filter',
    name: 'Drop duplicates',
    purpose: 'Remove duplicate post IDs from the candidate set.',
    detectorIds: ['xRepostDedup'],
  },
  {
    id: 'AgeFilter',
    stage: 'pre_scoring_filter',
    name: 'Age filter',
    purpose: 'Remove posts older than the freshness threshold.',
    detectorIds: ['accountAge', 'xStaleBurst'],
  },
  {
    id: 'RepostDeduplicationFilter',
    stage: 'pre_scoring_filter',
    name: 'Repost deduplication',
    purpose: 'Dedupe reposts of the same underlying content.',
    detectorIds: ['repostBot', 'xRepostDedup'],
  },
  {
    id: 'AuthorSocialgraphFilter',
    stage: 'pre_scoring_filter',
    name: 'Blocked / muted authors',
    purpose: 'Remove posts from authors you blocked or muted.',
    detectorIds: ['userExamples'],
  },
  {
    id: 'MutedKeywordFilter',
    stage: 'pre_scoring_filter',
    name: 'Muted keywords',
    purpose: 'Remove posts matching your muted keyword list.',
    detectorIds: ['cryptoSpam', 'adSpam', 'romanceBait'],
  },
];

/** Post-selection visibility filters */
export const POST_SELECTION_FILTERS: XAlgorithmRule[] = [
  {
    id: 'VFFilter',
    stage: 'post_selection_filter',
    name: 'Visibility filter (VF)',
    purpose: 'Remove deleted, spam, violence, gore, and policy-violating posts.',
    detectorIds: ['xVisibility', 'cryptoSpam', 'adSpam', 'romanceBait', 'thirstTrap', 'aiSlop', 'aiVoice', 'contentToxicity'],
  },
  {
    id: 'DedupConversationFilter',
    stage: 'post_selection_filter',
    name: 'Conversation dedup',
    purpose: 'Deduplicate multiple branches of the same thread.',
    detectorIds: ['xRepostDedup'],
  },
];

/** Phoenix weighted scorer — negative engagement predictions */
export const NEGATIVE_ENGAGEMENT_ACTIONS: XAlgorithmRule[] = [
  {
    id: 'P_not_interested',
    stage: 'scoring_negative',
    name: 'Not interested',
    purpose: 'Model down-weights content you would mark “show less”.',
    detectorIds: ['xNegativeEngagement', 'repostBot'],
  },
  {
    id: 'P_block_author',
    stage: 'scoring_negative',
    name: 'Block author',
    purpose: 'Signals similar to accounts users block.',
    detectorIds: ['xNegativeEngagement', 'handlePattern', 'userExamples'],
  },
  {
    id: 'P_mute_author',
    stage: 'scoring_negative',
    name: 'Mute author',
    purpose: 'Signals similar to accounts users mute.',
    detectorIds: ['xNegativeEngagement', 'romanceBait', 'thirstTrap'],
  },
  {
    id: 'P_report',
    stage: 'scoring_negative',
    name: 'Report',
    purpose: 'Signals correlated with reports (spam, abuse).',
    detectorIds: ['xVisibility', 'xNegativeEngagement', 'userExamples', 'contentToxicity'],
  },
];

/** Positive engagement — profile health targets */
export const POSITIVE_ENGAGEMENT_ACTIONS: XAlgorithmRule[] = [
  {
    id: 'P_favorite',
    stage: 'scoring_positive',
    name: 'Favorite / like',
    purpose: 'Original, relevant posts earn positive weight.',
    detectorIds: [],
  },
  {
    id: 'P_reply',
    stage: 'scoring_positive',
    name: 'Reply',
    purpose: 'Conversation-starting originals are favored.',
    detectorIds: [],
  },
  {
    id: 'P_repost',
    stage: 'scoring_positive',
    name: 'Repost',
    purpose: 'Shared content — excessive repost-only behavior is penalized elsewhere.',
    detectorIds: ['repostBot'],
  },
  {
    id: 'P_follow_author',
    stage: 'scoring_positive',
    name: 'Follow author',
    purpose: 'Trustworthy author signals improve reach.',
    detectorIds: ['xOrganicTrust'],
  },
];

export const DIVERSITY_RULES: XAlgorithmRule[] = [
  {
    id: 'AuthorDiversityScorer',
    stage: 'diversity',
    name: 'Author diversity',
    purpose: 'Attenuate repeated authors so one account cannot dominate the feed.',
    detectorIds: ['xAuthorMonoculture'],
  },
];

/** Grox content-understanding (May 2026 release) */
export const GROX_RULES: XAlgorithmRule[] = [
  {
    id: 'Grox_spam',
    stage: 'grox',
    name: 'Grox spam detection',
    purpose: 'Classifier for spam and low-quality promotion.',
    detectorIds: ['cryptoSpam', 'adSpam', 'handlePattern', 'xVisibility'],
  },
  {
    id: 'Grox_policy',
    stage: 'grox',
    name: 'Grox policy / PTOS',
    purpose: 'Policy and terms-of-service enforcement classifiers.',
    detectorIds: ['xVisibility', 'romanceBait'],
  },
];

export const ALL_X_RULES: XAlgorithmRule[] = [
  ...PRE_SCORING_FILTERS,
  ...POST_SELECTION_FILTERS,
  ...NEGATIVE_ENGAGEMENT_ACTIONS,
  ...POSITIVE_ENGAGEMENT_ACTIONS,
  ...DIVERSITY_RULES,
  ...GROX_RULES,
];

const DETECTOR_TO_RULES = new Map<DetectorId, string[]>();

for (const rule of ALL_X_RULES) {
  for (const det of rule.detectorIds) {
    const list = DETECTOR_TO_RULES.get(det) ?? [];
    if (!list.includes(rule.id)) list.push(rule.id);
    DETECTOR_TO_RULES.set(det, list);
  }
}

export function getXRulesForDetector(detectorId: DetectorId): string[] {
  return DETECTOR_TO_RULES.get(detectorId) ?? [];
}

export function enrichHitWithXRules<T extends { id: DetectorId; label: string; detail?: string }>(
  hit: T,
): T & { xRules?: string[]; xStage?: XPipelineStage } {
  const rules = ALL_X_RULES.filter((r) => r.detectorIds.includes(hit.id));
  if (!rules.length) return hit;
  const xRules = rules.map((r) => r.id);
  const xStage = rules[0]?.stage;
  const ruleNames = rules.map((r) => r.name).join(', ');
  return {
    ...hit,
    xRules,
    xStage,
    detail: hit.detail ? `${hit.detail} · X: ${ruleNames}` : `X: ${ruleNames}`,
  };
}

export const X_ALGORITHM_SOURCE_URL = 'https://github.com/xai-org/x-algorithm';
