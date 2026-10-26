/** Per-tweet spam heuristic for timeline Sp segment (0–100). */

import {
  buildDetectorResult,
  buildEvidenceHit,
  clampScore,
  DETECTOR_VERSION,
  redactMatchedText,
  resultToSignalIds,
  type DetectorResult,
  type EvidenceHit,
} from './evidence';

const CRYPTO_RE =
  /\b(web3|crypto|bitcoin|btc|eth|airdrop|nft|defi|pump\.fun|wallet|token|memecoin|wallet connect)\b/i;
const TICKER_RE = /\$[A-Z]{2,8}\b/g;
const ROMANCE_RE =
  /\b(my love|miss you|lonely|single|dm me|text me|onlyfans|spoil me|sugar|babe|darling)\b/i;
const AD_RE =
  /\b(buy now|discount|limited time|shop now|promo code|link in bio)\b/i;
const AFFILIATE_RE = /\b(affiliate|use code|referral link|partner link)\b/i;
const DISCLOSED_SPONSOR_RE = /\b(#ad\b|paid partnership|sponsored\b|#gifted\b)/i;
const PROMO_RE =
  /\b(upload\b.+\bto\b|instantly\s*:|before you sign|check it first|in\s+\d+\s+seconds?|link in bio|follow for follow|f4f|giveaway|claim now|free giveaway)\b/i;
const ENGAGEMENT_BAIT_RE =
  /\b(like\s+and\s+rt|retweet\s+to\s+win|comment\s+below|drop\s+your\s+@\w+|rt\s+to\s+win)\b/i;
const CTA_RE =
  /\b(dm me|message me|click here|join (?:our )?telegram|join discord|whatsapp me|act now|don't miss)\b/i;
const FUNNEL_RE = /\b(telegram|t\.me\/|discord\.gg|whatsapp)\b/i;
const IMPERSONATION_RE =
  /\b(official support|verified agent|elon|musk).{0,40}(wallet|send|btc|eth)\b/i;
const PERSONAL_EXP_RE =
  /\b(i (?:went|tried|saw|met|built|fixed|learned)|my (?:mom|dad|kid|team|boss|friend))\b/i;
const SOURCE_CITE_RE = /\b(via @|source:|according to|reported by)\b/i;
const NON_COMMERCIAL_RE = /\b(game|match|weather|recipe|episode|concert|interview)\b/i;

export interface SpamDetectInput {
  text: string;
  isReply?: boolean;
  isQuote?: boolean;
}

export interface SpamDimensionScores {
  spamLikelihood: number;
  promotionalLikelihood: number;
  affiliateOrSponsorLikelihood: number;
}

export interface TweetSpamHeuristic {
  score: number;
  signals: string[];
  dimensions?: SpamDimensionScores;
  result?: DetectorResult;
}

function countMatches(text: string, re: RegExp): number {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  return [...text.matchAll(new RegExp(re.source, flags))].length;
}

function extractDomains(text: string): string[] {
  const urls = text.match(/\bhttps?:\/\/[^\s]+/gi) ?? [];
  return urls.map((u) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return u;
    }
  });
}

function ctaDensity(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const ctas = countMatches(text, CTA_RE) + countMatches(text, ENGAGEMENT_BAIT_RE);
  return ctas / words;
}

function dimensionScoresFromEvidence(
  evidence: EvidenceHit[],
  counterEvidence: EvidenceHit[],
): SpamDimensionScores {
  const sumCategory = (cat: EvidenceHit['category']) =>
    evidence.filter((e) => e.category === cat).reduce((s, e) => s + e.weight, 0);
  const counter = counterEvidence.reduce((s, e) => s + e.weight, 0) * 0.5;

  const spamRaw =
    sumCategory('spam') +
    evidence.filter((e) => ['crypto_scam', 'funnel_dm', 'impersonation', 'giveaway_bait'].includes(e.id))
      .reduce((s, e) => s + e.weight * 0.5, 0);
  const promoRaw = sumCategory('promo');
  const affiliateRaw = sumCategory('affiliate');

  return {
    spamLikelihood: clampScore(spamRaw - counter),
    promotionalLikelihood: clampScore(promoRaw - counter * 0.3),
    affiliateOrSponsorLikelihood: clampScore(affiliateRaw - counter * 0.2),
  };
}

