import type { ProvenanceEvidence } from './types';

const DISCLOSURE_RES: Array<{ id: string; re: RegExp; label: string; confidence: number }> = [
  { id: 'disclosure_ad_hashtag', re: /#ad\b/i, label: 'Contains #ad disclosure', confidence: 0.85 },
  { id: 'disclosure_sponsored', re: /\bsponsored\b/i, label: 'Mentions sponsored content', confidence: 0.8 },
  { id: 'disclosure_paid_partnership', re: /paid partnership/i, label: 'Paid partnership language', confidence: 0.85 },
  { id: 'disclosure_affiliate', re: /\baffiliate\b/i, label: 'Affiliate mention', confidence: 0.75 },
  { id: 'disclosure_use_code', re: /\buse code\b/i, label: 'Promo / use-code language', confidence: 0.7 },
  { id: 'disclosure_gifted', re: /\b(gifted|#gifted)\b/i, label: 'Gifted product language', confidence: 0.65 },
];

export function detectSponsorshipEvidence(
  text: string,
  isPromotedAd: boolean,
): { score: number; evidence: ProvenanceEvidence[] } {
  const evidence: ProvenanceEvidence[] = [];
  if (isPromotedAd) {
    evidence.push({
      id: 'dom_promoted',
      label: 'X promoted/sponsored placement label',
      confidence: 0.95,
      source: 'dom',
    });
  }
  for (const { id, re, label, confidence } of DISCLOSURE_RES) {
    if (re.test(text)) {
      evidence.push({ id, label, confidence, source: 'heuristic' });
    }
  }
  const score = evidence.length
    ? Math.min(1, evidence.reduce((s, e) => s + e.confidence, 0) / evidence.length)
    : 0;
  return { score, evidence };
}
