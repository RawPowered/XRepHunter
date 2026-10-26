import { isExtensionContextInvalidated } from '../../lib/messaging';

export function installBackgroundErrorHandlers(): void {
  globalThis.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (
      isExtensionContextInvalidated(reason) ||
      msg.includes('Extension context invalidated')
    ) {
      event.preventDefault();
    }
  });
}
