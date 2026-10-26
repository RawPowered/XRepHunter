import type { TweetMediaInfo } from './extract-tweet-content';

/** Boost slop when promo text pairs with card/photo (0–100). */
export function scoreMediaHeuristic(
  media: TweetMediaInfo,
  textPromoScore: number,
): { boost: number; signals: string[] } {
  const signals: string[] = [];
  if (!media.hasPhoto && !media.hasCard && !media.hasVideo) {
    return { boost: 0, signals };
  }
  if (media.hasCard) signals.push('link_card');
  if (media.hasPhoto) signals.push('tweet_photo');
  if (media.hasVideo) signals.push('tweet_video');

  let boost = 0;
  if (textPromoScore >= 40 && (media.hasCard || media.hasPhoto)) {
    boost = Math.min(85, 35 + textPromoScore * 0.5);
    signals.push('promo_media');
  } else if (media.hasCard && media.cardTitle) {
    boost = 30;
  }
  return { boost, signals };
}
