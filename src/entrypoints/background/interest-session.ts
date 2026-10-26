import type { BrowseTopicsSnapshot } from '../../lib/db/repositories/browse-topics';

const sessionPostLabels = new Map<string, string[]>();
const sessionByTopic: Record<string, number> = {};

function labelsKey(labels: string[]): string {
  return [...labels].sort().join(',');
}

export function recordSessionBrowseTopics(postFingerprint: string, labels: string[]): boolean {
  const normalized = [...new Set(labels.map((l) => l.toLowerCase()).filter(Boolean))];
  const prev = sessionPostLabels.get(postFingerprint);
  if (prev && labelsKey(prev) === labelsKey(normalized)) return false;

  if (prev) {
    for (const t of prev) sessionByTopic[t] = Math.max(0, (sessionByTopic[t] ?? 0) - 1);
  }

  sessionPostLabels.set(postFingerprint, normalized);
  for (const t of normalized) sessionByTopic[t] = (sessionByTopic[t] ?? 0) + 1;
  return true;
}

export function resetSessionBrowseTopics(): void {
  sessionPostLabels.clear();
  for (const k of Object.keys(sessionByTopic)) delete sessionByTopic[k];
}

export function getSessionBrowseTopics(): BrowseTopicsSnapshot {
  const totalPosts = sessionPostLabels.size;
  return { totalPosts, byTopic: { ...sessionByTopic } };
}
