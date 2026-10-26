import { pickLikelihoodCategory } from './account-kind';
import { detectAiOrganicEvidence, isLikelyOrganic } from './ai-organic';
import { detectCopypastaEvidence, type CopypastaCorpusEntry } from './copypasta';
import { detectInfluencerAdEvidence } from './influencer-ad';
import { detectSponsorshipEvidence } from './sponsorship';
import type { ProvenanceAnalyzeInput, ProvenanceAssessment } from './types';

export function analyzePostProvenance(
  input: ProvenanceAnalyzeInput,
  corpus: CopypastaCorpusEntry[] = [],
): ProvenanceAssessment {
  const sponsorship = detectSponsorshipEvidence(input.text, input.isPromotedAd);
  const influencer = detectInfluencerAdEvidence(input.text);
  const copypasta = detectCopypastaEvidence(input.text, input.handle, corpus);
  const ai = detectAiOrganicEvidence(input.slopScore, input.hasAiImageMark ?? false);

  const evidence = [
    ...sponsorship.evidence,
    ...influencer.evidence,
    ...copypasta.evidence,
    ...ai.evidence,
  ];

  const scores = {
    sponsorship: sponsorship.score,
    influencerAd: influencer.score,
    copypasta: copypasta.score,
    aiAssisted: ai.score,
  };

  let likelihoodCategory = pickLikelihoodCategory(scores);
  if (
    likelihoodCategory !== 'likely_organic' &&
    isLikelyOrganic(scores.sponsorship, scores.influencerAd, scores.copypasta, scores.aiAssisted)
  ) {
    likelihoodCategory = 'likely_organic';
  }

  return {
    postFingerprint: input.postFingerprint,
    handle: input.handle,
    statusId: input.statusId,
    textFingerprint: copypasta.textFingerprint,
    likelihoodCategory,
    sponsorshipScore: scores.sponsorship,
    influencerAdScore: scores.influencerAd,
    copypastaScore: scores.copypasta,
    aiAssistedScore: scores.aiAssisted,
    evidence,
  };
}
