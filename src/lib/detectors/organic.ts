import type { AccountProfile, PostSample } from '../types';
import {
  buildDetectorResult,
  buildEvidenceHit,
  confidenceFromTextLength,
  type DetectorResult,
} from './evidence';

const LIVED_DETAIL_RE =
  /\b(?:on )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{4}|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i;
const ENGAGEMENT_BAIT_RE =
  /\b(like\s+and\s+rt|retweet\s+to\s+win|comment\s+below|drop\s+your\s+@)\b/i;

export interface OrganicDetectInput {
  text: string;
  isReply?: boolean;
  isQuote?: boolean;
  cardTitle?: string;
  postsSample?: PostSample[];
}

function typeTokenRatio(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 5) return 0;
  return new Set(words).size / words.length;
}

function sentenceLengthVariance(text: string): number {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 5);
  if (sentences.length < 2) return 0;
  const lengths = sentences.map((s) => s.length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, l) => a + (l - mean) ** 2, 0) / lengths.length;
  return Math.sqrt(variance) / Math.max(mean, 1);
}

function accountTopicVariety(posts: PostSample[]): number {
  if (posts.length < 3) return 0;
  const openers = posts.map((p) => p.text.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
  return new Set(openers).size / openers.length;
}

export function detectOrganic(input: OrganicDetectInput): DetectorResult {
  const t = input.text.trim();
  if (t.length < 8) {
    return {
      score: 0,
      confidence: 0.2,
      label: 'Organic unknown',
      evidence: [],
      counterEvidence: [],
      detectorVersion: '2026.05.26',
      explanationSummary: 'Too short to assess organic signals.',
    };
  }

  const evidence = [];

  const ttr = typeTokenRatio(t);
  if (ttr >= 0.5 && t.length >= 30) {
    evidence.push(
      buildEvidenceHit({
        id: 'original_wording',
        label: 'Varied vocabulary (original wording)',
        weight: 28,
        category: 'organic',
        source: 'text',
        detail: `TTR ${ttr.toFixed(2)}`,
      }),
    );
  }

  if (LIVED_DETAIL_RE.test(t) || /\b(i|my|we)\b/i.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'lived_detail',
        label: 'Specific time/date or lived detail',
        weight: 32,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (input.isReply && /^@\w+/i.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'conversational_context',
        label: 'Conversational reply context',
        weight: 20,
        category: 'organic',
        source: 'context',
      }),
    );
  }

  if (input.isQuote) {
    evidence.push(
      buildEvidenceHit({
        id: 'conversational_context',
        label: 'Quote/thread participation',
        weight: 15,
        category: 'organic',
        source: 'context',
      }),
    );
  }

  const slVar = sentenceLengthVariance(t);
  if (slVar >= 0.35 && t.length >= 50) {
    evidence.push(
      buildEvidenceHit({
        id: 'non_template_structure',
        label: 'Non-uniform sentence structure',
        weight: 18,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (!ENGAGEMENT_BAIT_RE.test(t) && t.length >= 30) {
    evidence.push(
      buildEvidenceHit({
        id: 'low_cta_density',
        label: 'No engagement-bait patterns',
        weight: 12,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (/[!?]{2,}|\.{3}|lol|lmao|idk|tbh|imo/i.test(t) && !ENGAGEMENT_BAIT_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'human_imperfection',
        label: 'Informal / human-like phrasing',
        weight: 14,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (input.cardTitle && t.length > 20) {
    const cardWords = new Set(input.cardTitle.toLowerCase().split(/\W+/));
    const textWords = t.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const overlap = textWords.filter((w) => cardWords.has(w)).length;
    if (overlap >= 2) {
      evidence.push(
        buildEvidenceHit({
          id: 'media_text_consistency',
          label: 'Text aligns with card/media title',
          weight: 16,
          category: 'organic',
          source: 'media',
        }),
      );
    }
  }

  const posts = input.postsSample ?? [];
  const variety = accountTopicVariety(posts);
  if (variety >= 0.6 && posts.length >= 4) {
    evidence.push(
      buildEvidenceHit({
        id: 'account_variety',
        label: 'Account shows varied post topics',
        weight: 18,
        category: 'account',
        source: 'account',
        detail: `${Math.round(variety * 100)}% unique openers`,
      }),
    );
  }

  const counterEvidence = [];
  if (ENGAGEMENT_BAIT_RE.test(t)) {
    counterEvidence.push(
      buildEvidenceHit({
        id: 'engagement_bait_present',
        label: 'Engagement bait undermines organic signal',
        weight: 25,
        category: 'promo',
        source: 'text',
      }),
    );
  }

  const baseConf = 0.5 + Math.min(0.35, evidence.length * 0.07);
  const result = buildDetectorResult(
    evidence.length >= 2 ? 'Likely organic' : 'Organic unclear',
    evidence,
    counterEvidence,
    t.length,
    baseConf,
  );
  result.confidence = confidenceFromTextLength(t.length) * baseConf;
  return result;
}

export function detectOrganicFromProfile(
  text: string,
  profile?: AccountProfile,
  opts?: { isReply?: boolean; isQuote?: boolean; cardTitle?: string },
): DetectorResult {
  return detectOrganic({
    text,
    isReply: opts?.isReply,
    isQuote: opts?.isQuote,
    cardTitle: opts?.cardTitle,
    postsSample: profile?.postsSample,
  });
}
