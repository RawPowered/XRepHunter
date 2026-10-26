import type { ReputationResult } from '../lib/types';
import { BASE_STYLES, bandColor, bandLabel } from './styles';

export function createBadgeHost(
  result: ReputationResult,
  compact = false,
  slopThreshold = 55,
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'xrh-badge-host';
  const shadow = el.attachShadow({ mode: 'closed' });
  const color = bandColor(result.band);
  const trustedBorder = result.isTrusted ? 'var(--xrh-accent)' : color;
  const slop = result.slop?.combined ?? 0;
  const showSlop = slop >= slopThreshold;
  const sigPart = result.slop?.signals?.length ? ` · ${result.slop.signals.join(', ')}` : '';
  const slopTip = result.slop
    ? `Heuristic ${result.slop.heuristic}${result.slop.model != null ? ` · Model ${result.slop.model}` : ''}${sigPart}`
    : '';

  shadow.innerHTML = `
    <style>${BASE_STYLES}
    .wrap { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: ${compact ? '2px 8px' : '4px 10px'};
      border-radius: 9999px;
      background: var(--xrh-bg);
      border: 1px solid ${trustedBorder};
      cursor: pointer;
      user-select: none;
      line-height: 1.2;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: ${color}; }
    .score { font-weight: 700; color: ${color}; font-size: ${compact ? '11px' : '13px'}; }
    .label { font-size: 11px; opacity: 0.85; }
    .trusted {
      font-size: 10px;
      font-weight: 700;
      color: var(--xrh-accent);
      border: 1px solid var(--xrh-accent);
      border-radius: 9999px;
      padding: 2px 8px;
    }
    .slop {
      font-size: 10px;
      font-weight: 700;
      color: #f97316;
      border: 1px solid #f97316;
      border-radius: 9999px;
      padding: 2px 8px;
    }
    </style>
    <div class="wrap">
      <div class="badge" title="XRepHunter reputation">
        <span class="dot"></span>
        <span class="score">${result.score}</span>
        ${compact ? '' : `<span class="label">${bandLabel(result.band)}</span>`}
      </div>
      ${result.isTrusted ? '<span class="trusted" title="You marked this account as trustworthy">Trusted</span>' : ''}
      ${showSlop ? `<span class="slop" title="${slopTip}">Slop ${slop}</span>` : ''}
    </div>
  `;

  shadow.querySelector('.badge')?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    el.dispatchEvent(new CustomEvent('xrh-open-drawer', { bubbles: true, detail: result }));
  });

  return el;
}
