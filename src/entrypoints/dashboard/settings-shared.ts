import { sendMessage } from '../../lib/messaging';
import type { ExtensionSettings } from '../../lib/types';

export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  await sendMessage({ type: 'SAVE_SETTINGS', settings: partial });
}
