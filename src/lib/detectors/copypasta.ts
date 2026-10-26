import {
  buildDetectorResult,
  buildEvidenceHit,
  type DetectorResult,
} from './evidence';

export const STALE_COPYPASTA_DAYS = 14;

export interface CopypastaCorpusEntry {
  textFingerprint: string;
  firstHandle: string;
  seenCount: number;
  firstSeenAt?: number;
  lastSeenAt?: number;
  imageFingerprint?: string;
}

export interface CopypastaDetectInput {
  text: string;
  handle: string;
  corpus?: CopypastaCorpusEntry[];
  imageFingerprint?: string;
  now?: number;
}

export function normalizeForSimilarity(text: string): string {
  return text
    .slice(0, 400)
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .trim()
    .toLowerCase();
}

export function normalizeTextFingerprint(text: string): string {
  return normalizeForSimilarity(text).slice(0, 200);
}

function wordShingles(text: string, size = 3): Set<string> {
  const words = text.split(/\s+/).filter((w) => w.length > 1);
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - size; i++) {
    shingles.add(words.slice(i, i + size).join(' '));
  }
  return shingles;
}

export function shingleJaccard(a: string, b: string): number {
  const sa = wordShingles(a);
  const sb = wordShingles(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const s of sa) {
    if (sb.has(s)) inter++;
  }
  return inter / (sa.size + sb.size - inter);
}

export function detectCopypasta(input: CopypastaDetectInput): DetectorResult {
  const t = input.text.trim();
  const fp = normalizeTextFingerprint(t);
  const corpus = input.corpus ?? [];
  const now = input.now ?? Date.now();
  const evidence = [];

  if (fp.length < 20) {
    return buildDetectorResult('Copypasta unlikely', [], [], t.length, 0.25);
  }

  const exact = corpus.find((c) => c.textFingerprint === fp);
  if (exact) {
    if (exact.firstHandle !== input.handle.toLowerCase()) {
      evidence.push(
        buildEvidenceHit({
          id: 'exact_duplicate',
          label: 'Exact duplicate text from another author',
          weight: 40,
          category: 'copypasta',
          source: 'repetition',
          matchedSignal: 'exact_duplicate',
          detail: `first @${exact.firstHandle}`,
        }),
      );
    } else if (exact.seenCount >= 3) {
      evidence.push(
        buildEvidenceHit({
          id: 'repeated_claim',
          label: 'Repeated claim (same author, high frequency)',
          weight: 28,
          category: 'copypasta',
          source: 'repetition',
          matchedSignal: 'repeated_claim',
          detail: `${exact.seenCount} times`,
        }),
      );
    }

    if (exact.firstSeenAt && exact.lastSeenAt) {
      const ageDays = (now - exact.firstSeenAt) / 86400000;
      const staleDays = (now - exact.lastSeenAt) / 86400000;
      if (ageDays >= STALE_COPYPASTA_DAYS && staleDays >= 3) {
        evidence.push(
          buildEvidenceHit({
            id: 'stale_copypasta',
            label: 'Stale resurfacing copypasta',
            weight: 22,
            category: 'copypasta',
            source: 'repetition',
            matchedSignal: 'stale_copypasta',
          }),
        );
      }
    }
  }

  if (!exact) {
    let bestJ = 0;
    let bestEntry: CopypastaCorpusEntry | undefined;
    for (const entry of corpus) {
      if (entry.textFingerprint.length < 24) continue;
      const j = shingleJaccard(fp, entry.textFingerprint);
      if (j > bestJ) {
        bestJ = j;
        bestEntry = entry;
      }
    }
    if (bestJ >= 0.85 && bestEntry && bestEntry.firstHandle !== input.handle.toLowerCase()) {
      evidence.push(
        buildEvidenceHit({
          id: 'near_duplicate',
          label: 'Near-duplicate text (shingle match)',
          weight: 32,
          category: 'copypasta',
          source: 'repetition',
          matchedSignal: 'near_duplicate',
          detail: `${Math.round(bestJ * 100)}% similar · @${bestEntry.firstHandle}`,
        }),
      );
    }
  }

  if (input.imageFingerprint) {
    const mediaMatch = corpus.find(
      (c) => c.imageFingerprint && c.imageFingerprint === input.imageFingerprint,
    );
    if (mediaMatch) {
      evidence.push(
        buildEvidenceHit({
          id: 'repeated_media',
          label: 'Repeated image fingerprint',
          weight: 35,
          category: 'copypasta',
          source: 'media',
          matchedSignal: 'repeated_media',
        }),
      );
    }
  }

  const label =
    evidence.length > 0 ? 'Likely copypasta / recycled' : 'Copypasta unlikely';
  return buildDetectorResult(label, evidence, [], t.length, evidence.length ? 0.7 : 0.35);
}

export function corpusEntryFromText(
  text: string,
  handle: string,
  seenCount = 1,
): CopypastaCorpusEntry {
  return {
    textFingerprint: normalizeTextFingerprint(text),
    firstHandle: handle.toLowerCase(),
    seenCount,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
  };
}
