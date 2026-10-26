/** Tweet preview images: native photos + link/card thumbnails on twimg. */

export const TWEET_PREVIEW_IMG_SEL =
  'img[src*="pbs.twimg.com/media"], img[src*="pbs.twimg.com/card_img"], [data-testid="card.wrapper"] img[src*="twimg.com"]';

export function queryTweetPreviewImages(root: ParentNode): HTMLImageElement[] {
  return [...root.querySelectorAll<HTMLImageElement>(TWEET_PREVIEW_IMG_SEL)];
}

export function pickLargestPreviewImageUrl(article: Element): string | undefined {
  const imgs = queryTweetPreviewImages(article);
  if (!imgs.length) return undefined;
  let best = imgs[0];
  let bestArea = 0;
  for (const img of imgs) {
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    const area = w * h || (img.src.includes('name=large') ? 1000 : 100);
    if (area >= bestArea) {
      bestArea = area;
      best = img;
    }
  }
  let src = best.src;
  if (src.includes('name=small') || src.includes('name=thumb')) {
    src = src.replace(/name=(small|thumb|medium)/, 'name=large');
  }
  return src;
}
