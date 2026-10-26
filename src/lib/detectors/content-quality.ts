import type {
  AccountProfile,
  ContentQualityProfile,
  DetectorCorrectionKind,
  PostSample,
} from '../types';
import type { TweetMediaInfo } from '../slop/extract-tweet-content';
import { analyzeTextSlop, legacySlopFromAnalysis } from './ai-slop';
import { detectCopypasta, type CopypastaCorpusEntry } from './copypasta';
import {
  aggregateConfidence,
  buildEvidenceHit,
  clampConfidence,
  clampScore,
  DETECTOR_VERSION,
  mergeEvidence,
  topEvidence,
  type DetectorResult,
  type EvidenceHit,
} from './evidence';
import { aiImageLikelihoodFromMedia, buildMediaEvidence } from './media-evidence';
import { detectOrganic } from './organic';
import { detectTweetSpam, getSpamDimensions } from './tweet-spam';

export type { ContentQualityProfile };

export interface ContentQualityInput {
  text: string;
  handle?: string;
  isReply?: boolean;
  isQuote?: boolean;
  media?: TweetMediaInfo;
  imageScore?: number;
  imageLabel?: string;
  hasManualAiMark?: boolean;
  cardTitle?: string;
  altText?: string;
  copypastaCorpus?: CopypastaCorpusEntry[];
  imageFingerprint?: string;
  profile?: AccountProfile;
  corrections?: DetectorCorrectionKind[];
  accountAutomationHint?: number;
}

export function applyCorrectionsToProfile(
  profile: ContentQualityProfile,
  corrections: DetectorCorrectionKind[],
): ContentQualityProfile {
  const counter = [...profile.topCounterEvidence];
  const evidence = [...profile.topEvidence];

  for (const c of corrections) {
    switch (c) {
      case 'not_spam':
        profile.spamLikelihood = clampScore(profile.spamLikelihood * 0.35);
        profile.promotionalLikelihood = clampScore(profile.promotionalLikelihood * 0.5);
        counter.push(
          buildEvidenceHit({
            id: 'user_not_spam',
            label: 'You marked: not spam',
            weight: 35,
            category: 'organic',
            source: 'user_feedback',
          }),
        );
        break;
      case 'not_ai':
        profile.aiTextLikelihood = clampScore(profile.aiTextLikelihood * 0.3);
        profile.aiImageLikelihood = clampScore(profile.aiImageLikelihood * 0.3);
        profile.slopLikelihood = clampScore(profile.slopLikelihood * 0.5);
        counter.push(
          buildEvidenceHit({
            id: 'user_not_ai',
            label: 'You marked: not AI',
            weight: 35,
            category: 'organic',
            source: 'user_feedback',
          }),
        );
        break;
      case 'organic':
        profile.organicLikelihood = clampScore(Math.max(profile.organicLikelihood, 65));
        evidence.push(
          buildEvidenceHit({
            id: 'user_organic',
            label: 'You marked: actually organic',
            weight: 40,
            category: 'organic',
            source: 'user_feedback',
          }),
        );
        break;
      case 'sponsored':
        profile.affiliateOrSponsorLikelihood = clampScore(
          Math.max(profile.affiliateOrSponsorLikelihood, 70),
        );
        profile.spamLikelihood = clampScore(profile.spamLikelihood * 0.5);
        evidence.push(
          buildEvidenceHit({
            id: 'user_sponsored',
            label: 'You marked: sponsored',
            weight: 35,
            category: 'affiliate',
            source: 'user_feedback',
          }),
        );
        break;
      case 'not_sponsored':
        profile.affiliateOrSponsorLikelihood = clampScore(
          profile.affiliateOrSponsorLikelihood * 0.3,
        );
        counter.push(
          buildEvidenceHit({
            id: 'user_not_sponsored',
            label: 'You marked: not sponsored',
            weight: 30,
            category: 'organic',
            source: 'user_feedback',
          }),
        );
        break;
      case 'copypasta':
        profile.copypastaLikelihood = clampScore(Math.max(profile.copypastaLikelihood, 75));
        evidence.push(
          buildEvidenceHit({
            id: 'user_copypasta',
            label: 'You marked: copypasta',
            weight: 40,
            category: 'copypasta',
            source: 'user_feedback',
          }),
        );
        break;
      case 'not_copypasta':
        profile.copypastaLikelihood = clampScore(profile.copypastaLikelihood * 0.25);
        counter.push(
          buildEvidenceHit({
            id: 'user_not_copypasta',
            label: 'You marked: not copypasta',
            weight: 35,
            category: 'organic',
            source: 'user_feedback',
          }),
        );
        break;
    }
  }

  profile.topEvidence = topEvidence(mergeEvidence(evidence, profile.topEvidence), 8);
  profile.topCounterEvidence = topEvidence(mergeEvidence(counter, profile.topCounterEvidence), 8);
  return profile;
}

function automationFromSignals(
  copypasta: number,
  slop: number,
  templateScore: number,
  accountHint?: number,
): number {
  const tweetLevel = clampScore(copypasta * 0.4 + slop * 0.25 + templateScore * 0.35);
  if (accountHint != null) {
    return clampScore(tweetLevel * 0.6 + accountHint * 0.4);
  }
  return tweetLevel;
}

export function legacySpamScore(profile: ContentQualityProfile): number {
  return clampScore(Math.max(profile.spamLikelihood, profile.promotionalLikelihood * 0.5));
}

