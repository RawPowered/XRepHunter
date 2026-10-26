import { buildSlopTextFromArticle, extractTweetMedia } from '../slop/extract-tweet-content';

/** Selector map version — bump when X DOM shifts */
export const SELECTOR_VERSION = '2026-05-statsbar';

export const SELECTORS = {
  userName: '[data-testid="UserName"]',
  userDescription: '[data-testid="UserDescription"]',
  primaryColumn: '[data-testid="primaryColumn"]',
  tweet: 'article[data-testid="tweet"], article[role="article"]',
  cellInnerDiv: '[data-testid="cellInnerDiv"]',
  userCell: '[data-testid="UserCell"]',
  conversation: '[data-testid="conversation"]',
  profileHeader: '[data-testid="UserProfileHeader_Items"]',
  reply: '[data-testid="reply"]',
  retweet: '[data-testid="retweet"]',
  like: '[data-testid="like"]',
  bookmark: '[data-testid="bookmark"]',
} as const;

export interface TweetActionBarTarget {
  group: HTMLElement;
  insertBefore: HTMLElement | null;
}

/** Action row for reply/like/bookmark; insert stats badges before bookmark when possible. */
export function findTweetActionBar(article: HTMLElement): TweetActionBarTarget | null {
  const anchor =
    article.querySelector(SELECTORS.reply) ??
    article.querySelector(SELECTORS.retweet) ??
    article.querySelector(SELECTORS.like);

  let group = anchor?.closest('[role="group"]') as HTMLElement | null;
  if (!group) {
    const groups = article.querySelectorAll('[role="group"]');
    if (groups.length) group = groups[groups.length - 1] as HTMLElement;
  }
  if (!group) return null;

  const bookmark = group.querySelector(SELECTORS.bookmark) as HTMLElement | null;
  return { group, insertBefore: bookmark };
}

export function insertIntoTweetActionBar(target: TweetActionBarTarget, node: HTMLElement): void {
  const parent = target.insertBefore?.parentElement ?? target.group;
  if (target.insertBefore && parent.contains(target.insertBefore)) {
    parent.insertBefore(node, target.insertBefore);
  } else {
    target.group.appendChild(node);
  }
}

const HANDLE_PATH_RE = /^\/([A-Za-z0-9_]{1,15})(?:\/|$)/;
const STATUS_PATH_RE = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/;

const RESERVED_HANDLES = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'i',
  'search',
  'settings',
  'compose',
  'hashtag',
]);

function parseHandleFromPath(href: string): string | null {
  const m = href.match(HANDLE_PATH_RE);
  if (!m || RESERVED_HANDLES.has(m[1].toLowerCase())) return null;
  return m[1].toLowerCase();
}

