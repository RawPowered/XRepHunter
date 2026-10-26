import type { AccountAnalyticsSnapshot, AccountProfile, PostSample } from '../types';
import { isAnalyticsOperation, normalizeAnalytics } from './analytics-normalizers';

function dig(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function parseJoined(createdAt?: string): { joinedText?: string; joinedAt?: number } {
  if (!createdAt) return {};
  const t = Date.parse(createdAt);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const joinedText = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    return { joinedText, joinedAt: t };
  }
  return { joinedText: createdAt };
}

function extractPosts(timeline: unknown): PostSample[] {
  const instructions = dig(timeline, 'timeline', 'instructions') as unknown[] | undefined;
  if (!Array.isArray(instructions)) return [];

  const posts: PostSample[] = [];
  for (const inst of instructions) {
    const entries = dig(inst, 'entries') as unknown[] | undefined;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const item = dig(entry, 'content', 'itemContent', 'tweet_results', 'result');
      if (!item || typeof item !== 'object') continue;
      const legacy = dig(item, 'legacy') as Record<string, unknown> | undefined;
      const note = dig(item, 'note_tweet', 'note_tweet_results', 'result', 'text') as string | undefined;
      const text = (note ?? legacy?.full_text ?? '') as string;
      if (!text && !legacy) continue;
      const retweeted = legacy?.retweeted_status_result;
      const isRepost = Boolean(retweeted);
      const isQuote = Boolean(legacy?.is_quote_status);
      const entities = legacy?.entities as Record<string, unknown> | undefined;
      const hasMedia = Boolean(
        (entities?.media as unknown[])?.length || (entities?.urls as unknown[])?.length,
      );
      posts.push({ text, isRepost, isQuote, hasMedia });
      if (posts.length >= 20) return posts;
    }
  }
  return posts;
}

export function normalizeUserByScreenName(data: unknown, handle: string): Partial<AccountProfile> | null {
  const user =
    dig(data, 'data', 'user', 'result') ??
    dig(data, 'data', 'user_result', 'result') ??
    dig(data, 'user', 'result');
  if (!user || typeof user !== 'object') return null;

  const legacy = dig(user, 'legacy') as Record<string, unknown> | undefined;
  const core = dig(user, 'core') as Record<string, unknown> | undefined;
  const screenName = (legacy?.screen_name ?? core?.screen_name ?? handle) as string;
  const displayName = (legacy?.name ?? core?.name) as string | undefined;
  const bio = legacy?.description as string | undefined;
  const createdAt = legacy?.created_at as string | undefined;
  const { joinedText, joinedAt } = parseJoined(createdAt);
  const followers = legacy?.followers_count as number | undefined;
  const following = legacy?.friends_count as number | undefined;

  const timeline =
    dig(user, 'timeline', 'timeline') ??
    dig(data, 'data', 'user', 'result', 'timeline_v2', 'timeline');

  return {
    handle: screenName.replace(/^@/, '').toLowerCase(),
    displayName,
    bio,
    joinedText,
    joinedAt,
    followersCount: followers,
    followingCount: following,
    postsSample: extractPosts(timeline),
    source: 'graphql',
  };
}

export function normalizeAboutAccount(data: unknown): Partial<AccountProfile> | null {
  const result =
    dig(data, 'data', 'about_account', 'result') ??
    dig(data, 'data', 'user_about', 'result') ??
    dig(data, 'about_account');
  if (!result || typeof result !== 'object') return null;

  const screenName = (dig(result, 'screen_name') ?? dig(result, 'username')) as string | undefined;
  const location =
    (dig(result, 'account_based_in') as string) ??
    (dig(result, 'location') as string) ??
    (dig(result, 'account_based_in_string') as string);

  const joined =
    (dig(result, 'created_at') as string) ??
    (dig(result, 'join_date') as string) ??
    (dig(result, 'date_joined') as string);

  const usernameChanges =
    (dig(result, 'username_changes_count') as number) ??
    (dig(result, 'username_change_count') as number);

  const connectionSource =
    (dig(result, 'source') as string) ?? (dig(result, 'connection_source') as string);

  const { joinedText, joinedAt } = parseJoined(typeof joined === 'string' ? joined : undefined);

  return {
    handle: screenName?.replace(/^@/, '').toLowerCase() ?? '',
    location: typeof location === 'string' ? location : undefined,
    joinedText,
    joinedAt,
    usernameChanges: typeof usernameChanges === 'number' ? usernameChanges : undefined,
    connectionSource: typeof connectionSource === 'string' ? connectionSource : undefined,
    source: 'graphql',
  };
}