export function detectTweetSpam(input: SpamDetectInput): DetectorResult {
  const t = input.text.trim();
  if (t.length < 8) {
    return {
      score: 0,
      confidence: 0.2,
      label: 'Spam unlikely',
      evidence: [],
      counterEvidence: [],
      detectorVersion: DETECTOR_VERSION,
      explanationSummary: 'Text too short to assess.',
    };
  }

  const evidence: EvidenceHit[] = [];
  const counterEvidence: EvidenceHit[] = [];
  const disclosed = DISCLOSED_SPONSOR_RE.test(t);

  const crypto = countMatches(t, CRYPTO_RE);
  if (crypto >= 2) {
    evidence.push(
      buildEvidenceHit({
        id: 'crypto_scam',
        label: 'Multiple crypto/scam terms',
        weight: 40,
        category: 'spam',
        source: 'text',
        matchedSignal: 'crypto',
        detail: `${crypto} matches`,
      }),
    );
  } else if (crypto === 1) {
    evidence.push(
      buildEvidenceHit({
        id: 'crypto_scam',
        label: 'Crypto/scam language',
        weight: 22,
        category: 'spam',
        source: 'text',
        matchedSignal: 'crypto',
      }),
    );
  }

  const tickers = t.match(TICKER_RE) ?? [];
  if (tickers.length >= 3) {
    evidence.push(
      buildEvidenceHit({
        id: 'ticker_spam',
        label: 'Excessive ticker/token mentions',
        weight: 28,
        category: 'spam',
        source: 'text',
        matchedSignal: 'ticker_spam',
        detail: `${tickers.length} tickers`,
      }),
    );
  }

  if (ROMANCE_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'romance_bait',
        label: 'Romance/DM bait language',
        weight: 28,
        category: 'spam',
        source: 'text',
        matchedSignal: 'romance',
      }),
    );
  }

  if (AD_RE.test(t) && !disclosed) {
    evidence.push(
      buildEvidenceHit({
        id: 'ad_language',
        label: 'Hard-sell / discount language',
        weight: disclosed ? 10 : 32,
        category: 'promo',
        source: 'text',
        matchedSignal: 'ad',
        matchedText: redactMatchedText(t.match(AD_RE)?.[0] ?? ''),
      }),
    );
  }

  if (AFFILIATE_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'affiliate_promo',
        label: disclosed ? 'Disclosed affiliate language' : 'Affiliate / use-code promo',
        weight: disclosed ? 18 : 30,
        category: 'affiliate',
        source: 'text',
        matchedSignal: 'affiliate',
      }),
    );
  }

  if (DISCLOSED_SPONSOR_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'disclosed_sponsor',
        label: 'Sponsorship disclosure present',
        weight: 35,
        category: 'affiliate',
        source: 'text',
        matchedSignal: 'sponsored',
      }),
    );
  }

  if (PROMO_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'promo_pattern',
        label: 'Promotional / giveaway pattern',
        weight: disclosed ? 15 : 28,
        category: 'promo',
        source: 'text',
        matchedSignal: 'promo',
      }),
    );
  }

  if (ENGAGEMENT_BAIT_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'engagement_bait',
        label: 'Engagement bait',
        weight: 25,
        category: 'promo',
        source: 'text',
        matchedSignal: 'engagement_bait',
      }),
    );
  }

  if (CTA_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'suspicious_cta',
        label: 'Suspicious call-to-action',
        weight: 22,
        category: 'promo',
        source: 'text',
        matchedSignal: 'cta',
      }),
    );
  }

  if (FUNNEL_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'funnel_dm',
        label: 'Off-platform funnel (Telegram/Discord/WhatsApp)',
        weight: 30,
        category: 'spam',
        source: 'text',
        matchedSignal: 'funnel',
      }),
    );
  }

  if (IMPERSONATION_RE.test(t)) {
    evidence.push(
      buildEvidenceHit({
        id: 'impersonation',
        label: 'Impersonation-style language',
        weight: 35,
        category: 'spam',
        source: 'text',
        matchedSignal: 'impersonation',
      }),
    );
  }

  const domains = extractDomains(t);
  const domainCounts = new Map<string, number>();
  for (const d of domains) domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  const repeatedDomain = [...domainCounts.entries()].find(([, c]) => c >= 2);
  if (repeatedDomain) {
    evidence.push(
      buildEvidenceHit({
        id: 'repeated_links',
        label: 'Repeated link domain',
        weight: 18,
        category: 'spam',
        source: 'text',
        matchedSignal: 'link_spam',
        detail: repeatedDomain[0],
      }),
    );
  } else if (
    /\bhttp[s]?:\/\//i.test(t) &&
    (crypto > 0 || AD_RE.test(t) || PROMO_RE.test(t))
  ) {
    evidence.push(
      buildEvidenceHit({
        id: 'link_with_promo',
        label: 'Link combined with promo/scam cues',
        weight: 12,
        category: 'spam',
        source: 'text',
        matchedSignal: 'link_spam',
      }),
    );
  }

  if (PERSONAL_EXP_RE.test(t)) {
    counterEvidence.push(
      buildEvidenceHit({
        id: 'personal_experience',
        label: 'Specific personal experience',
        weight: 25,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (input.isReply && t.length < 200 && /^@\w+/i.test(t)) {
    counterEvidence.push(
      buildEvidenceHit({
        id: 'conversational_reply',
        label: 'Conversational reply context',
        weight: 20,
        category: 'organic',
        source: 'context',
      }),
    );
  }

  if (SOURCE_CITE_RE.test(t) && !CTA_RE.test(t) && !PROMO_RE.test(t)) {
    counterEvidence.push(
      buildEvidenceHit({
        id: 'source_citation_no_cta',
        label: 'Source citation without hard CTA',
        weight: 22,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (ctaDensity(t) < 0.04 && t.length > 40) {
    counterEvidence.push(
      buildEvidenceHit({
        id: 'low_cta_density',
        label: 'Low call-to-action density',
        weight: 15,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (NON_COMMERCIAL_RE.test(t) && !crypto && !AD_RE.test(t)) {
    counterEvidence.push(
      buildEvidenceHit({
        id: 'non_commercial_language',
        label: 'Non-commercial topic language',
        weight: 18,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (input.isQuote && t.length > 60) {
    counterEvidence.push(
      buildEvidenceHit({
        id: 'coherent_thread_context',
        label: 'Quote/thread context present',
        weight: 12,
        category: 'context',
        source: 'context',
      }),
    );
  }

  const dims = dimensionScoresFromEvidence(evidence, counterEvidence);
  const spamScore = disclosed
    ? clampScore(dims.spamLikelihood * 0.6)
    : clampScore(Math.max(dims.spamLikelihood, dims.promotionalLikelihood * 0.7));

  let confidence = 0.55 + Math.min(0.35, evidence.length * 0.08);
  if (disclosed) confidence = Math.max(confidence, 0.6);
  if (counterEvidence.length >= 2) confidence *= 0.9;

  const result = buildDetectorResult(
    spamScore >= 40 ? 'Likely spam or promo' : 'Spam unlikely',
    evidence,
    counterEvidence,
    t.length,
    confidence,
  );
  result.score = spamScore;
  result.confidence = confidence;
  return result;
}

export function getSpamDimensions(result: DetectorResult): SpamDimensionScores {
  return dimensionScoresFromEvidence(result.evidence, result.counterEvidence);
}

export function scoreTweetSpamHeuristic(text: string): TweetSpamHeuristic {
  const result = detectTweetSpam({ text });
  const dims = dimensionScoresFromEvidence(result.evidence, result.counterEvidence);
  const disclosed = result.evidence.some((e) => e.id === 'disclosed_sponsor');
  const score = disclosed
    ? clampScore(Math.max(dims.spamLikelihood, dims.promotionalLikelihood * 0.5))
    : clampScore(Math.max(dims.spamLikelihood, dims.promotionalLikelihood * 0.7));

  return {
    score,
    signals: resultToSignalIds(result),
    dimensions: dims,
    result,
  };
}
