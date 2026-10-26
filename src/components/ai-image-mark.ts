import { formatAiImageTooltip, isAiGeneratedImage } from '../lib/slop/ai-image-flag';
import { imageFingerprint } from '../lib/slop/image-fingerprint';
import { queryTweetPreviewImages } from '../lib/slop/tweet-preview-images';
import { sendMessage } from '../lib/messaging';
import type { ExtensionSettings, SlopAnalysis } from '../lib/types';
import { BASE_STYLES } from './styles';
import { upsertBadgeOnImage } from './ai-image-badge';

const MARK_CLASS = 'xrh-ai-image-mark';
const markedCache = new Map<string, Set<string>>();

function cacheKey(handle: string): string {
  return handle.toLowerCase();
}

export function primeMarkedImagesCache(handle: string, fingerprints: string[]): void {
  markedCache.set(cacheKey(handle), new Set(fingerprints));
}

export function isImageMarkedLocally(handle: string, imageUrl: string): boolean {
  const set = markedCache.get(cacheKey(handle));
  if (!set) return false;
  return set.has(imageFingerprint(imageUrl));
}

function setMarkedLocally(handle: string, imageUrl: string, marked: boolean): void {
  const key = cacheKey(handle);
  let set = markedCache.get(key);
  if (!set) {
    set = new Set();
    markedCache.set(key, set);
  }
  const fp = imageFingerprint(imageUrl);
  if (marked) set.add(fp);
  else set.delete(fp);
}

function slopForMarked(settings: ExtensionSettings, existing?: SlopAnalysis | null): SlopAnalysis {
  const score = settings.manualAiImageSlopScore ?? 82;
  const combined = Math.max(existing?.combined ?? 0, score);
  return {
    heuristic: existing?.heuristic ?? 0,
    combined,
    image: Math.max(existing?.image ?? 0, score),
    imageLabel: 'user_marked_ai',
    signals: [...new Set([...(existing?.signals ?? []), 'user_marked_ai'])],
  };
}

function markButtonHtml(marked: boolean): string {
  return `
    <style>${BASE_STYLES}
    .btn {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid #2f3336;
      background: rgba(0,0,0,0.75);
      color: #e7e9ea;
      line-height: 1.2;
    }
    .btn:hover { border-color: #f97316; color: #fb923c; }
    .btn.marked { border-color: #f97316; color: #fff; background: rgba(249,115,22,0.85); }
    </style>
    <button type="button" class="btn ${marked ? 'marked' : ''}" title="${marked ? 'Remove your AI mark' : 'Mark image as AI — adds to author slop score'}">${marked ? 'AI ✓' : 'Mark AI'}</button>
  `;
}

function ensureMarkHost(img: HTMLImageElement): HTMLElement {
  const photo =
    (img.closest('[data-testid="tweetPhoto"]') as HTMLElement | null) ??
    (img.closest('[data-testid="card.wrapper"]') as HTMLElement | null);
  const anchor = photo ?? img.parentElement ?? img;
  const pos = getComputedStyle(anchor).position;
  if (pos === 'static') anchor.style.position = 'relative';
  let host = anchor.querySelector(`:scope > .${MARK_CLASS}`) as HTMLElement | null;
  if (!host) {
    host = document.createElement('span');
    host.className = MARK_CLASS;
    host.style.cssText =
      'position:absolute;bottom:8px;right:8px;z-index:6;line-height:0;pointer-events:auto;';
    anchor.appendChild(host);
  }
  return host;
}

export function removeImageMarkControls(article: HTMLElement): void {
  article.querySelectorAll(`.${MARK_CLASS}`).forEach((el) => el.remove());
}

export function syncImageMarkControls(
  article: HTMLElement,
  handle: string,
  text: string,
  settings: ExtensionSettings,
  slop: SlopAnalysis | null,
  opts: { badgeThreshold: number; badgeEnabled: boolean },
  onSlopChange: (slop: SlopAnalysis | null) => void,
): void {
  if (settings.manualAiImageMarkEnabled === false) {
    removeImageMarkControls(article);
    return;
  }

  const imgs = queryTweetPreviewImages(article);
  if (!imgs.length) return;

  const active = new Set<HTMLImageElement>();
  for (const img of imgs) {
    const src = img.src;
    if (!src) continue;
    const marked = isImageMarkedLocally(handle, src);
    const host = ensureMarkHost(img);
    active.add(img);

    const state = marked ? '1' : '0';
    if (host.dataset.xrhMarkState !== state) {
      host.dataset.xrhMarkState = state;
      const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'closed' });
      shadow.innerHTML = markButtonHtml(marked);
      const btn = shadow.querySelector('button');
      if (btn) {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggleMark(handle, src, text, settings, slop, marked, opts, onSlopChange);
        };
      }
    }

    if (marked || isAiGeneratedImage(slop, opts.badgeThreshold, marked)) {
      const displaySlop = marked ? slopForMarked(settings, slop) : slop;
      if (opts.badgeEnabled && displaySlop) {
        upsertBadgeOnImage(img, displaySlop, marked);
      }
    }
  }

  article.querySelectorAll(`.${MARK_CLASS}`).forEach((host) => {
    const anchor = host.parentElement;
    const img = anchor?.querySelector('img');
    if (img && !active.has(img)) host.remove();
  });
}

async function toggleMark(
  handle: string,
  imageUrl: string,
  text: string,
  settings: ExtensionSettings,
  slop: SlopAnalysis | null,
  wasMarked: boolean,
  opts: { badgeThreshold: number; badgeEnabled: boolean },
  onSlopChange: (slop: SlopAnalysis | null) => void,
): Promise<void> {
  if (wasMarked) {
    await sendMessage({ type: 'UNMARK_IMAGE_AS_AI', handle, imageUrl });
    setMarkedLocally(handle, imageUrl, false);
    onSlopChange(null);
  } else {
    await sendMessage({ type: 'MARK_IMAGE_AS_AI', handle, imageUrl, text });
    setMarkedLocally(handle, imageUrl, true);
    onSlopChange(slopForMarked(settings, slop));
  }
}
