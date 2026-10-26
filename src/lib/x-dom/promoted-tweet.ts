/** Detect X promoted/sponsored posts — strict to avoid dimming organic video/card posts. */

const PROMOTED_LABEL = /^(Ad|Promoted)$/i;

function isPromotedLabelSpan(span: Element): boolean {
  const t = span.textContent?.trim() ?? '';
  if (!PROMOTED_LABEL.test(t)) return false;
  if (span.closest('[data-testid="tweetText"]')) return false;
  if (span.closest('[data-testid="card.wrapper"]')) return false;
  if (span.closest('[data-testid="videoPlayer"]')) return false;
  if (span.closest('[data-testid="tweetPhoto"]')) return false;
  if (span.closest('video')) return false;
  if (span.closest('[role="group"]')) return false;
  return true;
}

/** placementTracking wraps many timeline cells; only treat as ad if it contains an Ad/Promoted pill. */
function cellHasPromotedPlacement(article: HTMLElement): boolean {
  const cell = article.closest('[data-testid="cellInnerDiv"]');
  if (!cell) return false;
  const tracking = cell.querySelector('[data-testid="placementTracking"]');
  if (!tracking) return false;
  for (const span of tracking.querySelectorAll('span')) {
    if (isPromotedLabelSpan(span)) return true;
  }
  return false;
}

export function isPromotedAdTweet(article: HTMLElement): boolean {
  if (cellHasPromotedPlacement(article)) return true;

  const social = article.querySelector('[data-testid="socialContext"]');
  if (social) {
    const label = social.textContent?.trim() ?? '';
    if (PROMOTED_LABEL.test(label)) return true;
  }

  for (const span of article.querySelectorAll('span')) {
    if (isPromotedLabelSpan(span)) return true;
  }
  return false;
}
