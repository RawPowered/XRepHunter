import type {

  AccountProfile,

  DetectorHit,

  ExtensionSettings,

  ReputationResult,

  ScoreBreakdown,

  SpamExample,

} from '../types';

import { getTrustedUser, isTrustedHandle } from '../types';

import { runAllDetectors } from '../detectors';
import { scoreProfileHeuristic } from '../detectors/ai-slop';

import {

  bucketRisk,

  getEffectiveWeight,

  getWeightedContribution,

  isSpamHit,

} from '../x-algorithm/weights';



export function scoreToBand(score: number): ReputationResult['band'] {

  if (score >= 70) return 'trusted';

  if (score >= 40) return 'caution';

  return 'high_risk';

}



function enrichHitsWithWeights(hits: DetectorHit[], settings: ExtensionSettings): DetectorHit[] {

  return hits.map((h) => ({

    ...h,

    effectiveWeight: Math.round(getEffectiveWeight(h, settings) * 100) / 100,

    weightedContribution: Math.round(getWeightedContribution(h, settings) * 100) / 100,

  }));

}



export interface BreakdownOpts {
  postSampleCount?: number;
  toxicityCombined?: number;
  slopCombined?: number;
  postSignalsRisk?: number;
  baselineRisk?: number;
  scoreCap?: number;
}

function computeBreakdown(
  hits: DetectorHit[],
  settings: ExtensionSettings,
  opts?: BreakdownOpts,
): ScoreBreakdown {

  const spamHits = hits.filter((h) => isSpamHit(h));

  const generalHits = hits.filter((h) => !isSpamHit(h));



  const spamRisk = bucketRisk(spamHits, settings);

  const generalRisk = bucketRisk(generalHits, settings);



  let xWeightedSpamRisk = spamRisk;

  if (settings.xAlgorithmAlignment !== false && spamHits.length) {

    xWeightedSpamRisk = bucketRisk(spamHits, { ...settings, xAlgorithmAlignment: true });

  }



  const spamW = settings.spamBucketWeight ?? 0.65;

  const generalW = settings.xAlgorithmAlignment !== false ? 1 - spamW : 0.5;

  const spamNorm = settings.xAlgorithmAlignment !== false ? spamW : 0.5;

  const generalNorm = settings.xAlgorithmAlignment !== false ? generalW : 0.5;



  let combinedRisk: number;

  const postSignalsRisk = opts?.postSignalsRisk ?? 0;
  const baseline = opts?.baselineRisk ?? 0.06;

  if (!spamHits.length && !generalHits.length) {
    const postCount = opts?.postSampleCount ?? 0;
    combinedRisk = postCount >= 5 ? baseline : Math.max(baseline, 0.12);
  } else if (!spamHits.length) {

    combinedRisk = generalRisk;

  } else if (!generalHits.length) {

    combinedRisk = spamRisk;

  } else {

    combinedRisk = spamNorm * spamRisk + generalNorm * generalRisk;

  }



  combinedRisk = Math.max(combinedRisk, postSignalsRisk, baseline);

  const sensitivityBoost = (settings.sensitivity - 0.5) * 0.2;

  const adjustedRisk = Math.min(1, Math.max(0, combinedRisk + sensitivityBoost));

  const cap = opts?.scoreCap ?? settings.reputationScoreCap ?? 95;
  let overall = Math.max(0, Math.min(cap, Math.round((1 - adjustedRisk) * 100)));

  if (opts?.toxicityCombined != null && opts.toxicityCombined >= 70) {
    overall = Math.min(overall, 65);
  }
  if (opts?.slopCombined != null && opts.slopCombined >= 75) {
    overall = Math.min(overall, 70);
  }

  return {
    overall,

    spamRisk: Math.round(spamRisk * 100),

    generalRisk: Math.round(generalRisk * 100),

    xWeightedSpamRisk: Math.round(xWeightedSpamRisk * 100),

  };

}



export function enrichHitsAndBreakdown(
  base: ReputationResult,
  hits: ReputationResult['hits'],
  settings: ExtensionSettings,
  opts?: BreakdownOpts,
): ReputationResult {
  const enriched = enrichHitsWithWeights(hits, settings).sort((a, b) => b.risk - a.risk);
  const breakdown = computeBreakdown(enriched, settings, opts);
  return {
    ...base,
    hits: enriched,
    breakdown,
    score: breakdown.overall,
    band: scoreToBand(breakdown.overall),
  };
}

