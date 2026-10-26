import type { DetectorHit, DetectorId, ExtensionSettings } from '../types';
import type { XPipelineStage } from './rules';
import { ALL_X_RULES } from './rules';

export const SPAM_LIBRARY_BOOST = 1.5;

export const STAGE_MULTIPLIERS: Record<XPipelineStage, number> = {
  post_selection_filter: 1.35,
  grox: 1.3,
  scoring_negative: 1.25,
  pre_scoring_filter: 1.15,
  diversity: 1.1,
  scoring_positive: 1.0,
};

export const RULE_PEAK_MULTIPLIERS: Record<string, number> = {
  P_report: 1.4,
  P_block_author: 1.35,
  VFFilter: 1.3,
  P_mute_author: 1.2,
  Grox_spam: 1.25,
  P_not_interested: 1.15,
  RepostDeduplicationFilter: 1.15,
  MutedKeywordFilter: 1.1,
  AuthorDiversityScorer: 1.1,
};

const SPAM_DETECTOR_IDS = new Set<DetectorId>([
  'userExamples',
  'cryptoSpam',
  'adSpam',
  'romanceBait',
  'thirstTrap',
  'aiSlop',
  'xVisibility',
  'xNegativeEngagement',
  'xRepostDedup',
  'xStaleBurst',
  'contentToxicity',
]);

const SPAM_X_STAGES = new Set<XPipelineStage>([
  'post_selection_filter',
  'grox',
  'scoring_negative',
]);

export function isSpamDetector(id: DetectorId): boolean {
  return SPAM_DETECTOR_IDS.has(id);
}

export function isSpamHit(hit: DetectorHit): boolean {
  if (isSpamDetector(hit.id)) return true;
  if (hit.xStage && SPAM_X_STAGES.has(hit.xStage as XPipelineStage)) return true;
  return false;
}

function getRulePeakMultiplier(hit: DetectorHit): number {
  if (!hit.xRules?.length) return 1;
  let peak = 1;
  for (const ruleId of hit.xRules) {
    const m = RULE_PEAK_MULTIPLIERS[ruleId];
    if (m && m > peak) peak = m;
  }
  return peak;
}

function getStageMultiplier(hit: DetectorHit): number {
  if (!hit.xStage) {
    const rules = ALL_X_RULES.filter((r) => r.detectorIds.includes(hit.id));
    const stage = rules[0]?.stage;
    if (stage) return STAGE_MULTIPLIERS[stage] ?? 1;
    return 1;
  }
  return STAGE_MULTIPLIERS[hit.xStage as XPipelineStage] ?? 1;
}

export function getEffectiveWeight(hit: DetectorHit, settings: ExtensionSettings): number {
  const base = settings.detectors[hit.id]?.weight ?? 1;
  let effective = base;

  if (hit.id === 'userExamples') {
    effective *= SPAM_LIBRARY_BOOST;
  }

  if (settings.xAlgorithmAlignment !== false) {
    effective *= getStageMultiplier(hit);
    effective *= getRulePeakMultiplier(hit);
  }

  return effective;
}

export function getWeightedContribution(hit: DetectorHit, settings: ExtensionSettings): number {
  return hit.risk * getEffectiveWeight(hit, settings);
}

export function bucketRisk(hits: DetectorHit[], settings: ExtensionSettings): number {
  if (!hits.length) return 0;
  let sum = 0;
  let weightSum = 0;
  for (const h of hits) {
    const w = getEffectiveWeight(h, settings);
    sum += h.risk * w;
    weightSum += w;
  }
  return weightSum > 0 ? sum / weightSum : 0;
}
