import { MIN_TWEET_LEN } from '../lib/detectors/ai-slop';
import { formatAiImageTooltip } from '../lib/slop/ai-image-flag';
import type { ContentQualityProfile, ReputationResult, ToxicityAnalysis } from '../lib/types';
import { BASE_STYLES, bandColor } from './styles';

export interface TweetStatsBadgeOpts {
  reputation: ReputationResult;
  tweetSlopScore: number;
  tweetSignals: string[];
  slopThreshold: number;
  slopPerTweetEnabled: boolean;
  tweetTextLength: number;
  tweetToxicity?: ToxicityAnalysis | null;
  toxicityThreshold: number;
  tweetSpamScore: number;
  authorSpamRisk: number;
  spamThreshold: number;
  tweetSlopImage?: number;
  tweetSlopImageLabel?: string;
  contentQuality?: ContentQualityProfile | null;
  postFingerprint?: string;
  handle?: string;
}

function displaySpam(opts: TweetStatsBadgeOpts): number {
  return Math.max(opts.authorSpamRisk, opts.tweetSpamScore);
}

function buildMetricsTooltip(opts: TweetStatsBadgeOpts): string {
  const {
    reputation,
    tweetSlopScore,
    tweetSignals,
    tweetToxicity,
    tweetSpamScore,
    authorSpamRisk,
    tweetSlopImage,
    tweetSlopImageLabel,
  } = opts;
  const authorSlop = reputation.slop?.combined;
  const authorTox = reputation.toxicity?.combined;
  const tweetTox = tweetToxicity?.combined ?? 0;
  const sp = displaySpam(opts);
  const slopSig = tweetSignals.length ? ` · ${tweetSignals.join(', ')}` : '';
  const cq = opts.contentQuality;
  const confLine =
    cq != null ? ` · confidence ${Math.round(cq.confidence * 100)}%` : '';
  const toxLabels = tweetToxicity?.topLabels?.length
    ? ` (${tweetToxicity.topLabels.map((l) => l.label).join(', ')})`
    : '';
  return [
    `Slop S ${tweetSlopScore} (tweet)${slopSig}${confLine}`,
    authorSlop != null ? `author slop ${authorSlop}` : null,
    `Toxicity T ${tweetTox}${toxLabels}`,
    authorTox != null ? `author tox ${authorTox}` : null,
    `Spam Sp ${sp} (tweet ${tweetSpamScore}, author ${authorSpamRisk})`,
    tweetSlopImage != null
      ? formatAiImageTooltip({
          heuristic: 0,
          combined: tweetSlopImage,
          image: tweetSlopImage,
          imageLabel: tweetSlopImageLabel,
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function buildContentMetricsHtml(opts: TweetStatsBadgeOpts): string {
  const {
    slopThreshold,
    toxicityThreshold,
    spamThreshold,
    tweetSlopScore,
    tweetToxicity,
    slopPerTweetEnabled,
    tweetTextLength,
  } = opts;

  if (!slopPerTweetEnabled || tweetTextLength < MIN_TWEET_LEN) {
    return '';
  }

  const tweetTox = tweetToxicity?.combined ?? 0;
  const sp = displaySpam(opts);
  const sHigh = tweetSlopScore >= slopThreshold;
  const tHigh = tweetTox >= toxicityThreshold;
  const spHigh = sp >= spamThreshold;
  const allClear = !sHigh && !tHigh && !spHigh;
  const whyBtn = opts.contentQuality
    ? `<button type="button" class="why" title="Why this score? Likelihood breakdown and evidence">Why this score?</button>`
    : '';

  const seg = (label: string, val: number, high: boolean, color: string) =>
    `<span class="seg${high ? ' high' : ''}" style="${high ? `--seg-color:${color}` : ''}">${label}<span class="num">${val}</span></span>`;

  return `
    <span class="pill metrics" title="${buildMetricsTooltip(opts).replace(/"/g, '&quot;')}">
      ${seg('S', tweetSlopScore, sHigh, '#f97316')}
      <span class="sep">·</span>
      ${seg('T', tweetTox, tHigh, '#f4212e')}
      <span class="sep">·</span>
      ${seg('Sp', sp, spHigh, 'var(--xrh-caution)')}
      ${allClear ? '<span class="ok" title="All content metrics below threshold">OK</span>' : ''}
      ${whyBtn}
    </span>
  `;
}

function buildShadowHtml(opts: TweetStatsBadgeOpts): string {
  const { reputation } = opts;
  const color = bandColor(reputation.band);
  const metricsHtml = buildContentMetricsHtml(opts);

  return `
    <style>${BASE_STYLES}
    .wrap {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      margin-inline: 4px 2px;
      vertical-align: middle;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 600;
      line-height: 1.2;
      background: var(--xrh-bg);
      border: 1px solid var(--xrh-border);
      user-select: none;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .rep {
      border-color: ${color};
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      gap: 4px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: ${color}; }
    .score { color: ${color}; }
    .metrics { cursor: default; gap: 2px; }
    .seg { color: #71767b; font-weight: 500; }
    .seg .num { margin-left: 1px; font-weight: 600; }
    .seg.high { color: var(--seg-color, #e7e9ea); font-weight: 700; }
    .seg.high .num { color: var(--seg-color, #e7e9ea); }
    .sep { color: #536471; font-weight: 400; user-select: none; }
    .ok {
      margin-left: 2px;
      color: var(--xrh-trusted);
      font-weight: 700;
      font-size: 9px;
    }
    .why {
      margin-left: 4px;
      padding: 2px 6px;
      border: none;
      background: transparent;
      color: #1d9bf0;
      font-size: 9px;
      font-weight: 600;
      cursor: pointer;
      pointer-events: auto;
      white-space: nowrap;
    }
    </style>
    <div class="wrap">
      <div class="pill rep" title="Author reputation score (higher = fewer risk signals) — click for details">
        <span class="dot"></span>
        <span class="score">${reputation.score}</span>
      </div>
      ${metricsHtml}
    </div>
  `;
}

function wireRepClick(host: HTMLElement, opts: TweetStatsBadgeOpts): void {
  const root = host.shadowRoot;
  root?.querySelector('.rep')?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    host.dispatchEvent(
      new CustomEvent('xrh-open-drawer', { bubbles: true, detail: opts.reputation }),
    );
  });
  root?.querySelector('.why')?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!opts.contentQuality) return;
    const ctx =
      opts.postFingerprint && opts.handle
        ? {
            postFingerprint: opts.postFingerprint,
            handle: opts.handle,
            baseProfile: opts.contentQuality,
          }
        : undefined;
    host.dispatchEvent(
      new CustomEvent('xrh-show-quality-why', {
        bubbles: true,
        detail: { profile: opts.contentQuality, ctx },
      }),
    );
  });
}

export function createTweetStatsBadges(opts: TweetStatsBadgeOpts): HTMLElement {
  const el = document.createElement('span');
  el.className = 'xrh-tweet-stats';
  el.style.cssText = 'display:inline-flex;align-items:center;vertical-align:middle;';
  const shadow = el.attachShadow({ mode: 'closed' });
  shadow.innerHTML = buildShadowHtml(opts);
  wireRepClick(el, opts);
  return el;
}

export function updateTweetStatsBadges(host: HTMLElement, opts: TweetStatsBadgeOpts): void {
  const shadow = host.shadowRoot;
  if (!shadow) return;
  shadow.innerHTML = buildShadowHtml(opts);
  wireRepClick(host, opts);
}
