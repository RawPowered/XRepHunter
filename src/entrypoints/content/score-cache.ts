import { sendMessage, isExtensionContextInvalidated } from '../../lib/messaging';
import { normalizeReputationResult } from '../../lib/scoring/normalize-result';
import { placeholderReputation } from '../../lib/scoring/placeholder-result';
import type { ReputationResult } from '../../lib/types';
import { markContentScriptInvalidated } from './lifecycle';
import { cs } from './state';

const inflight = new Map<string, Promise<ReputationResult>>();

export function getCachedScore(handle: string): ReputationResult | undefined {
  return cs.scoreCache.get(handle.toLowerCase());
}

export function putCachedScore(result: ReputationResult): void {
  cs.scoreCache.set(result.handle.toLowerCase(), normalizeReputationResult(result));
}

export async function fetchScore(
  handle: string,
  existing?: ReputationResult,
): Promise<ReputationResult> {
  if (existing) {
    const n = normalizeReputationResult(existing);
    putCachedScore(n);
    return n;
  }
  const h = handle.toLowerCase();
  const hit = cs.scoreCache.get(h);
  if (hit && hit.scannedAt > Date.now() - 60_000) return hit;

  const pending = inflight.get(h);
  if (pending) return pending;

  const p = (async () => {
    try {
      const raw = await sendMessage<ReputationResult>({ type: 'GET_SCORE', handle: h });
      if (raw?.handle) {
        const n = normalizeReputationResult(raw);
        putCachedScore(n);
        return n;
      }
    } catch (err) {
      if (isExtensionContextInvalidated(err)) {
        markContentScriptInvalidated();
        return placeholderReputation(h);
      }
      const ph = placeholderReputation(h);
      putCachedScore(ph);
      window.setTimeout(() => {
        inflight.delete(h);
        void fetchScore(h).then((fresh) => {
          putCachedScore(fresh);
          void import('./tweet-attach').then(({ reattachTweetsForHandle }) =>
            reattachTweetsForHandle(h, fresh),
          );
        });
      }, 2500);
      return ph;
    }
    const ph = placeholderReputation(h);
    putCachedScore(ph);
    return ph;
  })();

  inflight.set(h, p);
  try {
    return await p;
  } finally {
    inflight.delete(h);
  }
}

/** One round-trip for many visible authors. */
export async function prefetchScores(handles: string[]): Promise<void> {
  const missing = handles
    .map((h) => h.toLowerCase())
    .filter((h, i, arr) => arr.indexOf(h) === i && !cs.scoreCache.has(h) && !inflight.has(h));
  if (!missing.length) return;

  const batch = missing.slice(0, 48);
  try {
    const res = await sendMessage<Record<string, ReputationResult>>({
      type: 'BATCH_GET_SCORES',
      handles: batch,
    });
    for (const [handle, raw] of Object.entries(res ?? {})) {
      if (raw?.handle) putCachedScore(raw);
    }
  } catch {
    /* per-tweet fetchScore still runs */
  }
}
