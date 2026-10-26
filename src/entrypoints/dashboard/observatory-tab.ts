import { sendMessage } from '../../lib/messaging';
import type { DashboardView } from '../../lib/feed/dashboard/filters';
import { renderOverviewView } from './analytics-overview';
import { renderAttentionView } from './attention-view';
import { renderAccountIntelligenceView, wireAccountIntelligenceToolbar } from './account-intelligence-view';
import {
  downloadText,
  wireSortableTables,
} from './chart-utils';
import {
  getDashboardFilters,
  getDashboardView,
  readFiltersFromDom,
  scheduleReload,
  setDashboardView,
  subscribeDashboardReload,
  syncFiltersFromDom,
} from './dashboard-state';
import { renderCompositionView } from './feed-composition-view';
import { initBrowseTopicsSettingsUi } from './browse-topics-settings';
import { renderInteractionView } from './interaction-view';
import { renderProvenanceView } from './provenance-view';
import { renderRecycledView } from './recycled-view';
import { renderTrendsView } from './trends-view';

let pollTimer: number | null = null;
let accountToolbarWired = false;

async function fetchViewData(view: DashboardView): Promise<unknown> {
  const filters = getDashboardFilters();
  return sendMessage({ type: 'GET_DASHBOARD_DATA', view, filters });
}

function renderView(view: DashboardView, data: unknown): string {
  switch (view) {
    case 'overview':
      return renderOverviewView(data as Parameters<typeof renderOverviewView>[0]);
    case 'composition':
      return renderCompositionView(data as Parameters<typeof renderCompositionView>[0]);
    case 'attention':
      return renderAttentionView(data as Parameters<typeof renderAttentionView>[0]);
    case 'interaction':
      return renderInteractionView(data as Parameters<typeof renderInteractionView>[0]);
    case 'accounts':
      return renderAccountIntelligenceView(data as Parameters<typeof renderAccountIntelligenceView>[0]);
    case 'provenance':
      return renderProvenanceView(data as Parameters<typeof renderProvenanceView>[0]);
    case 'copypasta':
      return renderRecycledView(data as Parameters<typeof renderRecycledView>[0]);
    case 'trends':
      return renderTrendsView(data as Parameters<typeof renderTrendsView>[0]);
    default:
      return '<p class="hint">Unknown view.</p>';
  }
}

export async function loadObservatoryPanel(): Promise<void> {
  const panel = document.getElementById('observatory-panel');
  if (!panel) return;
  const view = getDashboardView();
  panel.innerHTML = '<p class="hint">Loading…</p>';
  try {
    const data = await fetchViewData(view);
    panel.innerHTML = renderView(view, data);
    wireSortableTables(panel);
    if (view === 'accounts' && !accountToolbarWired) {
      wireAccountIntelligenceToolbar(() => void loadObservatoryPanel());
      accountToolbarWired = true;
    }
    const acctFilter = document.getElementById('obs-account-filter') as HTMLSelectElement | null;
    if (acctFilter) {
      acctFilter.value = getDashboardFilters().accountFilter ?? 'all';
      acctFilter.addEventListener('change', () => {
        syncFiltersFromDom();
        scheduleReload(0);
      });
    }
  } catch (e) {
    panel.innerHTML = `<p class="hint">${e instanceof Error ? e.message : 'Failed to load observatory data'}</p>`;
  }
}

function setActiveSubnav(view: DashboardView): void {
  document.querySelectorAll('[data-obs-view]').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.obsView === view);
  });
}

function startPoll(): void {
  if (pollTimer != null) return;
  pollTimer = window.setInterval(() => {
    const tab = document.getElementById('tab-observatory');
    if (tab?.classList.contains('active')) void loadObservatoryPanel();
  }, 10000);
}

function stopPoll(): void {
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function exportView(format: 'csv' | 'json'): Promise<void> {
  const view = getDashboardView();
  const filters = getDashboardFilters();
  const res = await sendMessage<{ content: string; filename: string; mimeType: string }>({
    type: 'EXPORT_DASHBOARD_DATA',
    view,
    filters,
    format,
  });
  downloadText(res.content, res.filename, res.mimeType);
}

export function initObservatoryTab(): void {
  initBrowseTopicsSettingsUi();

  document.querySelectorAll('[data-obs-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = (btn as HTMLElement).dataset.obsView as DashboardView;
      setDashboardView(view);
      setActiveSubnav(view);
      void loadObservatoryPanel();
    });
  });

  const filterIds = [
    'obs-range',
    'obs-surface',
    'obs-topic',
    'obs-handle',
    'obs-provenance',
    'obs-min-slop',
    'obs-min-spam',
    'obs-min-tox',
    'obs-interaction-only',
    'obs-non-trusted',
    'obs-trends-granularity',
  ];
  for (const id of filterIds) {
    const el = document.getElementById(id);
    el?.addEventListener('change', () => {
      syncFiltersFromDom();
      scheduleReload();
    });
    el?.addEventListener('input', () => {
      syncFiltersFromDom();
      scheduleReload();
    });
  }

  document.getElementById('obs-export-csv')?.addEventListener('click', () => void exportView('csv'));
  document.getElementById('obs-export-json')?.addEventListener('click', () => void exportView('json'));

  document.getElementById('obs-topics-toggle')?.addEventListener('click', () => {
    const el = document.getElementById('obs-topics-panel');
    if (el) el.hidden = !el.hidden;
  });

  subscribeDashboardReload(() => void loadObservatoryPanel());

  setActiveSubnav(getDashboardView());
  syncFiltersFromDom();
  startPoll();
}

export async function loadObservatoryTab(): Promise<void> {
  syncFiltersFromDom();
  await loadObservatoryPanel();
}

export { stopPoll };
