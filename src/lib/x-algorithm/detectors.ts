import type { AccountProfile, DetectorHit, DetectorId } from '../types';
import { enrichHitWithXRules } from './rules';

const VF_SPAM_RE =
  /\b(casino|viagra|giveaway|free money|click here|100% free|guaranteed profit|hack dm|telegram\.me|t\.me\/)\b/i;
const VF_VIOLENCE_RE = /\b(kill|murder|gore|nsfw|blood|genocide)\b/i;
const NEGATIVE_ENGAGEMENT_RE =
  /\b(follow for follow|f4f|follow back|unfollow|click link|subscribe now|you won't believe|limited slots)\b/i;

function hit(id: DetectorId, label: string, risk: number, detail?: string): DetectorHit {
  return enrichHitWithXRules({ id, label, risk, detail });
}

/** VFFilter — spam / policy approximations (Grox-aligned) */
export function detectXVisibility(profile: AccountProfile): DetectorHit | null {
  const blob = `${profile.bio ?? ''} ${(profile.postsSample ?? []).map((p) => p.text).join(' ')}`;
  if (VF_SPAM_RE.test(blob)) {
    return hit('xVisibility', 'X VF: spam / promotion patterns', 0.82);
  }
  if (VF_VIOLENCE_RE.test(blob)) {
    return hit('xVisibility', 'X VF: violence / NSFW language', 0.9);
  }
  return null;
}

/** RepostDeduplicationFilter + DropDuplicatesFilter */
export function detectXRepostDedup(profile: AccountProfile): DetectorHit | null {
  const posts = profile.postsSample ?? [];
  if (posts.length < 4) return null;

  const normalized = posts.map((p) => p.text.replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase());
  const unique = new Set(normalized.filter((t) => t.length > 20));
  if (unique.size <= 1 && posts.length >= 4) {
    return hit('xRepostDedup', 'X: duplicate / recycled post text', 0.8, `${posts.length} similar posts`);
  }

  const repostTexts = posts.filter((p) => p.isRepost).map((p) => p.text.slice(0, 80));
  const dupReposts = repostTexts.length - new Set(repostTexts).size;
  if (dupReposts >= 2) {
    return hit('xRepostDedup', 'X: repeated repost content', 0.7, `${dupReposts} dupes`);
  }
  return null;
}

/** AuthorDiversityScorer — monoculture output (one topic/format only) */
export function detectXAuthorMonoculture(profile: AccountProfile): DetectorHit | null {
  const posts = profile.postsSample ?? [];
  if (posts.length < 6) return null;
  const allRepost = posts.every((p) => p.isRepost || p.isQuote);
  const allMedia = posts.every((p) => p.hasMedia);
  if (allRepost) return hit('xAuthorMonoculture', 'X diversity: repost-only author', 0.75);
  if (allMedia && posts.every((p) => p.text.length < 50)) {
    return hit('xAuthorMonoculture', 'X diversity: media-only, low-text feed', 0.55);
  }
  return null;
}

/** P(block|mute|report|not_interested) heuristics */
export function detectXNegativeEngagement(profile: AccountProfile): DetectorHit | null {
  const blob = `${profile.bio ?? ''} ${(profile.postsSample ?? []).map((p) => p.text).join(' ')}`;
  const matches = blob.match(new RegExp(NEGATIVE_ENGAGEMENT_RE.source, 'gi'));
  if (matches && matches.length >= 2) {
    return hit(
      'xNegativeEngagement',
      'X scoring: high block/mute/report signals',
      0.72,
      `${matches.length} patterns`,
    );
  }
  if (/\bfollow\b.*\bfollow\b/i.test(blob)) {
    return hit('xNegativeEngagement', 'X scoring: follow-churn CTA pattern', 0.6);
  }
  return null;
}

/** Organic trust — inverse of spam growth patterns (P_follow_author) */
export function detectXOrganicTrust(profile: AccountProfile): DetectorHit | null {
  const followers = profile.followersCount;
  const following = profile.followingCount;
  if (followers == null || following == null || following < 100) return null;

  const ratio = following / Math.max(followers, 1);
  if (ratio > 15 && followers < 500) {
    return hit(
      'xOrganicTrust',
      'X: low trust ratio (following >> followers)',
      0.65,
      `${following}/${followers}`,
    );
  }
  return null;
}

/** AgeFilter proxy — burst of only very new-looking activity */
export function detectXStaleBurst(profile: AccountProfile): DetectorHit | null {
  if (!profile.joinedAt) return null;
  const ageDays = (Date.now() - profile.joinedAt) / 86400000;
  const posts = profile.postsSample ?? [];
  if (ageDays < 30 && posts.length >= 8) {
    const repostRatio = posts.filter((p) => p.isRepost).length / posts.length;
    if (repostRatio > 0.7) {
      return hit('xStaleBurst', 'X AgeFilter: new account + high-volume reposts', 0.78);
    }
  }
  return null;
}

export function runXAlgorithmDetectors(profile: AccountProfile): DetectorHit[] {
  const fns = [
    detectXVisibility,
    detectXRepostDedup,
    detectXAuthorMonoculture,
    detectXNegativeEngagement,
    detectXOrganicTrust,
    detectXStaleBurst,
  ];
  const hits: DetectorHit[] = [];
  for (const fn of fns) {
    const h = fn(profile);
    if (h) hits.push(h);
  }
  return hits;
}
