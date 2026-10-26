/** Wake or re-inject content scripts on X tabs after extension reload. */
export async function refreshXContentTabs(): Promise<void> {
  const tabs = await browser.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
  for (const tab of tabs) {
    if (!tab.id) continue;
    const pinged = await browser.tabs
      .sendMessage(tab.id, { type: 'XREP_BOOTSTRAP' })
      .then(() => true)
      .catch(() => false);
    if (pinged) continue;
    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    } catch {
      /* tab may not allow injection — user must refresh */
    }
  }
}
