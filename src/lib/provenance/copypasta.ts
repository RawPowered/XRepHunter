import {
  detectCopypasta,
  normalizeTextFingerprint,
  type CopypastaCorpusEntry,
} from '../detectors/copypasta';
import type { ProvenanceEvidence } from './types';

export type { CopypastaCorpusEntry };
export { normalizeTextFingerprint };

const PROVENANCE_ID_MAP: Record<string, string> = {
  exact_duplicate: 'corpus_cross_author',
  near_duplicate: 'corpus_cross_author',
  repeated_claim: 'corpus_high_frequency',
  stale_copypasta: 'corpus_high_frequency',
};

function detectorToProvenance(
  evidence: { id: string; label: string; detail?: string; source: string }[],
): ProvenanceEvidence[] {
  return evidence.map((e) => ({
    id: PROVENANCE_ID_MAP[e.id] ?? e.id,
    label: e.label,
    confidence: 0.7,
    detail: e.detail,
    source: e.source === 'repetition' ? 'corpus' : 'heuristic',
  }));
}

export function detectCopypastaEvidence(
  text: string,
  handle: string,
  corpus: CopypastaCorpusEntry[],
): { score: number; evidence: ProvenanceEvidence[]; textFingerprint: string } {
  const textFingerprint = normalizeTextFingerprint(text);
  const result = detectCopypasta({ text, handle, corpus });
  const evidence = detectorToProvenance(result.evidence);
  const score = evidence.length
    ? Math.min(0.9, result.score / 100)
    : 0;
  return { score, evidence, textFingerprint };
}
