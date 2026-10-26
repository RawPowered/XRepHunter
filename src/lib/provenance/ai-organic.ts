import type { ProvenanceEvidence } from './types';

const SLOP_AI_THRESHOLD = 55;

export function detectAiOrganicEvidence(
  slopScore: number | undefined,
  hasAiImageMark: boolean,
): { score: number; evidence: ProvenanceEvidence[] } {
  const evidence: ProvenanceEvidence[] = [];
  if (hasAiImageMark) {
    evidence.push({
      id: 'ai_manual_image_mark',
      label: 'Image manually marked as likely AI-generated',
      confidence: 0.85,
      source: 'heuristic',
    });
  }
  if (slopScore != null && slopScore >= SLOP_AI_THRESHOLD) {
    evidence.push({
      id: 'ai_slop_score',
      label: 'Elevated AI-slop heuristic score',
      confidence: Math.min(0.9, slopScore / 100),
      detail: `score ${slopScore}`,
      source: 'heuristic',
    });
  }
  const score = evidence.length
    ? Math.min(0.95, evidence.reduce((s, e) => s + e.confidence, 0) / evidence.length)
    : 0;
  return { score, evidence };
}

export function isLikelyAiAssisted(score: number): boolean {
  return score >= 0.55;
}

export function isLikelyOrganic(
  sponsorshipScore: number,
  influencerAdScore: number,
  copypastaScore: number,
  aiAssistedScore: number,
): boolean {
  return (
    sponsorshipScore < 0.35 &&
    influencerAdScore < 0.35 &&
    copypastaScore < 0.35 &&
    aiAssistedScore < 0.45
  );
}
