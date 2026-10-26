import type { MessageType } from './types';

export function isExtensionContextInvalidated(err: unknown): boolean {
  const msgText = err instanceof Error ? err.message : String(err);
  return msgText.includes('Extension context invalidated');
}

export function isRuntimeMessageError(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  );
}

/** True when the extension was reloaded but this tab still has an old content script. */
export function isExtensionContextAlive(): boolean {
  try {
    return Boolean(browser.runtime?.id);
  } catch {
    return false;
  }
}

export function sendMessage<T extends MessageType, R = unknown>(msg: T): Promise<R> {
  return browser.runtime.sendMessage(msg).then((res) => {
    if (isRuntimeMessageError(res)) {
      return Promise.reject(new Error(res.error));
    }
    return res as R;
  }).catch((err: unknown) => {
    if (isExtensionContextInvalidated(err)) {
      return Promise.reject(new Error('Extension was reloaded — refresh this X tab.'));
    }
    return Promise.reject(err);
  });
}
export function onMessage(
  handler: (msg: MessageType, sender: Browser.runtime.MessageSender) => Promise<unknown> | unknown,
): void {
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      const result = handler(msg as MessageType, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch((err) => sendResponse({ error: String(err) }));
        return true;
      }
      sendResponse(result);
    } catch (err) {
      sendResponse({ error: String(err) });
    }
    return true;
  });
}