/** Tweet status id from /handle/status/123 links when present. */
export function extractTweetStatusId(article: Element): string | undefined {
  for (const a of article.querySelectorAll('a[href*="/status/"]')) {
    const href = a.getAttribute('href') ?? '';
    const m = href.match(/\/status\/(\d+)/);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * Primary author for a timeline tweet card (not @mentions in body).
 * Prefers User-Name link, then status URL author, then first profile link.
 */
export function queryTweetArticles(root: ParentNode = document): HTMLElement[] {
  const nodes = root.querySelectorAll(SELECTORS.tweet);
  return [...nodes] as HTMLElement[];
}

export function extractTweetAuthorHandle(article: HTMLElement): string | null {
  const userNameRoot =
    article.querySelector(':scope [data-testid="User-Name"]') ??
    article.querySelector('[data-testid="User-Name"]') ??
    article.querySelector(':scope [data-testid="UserName"]') ??
    article.querySelector('[data-testid="UserName"]');
  const userNameLink =
    userNameRoot?.querySelector('a[href^="/"]') ??
    article.querySelector('a[href^="/"][role="link"]');
  if (userNameLink) {
    const h = parseHandleFromPath(userNameLink.getAttribute('href') ?? '');
    if (h) return h;
  }

  for (const a of article.querySelectorAll('a[href*="/status/"]')) {
    const href = a.getAttribute('href') ?? '';
    const m = href.match(STATUS_PATH_RE);
    if (m && !RESERVED_HANDLES.has(m[1].toLowerCase())) return m[1].toLowerCase();
  }

  const link = article.querySelector('a[href^="/"]');
  return parseHandleFromPath(link?.getAttribute('href') ?? '');
}

/** Insert stats host when action bar is not yet in DOM. */
export function insertTweetStatsFallback(article: HTMLElement, node: HTMLElement): void {
  const textEl = article.querySelector('[data-testid="tweetText"]');
  if (textEl?.parentElement) {
    const parent = textEl.parentElement;
    if (textEl.nextSibling) parent.insertBefore(node, textEl.nextSibling);
    else parent.appendChild(node);
    return;
  }
  article.appendChild(node);
}

export function findProfileHandleFromUrl(): string | null {
  const m = location.pathname.match(/^\/([^/?#]+)/);
  if (!m) return null;
  const seg = m[1].toLowerCase();
  const reserved = new Set([
    'home',
    'explore',
    'notifications',
    'messages',
    'i',
    'search',
    'settings',
    'compose',
  ]);
  if (reserved.has(seg)) return null;
  return seg;
}

export function parseJoinedFromText(text: string): { joinedText?: string; joinedAt?: number } {
  const joinedMatch = text.match(
    /joined\s+([A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  );
  if (!joinedMatch) return {};
  const joinedText = joinedMatch[1];
  const t = Date.parse(joinedText);
  return { joinedText, joinedAt: Number.isNaN(t) ? undefined : t };
}

export function scrapeAboutFromDom(): Partial<import('../types').AccountProfile> {
  const bodyText = document.body.innerText;
  const joined = parseJoinedFromText(bodyText);
  const locationMatch = bodyText.match(/account based in[:\s]*([^\n]+)/i);
  const changesMatch = bodyText.match(/(\d+)\s+username change/i);
  const connectionMatch = bodyText.match(/connected via[:\s]*([^\n]+)/i);

  return {
    joinedText: joined.joinedText,
    joinedAt: joined.joinedAt,
    location: locationMatch?.[1]?.trim(),
    usernameChanges: changesMatch ? parseInt(changesMatch[1], 10) : undefined,
    connectionSource: connectionMatch?.[1]?.trim(),
    source: 'dom',
  };
}

export function extractTweetText(article: Element): string {
  const el = article.querySelector('[data-testid="tweetText"]');
  return el?.textContent?.trim() ?? '';
}

export { buildSlopTextFromArticle, extractTweetMedia } from '../slop/extract-tweet-content';

import { articleHasCommunityNote } from './community-note';
import { scoreTextHeuristicDetailed } from '../detectors/ai-slop';
import { scoreTweetSpamHeuristic } from '../detectors/tweet-spam';

export function scrapeProfileFromDom(handle: string): Partial<import('../types').AccountProfile> {
  const userName = document.querySelector(SELECTORS.userName);
  const displayName = userName?.querySelector('span span')?.textContent?.trim();
  const bioEl = document.querySelector(SELECTORS.userDescription);
  const bio = bioEl?.textContent?.trim();
  const headerText = document.querySelector(SELECTORS.profileHeader)?.textContent ?? '';
  const joined = parseJoinedFromText(headerText + ' ' + document.body.innerText.slice(0, 5000));

  const posts: import('../types').PostSample[] = [];
  document.querySelectorAll(SELECTORS.tweet).forEach((el, i) => {
    if (i >= 60) return;
    const text = buildSlopTextFromArticle(el).slice(0, 500);
    if (!text) return;
    const isRepost = /reposted/i.test(el.textContent?.slice(0, 80) ?? '');
    const mediaInfo = extractTweetMedia(el);
    const hasMedia = mediaInfo.hasPhoto || mediaInfo.hasCard || mediaInfo.hasVideo;
    const { score: slopScore } = scoreTextHeuristicDetailed(text);
    const { score: spamScore } = scoreTweetSpamHeuristic(text);
    posts.push({
      text,
      isRepost,
      isQuote: false,
      hasMedia,
      imageUrl: mediaInfo.imageUrl,
      hasCommunityNote: articleHasCommunityNote(el),
      slopScore,
      spamScore,
    });
  });

  return {
    handle: handle.toLowerCase(),
    displayName,
    bio,
    ...joined,
    postsSample: posts,
    source: 'dom',
  };
}

export function extractHandlesFromPage(): string[] {
  const handles = new Set<string>();
  document.querySelectorAll('a[href^="/"]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    const m = href.match(/^\/([A-Za-z0-9_]{1,15})(?:\/|$)/);
    if (m && !['home', 'explore', 'i', 'search', 'hashtag'].includes(m[1].toLowerCase())) {
      handles.add(m[1].toLowerCase());
    }
  });
  return [...handles];
}
