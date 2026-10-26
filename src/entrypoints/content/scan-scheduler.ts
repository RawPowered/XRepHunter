import { sendMessage } from '../../lib/messaging';
import { safeSend } from './lifecycle';
import { prefetchScores } from './score-cache';
import {
  extractHandlesFromPage,
  extractTweetAuthorHandle,
  findProfileHandleFromUrl,
  queryTweetArticles,
  scrapeAboutFromDom,
  scrapeProfileFromDom,
  SELECTORS,
} from '../../lib/x-dom/selectors';
import { getContentSettings } from './settings-cache';
import { resetContentScriptLifecycle } from './lifecycle';
import { isAnalyticsPage, scrapeAnalyticsFromDom } from '../../lib/x-api/analytics-normalizers';
import { cs, setPrimaryAccount } from './state';
import { observePostAttention } from './attention-tracker';
import { reattachTweetsForHandle, scheduleAttachTweet } from './tweet-attach';
import { injectProfileBadge, scanAndBadge } from './profile-ui';

export function trackPendingHandle(h: string): void {
  cs.pendingHandles.add(h);
  const prev = cs.pendingHandleTimers.get(h);
  if (prev) window.clearTimeout(prev);
  cs.pendingHandleTimers.set(
    h,
    window.setTimeout(() => {
      cs.pendingHandles.delete(h);
      cs.pendingHandleTimers.delete(h);
    }, cs.PENDING_HANDLE_TIMEOUT_MS),
  );
}

export function releasePendingHandle(h: string): void {
  cs.pendingHandles.delete(h);
  const t = cs.pendingHandleTimers.get(h);
  if (t) window.clearTimeout(t);
  cs.pendingHandleTimers.delete(h);
}

function ensureTweetObserver(): IntersectionObserver {
  if (cs.tweetIo) return cs.tweetIo;
  cs.tweetIo = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const handle = el.dataset.xrhAuthor ?? extractTweetAuthorHandle(el);
        if (!handle) continue;
        el.dataset.xrhAuthor = handle;
        scheduleAttachTweet(el, handle);
      }
    },
    { rootMargin: '200px' },
  );
  return cs.tweetIo;
}

export function observeTweetArticle(article: HTMLElement): void {
  const handle = extractTweetAuthorHandle(article);
  if (!handle) return;
  article.dataset.xrhAuthor = handle;
  observePostAttention(article);
  ensureTweetObserver().observe(article);
  const rect = article.getBoundingClientRect();
  const inView = rect.top < window.innerHeight + 220 && rect.bottom > -220;
  if (inView) scheduleAttachTweet(article, handle);
}

export async function loadPrimaryAccount(): Promise<void> {
  setPrimaryAccount(
    await sendMessage<import('../../lib/types').PrimaryAccount | undefined>({
      type: 'GET_PRIMARY_ACCOUNT',
    }),
  );
}

export function scheduleAnalyticsDomScrape(): void {
  const primary = cs.primaryAccount;
  if (!primary?.handle || !isAnalyticsPage(location.pathname)) return;
  if (cs.analyticsDomTimer) window.clearTimeout(cs.analyticsDomTimer);
  cs.analyticsDomTimer = window.setTimeout(() => {
    const snap = scrapeAnalyticsFromDom(primary!.handle);
    if (snap) void sendMessage({ type: 'ANALYTICS_PAYLOAD', snapshot: snap });
  }, 1500);
}

export async function bootstrap(): Promise<void> {
  resetContentScriptLifecycle();
  const settings = await getContentSettings();
  if (!settings.enabled) return;
  try {
    await loadPrimaryAccount();
  } catch {
    /* background waking up */
  }
  scheduleAnalyticsDomScrape();

  const path = location.pathname;
  if (path.endsWith('/about')) {
    const handle = findProfileHandleFromUrl();
    if (handle) void scanAndBadge(handle, scrapeAboutFromDom());
  }

  const profileHandle = findProfileHandleFromUrl();
  if (profileHandle && !path.endsWith('/about')) {
    void scanAndBadge(profileHandle, scrapeProfileFromDom(profileHandle));
    injectProfileBadge(profileHandle, profileHandle === cs.primaryAccount?.handle);
  }

  scheduleScan();
}

function scheduleProfileRescan(): void {
  const handle = findProfileHandleFromUrl();
  if (!handle || location.pathname.endsWith('/about')) return;
  if (cs.profileRescanTimer) window.clearTimeout(cs.profileRescanTimer);
  cs.profileRescanTimer = window.setTimeout(() => {
    cs.profileRescanTimer = null;
    const now = Date.now();
    const visible = document.querySelectorAll(SELECTORS.tweet).length;
    const tweetGrowth = visible > cs.lastProfileVisibleTweets;
    cs.lastProfileVisibleTweets = visible;
    if (!tweetGrowth && now - cs.lastProfileRescanAt < 5000) return;
    cs.lastProfileRescanAt = now;
    void scanAndBadge(handle, scrapeProfileFromDom(handle));
  }, 800);
}

export function scheduleScan(): void {
  if (cs.debounceTimer) window.clearTimeout(cs.debounceTimer);
  cs.debounceTimer = window.setTimeout(() => void scanVisibleHandles(), 400);
  scheduleProfileRescan();
}

export async function scanVisibleHandles(): Promise<void> {
  const settings = await getContentSettings();
  if (!settings.enabled) return;

  const priority: string[] = [];
  const seen = new Set<string>();
  const addHandle = (h: string | null | undefined) => {
    if (!h || seen.has(h)) return;
    seen.add(h);
    priority.push(h);
  };

  queryTweetArticles().forEach((el) => {
    observeTweetArticle(el);
    addHandle(extractTweetAuthorHandle(el));
  });

  addHandle(findProfileHandleFromUrl());
  for (const h of extractHandlesFromPage()) addHandle(h);

  const batch = priority.slice(0, cs.MAX_DISCOVER_HANDLES);
  await prefetchScores(batch);

  for (const h of batch) {
    safeSend(sendMessage({ type: 'ENSURE_ACCOUNT_SCANNED', handle: h }));
    if (cs.pendingHandles.has(h)) continue;
    trackPendingHandle(h);
    const cached = cs.scoreCache.get(h);
    const work = cached ? Promise.resolve(reattachTweetsForHandle(h, cached)) : scanAndBadge(h);
    void work.finally(() => {
      releasePendingHandle(h);
      cs.scannedThisPage.add(h);
    });
  }
}
