import type { AccountProfile } from '../types';

const MIN_LEN = 12;

function qualifies(text: string): boolean {
  return text.trim().length >= MIN_LEN;
}

export function buildToxicityTextForProfile(profile: AccountProfile, maxLen = 2000): string {
  const parts: string[] = [];
  if (profile.bio?.trim()) parts.push(profile.bio.trim());
  const posts = [...(profile.postsSample ?? [])]
    .filter((p) => qualifies(p.text))
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 8);
  for (const p of posts) parts.push(p.text.trim());
  return parts.join('\n\n').slice(0, maxLen);
}
