import type { ProvenanceEvidence } from '../../provenance/types';
import type { LikelihoodCategory } from '../../provenance/types';

export type ProvenanceDisplayCategory =
  | 'organic_likely'
  | 'official_ad'
  | 'disclosed_sponsor'
  | 'suspected_influencer_ad'
  | 'affiliate_promo'
  | 'monetization_likely'
  | 'ai_likely'
  | 'recycled_likely'
  | 'automation_likely'
  | 'unknown';

export const PROVENANCE_CATEGORY_LABELS: Record<ProvenanceDisplayCategory, string> = {
  organic_likely: 'Organic likely',
  official_ad: 'Official ad',
  disclosed_sponsor: 'Disclosed sponsor',
  suspected_influencer_ad: 'Suspected influencer ad',
  affiliate_promo: 'Affiliate / promo',
  monetization_likely: 'Monetization likely',
  ai_likely: 'AI-assisted likely',
  recycled_likely: 'Recycled / copypasta',
  automation_likely: 'Automation-like',
  unknown: 'Unknown',
};

export interface ProvenanceDisplayInput {
  likelihoodCategory?: LikelihoodCategory | string;
  sponsorshipScore?: number;
  influencerAdScore?: number;
  copypastaScore?: number;
  aiAssistedScore?: number;
  isPromoted?: boolean;
  slopScore?: number;
  spamScore?: number;
  evidence?: ProvenanceEvidence[];
}

export function deriveProvenanceDisplayCategory(input: ProvenanceDisplayInput): ProvenanceDisplayCategory {
  const evidence = input.evidence ?? [];
  const ids = new Set(evidence.map((e) => e.id));

  if (input.isPromoted || ids.has('dom_promoted')) return 'official_ad';
  if ([...ids].some((id) => id.startsWith('disclosure_'))) return 'disclosed_sponsor';
  if (input.likelihoodCategory === 'likely_sponsored' || (input.sponsorshipScore ?? 0) >= 0.5) {
    return 'affiliate_promo';
  }
  if (input.likelihoodCategory === 'likely_influencer_ad' || (input.influencerAdScore ?? 0) >= 0.5) {
    return 'suspected_influencer_ad';
  }
  if ((input.influencerAdScore ?? 0) >= 0.35 && (input.sponsorshipScore ?? 0) >= 0.35) {
    return 'monetization_likely';
  }
  if (input.likelihoodCategory === 'likely_ai_assisted' || (input.aiAssistedScore ?? 0) >= 0.55) {
    return 'ai_likely';
  }
  if ((input.slopScore ?? 0) >= 55 && !input.likelihoodCategory) return 'ai_likely';
  if (input.likelihoodCategory === 'likely_recycled' || (input.copypastaScore ?? 0) >= 0.5) {
    return 'recycled_likely';
  }
  if ((input.spamScore ?? 0) >= 60) return 'automation_likely';
  if (input.likelihoodCategory === 'likely_organic') return 'organic_likely';
  if (
    (input.sponsorshipScore ?? 0) < 0.25 &&
    (input.influencerAdScore ?? 0) < 0.25 &&
    (input.copypastaScore ?? 0) < 0.25 &&
    (input.aiAssistedScore ?? 0) < 0.4
  ) {
    return 'organic_likely';
  }
  return 'unknown';
}

export function topEvidenceSignals(evidence: ProvenanceEvidence[], limit = 5): ProvenanceEvidence[] {
  return [...evidence].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

export function maxEvidenceConfidence(evidence: ProvenanceEvidence[]): number {
  if (!evidence.length) return 0;
  return Math.max(...evidence.map((e) => e.confidence));
}
