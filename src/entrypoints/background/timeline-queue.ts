import { enqueueScan } from './scan-pipeline';

const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_PER_FLUSH = 12;
const FLUSH_MS = 1500;

export function enqueueTimelineAuthors(handles: string[]): void {
  for (const h of handles) {
    const x = h.toLowerCase().trim();
    if (x) pending.add(x);
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = [...pending].slice(0, MAX_PER_FLUSH);
    for (const h of batch) pending.delete(h);
    for (const h of batch) enqueueScan(h);
    if (pending.size > 0) enqueueTimelineAuthors([]);
  }, FLUSH_MS);
}
