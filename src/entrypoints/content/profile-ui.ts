import { createBadgeHost } from '../../components/badge';
import { profileToSpamExample } from '../../lib/examples/matcher';
import { sendMessage } from '../../lib/messaging';
import { mergeProfiles } from '../../lib/scoring/reputation';
import { normalizeReputationResult } from '../../lib/scoring/normalize-result';
import type { AccountProfile, ExtensionSettings, ReputationResult } from '../../lib/types';
import {
  findProfileHandleFromUrl,
  scrapeAboutFromDom,
  scrapeProfileFromDom,
  SELECTORS,
} from '../../lib/x-dom/selectors';
import { cs } from './state';
import { reattachTweetsForHandle } from './tweet-attach';

import { getContentSettings } from './settings-cache';
import { putCachedScore } from './score-cache';

async function getSlopThreshold(): Promise<number> {
  const s = await getContentSettings();
  return s.slopDisplayThreshold ?? 55;
}

export async function refreshBadgesForHandle(handle: string, result: ReputationResult): Promise<void> {
  const normalized = normalizeReputationResult({ ...result, handle });
  putCachedScore(normalized);
  if (findProfileHandleFromUrl() === handle.toLowerCase()) {
    document.querySelector('.xrh-profile-badge')?.remove();
    injectProfileBadge(handle, handle === cs.primaryAccount?.handle, normalized);
  }
  reattachTweetsForHandle(handle, normalized);
}

export async function scanAndBadge(handle: string, partial?: Partial<AccountProfile>): Promise<void> {
  try {
    const hasProfileDelta = Boolean(partial && Object.keys(partial).length > 0);
    const raw = await sendMessage<ReputationResult>(
      hasProfileDelta
        ? { type: 'SCAN_HANDLE', handle, profile: partial }
        : { type: 'GET_SCORE', handle },
    );
    if (!raw) return;
    const result = normalizeReputationResult(raw);
    putCachedScore(result);

    if (findProfileHandleFromUrl() === handle.toLowerCase()) {
      injectProfileBadge(handle, handle === cs.primaryAccount?.handle, result);
    }

    reattachTweetsForHandle(handle, result);
  } catch {
    /* extension reloaded or scan failed */
  }
}

export function injectProfileBadge(
  handle: string,
  isPrimary = false,
  existing?: ReputationResult,
): void {
  void (async () => {
    let result: ReputationResult;
    try {
      result = existing
        ? normalizeReputationResult(existing)
        : normalizeReputationResult(
            await sendMessage<ReputationResult>({ type: 'GET_SCORE', handle }),
          );
    } catch {
      return;
    }
    const anchor =
      document.querySelector('[data-testid="placementTracking"]') ??
      document.querySelector(SELECTORS.userName)?.parentElement;
    if (!anchor || document.querySelector('.xrh-profile-badge')) return;

    const wrap = document.createElement('div');
    wrap.className = 'xrh-profile-badge';
    wrap.style.cssText = 'margin:8px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
    const threshold = await getSlopThreshold();
    wrap.appendChild(createBadgeHost(result, false, threshold));

    if (isPrimary) {
      const you = document.createElement('span');
      you.textContent = 'You';
      you.style.cssText =
        'font-size:11px;font-weight:700;color:#1d9bf0;border:1px solid #1d9bf0;border-radius:9999px;padding:2px 8px;';
      wrap.appendChild(you);
    }

    const btnStyle =
      'background:#16181c;border:1px solid #2f3336;color:#e7e9ea;border-radius:9999px;padding:6px 12px;cursor:pointer;font-size:12px;';

    const trustBtn = document.createElement('button');
    trustBtn.style.cssText = result.isTrusted
      ? btnStyle + 'border-color:#1d9bf0;color:#1d9bf0;'
      : btnStyle;
    trustBtn.textContent = result.isTrusted ? 'Remove trust' : 'Mark trustworthy';
    trustBtn.onclick = () => void toggleTrust(handle, result.isTrusted);
    wrap.appendChild(trustBtn);

    const markBtn = document.createElement('button');
    markBtn.textContent = 'Mark spam example';
    markBtn.style.cssText = btnStyle;
    markBtn.onclick = () => void markAsSpam(handle);
    wrap.appendChild(markBtn);

    anchor.insertAdjacentElement('afterend', wrap);
  })();
}

export async function refreshProfile(handle: string): Promise<void> {
  document.querySelector('.xrh-profile-badge')?.remove();
  await scanAndBadge(handle, scrapeProfileFromDom(handle));
  injectProfileBadge(handle, handle === cs.primaryAccount?.handle);
}

export async function toggleTrust(handle: string, isTrusted: boolean): Promise<void> {
  if (isTrusted) {
    await sendMessage({ type: 'REMOVE_TRUSTED', handle });
  } else {
    await sendMessage({ type: 'ADD_TRUSTED', handle });
  }
  await refreshProfile(handle);
}

export async function markAsSpam(handle: string): Promise<void> {
  const partial = scrapeProfileFromDom(handle);
  const about = location.pathname.endsWith('/about') ? scrapeAboutFromDom() : {};
  const profile = mergeProfiles(partial, about, handle);
  const ex = profileToSpamExample(profile, ['userExamples'], 'Marked from profile');
  await sendMessage({ type: 'ADD_SPAM_EXAMPLE', example: ex });
  alert(`Added @${handle} to spam examples.`);
}
