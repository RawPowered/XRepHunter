import { sendMessage } from '../../lib/messaging';
import type { ExtensionSettings } from '../../lib/types';
import { ALL_X_RULES, X_ALGORITHM_SOURCE_URL } from '../../lib/x-algorithm/rules';
import type {
  AccountInsights,
  AnalyticsHistoryEntry,
  AnalyticsImportResult,
  BlockSuggestion,
  DetectorId,
  ExportBundle,
  PrimaryAccount,
  ReputationResult,
  SpamExample,
  TrustedUser,
} from '../../lib/types';
import {
  renderHistoryTable,
  renderInsightsBlock,
  renderMetricCards,
  renderPostsTable,
  renderSparklines,
} from './analytics-ui';
import { coerceScoreBreakdown } from '../../lib/scoring/normalize-result';
import { SPAM_LIBRARY_BOOST, STAGE_MULTIPLIERS } from '../../lib/x-algorithm/weights';
import { DETECTOR_LABELS, STAGE_LABELS } from './labels';
import { initObservatoryTab, loadObservatoryTab } from './observatory-tab';
import {
  initModelTabs,
  loadSlopSettings,
  loadToxicitySettings,
  wireModelRuntimeMessages,
} from './model-tabs';
import { saveSettings } from './settings-shared';

document.querySelectorAll('.tabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.getAttribute('data-tab')}`)?.classList.add('active');
    if (btn.getAttribute('data-tab') === 'analytics') void loadAnalyticsTab();
    if (btn.getAttribute('data-tab') === 'observatory') void loadObservatoryTab();
  });
});

const learningEl = document.getElementById('learning-mode') as HTMLInputElement;
const autoSuggestEl = document.getElementById('auto-suggest') as HTMLInputElement;
const agreedEl = document.getElementById('auto-block-agreed') as HTMLInputElement;
const sensitivityEl = document.getElementById('sensitivity') as HTMLInputElement;
const sensitivityVal = document.getElementById('sensitivity-val')!;
const thresholdEl = document.getElementById('threshold') as HTMLInputElement;
const detectorsEl = document.getElementById('detectors')!;
const xAlgoEl = document.getElementById('x-algorithm-alignment') as HTMLInputElement;
const spamBucketEl = document.getElementById('spam-bucket-weight') as HTMLInputElement;
const spamBucketVal = document.getElementById('spam-bucket-val')!;
const reputationCapEl = document.getElementById('reputation-cap') as HTMLInputElement;
const reputationBaselineEl = document.getElementById('reputation-baseline') as HTMLInputElement;
const reputationBaselineVal = document.getElementById('reputation-baseline-val')!;

async function loadSettings(): Promise<void> {
  const s = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  xAlgoEl.checked = s.xAlgorithmAlignment !== false;
  spamBucketEl.value = String(s.spamBucketWeight ?? 0.65);
  spamBucketVal.textContent = String(s.spamBucketWeight ?? 0.65);
  learningEl.checked = s.learningMode;
  autoSuggestEl.checked = s.autoSuggestEnabled;
  agreedEl.checked = s.autoBlockAgreed;
  sensitivityEl.value = String(s.sensitivity);
  sensitivityVal.textContent = String(s.sensitivity);
  thresholdEl.value = String(s.autoSuggestThreshold);
  reputationCapEl.value = String(s.reputationScoreCap ?? 95);
  reputationBaselineEl.value = String(s.reputationBaselineRisk ?? 0.06);
  reputationBaselineVal.textContent = String(s.reputationBaselineRisk ?? 0.06);

  detectorsEl.innerHTML = '';
  for (const [id, cfg] of Object.entries(s.detectors) as [DetectorId, { enabled: boolean; weight: number }][]) {
    if (id === 'aiVoice') continue;
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" data-detector="${id}" ${cfg.enabled ? 'checked' : ''} /> ${DETECTOR_LABELS[id]} (weight ${cfg.weight})`;
    detectorsEl.appendChild(label);
  }
}

