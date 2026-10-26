import { extractTweetText } from '../x-dom/selectors';
import { pickLargestPreviewImageUrl, queryTweetPreviewImages } from './tweet-preview-images';

export interface TweetMediaInfo {
  hasPhoto: boolean;
  hasCard: boolean;
  hasVideo: boolean;
  imageUrl?: string;
  altTexts: string[];
  cardTitle?: string;
  cardDescription?: string;
}

export function extractTweetMedia(article: Element): TweetMediaInfo {
  const hasVideo = Boolean(article.querySelector('video, [data-testid="videoPlayer"]'));
  const previewImgs = queryTweetPreviewImages(article);
  const hasPhoto = previewImgs.some((img) => img.src.includes('/media/'));
  const hasCardImage = previewImgs.some(
    (img) => img.src.includes('/card_img') || Boolean(img.closest('[data-testid="card.wrapper"]')),
  );
  const card = article.querySelector('[data-testid="card.wrapper"]');
  const hasCard = Boolean(card);

  const altTexts: string[] = [];
  article.querySelectorAll<HTMLImageElement>('img[src*="pbs.twimg"]').forEach((img) => {
    const alt = img.alt?.trim();
    if (alt && alt.length > 2 && !altTexts.includes(alt)) altTexts.push(alt);
  });

  let cardTitle: string | undefined;
  let cardDescription: string | undefined;
  if (card) {
    const spans = [...card.querySelectorAll('span')].map((s) => s.textContent?.trim() ?? '');
    const lines = spans.filter((t) => t.length > 2);
    if (lines.length) cardTitle = lines[0];
    if (lines.length > 1) cardDescription = lines.slice(1, 4).join(' ');
  }

  return {
    hasPhoto: hasPhoto || hasCardImage,
    hasCard,
    hasVideo,
    imageUrl: pickLargestPreviewImageUrl(article),
    altTexts,
    cardTitle,
    cardDescription,
  };
}

/** Full text for slop scoring: tweet body, card preview, image alt. */
export function buildSlopTextFromArticle(article: Element): string {
  const parts: string[] = [];
  const tweet = extractTweetText(article);
  if (tweet) parts.push(tweet);
  const media = extractTweetMedia(article);
  if (media.cardTitle) parts.push(media.cardTitle);
  if (media.cardDescription) parts.push(media.cardDescription);
  for (const alt of media.altTexts) parts.push(alt);
  return parts.join('\n').trim();
}

export function extractTweetSlopContent(article: Element): {
  text: string;
  media: TweetMediaInfo;
} {
  return {
    text: buildSlopTextFromArticle(article),
    media: extractTweetMedia(article),
  };
}
