import type { AccountPostRollups } from '../db/repositories/accounts';
import type { DetectorHit, ExtensionSettings } from '../types';
import { enrichHitWithXRules } from '../x-algorithm/rules';

function hit(id: 'communityNotes' | 'postSpamSignals', label: string, risk: number, detail?: string): DetectorHit {
  return enrichHitWithXRules({ id, label, risk, detail });
}

export function computePostSignalsRisk(
  rollups: AccountPostRollups | null,
  settings: ExtensionSettings,
): number {
  if (!rollups || rollups.postsAnalyzed < 1) return 0;
  let risk = 0;
  if (rollups.noteRate >= 0.2) risk = Math.max(risk, 0.75);
  else if (rollups.noteRate >= 0.08) risk = Math.max(risk, 0.5);
  else if (rollups.postsWithNote >= 1) risk = Math.max(risk, 0.35);

  const spamThresh = settings.spamDisplayThreshold ?? 40;
  if (rollups.maxPostSpam >= spamThresh + 25) risk = Math.max(risk, 0.7);
  else if (rollups.avgPostSpam >= spamThresh) risk = Math.max(risk, 0.55);
  else if (rollups.maxPostSpam >= spamThresh) risk = Math.max(risk, 0.4);

  const slopThresh = settings.slopDisplayThreshold ?? 55;
  if (rollups.maxPostSlop >= slopThresh + 20) risk = Math.max(risk, 0.65);
  else if (rollups.avgPostSlop >= slopThresh) risk = Math.max(risk, 0.5);

  const toxThresh = settings.toxicityDisplayThreshold ?? 45;
  if (rollups.maxPostToxicity >= toxThresh + 25) risk = Math.max(risk, 0.7);
  else if (rollups.avgPostToxicity >= toxThresh) risk = Math.max(risk, 0.55);

  return Math.min(1, risk);
}

export function detectCommunityNotes(rollups: AccountPostRollups | null): DetectorHit | null {
  if (!rollups?.postsWithNote) return null;
  if (rollups.noteRate >= 0.15) {
    return hit(
      'communityNotes',
      'Community Notes on posts',
      0.8,
      `${rollups.postsWithNote}/${rollups.postsAnalyzed} posts (${Math.round(rollups.noteRate * 100)}%)`,
    );
  }
  if (rollups.postsWithNote >= 1) {
    return hit(
      'communityNotes',
      'Community Note observed',
      0.45,
      `${rollups.postsWithNote} post(s)`,
    );
  }
  return null;
}

export function detectPostSpamSignals(rollups: AccountPostRollups | null): DetectorHit | null {
  if (!rollups || rollups.postsAnalyzed < 2) return null;
  if (rollups.maxPostSpam >= 70 || rollups.avgPostSpam >= 55) {
    return hit(
      'postSpamSignals',
      'High per-post spam signals',
      0.7,
      `avg ${Math.round(rollups.avgPostSpam)} max ${rollups.maxPostSpam}`,
    );
  }
  if (rollups.maxPostSpam >= 50 || rollups.avgPostSpam >= 45) {
    return hit(
      'postSpamSignals',
      'Elevated per-post spam',
      0.5,
      `avg ${Math.round(rollups.avgPostSpam)} max ${rollups.maxPostSpam}`,
    );
  }
  if (rollups.maxPostSlop >= 75 || rollups.maxPostToxicity >= 70) {
    return hit(
      'postSpamSignals',
      'Risky slop/toxicity on posts',
      0.55,
      `slop max ${rollups.maxPostSlop} tox max ${rollups.maxPostToxicity}`,
    );
  }
  return null;
}

export function postSignalHits(rollups: AccountPostRollups | null): DetectorHit[] {
  const hits: DetectorHit[] = [];
  const cn = detectCommunityNotes(rollups);
  if (cn) hits.push(cn);
  const ps = detectPostSpamSignals(rollups);
  if (ps) hits.push(ps);
  return hits;
}