xAlgoEl.addEventListener('change', () =>
  saveSettings({ xAlgorithmAlignment: xAlgoEl.checked }),
);
spamBucketEl.addEventListener('input', () => {
  spamBucketVal.textContent = spamBucketEl.value;
  saveSettings({ spamBucketWeight: parseFloat(spamBucketEl.value) });
});
learningEl.addEventListener('change', () => saveSettings({ learningMode: learningEl.checked }));
autoSuggestEl.addEventListener('change', () => {
  if (autoSuggestEl.checked && !agreedEl.checked) {
    alert('Please agree to block suggestions first.');
    autoSuggestEl.checked = false;
    return;
  }
  saveSettings({ autoSuggestEnabled: autoSuggestEl.checked });
});
agreedEl.addEventListener('change', () => {
  saveSettings({ autoBlockAgreed: agreedEl.checked });
  if (!agreedEl.checked) {
    autoSuggestEl.checked = false;
    saveSettings({ autoSuggestEnabled: false });
  }
});
sensitivityEl.addEventListener('input', () => {
  sensitivityVal.textContent = sensitivityEl.value;
  saveSettings({ sensitivity: parseFloat(sensitivityEl.value) });
});
thresholdEl.addEventListener('change', () =>
  saveSettings({ autoSuggestThreshold: parseInt(thresholdEl.value, 10) || 25 }),
);
reputationCapEl.addEventListener('change', () =>
  saveSettings({ reputationScoreCap: parseInt(reputationCapEl.value, 10) || 95 }),
);
reputationBaselineEl.addEventListener('input', () => {
  reputationBaselineVal.textContent = reputationBaselineEl.value;
  saveSettings({ reputationBaselineRisk: parseFloat(reputationBaselineEl.value) || 0.06 });
});

detectorsEl.addEventListener('change', async (e) => {
  const t = e.target as HTMLInputElement;
  if (!t.dataset.detector) return;
  const s = await sendMessage<ExtensionSettings>({ type: 'GET_SETTINGS' });
  const id = t.dataset.detector as DetectorId;
  s.detectors[id].enabled = t.checked;
  await saveSettings({ detectors: s.detectors });
});

async function loadExamples(): Promise<void> {
  const list = await sendMessage<SpamExample[]>({ type: 'GET_SPAM_EXAMPLES' });
  const ul = document.getElementById('examples-list')!;
  ul.innerHTML = list
    .map(
      (ex) => `
    <li class="item">
      <strong>@${ex.handle}</strong>
      <div class="meta">${ex.categories.join(', ')} Â· ${ex.keywords.slice(0, 5).join(', ')}</div>
      ${ex.note ? `<div>${ex.note}</div>` : ''}
      <button data-del="${ex.id}" style="margin-top:8px">Delete</button>
    </li>`,
    )
    .join('');
  ul.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await sendMessage({ type: 'DELETE_SPAM_EXAMPLE', id: (btn as HTMLElement).dataset.del! });
      void loadExamples();
    });
  });
}

document.getElementById('export-btn')!.addEventListener('click', async () => {
  const data = await sendMessage<ExportBundle>({ type: 'EXPORT_DATA' });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `xrephunter-export-${Date.now()}.json`;
  a.click();
});

document.getElementById('import-file')!.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text) as ExportBundle;
  await sendMessage({ type: 'IMPORT_DATA', data });
  alert('Import complete.');
  void loadExamples();
  void loadSettings();
});

async function loadQueue(): Promise<void> {
  const q = await sendMessage<BlockSuggestion[]>({ type: 'GET_QUEUE' });
  const ul = document.getElementById('queue-list')!;
  ul.innerHTML =
    q
      .slice(0, 50)
      .map(
        (item) => `
    <li class="item">
      <strong>@${item.handle}</strong> â€” score ${item.score} â€” ${item.status}
      <div class="meta">${item.hits.map((h) => h.label).join('; ')}</div>
    </li>`,
      )
      .join('') || '<li class="hint">No pending suggestions</li>';
}

