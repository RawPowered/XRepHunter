/** Fire-and-forget runtime message from offscreen; never throws on invalidated context. */
export function safeRuntimeSend(message: object): void {
  try {
    if (!browser.runtime?.id) return;
    void browser.runtime.sendMessage(message).catch(() => {});
  } catch {
    /* extension context invalidated */
  }
}
