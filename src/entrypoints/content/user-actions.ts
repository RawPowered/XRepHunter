import type { AttributionSource } from '../../lib/feed/event-kinds';
import { sendMessage } from '../../lib/messaging';
import {
  getLastFocusedPost,
  resolvePostFromArticle,
  resolvePostFromStatusId,
} from './attention-tracker';
import { safeSend } from './lifecycle';

export const USER_ACTION_EVENT = 'xrephunter-user-action';

const recentClicks = new Map<string, number>();
const CLICK_DEDUPE_MS = 2000;

type UserActionKind = 'like' | 'repost' | 'reply' | 'quote';

function sendUserAction(
  kind: UserActionKind,
  post?: { postFingerprint: string; handle: string; statusId?: string },
  attributionSource?: AttributionSource,
): void {
  safeSend(
    sendMessage({
      type: 'RECORD_USER_ACTION',
      kind,
      postFingerprint: post?.postFingerprint,
      handle: post?.handle,
      statusId: post?.statusId,
      attributionSource,
    }),
  );
}

function resolvePostFromEventDetail(detail: {
  statusId?: string;
}): {
  post: { postFingerprint: string; handle: string; statusId?: string } | null;
  attributionSource?: AttributionSource;
} {
  if (detail.statusId) {
    const fromStatus = resolvePostFromStatusId(detail.statusId);
    if (fromStatus) return { post: fromStatus, attributionSource: 'statusId' };
  }
  const last = getLastFocusedPost();
  if (last) return { post: last, attributionSource: 'lastFocused' };
  return { post: null };
}

export function initUserActionTracking(): void {
  window.addEventListener(USER_ACTION_EVENT, ((e: CustomEvent) => {
    const kind = e.detail?.kind as UserActionKind | undefined;
    if (!kind) return;
    const { post, attributionSource } = resolvePostFromEventDetail(e.detail ?? {});
    sendUserAction(kind, post ?? undefined, attributionSource);
  }) as EventListener);

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest(
        '[data-testid="like"], [data-testid="unlike"], [data-testid="retweet"], [data-testid="reply"]',
      );
      if (!btn) return;
      const testId = btn.getAttribute('data-testid');
      let kind: 'like' | 'repost' | 'reply' | null = null;
      if (testId === 'like') kind = 'like';
      else if (testId === 'retweet') kind = 'repost';
      else if (testId === 'reply') kind = 'reply';
      if (!kind) return;
      const article = btn.closest('article');
      const fp = `${article?.getAttribute('data-testid') ?? 't'}-${kind}`;
      const now = Date.now();
      const last = recentClicks.get(fp);
      if (last != null && now - last < CLICK_DEDUPE_MS) return;
      recentClicks.set(fp, now);
      const post = article ? resolvePostFromArticle(article as HTMLElement) : null;
      sendUserAction(kind, post ?? undefined, post ? 'article' : undefined);
    },
    true,
  );
}
