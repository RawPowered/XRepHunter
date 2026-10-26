export type FeedSurface =
  | 'for_you'
  | 'following'
  | 'profile'
  | 'search'
  | 'notifications'
  | 'unknown';

export const FEED_SURFACE_LABELS: Record<FeedSurface, string> = {
  for_you: 'For You',
  following: 'Following',
  profile: 'Profile',
  search: 'Search',
  notifications: 'Notifications',
  unknown: 'Unknown',
};

/** Detect feed surface from current X URL path. */
export function detectFeedSurface(pathname = typeof location !== 'undefined' ? location.pathname : ''): FeedSurface {
  const path = pathname.toLowerCase();
  if (path === '/home' || path === '/' || path.startsWith('/home/')) return 'for_you';
  if (path.includes('/following')) return 'following';
  if (path.includes('/notifications')) return 'notifications';
  if (path.includes('/search')) return 'search';
  if (/^\/[^/]+(\/(with_replies|media|likes|highlights|superfollows|analytics|about))?$/.test(path)) {
    return 'profile';
  }
  return 'unknown';
}

export type MediaType = 'text' | 'image' | 'video' | 'card';

export function inferMediaType(media: {
  hasVideo?: boolean;
  hasCard?: boolean;
  hasPhoto?: boolean;
}): MediaType {
  if (media.hasVideo) return 'video';
  if (media.hasCard) return 'card';
  if (media.hasPhoto) return 'image';
  return 'text';
}
