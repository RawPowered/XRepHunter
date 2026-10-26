let invalidated = false;
let bannerEl: HTMLElement | null = null;

export function isContentScriptAlive(): boolean {
  return !invalidated;
}

export function resetContentScriptLifecycle(): void {
  invalidated = false;
  bannerEl?.remove();
  bannerEl = null;
  document.getElementById('xrh-reload-banner')?.remove();
}

export function markContentScriptInvalidated(): void {
  if (invalidated) return;
  invalidated = true;
  showReloadBanner();
}

function showReloadBanner(): void {
  if (bannerEl || document.getElementById('xrh-reload-banner')) return;
  bannerEl = document.createElement('div');
  bannerEl.id = 'xrh-reload-banner';
  bannerEl.textContent = 'XRepHunter was updated — refresh this tab (Ctrl+Shift+R).';
  bannerEl.style.cssText =
    'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:999999;' +
    'background:#1d9bf0;color:#fff;padding:10px 16px;border-radius:8px;font:600 13px system-ui;' +
    'box-shadow:0 4px 24px rgba(0,0,0,.45);cursor:pointer;';
  bannerEl.onclick = () => location.reload();
  document.documentElement.appendChild(bannerEl);
}

/** Wrap fire-and-forget background calls — never throws on invalidated context. */
export function safeSend<T>(promise: Promise<T>): void {
  if (!isContentScriptAlive()) {
    markContentScriptInvalidated();
    return;
  }
  promise.catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('reloaded') || msg.includes('invalidated')) {
      markContentScriptInvalidated();
    }
  });
}