const primaryHandleEl = document.getElementById('primary-handle') as HTMLInputElement;
const primaryLabelEl = document.getElementById('primary-label') as HTMLInputElement;
const primaryStatusEl = document.getElementById('primary-status')!;
const primaryLinkEl = document.getElementById('primary-profile-link')!;
const myAccountRepEl = document.getElementById('my-account-reputation')!;
const myAccountTeaserEl = document.getElementById('my-account-analytics-teaser')!;
const analyticsMetricEl = document.getElementById('analytics-metric-cards')!;
const analyticsHistoryEl = document.getElementById('analytics-history')!;
const analyticsTrendsEl = document.getElementById('analytics-trends')!;
const analyticsTopPostsEl = document.getElementById('analytics-top-posts')!;
const analyticsInsightsEl = document.getElementById('analytics-insights')!;
const analyticsImportStatusEl = document.getElementById('analytics-import-status')!;
const analyticsCsvFileEl = document.getElementById('analytics-csv-file') as HTMLInputElement;
const analyticsCsvImportBtn = document.getElementById('analytics-csv-import') as HTMLButtonElement;

let pendingCsvText: string | null = null;

function gotoAnalyticsTab(): void {
  document.querySelector<HTMLButtonElement>('[data-tab="analytics"]')?.click();
}

function renderMyAccountInsights(insights: AccountInsights | null): void {
  if (!insights) {
    myAccountRepEl.innerHTML = '<p class="hint">Save your @handle above to get started.</p>';
    myAccountTeaserEl.innerHTML = '';
    return;
  }

  const r = insights.reputation;
  if (r) {
    const slopSig = r.slop?.signals?.length ? ` Â· ${r.slop.signals.join(', ')}` : '';
    const slop = r.slop
      ? `<p class="meta">Slop: ${r.slop.combined} (heuristic ${r.slop.heuristic}${r.slop.model != null ? `, model ${r.slop.model}` : ''}${slopSig})</p>`
      : '';
    const hits =
      r.hits.length > 0
        ? `<ul>${r.hits
            .slice(0, 8)
            .map((h) => `<li><strong>${h.label}</strong>${h.detail ? ` â€” ${h.detail}` : ''}</li>`)
            .join('')}</ul>`
        : '<p class="meta">No risk signals.</p>';
    myAccountRepEl.innerHTML = `
      <div class="score-big ${r.band}">${r.score}</div>
      <p>@${insights.handle} Â· ${r.band.replace('_', ' ')}</p>
      <p class="meta">Spam/X risk ${coerceScoreBreakdown(r.breakdown, r.score).spamRisk}% · General ${coerceScoreBreakdown(r.breakdown, r.score).generalRisk}%</p>
      ${slop}
      <h3>Signals</h3>
      ${hits}
    `;
  } else {
    myAccountRepEl.innerHTML =
      '<p class="hint">No reputation scan yet â€” click Refresh reputation. Open your profile on X for richer data.</p>';
  }

  const a = insights.analytics;
  if (a?.impressions != null) {
    myAccountTeaserEl.innerHTML = `Latest: <strong>${a.impressions.toLocaleString()}</strong> impressions (${a.source}). <button type="button" class="link-btn" id="goto-analytics-btn">View analytics â†’</button>`;
    document.getElementById('goto-analytics-btn')?.addEventListener('click', gotoAnalyticsTab);
  } else {
    myAccountTeaserEl.innerHTML =
      'No analytics yet â€” <button type="button" class="link-btn" id="goto-analytics-btn">import CSV or sync on X</button>.';
    document.getElementById('goto-analytics-btn')?.addEventListener('click', gotoAnalyticsTab);
  }
}

