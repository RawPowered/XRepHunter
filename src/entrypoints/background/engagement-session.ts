import { emptyUserActions, type UserActionsSnapshot } from '../../lib/db/repositories/user-actions';

let sessionActions = emptyUserActions();
const lastActionAt = new Map<string, number>();
const DEDUPE_MS = 800;

export function shouldRecordUserAction(kind: string): boolean {
  const now = Date.now();
  const last = lastActionAt.get(kind) ?? 0;
  if (now - last < DEDUPE_MS) return false;
  lastActionAt.set(kind, now);
  return true;
}

export function recordSessionUserAction(kind: 'like' | 'repost' | 'reply' | 'quote'): void {
  if (kind === 'like') sessionActions = { ...sessionActions, likes: sessionActions.likes + 1 };
  else if (kind === 'repost') sessionActions = { ...sessionActions, reposts: sessionActions.reposts + 1 };
  else if (kind === 'reply') sessionActions = { ...sessionActions, replies: sessionActions.replies + 1 };
  else sessionActions = { ...sessionActions, quotes: sessionActions.quotes + 1 };
}

export function resetSessionUserActions(): void {
  sessionActions = emptyUserActions();
  lastActionAt.clear();
}

export function getSessionUserActions(): UserActionsSnapshot {
  return sessionActions;
}
