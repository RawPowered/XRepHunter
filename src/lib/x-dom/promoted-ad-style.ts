import { isPromotedAdTweet } from './promoted-tweet';

const STYLE_ID = 'xrh-promoted-ad-style';
const CLASS = 'xrh-promoted-ad';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    article.${CLASS} [data-testid="tweetPhoto"],
    article.${CLASS} [data-testid="card.wrapper"],
    article.${CLASS} [data-testid="videoPlayer"],
    article.${CLASS} video {
      display: none !important;
    }
    article.${CLASS} [data-testid="tweetText"],
    article.${CLASS} [data-testid="tweetText"] span,
    article.${CLASS} [data-testid="tweetText"] a {
      color: #000 !important;
    }
  `;
  document.documentElement.appendChild(el);
}

export function applyPromotedAdTreatment(article: HTMLElement, enabled: boolean): void {
  if (!enabled) {
    article.classList.remove(CLASS);
    return;
  }
  ensureStyles();
  if (isPromotedAdTweet(article)) article.classList.add(CLASS);
  else article.classList.remove(CLASS);
}
