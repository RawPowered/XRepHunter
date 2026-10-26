import type { AccountKind, LikelihoodCategory } from './types';

export interface AccountKindInput {
  sponsorshipHits: number;
  influencerAdHits: number;
  copypastaHits: number;
  aiAssistedHits: number;
  postsExposed: number;
}

export function classifyAccountKind(input: AccountKindInput): { kind: AccountKind; confidence: number } {
  const { postsExposed } = input;
  if (postsExposed < 2) return { kind: 'unknown', confidence: 0.2 };

  const promoRatio = (input.sponsorshipHits + input.influencerAdHits) / postsExposed;
  const recycleRatio = input.copypastaHits / postsExposed;
  const aiRatio = input.aiAssistedHits / postsExposed;

  const signals = [
    promoRatio >= 0.4,
    recycleRatio >= 0.35,
    aiRatio >= 0.35,
    promoRatio >= 0.15 && recycleRatio >= 0.15,
  ].filter(Boolean).length;

  if (signals >= 2) return { kind: 'mixed', confidence: 0.6 };
  if (promoRatio >= 0.35) return { kind: 'promoter', confidence: Math.min(0.85, promoRatio) };
  if (recycleRatio >= 0.35) return { kind: 'recycler', confidence: Math.min(0.85, recycleRatio) };
  if (promoRatio < 0.1 && recycleRatio < 0.1 && aiRatio < 0.2) {
    return { kind: 'creator', confidence: 0.55 };
  }
  return { kind: 'unknown', confidence: 0.35 };
}

export function pickLikelihoodCategory(scores: {
  sponsorship: number;
  influencerAd: number;
  copypasta: number;
  aiAssisted: number;
}): LikelihoodCategory {
  const entries: Array<[LikelihoodCategory, number]> = [
    ['likely_sponsored', scores.sponsorship],
    ['likely_influencer_ad', scores.influencerAd],
    ['likely_recycled', scores.copypasta],
    ['likely_ai_assisted', scores.aiAssisted],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const [top, score] = entries[0];
  if (score < 0.45) return 'likely_organic';
  return top;
}
