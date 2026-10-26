import type { ProvenanceEvidence } from './types';

const PROMO_RE =
  /\b(buy now|shop now|discount|promo code|link in bio|limited time|use my link|check out|grab yours)\b/i;
const LINK_RE = /https?:\/\/|t\.co\/\w+/i;
const BRAND_RE = /\b(partner|collab|collaboration|brand|launch|available now)\b/i;

export function detectInfluencerAdEvidence(text: string): {
  score: number;
  evidence: ProvenanceEvidence[];
} {
  const evidence: ProvenanceEvidence[] = [];
  const t = text.trim();
  if (t.length < 20) return { score: 0, evidence };

  const promoHits = (t.match(PROMO_RE) ?? []).length;
  const hasLink = LINK_RE.test(t);
  const brandHits = (t.match(BRAND_RE) ?? []).length;

  if (promoHits >= 2) {
    evidence.push({
      id: 'influencer_promo_density',
      label: 'High promo phrase density',
      confidence: 0.65,
      detail: `${promoHits} promo signals`,
      source: 'heuristic',
    });
  } else if (promoHits === 1 && hasLink) {
    evidence.push({
      id: 'influencer_promo_link',
      label: 'Promo language with outbound link',
      confidence: 0.6,
      source: 'heuristic',
    });
  }

  if (brandHits >= 1 && hasLink && promoHits >= 1) {
    evidence.push({
      id: 'influencer_brand_promo',
      label: 'Brand/collab language with promo link pattern',
      confidence: 0.55,
      source: 'heuristic',
    });
  }

  const score = evidence.length
    ? Math.min(0.85, evidence.reduce((s, e) => s + e.confidence, 0) / evidence.length)
    : 0;
  return { score, evidence };
}