export function parseGraphQLBody(
  url: string,
  body: unknown,
  options?: { defaultHandle?: string },
): {
  kind: 'user' | 'about' | 'timeline' | 'analytics' | 'unknown';
  handle?: string;
  profile?: Partial<AccountProfile>;
  analytics?: AccountAnalyticsSnapshot;
  timelineHandles?: string[];
} {
  const defaultHandle = options?.defaultHandle ?? '';

  if (isAnalyticsOperation(url, body) && defaultHandle) {
    const analytics = normalizeAnalytics(body, defaultHandle);
    if (analytics) {
      return { kind: 'analytics', handle: analytics.handle, analytics };
    }
  }

  const opMatch = url.match(/[?&]op=([^&]+)/) || url.match(/graphql\/([^/]+)/);
  const op = opMatch?.[1]?.toLowerCase() ?? '';

  if (op.includes('userbyscreenname') || op.includes('profile_spotlight')) {
    const vars = extractVariables(body);
    const handle = (vars?.screen_name ?? vars?.screenName ?? '') as string;
    const profile = normalizeUserByScreenName(body, handle);
    return { kind: 'user', handle: profile?.handle ?? handle, profile: profile ?? undefined };
  }

  if ((op.includes('about') || op.includes('account')) && !isAnalyticsOperation(url, body)) {
    const profile = normalizeAboutAccount(body);
    return { kind: 'about', handle: profile?.handle, profile: profile ?? undefined };
  }

  const data = body as Record<string, unknown>;
  if (data?.data && typeof data.data === 'object') {
    const keys = Object.keys(data.data as object).join(' ').toLowerCase();
    if (keys.includes('user')) {
      const vars = extractVariables(body);
      const handle = (vars?.screen_name ?? '') as string;
      const profile = normalizeUserByScreenName(body, handle);
      if (profile?.handle) return { kind: 'user', handle: profile.handle, profile };
    }
    if (keys.includes('about')) {
      const profile = normalizeAboutAccount(body);
      if (profile?.handle) return { kind: 'about', handle: profile.handle, profile };
    }
    if (keys.includes('home') || keys.includes('timeline')) {
      const timelineHandles = extractTimelineAuthorHandles(body);
      if (timelineHandles.length) {
        return { kind: 'timeline', timelineHandles };
      }
    }
  }

  if (op.includes('timeline') || op.includes('tweet')) {
    const timelineHandles = extractTimelineAuthorHandles(body);
    return {
      kind: 'timeline',
      timelineHandles: timelineHandles.length ? timelineHandles : undefined,
    };
  }

  return { kind: 'unknown' };
}

/** Unique screen_names from home/profile timeline GraphQL payloads. */
export function extractTimelineAuthorHandles(body: unknown): string[] {
  const handles = new Set<string>();
  const paths = [
    ['data', 'home', 'home_timeline_urt', 'instructions'],
    ['data', 'home', 'home_timeline', 'instructions'],
    ['data', 'home', 'home_latest_timeline_urt', 'instructions'],
    ['data', 'home', 'home_latest_timeline', 'instructions'],
    ['data', 'bookmark', 'timeline', 'instructions'],
    ['data', 'user', 'result', 'timeline_v2', 'timeline', 'instructions'],
  ];
  for (const path of paths) {
    let cur: unknown = body;
    for (const k of path) {
      if (cur == null || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[k];
    }
    if (Array.isArray(cur)) collectAuthorsFromInstructions(cur, handles);
  }
  return [...handles];
}

function collectAuthorsFromInstructions(instructions: unknown[], handles: Set<string>): void {
  for (const inst of instructions) {
    const entries = dig(inst, 'entries') as unknown[] | undefined;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const item =
        dig(entry, 'content', 'itemContent', 'tweet_results', 'result') ??
        dig(entry, 'content', 'itemContent', 'promotedContent', 'tweet_results', 'result');
      if (!item || typeof item !== 'object') continue;
      const sn =
        (dig(item, 'core', 'user_results', 'result', 'legacy', 'screen_name') as string | undefined) ??
        (dig(item, 'core', 'user_results', 'result', 'core', 'screen_name') as
          | string
          | undefined);
      if (sn) handles.add(sn.replace(/^@/, '').toLowerCase());
    }
  }
}

function extractVariables(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.variables && typeof b.variables === 'object') return b.variables as Record<string, unknown>;
  return null;
}