async function loadAnalyticsTab(): Promise<void> {
  const account = await sendMessage<PrimaryAccount | undefined>({ type: 'GET_PRIMARY_ACCOUNT' });
  if (!account) {
    analyticsMetricEl.innerHTML = '<p class="hint">Save your @handle on My account first.</p>';
    analyticsHistoryEl.innerHTML = '';
    analyticsTrendsEl.innerHTML = '';
    analyticsTopPostsEl.innerHTML = '';
    analyticsInsightsEl.innerHTML = '';
    return;
  }

  const [insights, history] = await Promise.all([
    sendMessage<AccountInsights | null>({ type: 'GET_ACCOUNT_INSIGHTS' }),
    sendMessage<AnalyticsHistoryEntry[]>({ type: 'GET_ANALYTICS_HISTORY' }),
  ]);

  const snap = insights?.analytics;
  if (snap) {
    analyticsMetricEl.innerHTML = renderMetricCards(snap);
    analyticsTopPostsEl.innerHTML = renderPostsTable(snap.tweets ?? []);
  } else {
    analyticsMetricEl.innerHTML =
      '<p class="hint">No data yet â€” import a CSV below or visit X Account analytics.</p>';
    analyticsTopPostsEl.innerHTML = '';
  }

  analyticsHistoryEl.innerHTML = renderHistoryTable(history);
  analyticsTrendsEl.innerHTML = renderSparklines(history);
  analyticsInsightsEl.innerHTML = renderInsightsBlock(insights);
}

analyticsCsvFileEl.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  pendingCsvText = file ? await file.text() : null;
  analyticsCsvImportBtn.disabled = !pendingCsvText;
  analyticsImportStatusEl.textContent = file ? `Selected: ${file.name}` : '';
});

analyticsCsvImportBtn.addEventListener('click', async () => {
  if (!pendingCsvText) return;
  analyticsImportStatusEl.textContent = 'Importingâ€¦';
  analyticsCsvImportBtn.disabled = true;
  const res = await sendMessage<AnalyticsImportResult>({
    type: 'IMPORT_ANALYTICS_CSV',
    csv: pendingCsvText,
  });
  if (res?.ok) {
    const warn = res.warnings.length ? ` ${res.warnings.join(' ')}` : '';
    analyticsImportStatusEl.textContent = `Import saved.${warn}`;
    analyticsImportStatusEl.className = 'import-status ok';
    pendingCsvText = null;
    analyticsCsvFileEl.value = '';
    void loadAnalyticsTab();
    void loadPrimaryAccountUi();
  } else {
    analyticsImportStatusEl.textContent = res?.error ?? 'Import failed.';
    analyticsImportStatusEl.className = 'import-status err';
    analyticsCsvImportBtn.disabled = false;
  }
});

async function loadPrimaryAccountUi(): Promise<void> {
  const account = await sendMessage<PrimaryAccount | undefined>({ type: 'GET_PRIMARY_ACCOUNT' });
  if (account) {
    primaryHandleEl.value = account.handle;
    primaryLabelEl.value = account.displayLabel ?? '';
    primaryLinkEl.innerHTML = `<a href="https://x.com/${account.handle}" target="_blank" rel="noopener">Open @${account.handle} on X</a>`;
    if (account.lastScannedAt) {
      primaryStatusEl.textContent = `Last scanned: ${new Date(account.lastScannedAt).toLocaleString()}`;
    }
  }
  const insights = await sendMessage<AccountInsights | null>({ type: 'GET_ACCOUNT_INSIGHTS' });
  renderMyAccountInsights(insights);
}