export function legacySlopScore(profile: ContentQualityProfile): number {
  return clampScore(
    Math.max(
      profile.slopLikelihood,
      profile.aiTextLikelihood * 0.7,
      profile.promotionalSlopLikelihood,
    ),
  );
}

export function analyzeContentQuality(input: ContentQualityInput): ContentQualityProfile {
  const text = input.text.trim();
  const textLen = text.length;
  const imageOnly = textLen < 12 && Boolean(input.media?.hasPhoto || input.media?.hasCard);

  const spamResult = detectTweetSpam({
    text,
    isReply: input.isReply,
    isQuote: input.isQuote,
  });
  const spamDims = getSpamDimensions(spamResult);

  const textSlop = analyzeTextSlop(text, { isReply: input.isReply });
  const legacySlop = legacySlopFromAnalysis(text, textSlop);

  const organicResult = detectOrganic({
    text,
    isReply: input.isReply,
    isQuote: input.isQuote,
    cardTitle: input.cardTitle,
    postsSample: input.profile?.postsSample,
  });

  let copypastaResult: DetectorResult = {
    score: 0,
    confidence: 0.3,
    label: 'Copypasta unlikely',
    evidence: [],
    counterEvidence: [],
    detectorVersion: DETECTOR_VERSION,
    explanationSummary: '',
  };
  if (input.handle) {
    copypastaResult = detectCopypasta({
      text,
      handle: input.handle,
      corpus: input.copypastaCorpus ?? [],
      imageFingerprint: input.imageFingerprint,
    });
  }

  let mediaResult: DetectorResult | undefined;
  let aiImageLikelihood = 0;
  if (input.media) {
    mediaResult = buildMediaEvidence({
      text,
      media: input.media,
      imageScore: input.imageScore,
      imageLabel: input.imageLabel,
      hasManualAiMark: input.hasManualAiMark,
      cardTitle: input.cardTitle,
      altText: input.altText,
    });
    aiImageLikelihood = aiImageLikelihoodFromMedia(mediaResult);
  }

  let aiTextLikelihood = imageOnly ? 0 : Math.max(textSlop.aiText.score, legacySlop.score * 0.7);
  let slopLikelihood = imageOnly ? 0 : Math.max(textSlop.slop.score, legacySlop.score);
  let promotionalSlopLikelihood = imageOnly
    ? 0
    : Math.max(textSlop.promotionalSlop.score, legacySlop.score * 0.5);

  if (imageOnly && aiImageLikelihood > 0) {
    aiTextLikelihood = clampScore(aiImageLikelihood * 0.5);
    slopLikelihood = clampScore(aiImageLikelihood * 0.4);
  }

  const allEvidence = mergeEvidence(
    spamResult.evidence,
    textSlop.aiText.evidence,
    textSlop.slop.evidence,
    textSlop.promotionalSlop.evidence,
    organicResult.evidence,
    copypastaResult.evidence,
    mediaResult?.evidence ?? [],
  );
  const allCounter = mergeEvidence(
    spamResult.counterEvidence,
    textSlop.aiText.counterEvidence,
    textSlop.slop.counterEvidence,
    textSlop.promotionalSlop.counterEvidence,
    organicResult.counterEvidence,
    copypastaResult.counterEvidence,
    mediaResult?.counterEvidence ?? [],
  );

  let confidence = aggregateConfidence(
    0.65,
    allEvidence,
    allCounter,
    Math.max(textLen, imageOnly ? 20 : 0),
  );
  if (imageOnly) confidence = Math.min(confidence, 0.55);
  if (allEvidence.length === 0) confidence = Math.min(confidence, 0.35);

  const automationLikelihood = automationFromSignals(
    copypastaResult.score,
    slopLikelihood,
    legacySlop.score >= 50 ? 30 : 0,
    input.accountAutomationHint,
  );

  const explanations: Record<string, string> = {
    spam: spamResult.explanationSummary,
    organic: organicResult.explanationSummary,
    aiText: textSlop.aiText.explanationSummary,
    slop: textSlop.slop.explanationSummary,
    promotionalSlop: textSlop.promotionalSlop.explanationSummary,
    copypasta: copypastaResult.explanationSummary,
    media: mediaResult?.explanationSummary ?? 'No media assessed.',
  };
  if (confidence < 0.35) {
    explanations.overall = 'Insufficient evidence — treat as uncertain.';
  }

  let profile: ContentQualityProfile = {
    spamLikelihood: spamDims.spamLikelihood,
    promotionalLikelihood: spamDims.promotionalLikelihood,
    affiliateOrSponsorLikelihood: spamDims.affiliateOrSponsorLikelihood,
    aiTextLikelihood,
    aiImageLikelihood,
    slopLikelihood,
    promotionalSlopLikelihood,
    copypastaLikelihood: copypastaResult.score,
    organicLikelihood: organicResult.score,
    automationLikelihood,
    confidence,
    topEvidence: topEvidence(allEvidence, 8),
    topCounterEvidence: topEvidence(allCounter, 8),
    detectorVersion: DETECTOR_VERSION,
    explanations,
  };

  if (input.corrections?.length) {
    profile = applyCorrectionsToProfile(profile, input.corrections);
    profile.confidence = clampConfidence(profile.confidence * 0.95);
  }

  return profile;
}

export function qualityToSlopSignals(profile: ContentQualityProfile): string[] {
  const signals: string[] = [];
  for (const e of profile.topEvidence) {
    if (e.matchedSignal) signals.push(e.matchedSignal);
    else if (e.id) signals.push(e.id);
  }
  return [...new Set(signals)].slice(0, 10);
}
