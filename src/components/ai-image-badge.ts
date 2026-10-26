import { formatAiImageTooltip, isAiGeneratedImage } from '../lib/slop/ai-image-flag';
import { queryTweetPreviewImages } from '../lib/slop/tweet-preview-images';
import type { SlopAnalysis } from '../lib/types';
import { BASE_STYLES } from './styles';

const BADGE_CLASS = 'xrh-ai-image-badge';

export interface AiImageBadgeOpts {
  threshold: number;
  enabled: boolean;
}

function badgeHtml(slop: SlopAnalysis, userMarked?: boolean): string {
  const score = slop.image;
  const text = userMarked ? `AI ✓` : score != null ? `AI ${score}` : 'AI';
  const tip = formatAiImageTooltip(slop, userMarked).replace(/"/g, '&quot;');
  return `
    <style>${BASE_STYLES}
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.02em;
      color: #fff;
      background: rgba(249, 115, 22, 0.92);
      border: 1px solid #fb923c;
      box-shadow: 0 1px 4px rgba(0,0,0,0.45);
      pointer-events: none;
      user-select: none;
      line-height: 1.1;
    }
    </style>
    <span class="badge" title="${tip}">${text}</span>
  `;
}

function ensureAnchor(img: HTMLImageElement): HTMLElement {
  const photo =
    (img.closest('[data-testid="tweetPhoto"]') as HTMLElement | null) ??
    (img.closest('[data-testid="card.wrapper"]') as HTMLElement | null);
  const anchor = photo ?? img.parentElement ?? img;
  const pos = getComputedStyle(anchor).position;
  if (pos === 'static') anchor.style.position = 'relative';
  return anchor;
}

export function upsertBadgeOnImage(
  img: HTMLImageElement,
  slop: SlopAnalysis,
  userMarked?: boolean,
): void {
  const anchor = ensureAnchor(img);
  let host = anchor.querySelector(`:scope > .${BADGE_CLASS}`) as HTMLElement | null;
  if (!host) {
    host = document.createElement('span');
    host.className = BADGE_CLASS;
    host.style.cssText =
      'position:absolute;top:8px;left:8px;z-index:5;pointer-events:none;line-height:0;';
    anchor.appendChild(host);
  }
  const state = `${slop.image ?? ''}|${slop.imageLabel ?? ''}|${userMarked ? 1 : 0}`;
  if (host.dataset.xrhState === state) return;
  host.dataset.xrhState = state;
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = badgeHtml(slop, userMarked);
}

export function removeAiImageBadges(article: HTMLElement): void {
  article.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
}

export interface SyncAiImageBadgeOpts extends AiImageBadgeOpts {
  /** Keep existing badges while slop is still loading (avoids flicker). */
  slopPending?: boolean;
}

export function syncAiImageBadges(
  article: HTMLElement,
  slop: SlopAnalysis | null,
  opts: SyncAiImageBadgeOpts,
  isMarked?: (imageUrl: string) => boolean,
): void {
  const imgs = queryTweetPreviewImages(article);
  if (!imgs.length) {
    if (!opts.slopPending) removeAiImageBadges(article);
    return;
  }

  if (!opts.enabled) {
    removeAiImageBadges(article);
    return;
  }

  const active = new Set<HTMLImageElement>();
  for (const img of imgs) {
    const src = img.src;
    const marked = src ? isMarked?.(src) : false;
    const show = marked || isAiGeneratedImage(slop, opts.threshold, marked);
    if (show) {
      const displaySlop =
        slop ??
        (marked
          ? {
              heuristic: 0,
              combined: opts.threshold,
              image: opts.threshold,
              imageLabel: 'user_marked_ai',
            }
          : null);
      if (displaySlop) {
        upsertBadgeOnImage(img, displaySlop, marked);
        active.add(img);
      }
    }
  }

  if (!active.size && !opts.slopPending) {
    removeAiImageBadges(article);
    return;
  }

  article.querySelectorAll(`.${BADGE_CLASS}`).forEach((host) => {
    const anchor = host.parentElement;
    const img = anchor?.querySelector('img');
    if (img && !active.has(img)) host.remove();
  });
}
