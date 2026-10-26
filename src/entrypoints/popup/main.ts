import { sendMessage } from '../../lib/messaging';
import type { ExtensionSettings } from '../../lib/types';

const enabledEl = document.getElementById('enabled') as HTMLInputElement;
const scansEl = document.getElementById('scans')!;
const flagsEl = document.getElementById('flags')!;

async function load(): Promise<void> {
  const [settings, stats] = await Promise.all([
    sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' }),
    sendMessage<Record<string, number>>({ type: 'GET_STATS' }),
  ]);
  enabledEl.checked = settings.enabled;
  scansEl.textContent = String(stats.scans ?? 0);
  flagsEl.textContent = String(stats.flags ?? 0);
}

enabledEl.addEventListener('change', async () => {
  await sendMessage({ type: 'SAVE_SETTINGS', settings: { enabled: enabledEl.checked } });
});

document.getElementById('open-dashboard')!.addEventListener('click', () => {
  browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') });
});

void load();
