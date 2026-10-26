import type { AccountProfile, DetectorHit, SpamExample } from '../types';
import { enrichHitWithXRules } from '../x-algorithm/rules';

function hit(label: string, risk: number, detail?: string, matchStrength?: number): DetectorHit {
  return enrichHitWithXRules({
    id: 'userExamples',
    label,
    risk,
    detail,
    matchStrength,
  });
}

function handleSimilarity(handle: string, pattern?: string): number {
  if (!pattern) return 0;
  try {
    const re = new RegExp(pattern, 'i');
    return re.test(handle) ? 1 : 0;
  } catch {
    return 0;
  }
}

function keywordOverlap(text: string, keywords: string[]): number {
  if (!keywords.length) return 0;
  const lower = text.toLowerCase();
  let n = 0;
  for (const k of keywords) {
    if (k && lower.includes(k.toLowerCase())) n++;
  }
  return n / keywords.length;
}

export function matchUserExamples(profile: AccountProfile, examples: SpamExample[]): DetectorHit | null {
  if (!examples.length) return null;

  const blob = `${profile.bio ?? ''} ${(profile.postsSample ?? []).map((p) => p.text).join(' ')}`;
  let best = 0;
  let bestEx: SpamExample | null = null;

  for (const ex of examples) {
    let score = 0;
    if (ex.handle.toLowerCase() === profile.handle.toLowerCase()) score = 1;
    score = Math.max(score, handleSimilarity(profile.handle, ex.handlePattern) * 0.9);
    score = Math.max(score, keywordOverlap(blob, ex.keywords) * 0.85);
    if (ex.bio && profile.bio && profile.bio.toLowerCase().includes(ex.bio.toLowerCase().slice(0, 30))) {
      score = Math.max(score, 0.7);
    }
    if (ex.repostRatio != null && profile.postsSample?.length) {
      const reposts = profile.postsSample.filter((p) => p.isRepost).length / profile.postsSample.length;
      if (Math.abs(reposts - ex.repostRatio) < 0.2) score = Math.max(score, 0.5);
    }
    if (score > best) {
      best = score;
      bestEx = ex;
    }
  }

  if (best >= 0.5 && bestEx) {
    const risk = 0.5 + best * 0.45;
    return hit(
      'Matches spam example library',
      risk,
      `@${bestEx.handle} (${Math.round(best * 100)}% match)`,
      best,
    );
  }
  return null;
}

export function profileToSpamExample(
  profile: AccountProfile,
  categories: import('../types').DetectorId[],
  note?: string,
): Omit<SpamExample, 'id' | 'createdAt'> {
  const posts = profile.postsSample ?? [];
  const repostRatio = posts.length
    ? posts.filter((p) => p.isRepost).length / posts.length
    : undefined;
  const keywords = extractKeywords(profile);

  return {
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    keywords,
    handlePattern: suggestHandlePattern(profile.handle),
    categories,
    postSnippets: posts.slice(0, 5).map((p) => p.text.slice(0, 200)),
    repostRatio,
    joinedText: profile.joinedText,
    note,
  };
}

function extractKeywords(profile: AccountProfile): string[] {
  const words = `${profile.bio ?? ''} ${(profile.postsSample ?? []).map((p) => p.text).join(' ')}`
    .toLowerCase()
    .match(/\b[a-z$#@]{4,}\b/g);
  const freq = new Map<string, number>();
  for (const w of words ?? []) {
    if (w.length < 5) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);
}

function suggestHandlePattern(handle: string): string | undefined {
  if (/\d{6,}$/.test(handle)) return '^[a-zA-Z]+\\d{6,}$';
  if (/lovely|bb$/i.test(handle)) return handle.slice(-6);
  return undefined;
}
