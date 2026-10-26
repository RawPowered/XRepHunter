import { getSettings, saveSettings } from '../../lib/storage';
import type { CustomBrowseInterest, ExtensionSettings } from '../../lib/types';

function renderEditor(interests: CustomBrowseInterest[]): void {
  const el = document.getElementById('custom-browse-interests-editor');
  if (!el) return;
  if (!interests.length) {
    el.innerHTML =
      '<p class="hint">No custom interests yet. Add keywords for niches like mecha, gardening, etc.</p>';
    return;
  }
  el.innerHTML = interests
    .map((c, i) => {
      const tags = (c.hashtags ?? []).join(', ');
      return `<div class="custom-interest-row" data-idx="${i}">
      <label>Label <input type="text" class="ci-label" value="${escapeAttr(c.label)}" /></label>
      <label>Keywords (comma-separated) <input type="text" class="ci-keywords" value="${escapeAttr(c.keywords.join(', '))}" /></label>
      <label>Hashtags (optional) <input type="text" class="ci-hashtags" value="${escapeAttr(tags)}" /></label>
      <button type="button" class="ci-remove">Remove</button>
    </div>`;
    })
    .join('');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function readEditor(): CustomBrowseInterest[] {
  const rows = document.querySelectorAll('.custom-interest-row');
  const out: CustomBrowseInterest[] = [];
  rows.forEach((row, i) => {
    const label = (row.querySelector('.ci-label') as HTMLInputElement)?.value.trim();
    const kw = (row.querySelector('.ci-keywords') as HTMLInputElement)?.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const tags = (row.querySelector('.ci-hashtags') as HTMLInputElement)?.value
      .split(',')
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean);
    if (!label || !kw.length) return;
    out.push({
      id: `custom-${i}-${label.toLowerCase().replace(/\W+/g, '-').slice(0, 20)}`,
      label,
      keywords: kw,
      hashtags: tags.length ? tags : undefined,
    });
  });
  return out;
}

export async function loadBrowseTopicsSettings(): Promise<void> {
  const s = await getSettings();
  const enabled = document.getElementById('browse-topics-enabled') as HTMLInputElement | null;
  const clip = document.getElementById('browse-topic-clip-enabled') as HTMLInputElement | null;
  if (enabled) enabled.checked = s.browseTopicsEnabled !== false;
  if (clip) clip.checked = s.browseTopicClipEnabled !== false;
  renderEditor(s.customBrowseInterests ?? []);
}

export function initBrowseTopicsSettingsUi(): void {
  void loadBrowseTopicsSettings();

  document.getElementById('browse-topics-save')?.addEventListener('click', async () => {
    const status = document.getElementById('browse-topics-save-status');
    const enabled = (document.getElementById('browse-topics-enabled') as HTMLInputElement).checked;
    const clip = (document.getElementById('browse-topic-clip-enabled') as HTMLInputElement).checked;
    const customBrowseInterests = readEditor();
    const prev = await getSettings();
    const next: ExtensionSettings = {
      ...prev,
      browseTopicsEnabled: enabled,
      browseTopicClipEnabled: clip,
      customBrowseInterests,
    };
    await saveSettings(next);
    if (status) status.textContent = 'Saved.';
    renderEditor(customBrowseInterests);
  });

  const editor = document.getElementById('custom-browse-interests-editor');
  if (editor?.parentElement && !document.querySelector('.browse-topics-add')) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add custom interest';
    addBtn.className = 'browse-topics-add';
    addBtn.addEventListener('click', async () => {
      const s = await getSettings();
      const list = [...(s.customBrowseInterests ?? []), { id: 'new', label: 'New', keywords: [] }];
      renderEditor(list);
    });
    editor.parentElement.insertBefore(addBtn, editor.nextSibling);
  }

  document.getElementById('custom-browse-interests-editor')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.ci-remove');
    if (!btn) return;
    btn.closest('.custom-interest-row')?.remove();
  });
}
