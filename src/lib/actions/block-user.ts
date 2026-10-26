import { SELECTORS } from '../x-dom/selectors';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function clickEl(el: Element | null): boolean {
  if (!el) return false;
  (el as HTMLElement).click();
  return true;
}

/** Automate block via profile ⋯ menu (fragile — X UI may change) */
export async function blockUserOnPage(handle: string): Promise<{ ok: boolean; error?: string }> {
  const pathHandle = location.pathname.split('/')[1]?.toLowerCase();
  if (pathHandle !== handle.toLowerCase()) {
    return { ok: false, error: 'Navigate to profile first' };
  }

  const moreBtn =
    document.querySelector('[data-testid="userActions"]') ??
    document.querySelector('button[aria-label="More"]') ??
    [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'More');

  if (!clickEl(moreBtn)) return { ok: false, error: 'More menu not found' };
  await sleep(400);

  const blockItem = [...document.querySelectorAll('[role="menuitem"]')].find((el) =>
    /block\s+@/i.test(el.textContent ?? ''),
  );
  if (!clickEl(blockItem ?? null)) {
    const blockAlt = [...document.querySelectorAll('span')].find((s) => /^block @/i.test(s.textContent ?? ''));
    if (!clickEl(blockAlt?.closest('[role="menuitem"]') ?? blockAlt)) {
      return { ok: false, error: 'Block menu item not found' };
    }
  }
  await sleep(400);

  const confirm = [...document.querySelectorAll('button')].find((b) =>
    /^block$/i.test(b.textContent?.trim() ?? ''),
  );
  if (!clickEl(confirm)) return { ok: false, error: 'Block confirm not found' };

  return { ok: true };
}

export async function muteUserOnPage(handle: string): Promise<{ ok: boolean; error?: string }> {
  const pathHandle = location.pathname.split('/')[1]?.toLowerCase();
  if (pathHandle !== handle.toLowerCase()) {
    return { ok: false, error: 'Navigate to profile first' };
  }

  const moreBtn = document.querySelector('[data-testid="userActions"]');
  if (!clickEl(moreBtn)) return { ok: false, error: 'More menu not found' };
  await sleep(400);

  const muteItem = [...document.querySelectorAll('[role="menuitem"]')].find((el) =>
    /mute\s+@/i.test(el.textContent ?? ''),
  );
  if (!clickEl(muteItem ?? null)) return { ok: false, error: 'Mute menu item not found' };
  await sleep(300);

  const confirm = [...document.querySelectorAll('button')].find((b) =>
    /^mute$/i.test(b.textContent?.trim() ?? ''),
  );
  if (confirm) clickEl(confirm);

  return { ok: true };
}

export function navigateToProfile(handle: string): void {
  const url = `https://x.com/${handle}`;
  if (location.href !== url) location.href = url;
}
