import type { ProvenanceEvidence } from '../provenance/types';

export type EvidenceSource =
  | 'text'
  | 'account'
  | 'media'
  | 'graph'
  | 'repetition'
  | 'context'
  | 'user_feedback';

export type DetectorCategory =
  | 'spam'
  | 'promo'
  | 'affiliate'
  | 'ai_text'
  | 'ai_image'
  | 'slop'
  | 'copypasta'
  | 'organic'
  | 'automation';

export interface EvidenceHit {
  id: string;
  label: string;
  weight: number;
  matchedText?: string;
  matchedSignal?: string;
  category: DetectorCategory;
  detail?: string;
  source: EvidenceSource;
}

export interface DetectorResult {
  score: number;
  confidence: number;
  label: string;
  evidence: EvidenceHit[];
  counterEvidence: EvidenceHit[];
  detectorVersion: string;
  explanationSummary: string;
}

export const INDICATOR_DISCLAIMER =
  'Likelihood indicators only — not proof of spam, AI authorship, or bot activity.';

export const DETECTOR_VERSION = '2026.05.26';

export function clampScore(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function clampConfidence(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function buildEvidenceHit(
  partial: Omit<EvidenceHit, 'weight'> & { weight?: number },
): EvidenceHit {
  return {
    weight: partial.weight ?? 15,
    ...partial,
  };
}

export function mergeEvidence(...lists: EvidenceHit[][]): EvidenceHit[] {
  const byId = new Map<string, EvidenceHit>();
  for (const list of lists) {
    for (const hit of list) {
      const existing = byId.get(hit.id);
      if (!existing || hit.weight > existing.weight) {
        byId.set(hit.id, hit);
      }
    }
  }
  return [...byId.values()];
}

export function topEvidence(hits: EvidenceHit[], n = 5): EvidenceHit[] {
  return [...hits].sort((a, b) => b.weight - a.weight).slice(0, n);
}

export function summarizeResult(result: DetectorResult): string {
  const top = topEvidence(result.evidence, 2).map((e) => e.label);
  const counter = topEvidence(result.counterEvidence, 1).map((e) => e.label);
  const parts = [`${result.label} (${result.score})`];
  if (top.length) parts.push(`evidence: ${top.join('; ')}`);
  if (counter.length) parts.push(`counter: ${counter.join('; ')}`);
  return parts.join(' · ');
}

export function provenanceToEvidenceHit(
  e: ProvenanceEvidence,
  category: DetectorCategory = 'affiliate',
): EvidenceHit {
  const sourceMap: Record<string, EvidenceSource> = {
    dom: 'context',
    heuristic: 'text',
    corpus: 'repetition',
  };
  return {
    id: e.id,
    label: e.label,
    weight: Math.round(e.confidence * 25),
    category,
    detail: e.detail,
    source: sourceMap[e.source] ?? 'text',
  };
}

export function confidenceFromTextLength(
  len: number,
  minLen = 12,
  fullLen = 80,
): number {
  if (len < minLen) return 0.25;
  if (len >= fullLen) return 1;
  return clampConfidence(0.25 + ((len - minLen) / (fullLen - minLen)) * 0.75);
}

export function redactMatchedText(text: string, max = 48): string {
  const stripped = text.replace(/\bhttps?:\/\/\S+/gi, '[link]').trim();
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max)}…`;
}

export function scoreFromEvidence(
  evidence: EvidenceHit[],
  counterEvidence: EvidenceHit[],
  opts?: { perFamilyCap?: number; familyKey?: (e: EvidenceHit) => string },
): number {
  const cap = opts?.perFamilyCap ?? 25;
  const familyKey = opts?.familyKey ?? ((e) => e.id);
  const familyTotals = new Map<string, number>();

  let positive = 0;
  for (const hit of evidence) {
    const key = familyKey(hit);
    const current = familyTotals.get(key) ?? 0;
    const add = Math.min(hit.weight, cap - current);
    if (add > 0) {
      familyTotals.set(key, current + add);
      positive += add;
    }
  }

  const counterSum = counterEvidence.reduce((s, e) => s + e.weight, 0);
  return clampScore(positive - counterSum * 0.6);
}

export function aggregateConfidence(
  base: number,
  evidence: EvidenceHit[],
  counterEvidence: EvidenceHit[],
  textLen: number,
): number {
  let c = base * confidenceFromTextLength(textLen);
  const counterWeight = counterEvidence.reduce((s, e) => s + e.weight, 0);
  if (counterEvidence.length >= 2 || counterWeight >= 30) {
    c *= 0.85;
  }
  if (evidence.length === 0) c *= 0.5;
  return clampConfidence(c);
}

export function emptyDetectorResult(label: string): DetectorResult {
  return {
    score: 0,
    confidence: 0.25,
    label,
    evidence: [],
    counterEvidence: [],
    detectorVersion: DETECTOR_VERSION,
    explanationSummary: 'Insufficient signals.',
  };
}

export function buildDetectorResult(
  label: string,
  evidence: EvidenceHit[],
  counterEvidence: EvidenceHit[],
  textLen: number,
  baseConfidence = 0.65,
): DetectorResult {
  const score = scoreFromEvidence(evidence, counterEvidence);
  const confidence = aggregateConfidence(baseConfidence, evidence, counterEvidence, textLen);
  const top = topEvidence(evidence, 2);
  const summary =
    top.length > 0
      ? `May indicate ${label.toLowerCase()}: ${top.map((e) => e.label).join('; ')}`
      : 'No strong indicators.';
  return {
    score,
    confidence,
    label,
    evidence,
    counterEvidence,
    detectorVersion: DETECTOR_VERSION,
    explanationSummary: summary,
  };
}

export function resultToSignalIds(result: DetectorResult): string[] {
  return result.evidence.map((e) => e.matchedSignal ?? e.id);
}
