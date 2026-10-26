import type { AccountAnalyticsSnapshot, TweetAnalytics } from '../types';
import { normalizeHandle } from '../types';

function dig(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

const ANALYTICS_OP_RE =
  /analytics|accountoverview|creator|organic|impression|engagement|tweetdetail|tweetresult|metric|insight/i;

const METRIC_KEYS: Record<string, keyof AccountAnalyticsSnapshot | keyof TweetAnalytics> = {
  impression_count: 'impressions',
  impressions: 'impressions',
  impression: 'impressions',
  engagements: 'engagements',
  engagement_count: 'engagements',
  total_engagements: 'engagements',
  profile_visits: 'profileVisits',
  profile_visit_count: 'profileVisits',
  mentions: 'mentions',
  mention_count: 'mentions',
  new_followers: 'newFollowers',
  followers_gained: 'newFollowers',
  like_count: 'likes',
  likes: 'likes',
  favorite_count: 'likes',
  retweet_count: 'reposts',
  repost_count: 'reposts',
  reply_count: 'replies',
  replies: 'replies',
  url_link_clicks: 'linkClicks',
  link_clicks: 'linkClicks',
};

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10);
  return undefined;
}

function extractTweetId(obj: Record<string, unknown>): string | undefined {
  const id =
    obj.rest_id ??
    obj.id_str ??
    obj.id ??
    dig(obj, 'tweet', 'rest_id') ??
    dig(obj, 'legacy', 'id_str');
  return id != null ? String(id) : undefined;
}

function walkMetrics(
  node: unknown,
  account: Partial<AccountAnalyticsSnapshot>,
  tweets: Map<string, TweetAnalytics>,
  depth = 0,
): void {
  if (depth > 12 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkMetrics(item, account, tweets, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;

  const o = node as Record<string, unknown>;
  const tweetId = extractTweetId(o);
  const legacy = o.legacy as Record<string, unknown> | undefined;
  const text =
    (o.full_text as string) ??
    (legacy?.full_text as string) ??
    (dig(o, 'note_tweet', 'note_tweet_results', 'result', 'text') as string);

  let tweet: TweetAnalytics | undefined;
  if (tweetId) {
    tweet = tweets.get(tweetId) ?? {
      tweetId,
      textPreview: text?.slice(0, 120),
      capturedAt: Date.now(),
    };
    tweets.set(tweetId, tweet);
  }

  for (const [key, val] of Object.entries(o)) {
    const lk = key.toLowerCase();
    const mapped = METRIC_KEYS[lk];
    if (mapped && typeof val !== 'object') {
      const n = num(val);
      if (n == null) continue;
      if (tweet && mapped in tweet) {
        (tweet as Record<string, number>)[mapped] = n;
      } else if (mapped in account) {
        (account as Record<string, number>)[mapped as string] =
          Math.max((account as Record<string, number>)[mapped as string] ?? 0, n);
      }
    }
  }

  if (tweet) {
    const imp = tweet.impressions;
    const eng = tweet.engagements ?? (tweet.likes ?? 0) + (tweet.reposts ?? 0) + (tweet.replies ?? 0);
    if (imp && imp > 0 && eng > 0) {
      tweet.engagements = eng;
      tweet.engagementRate = (eng / imp) * 100;
    }
  }

  for (const val of Object.values(o)) {
    if (val && typeof val === 'object') walkMetrics(val, account, tweets, depth + 1);
  }
}

export function isAnalyticsOperation(url: string, body: unknown): boolean {
  const opMatch = url.match(/[?&]op=([^&]+)/i) || url.match(/graphql\/([^/?]+)/i);
  const op = (opMatch?.[1] ?? '').toLowerCase();
  if (ANALYTICS_OP_RE.test(op) || ANALYTICS_OP_RE.test(url)) return true;

  const data = body as Record<string, unknown>;
  if (!data?.data || typeof data.data !== 'object') return false;
  const keys = Object.keys(data.data as object).join(' ').toLowerCase();
  return ANALYTICS_OP_RE.test(keys);
}

export function normalizeAnalytics(
  body: unknown,
  defaultHandle: string,
): AccountAnalyticsSnapshot | null {
  if (!body || typeof body !== 'object') return null;

  const account: Partial<AccountAnalyticsSnapshot> = {
    handle: normalizeHandle(defaultHandle),
    capturedAt: Date.now(),
    source: 'graphql',
  };
  const tweets = new Map<string, TweetAnalytics>();

  walkMetrics(body, account, tweets);

  const hasAccountMetrics =
    account.impressions != null ||
    account.engagements != null ||
    account.profileVisits != null ||
    tweets.size > 0;

  if (!hasAccountMetrics) return null;

  if (account.engagements == null && tweets.size > 0) {
    let sum = 0;
    for (const t of tweets.values()) {
      sum += t.engagements ?? (t.likes ?? 0) + (t.reposts ?? 0) + (t.replies ?? 0);
    }
    if (sum > 0) account.engagements = sum;
  }

  if (account.impressions == null && tweets.size > 0) {
    let sum = 0;
    for (const t of tweets.values()) {
      sum += t.impressions ?? 0;
    }
    if (sum > 0) account.impressions = sum;
  }

  return {
    handle: account.handle!,
    periodLabel: account.periodLabel,
    impressions: account.impressions,
    engagements: account.engagements,
    profileVisits: account.profileVisits,
    mentions: account.mentions,
    newFollowers: account.newFollowers,
    tweets: [...tweets.values()].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0)),
    capturedAt: account.capturedAt!,
    source: 'graphql',
  };
}

export function scrapeAnalyticsFromDom(handle: string): AccountAnalyticsSnapshot | null {
  const text = document.body?.innerText ?? '';
  const impressions = text.match(/([\d,]+)\s*impressions?/i);
  const engagements = text.match(/([\d,]+)\s*engagements?/i);
  const visits = text.match(/([\d,]+)\s*profile\s*visits?/i);

  const imp = impressions ? parseInt(impressions[1].replace(/,/g, ''), 10) : undefined;
  const eng = engagements ? parseInt(engagements[1].replace(/,/g, ''), 10) : undefined;
  const pv = visits ? parseInt(visits[1].replace(/,/g, ''), 10) : undefined;

  if (!imp && !eng && !pv) return null;

  return {
    handle: normalizeHandle(handle),
    impressions: imp,
    engagements: eng,
    profileVisits: pv,
    capturedAt: Date.now(),
    source: 'dom',
  };
}

export const ANALYTICS_PATH_PREFIXES = [
  '/i/account_analytics',
  '/i/creator_studio',
  '/i/creators',
  '/i/insights',
  '/i/account_analytics/',
];

export function isAnalyticsPage(pathname: string): boolean {
  return ANALYTICS_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}
