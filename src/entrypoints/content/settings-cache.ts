import { sendMessage } from '../../lib/messaging';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../../lib/types';
import { cs } from './state';

/** Cached settings with safe fallback when the background is unreachable. */
export async function getContentSettings(): Promise<ExtensionSettings> {
  if (cs.cachedSettings) return cs.cachedSettings;
  try {
    cs.cachedSettings = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  } catch {
    cs.cachedSettings = { ...DEFAULT_SETTINGS };
  }
  return cs.cachedSettings;
}
