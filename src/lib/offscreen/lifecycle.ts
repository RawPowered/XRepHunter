const OFFSCREEN_URL = 'offscreen.html';
const CREATE_DELAY_MS = 300;

let offscreenOpen = false;

export function markOffscreenClosed(): void {
  offscreenOpen = false;
}

/** Close zombie offscreen document after extension reload. */
export async function resetOffscreenDocument(): Promise<void> {
  try {
    await chrome.offscreen.closeDocument();
  } catch {
    /* no document open */
  }
  markOffscreenClosed();
}

/** Create offscreen document if missing (call after resetOffscreenDocument on startup). */
export async function ensureOffscreenDocument(justification: string): Promise<void> {
  if (offscreenOpen) return;

  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['WORKERS' as chrome.offscreen.Reason],
      justification,
    });
  } catch {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
    });
    if (existing.length === 0) throw new Error('Failed to create offscreen document');
  }

  offscreenOpen = true;
  await new Promise((r) => setTimeout(r, CREATE_DELAY_MS));
}