export function computeReputation(
  profile: AccountProfile,
  settings: ExtensionSettings,
  examples: SpamExample[],
  extraHits: DetectorHit[] = [],
  breakdownOpts?: Omit<BreakdownOpts, 'postSampleCount' | 'scoreCap' | 'baselineRisk'>,
): ReputationResult {
  const slop = scoreProfileHeuristic(profile);
  const rawHits = [...runAllDetectors(profile, settings, examples, slop), ...extraHits];
  const trusted = getTrustedUser(profile.handle, settings);
  const base: ReputationResult = {
    handle: profile.handle.toLowerCase(),
    score: 0,
    band: 'caution',
    hits: [],
    scannedAt: Date.now(),
    profile,
    breakdown: { overall: 50, spamRisk: 0, generalRisk: 0, xWeightedSpamRisk: 0 },
    isTrusted: isTrustedHandle(profile.handle, settings),
    trustedNote: trusted?.note,
    slop,
  };
  return enrichHitsAndBreakdown(base, rawHits, settings, {
    postSampleCount: profile.postsSample?.length ?? 0,
    slopCombined: slop.combined,
    scoreCap: settings.reputationScoreCap ?? 95,
    baselineRisk: settings.reputationBaselineRisk ?? 0.06,
    ...breakdownOpts,
  });
}



export function mergeProfiles(

  base: Partial<AccountProfile>,

  extra: Partial<AccountProfile>,

  handle: string,

): AccountProfile {

  const posts = extra.postsSample?.length ? extra.postsSample : base.postsSample;

  return {

    handle: handle.toLowerCase(),

    displayName: extra.displayName ?? base.displayName,

    bio: extra.bio ?? base.bio,

    joinedText: extra.joinedText ?? base.joinedText,

    joinedAt: extra.joinedAt ?? base.joinedAt,

    location: extra.location ?? base.location,

    usernameChanges: extra.usernameChanges ?? base.usernameChanges,

    connectionSource: extra.connectionSource ?? base.connectionSource,

    followersCount: extra.followersCount ?? base.followersCount,

    followingCount: extra.followingCount ?? base.followingCount,

    postsSample: posts ?? [],

    source: extra.source === 'graphql' || base.source === 'graphql' ? 'graphql' : 'dom',

  };

}



export function shouldSuggestBlock(result: ReputationResult, settings: ExtensionSettings): boolean {

  if (!settings.autoSuggestEnabled || !settings.autoBlockAgreed || settings.learningMode) return false;

  if (result.isTrusted || isTrustedHandle(result.handle, settings)) return false;

  return result.score <= settings.autoSuggestThreshold;

}



export function profileHealthTips(result: ReputationResult): string[] {

  const tips: string[] = [];

  const spamRisk = result.breakdown?.spamRisk ?? 0;
  if (spamRisk >= 50) {

    tips.push(

      `Spam/X-weighted risk is ${spamRisk}% — aligns with VFFilter / Grox down-ranking.`,

    );

  }

  for (const h of result.hits) {

    if (h.id === 'repostBot' || h.id === 'xRepostDedup')

      tips.push('X For You favors originals — reduce duplicate reposts (RepostDeduplicationFilter).');

    if (h.id === 'cryptoSpam' || h.id === 'xVisibility')

      tips.push('Content may fail X VF / Grox spam checks — diversify beyond promo/crypto.');

    if (h.id === 'handlePattern')

      tips.push('Consider a handle that matches your display name.');

    if (h.id === 'romanceBait' || h.id === 'thirstTrap')

      tips.push('Vague or bait-style posts align with negative P(mute) / P(report) signals.');

    if (h.id === 'userExamples')

      tips.push('Profile matches your spam example library — highest X spam weight applied.');

    if (h.id === 'xAuthorMonoculture')

      tips.push('Add varied post types — Author Diversity Scorer penalizes one-note feeds.');

    if (h.id === 'xNegativeEngagement')

      tips.push('Reduce follow-churn CTAs — they correlate with block/mute predictions.');

    if (h.id === 'xOrganicTrust')

      tips.push('Balance following/followers for stronger P(follow_author) trust.');

    if (h.id === 'xStaleBurst')

      tips.push('New accounts with repost floods match AgeFilter + low-trust patterns.');

    if (h.id === 'aiSlop')

      tips.push(
        `AI slop score ${result.slop?.combined ?? '—'} — generic AI voice may align with VF spam patterns.`,
      );

  }

  if (!tips.length && result.score >= 70) {

    tips.push(

      'Aligned with X For You goals: diverse originals, positive engagement signals, no VF risk patterns.',

    );

  }

  return tips;

}


