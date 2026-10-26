import type { AccountPostRollups } from '../lib/db/repositories/accounts';
import { showContentQualityWhyPanel } from './content-quality-why';
import { analyzeContentQuality } from '../lib/detectors/content-quality';
import type { ContentQualityProfile, ReputationResult } from '../lib/types';
import { profileToSpamExample } from '../lib/examples/matcher';
import { sendMessage } from '../lib/messaging';
import { coerceScoreBreakdown } from '../lib/scoring/normalize-result';
import { BASE_STYLES, bandColor, bandLabel } from './styles';

let drawerHost: HTMLElement | null = null;

function accountQualityProfile(result: ReputationResult): ContentQualityProfile {
  const profile = result.profile;
  const postTexts = (profile?.postsSample ?? [])
    .filter((p) => p.text?.trim())
    .slice(0, 3)
    .map((p) => p.text.trim());
  const text = [profile?.bio?.trim(), ...postTexts].filter(Boolean).join('\n\n').slice(0, 2000);
  return analyzeContentQuality({
    text: text || `Posts from @${result.handle}`,
    handle: result.handle,
    profile,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toxicitySection(result: ReputationResult): string {
  const t = result.toxicity;
  if (!t) return '';
  const labels =
    t.topLabels?.map((l) => `${l.label} ${Math.round(l.score * 100)}%`).join(', ') ?? '—';
  return `
    <div class="tox-block">
      <h3>Content toxicity</h3>
      <div class="bar-row"><span>Combined</span><span>${t.combined}</span></div>
      <div class="bar"><div class="fill toxic" style="width:${Math.min(100, t.combined)}%"></div></div>
      <p class="meta">Top: ${escapeHtml(labels)}${t.source ? ` · ${escapeHtml(t.source)}` : ''}</p>
      <p class="meta">Indicator only — not a moderation decision.</p>
    </div>
  `;
}

function slopSection(result: ReputationResult): string {
  const s = result.slop;
  if (!s) return '';
  const onnxLine =
    s.onnx != null
      ? `<div class="bar-row"><span>ONNX text</span><span>${s.onnx}</span></div>`
      : '';
  const modelLine =
    s.model != null
      ? `<div class="bar-row"><span>Wllama</span><span>${s.model}</span></div>`
      : '';
  const imageLine =
    s.image != null
      ? `<div class="bar-row"><span>Image ML</span><span>${s.image}</span></div>`
      : '';
  const hint =
    !s.onnx && !s.model && !s.image
      ? '<p class="slop-hint">Enable slop models in the dashboard.</p>'
      : '';
  return `
    <div class="slop-block">
      <h3>AI slop</h3>
      <div class="bar-row"><span>Combined</span><span>${s.combined}</span></div>
      <div class="bar"><div class="fill slop" style="width:${Math.min(100, s.combined)}%"></div></div>
      <div class="bar-row"><span>Heuristic</span><span>${s.heuristic}</span></div>
      ${onnxLine}
      ${modelLine}
      ${imageLine}
      ${hint}
      ${s.samplesScored != null ? `<p class="meta">Samples scored: ${s.samplesScored}</p>` : ''}
      ${s.signals?.length ? `<p class="meta">Signals: ${s.signals.join(', ')}</p>` : ''}
      <p class="meta">Indicator only — not proof of AI authorship.</p>
    </div>
  `;
}

function postSignalsSection(rollups: AccountPostRollups | null): string {
  if (!rollups?.postsAnalyzed) return '';
  return `
    <div class="post-signals-block">
      <h3>Post signals</h3>
      <div class="bar-row"><span>Posts analyzed</span><span>${rollups.postsAnalyzed}</span></div>
      <div class="bar-row"><span>Community Notes</span><span>${rollups.postsWithNote} (${Math.round(rollups.noteRate * 100)}%)</span></div>
      <div class="bar-row"><span>Avg spam / slop / tox</span><span>${Math.round(rollups.avgPostSpam)} / ${Math.round(rollups.avgPostSlop)} / ${Math.round(rollups.avgPostToxicity)}</span></div>
      <p class="meta"><a href="#" data-action="leaderboard">View on leaderboard</a></p>
    </div>
  `;
}

function breakdownSection(result: ReputationResult): string {
  const b = coerceScoreBreakdown(result.breakdown, result.score);
  return `
    <div class="breakdown">
      <h3>Score breakdown</h3>
      <div class="bar-row"><span>Spam / X risk</span><span>${b.spamRisk}%</span></div>
      <div class="bar"><div class="fill spam" style="width:${Math.min(100, b.spamRisk)}%"></div></div>
      <div class="bar-row"><span>General risk</span><span>${b.generalRisk}%</span></div>
      <div class="bar"><div class="fill general" style="width:${Math.min(100, b.generalRisk)}%"></div></div>
      <div class="bar-row meta"><span>X-weighted spam</span><span>${b.xWeightedSpamRisk}%</span></div>
    </div>
  `;
}

export function showDrawer(result: ReputationResult, onRefresh?: () => void): void {
  void openDrawer(result, onRefresh);
}

async function openDrawer(result: ReputationResult, onRefresh?: () => void): Promise<void> {
  const safe = {
    ...result,
    breakdown: coerceScoreBreakdown(result.breakdown, result.score),
  };
  hideDrawer();
  let rollups: AccountPostRollups | null = null;
  try {
    rollups = await sendMessage<AccountPostRollups | null>({
      type: 'GET_ACCOUNT_ROLLUPS',
      handle: safe.handle,
    });
  } catch {
    /* ignore */
  }
  const root = document.createElement('div');
  root.id = 'xrh-drawer-root';
  const shadow = root.attachShadow({ mode: 'closed' });
  const color = bandColor(safe.band);

  const trustedBanner = safe.isTrusted
    ? `<p class="trusted-banner">Trusted by you — full score still shown.${safe.trustedNote ? ` ${escapeHtml(safe.trustedNote)}` : ''}</p>`
    : '';
  const trustBtn = safe.isTrusted
    ? `<button class="secondary" data-action="untrust">Remove trust</button>`
    : `<button class="secondary trust" data-action="trust">Mark as trustworthy</button>`;

  const hitsHtml = safe.hits
    .slice(0, 10)
    .map((h) => {
      const w = h.effectiveWeight != null ? ` <span class="weight">×${h.effectiveWeight}</span>` : '';
      return `<li><strong>${escapeHtml(h.label)}</strong>${h.detail ? ` — ${escapeHtml(h.detail)}` : ''}${w} <span class="risk">${Math.round(h.risk * 100)}%</span></li>`;
    })
    .join('');

  shadow.innerHTML = `
    <style>${BASE_STYLES}
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 999998; }
    .panel { position: fixed; top: 0; right: 0; width: min(380px, 100vw); height: 100vh;
      background: #000; border-left: 1px solid var(--xrh-border); z-index: 999999;
      padding: 20px; overflow-y: auto; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    h3 { font-size: 14px; margin: 16px 0 8px; color: #71767b; }
    .score-big { font-size: 36px; font-weight: 800; color: ${color}; }
    .band { color: ${color}; margin-bottom: 8px; }
    .trusted-banner { color: var(--xrh-accent); font-size: 13px; margin: 0 0 12px; }
    .breakdown { margin-bottom: 12px; }
    .bar-row { display: flex; justify-content: space-between; font-size: 12px; margin-top: 6px; }
    .bar-row.meta { color: #71767b; }
    .bar { height: 6px; background: #2f3336; border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
    .fill.spam { background: var(--xrh-risk); height: 100%; }
    .fill.general { background: var(--xrh-caution); height: 100%; }
    .fill.slop { background: #f97316; height: 100%; }
    .fill.toxic { background: #f4212e; height: 100%; }
    .slop-block, .tox-block { margin-bottom: 12px; }
    .slop-hint, .meta { font-size: 12px; color: #71767b; margin: 4px 0; }
    ul { padding-left: 18px; margin: 0 0 16px; }
    li { margin-bottom: 8px; line-height: 1.35; font-size: 13px; }
    .risk, .weight { opacity: 0.7; font-size: 11px; }
    button { display: block; width: 100%; margin: 8px 0; padding: 12px;
      border-radius: 9999px; border: none; font-weight: 700; cursor: pointer; font-size: 14px; }
    .secondary { background: transparent; color: #e7e9ea; border: 1px solid var(--xrh-border); }
    .trust { border-color: var(--xrh-accent); color: var(--xrh-accent); }
    .close { position: absolute; top: 12px; right: 16px; background: none; border: none;
      color: #e7e9ea; font-size: 22px; width: auto; cursor: pointer; }
    </style>
    <div class="backdrop" data-action="close"></div>
    <div class="panel">
      <button class="close" data-action="close">×</button>
      <h2>@${escapeHtml(safe.handle)}</h2>
      <div class="score-big">${safe.score}</div>
      <div class="band">${bandLabel(safe.band)}</div>
      ${trustedBanner}
      ${breakdownSection(safe)}
      <button class="secondary" data-action="why-score">Why this score?</button>
      ${postSignalsSection(rollups)}
      ${slopSection(safe)}
      ${toxicitySection(safe)}
      <h3>Signals</h3>
      <ul>${hitsHtml || '<li>No risk signals detected</li>'}</ul>
      ${trustBtn}
      <button class="secondary" data-action="spam">Add as spam example</button>
      ${safe.isTrusted ? '' : '<button class="secondary" data-action="block">Suggest block…</button>'}
    </div>
  `;

  shadow.querySelectorAll('[data-action="close"]').forEach((n) =>
    n.addEventListener('click', () => hideDrawer()),
  );

  shadow.querySelector('[data-action="spam"]')?.addEventListener('click', async () => {
    if (!result.profile) return;
    const ex = profileToSpamExample(
      result.profile,
      result.hits.map((h) => h.id),
      'Marked from drawer',
    );
    await sendMessage({ type: 'ADD_SPAM_EXAMPLE', example: ex });
    onRefresh?.();
    hideDrawer();
  });

  shadow.querySelector('[data-action="trust"]')?.addEventListener('click', async () => {
    await sendMessage({ type: 'ADD_TRUSTED', handle: result.handle });
    onRefresh?.();
    hideDrawer();
  });

  shadow.querySelector('[data-action="untrust"]')?.addEventListener('click', async () => {
    await sendMessage({ type: 'REMOVE_TRUSTED', handle: result.handle });
    onRefresh?.();
    hideDrawer();
  });

  shadow.querySelector('[data-action="block"]')?.addEventListener('click', () => {
    root.dispatchEvent(
      new CustomEvent('xrh-request-block', { bubbles: true, detail: { result } }),
    );
    hideDrawer();
  });

  shadow.querySelector('[data-action="leaderboard"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    void browser.runtime.openOptionsPage();
  });

  shadow.querySelector('[data-action="why-score"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const q = accountQualityProfile(safe);
    showContentQualityWhyPanel(q);
  });

  document.documentElement.appendChild(root);
  drawerHost = root;
}

export function hideDrawer(): void {
  drawerHost?.remove();
  drawerHost = null;
}



