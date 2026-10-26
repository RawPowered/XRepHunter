import { normalizeReputationResult } from './normalize-result';
import type { ReputationResult } from '../types';

/** Shown on tweets while the background is loading or briefly unreachable. */
export function placeholderReputation(handle: string): ReputationResult {
  return normalizeReputationResult({
    handle: handle.toLowerCase(),
    score: 50,
    band: 'caution',
    hits: [],
    scannedAt: Date.now(),
    isTrusted: false,
  });
}