document.getElementById('primary-save')!.addEventListener('click', async () => {
  const handle = primaryHandleEl.value.trim().replace(/^@/, '');
  if (!handle) {
    primaryStatusEl.textContent = 'Enter a handle.';
    return;
  }
  const res = await sendMessage<{ ok: boolean; error?: string; account?: PrimaryAccount }>({
    type: 'SET_PRIMARY_ACCOUNT',
    handle,
    displayLabel: primaryLabelEl.value.trim() || undefined,
  });
  if (!res?.ok) {
    primaryStatusEl.textContent = res?.error ?? 'Save failed.';
    return;
  }
  primaryStatusEl.textContent = `Saved @${handle}. Open your profile on X for a full scan.`;
  void loadPrimaryAccountUi();
});

document.getElementById('primary-refresh')!.addEventListener('click', async () => {
  primaryStatusEl.textContent = 'Scanningâ€¦';
  const res = await sendMessage<{ ok: boolean; error?: string }>({ type: 'SCAN_PRIMARY_ACCOUNT' });
  if (!res?.ok) {
    primaryStatusEl.textContent = res?.error ?? 'Scan failed. Save your handle first.';
    return;
  }
  primaryStatusEl.textContent = 'Scan complete. Open your profile on X if data looks stale.';
  void loadPrimaryAccountUi();
});

async function loadTrusted(): Promise<void> {
  const list = await sendMessage<TrustedUser[]>({ type: 'GET_TRUSTED' });
  const ul = document.getElementById('trusted-list')!;
  ul.innerHTML =
    list
      .map(
        (t) => `
    <li class="item">
      <strong>@${t.handle}</strong>
      <div class="meta">Since ${new Date(t.addedAt).toLocaleDateString()}</div>
      ${t.note ? `<div>${t.note}</div>` : ''}
      <button data-untrust="${t.handle}" style="margin-top:8px">Remove trust</button>
    </li>`,
      )
      .join('') || '<li class="hint">No trusted accounts yet.</li>';
  ul.querySelectorAll('[data-untrust]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await sendMessage({ type: 'REMOVE_TRUSTED', handle: (btn as HTMLElement).dataset.untrust! });
      void loadTrusted();
    });
  });
}

function renderXAlgorithmRules(): void {
  const el = document.getElementById('x-rules-list')!;
  const byStage = new Map<string, typeof ALL_X_RULES>();
  for (const rule of ALL_X_RULES) {
    const list = byStage.get(rule.stage) ?? [];
    list.push(rule);
    byStage.set(rule.stage, list);
  }
  const stageInfo = Object.entries(STAGE_MULTIPLIERS)
    .map(([k, v]) => `${k}: ×${v}`)
    .join(' · ');
  let html = `<p class="hint">Scoring: overall = 100 − (spamBucketWeight × spamRisk + (1−spamBucketWeight) × generalRisk). Spam library boost: ×${SPAM_LIBRARY_BOOST}. Stage multipliers: ${stageInfo}</p>`;
  html += `<p class="hint">Source: <a href="${X_ALGORITHM_SOURCE_URL}" target="_blank" rel="noopener">${X_ALGORITHM_SOURCE_URL}</a></p>`;
  for (const [stage, rules] of byStage) {
    html += `<h2>${STAGE_LABELS[stage] ?? stage}</h2><ul>`;
    for (const r of rules) {
      const dets = r.detectorIds.length
        ? r.detectorIds.map((id) => DETECTOR_LABELS[id] ?? id).join(', ')
        : 'Profile health only';
      html += `<li class="item"><strong>${r.name}</strong> <span class="meta">(${r.id})</span><div>${r.purpose}</div><div class="meta">XRepHunter: ${dets}</div></li>`;
    }
    html += '</ul>';
  }
  el.innerHTML = html;
}


initObservatoryTab();
initModelTabs();
wireModelRuntimeMessages();

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'ANALYTICS_CAPTURED') {
    void loadPrimaryAccountUi();
    void loadAnalyticsTab();
  }
});

void loadSettings();
void loadSlopSettings();
void loadToxicitySettings();
void loadPrimaryAccountUi();
void loadTrusted();
void loadExamples();
void loadQueue();
renderXAlgorithmRules();
