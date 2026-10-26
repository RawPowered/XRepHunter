import type { ContentQualityProfile, DetectorCorrectionKind } from '../lib/types';
import { applyCorrectionsToProfile } from '../lib/detectors/content-quality';
import { sendMessage } from '../lib/messaging';
import { INDICATOR_DISCLAIMER } from '../lib/detectors/evidence';
import { BASE_STYLES } from './styles';

const WHY_HOST_ID = 'xrh-cq-why-root';
const WHY_Z_INDEX = 2147483646;

const CORRECTION_BUTTONS: { kind: DetectorCorrectionKind; label: string }[] = [
  { kind: 'not_spam', label: 'Not spam' },
  { kind: 'not_ai', label: 'Not AI' },
  { kind: 'organic', label: 'Actually organic' },
  { kind: 'sponsored', label: 'Sponsored' },
  { kind: 'copypasta', label: 'Copypasta' },
];

export interface QualityWhyContext {
  postFingerprint: string;
  handle: string;
  /** Re-apply corrections after user feedback */
  baseProfile: ContentQualityProfile;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function evidenceList(
  title: string,
  items: ContentQualityProfile['topEvidence'],
  className: string,
): string {
  if (!items.length) return '';
  const lis = items
    .map(
      (e) =>
        `<li><strong>${escapeHtml(e.label)}</strong>${e.detail ? ` <span class="detail">${escapeHtml(e.detail)}</span>` : ''} <span class="w">+${e.weight}</span></li>`,
    )
    .join('');
  return `<div class="${className}"><h4>${title}</h4><ul>${lis}</ul></div>`;
}

function dimRow(label: string, value: number): string {
  return `<div class="dim-row"><span>${escapeHtml(label)}</span><span class="val">${value}</span><div class="bar"><div class="fill" style="width:${Math.min(100, value)}%"></div></div></div>`;
}

export function renderContentQualityWhyHtml(profile: ContentQualityProfile): string {
  const lowConf = profile.confidence < 0.35;
  const warn = lowConf
    ? `<p class="warn">Low confidence (${Math.round(profile.confidence * 100)}%) — insufficient evidence for strong conclusions.</p>`
    : '';

  return `
    <div class="cq-why">
      <h3>Why this score?</h3>
      ${warn}
      <p class="conf">Confidence: ${Math.round(profile.confidence * 100)}%</p>
      <div class="dims">
        ${dimRow('Spam likelihood', profile.spamLikelihood)}
        ${dimRow('Promo likelihood', profile.promotionalLikelihood)}
        ${dimRow('Affiliate / sponsor', profile.affiliateOrSponsorLikelihood)}
        ${dimRow('Organic likelihood', profile.organicLikelihood)}
        ${dimRow('AI text likelihood', profile.aiTextLikelihood)}
        ${dimRow('AI image likelihood', profile.aiImageLikelihood)}
        ${dimRow('Slop likelihood', profile.slopLikelihood)}
        ${dimRow('Copypasta likelihood', profile.copypastaLikelihood)}
      </div>
      ${evidenceList('Top evidence', profile.topEvidence.slice(0, 5), 'evidence')}
      ${evidenceList('Counter-evidence', profile.topCounterEvidence.slice(0, 5), 'counter')}
      <p class="version">Detector ${escapeHtml(profile.detectorVersion)}</p>
      <p class="disclaimer">${escapeHtml(INDICATOR_DISCLAIMER)}</p>
    </div>
  `;
}

function buildPanelInnerHtml(profile: ContentQualityProfile, ctx?: QualityWhyContext): string {
  return `
    ${renderContentQualityWhyHtml(profile)}
    ${
      ctx
        ? `<div class="corrections">${CORRECTION_BUTTONS.map(
            (b) =>
              `<button type="button" class="corr" data-correction="${b.kind}">${b.label}</button>`,
          ).join('')}</div>`
        : ''
    }
    <button type="button" class="close" data-action="close">Close</button>
  `;
}

export function hideContentQualityWhyPanel(): void {
  document.getElementById(WHY_HOST_ID)?.remove();
}

export function showContentQualityWhyPanel(
  profile: ContentQualityProfile,
  ctx?: QualityWhyContext,
): void {
  hideContentQualityWhyPanel();

  const root = document.createElement('div');
  root.id = WHY_HOST_ID;
  root.style.cssText = `position:fixed;inset:0;z-index:${WHY_Z_INDEX};pointer-events:none;`;

  const shadow = root.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>${BASE_STYLES}
    .shell { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      padding: 16px; pointer-events: none; }
    .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.55);
      pointer-events: auto; }
    .panel { position: relative; z-index: 1; width: min(400px, 100%); max-height: min(80vh, 640px);
      overflow-y: auto; pointer-events: auto;
      background: #000; border: 1px solid var(--xrh-border); border-radius: 12px; padding: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5); font-size: 12px; color: #e7e9ea; }
    h3 { margin: 0 0 10px; font-size: 14px; }
    h4 { margin: 10px 0 6px; font-size: 12px; color: #71767b; }
    .warn { color: #f97316; margin: 0 0 8px; }
    .conf { color: #71767b; margin: 0 0 10px; }
    .dim-row { margin-bottom: 6px; }
    .dim-row span { display: flex; justify-content: space-between; font-size: 11px; }
    .bar { height: 4px; background: #2f3336; border-radius: 2px; margin-top: 2px; }
    .fill { height: 100%; background: #f97316; border-radius: 2px; }
    ul { margin: 0; padding-left: 16px; }
    li { margin-bottom: 4px; }
    .detail { color: #71767b; }
    .w { color: #71767b; font-size: 10px; }
    .counter ul { color: #8b98a5; }
    .version, .disclaimer { font-size: 10px; color: #71767b; margin-top: 8px; }
    .close { margin-top: 10px; width: 100%; padding: 10px; border-radius: 8px;
      border: 1px solid var(--xrh-border); background: #16181c; color: #e7e9ea; cursor: pointer;
      font-weight: 600; }
    .corrections { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
    .corr { font-size: 10px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--xrh-border);
      background: #16181c; color: #e7e9ea; cursor: pointer; }
    </style>
    <div class="shell">
      <div class="backdrop" data-action="close"></div>
      <div class="panel" role="dialog" aria-label="Why this score?">
        ${buildPanelInnerHtml(profile, ctx)}
      </div>
    </div>
  `;

  const panel = shadow.querySelector('.panel') as HTMLElement;

  const rerender = (next: ContentQualityProfile) => {
    panel.innerHTML = buildPanelInnerHtml(next, ctx);
    wirePanelEvents(root, shadow, ctx, rerender);
  };

  wirePanelEvents(root, shadow, ctx, rerender);
  document.documentElement.appendChild(root);
}

function wirePanelEvents(
  root: HTMLElement,
  shadow: ShadowRoot,
  ctx: QualityWhyContext | undefined,
  rerender: (profile: ContentQualityProfile) => void,
): void {
  shadow.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideContentQualityWhyPanel();
  });
  shadow.querySelector('.backdrop')?.addEventListener('click', () => hideContentQualityWhyPanel());

  if (!ctx) return;

  shadow.querySelectorAll('[data-correction]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kind = (e.currentTarget as HTMLElement).getAttribute(
        'data-correction',
      ) as DetectorCorrectionKind;
      void (async () => {
        await sendMessage({
          type: 'SET_DETECTOR_CORRECTION',
          postFingerprint: ctx.postFingerprint,
          handle: ctx.handle,
          correction: kind,
        });
        const corrections = await sendMessage<DetectorCorrectionKind[]>({
          type: 'GET_DETECTOR_CORRECTIONS',
          postFingerprint: ctx.postFingerprint,
        });
        rerender(applyCorrectionsToProfile(ctx.baseProfile, corrections ?? []));
      })();
    });
  });
}
