import type { SlopAnalysis } from '../types';

const AI_LABEL_RE = /ai|generated|synthetic|fake/i;

/** True when CLIP image slop should show the on-photo AI badge. */
export function isAiGeneratedImage(
  slop: SlopAnalysis | null,
  threshold: number,
  userMarked?: boolean,
): boolean {
  if (userMarked) return true;
  if (!slop) return false;
  if (slop.imageLabel === 'user_marked_ai') return true;
  if (slop.signals?.includes('user_marked_ai')) return true;
  if (slop.image != null && slop.image >= threshold) return true;
  if (slop.imageLabel && AI_LABEL_RE.test(slop.imageLabel)) return true;
  return false;
}

export function formatAiImageTooltip(slop: SlopAnalysis, userMarked?: boolean): string {
  if (userMarked || slop.imageLabel === 'user_marked_ai') {
    return `You marked this image as AI (slop ${slop.image ?? '—'}). Counts toward @author slop.`;
  }
  const score = slop.image ?? '—';
  const label = slop.imageLabel ?? 'unknown';
  return `Image ML: ${score} (${label})`;
}
