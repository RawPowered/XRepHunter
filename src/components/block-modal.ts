import type { BlockSuggestion, ReputationResult } from '../lib/types';
import { blockUserOnPage, muteUserOnPage } from '../lib/actions/block-user';
import { sendMessage } from '../lib/messaging';
import { BASE_STYLES, bandColor, bandLabel } from './styles';

let modalHost: HTMLElement | null = null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function showBlockSuggestionModal(
  result: ReputationResult,
  suggestion?: BlockSuggestion,
): void {
  hideBlockModal();
  const root = document.createElement('div');
  root.id = 'xrh-block-modal';
  const shadow = root.attachShadow({ mode: 'closed' });
  const color = bandColor(result.band);
  const reasons = result.hits
    .slice(0, 3)
    .map((h) => `<li>${escapeHtml(h.label)}</li>`)
    .join('');

  shadow.innerHTML = `
    <style>${BASE_STYLES}
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 1000000; display: flex; align-items: center; justify-content: center; }
    .card {
      background: #000; border: 1px solid var(--xrh-border); border-radius: 16px;
      max-width: 420px; width: 90%; padding: 24px; text-align: center;
    }
    h2 { margin: 0 0 12px; font-size: 20px; }
    .score { font-size: 28px; font-weight: 800; color: ${color}; }
    .band { color: ${color}; margin-bottom: 12px; }
    ul { text-align: left; margin: 12px 0; padding-left: 20px; }
    button {
      display: block; width: 100%; margin: 8px 0; padding: 12px;
      border-radius: 9999px; border: none; font-weight: 700; cursor: pointer; font-size: 15px;
    }
    .block { background: var(--xrh-risk); color: #fff; }
    .mute { background: transparent; color: #e7e9ea; border: 1px solid var(--xrh-border); }
    .dismiss { background: transparent; color: #71767b; border: none; }
    .whitelist { background: transparent; color: var(--xrh-accent); border: 1px solid var(--xrh-accent); }
    .legal { font-size: 11px; color: #71767b; margin-top: 12px; line-height: 1.4; }
    </style>
    <div class="backdrop">
      <div class="card">
        <h2>@${escapeHtml(result.handle)} is suggested to be blocked</h2>
        <div class="score">${result.score}</div>
        <div class="band">${bandLabel(result.band)} — XRepHunter reputation</div>
        <ul>${reasons || '<li>Multiple risk signals</li>'}</ul>
        <p>Would you like to proceed? Marking trustworthy keeps the score visible but stops block suggestions.</p>
        <button class="block" data-action="block">Block</button>
        <button class="mute" data-action="mute">Mute</button>
        <button class="whitelist" data-action="trust">Mark trustworthy</button>
        <button class="dismiss" data-action="dismiss">Dismiss</button>
        <p class="legal">Not affiliated with X. You confirm each action. False positives possible.</p>
      </div>
    </div>
  `;

  const sid = suggestion?.id;

  shadow.querySelector('[data-action="block"]')?.addEventListener('click', async () => {
    const r = await blockUserOnPage(result.handle);
    if (r.ok) {
      if (sid) await sendMessage({ type: 'UPDATE_QUEUE', id: sid, status: 'blocked' });
      await sendMessage({ type: 'GET_STATS' });
    } else {
      alert(r.error ?? 'Block failed — open profile and try manually.');
    }
    hideBlockModal();
  });

  shadow.querySelector('[data-action="mute"]')?.addEventListener('click', async () => {
    const r = await muteUserOnPage(result.handle);
    if (r.ok && sid) await sendMessage({ type: 'UPDATE_QUEUE', id: sid, status: 'muted' });
    hideBlockModal();
  });

  shadow.querySelector('[data-action="trust"]')?.addEventListener('click', async () => {
    await sendMessage({ type: 'ADD_TRUSTED', handle: result.handle });
    if (sid) await sendMessage({ type: 'UPDATE_QUEUE', id: sid, status: 'whitelisted' });
    hideBlockModal();
  });

  shadow.querySelector('[data-action="dismiss"]')?.addEventListener('click', async () => {
    if (sid) await sendMessage({ type: 'UPDATE_QUEUE', id: sid, status: 'dismissed' });
    hideBlockModal();
  });

  document.documentElement.appendChild(root);
  modalHost = root;
}

export function hideBlockModal(): void {
  modalHost?.remove();
  modalHost = null;
}
