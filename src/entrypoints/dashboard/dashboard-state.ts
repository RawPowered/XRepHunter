import type {
  DashboardFilters,
  DashboardRange,
  DashboardView,
  AccountIntelFilter,
  TrendsGranularity,
} from '../../lib/feed/dashboard/filters';
import { DEFAULT_DASHBOARD_FILTERS } from '../../lib/feed/dashboard/filters';

export type { DashboardView, DashboardFilters, DashboardRange };

let activeView: DashboardView = 'overview';
let filters: DashboardFilters = { ...DEFAULT_DASHBOARD_FILTERS };
let reloadTimer: number | null = null;
let onChange: (() => void) | null = null;

export function getDashboardView(): DashboardView {
  return activeView;
}

export function setDashboardView(view: DashboardView): void {
  activeView = view;
  onChange?.();
}

export function getDashboardFilters(): DashboardFilters {
  return { ...filters };
}

export function setDashboardFilters(partial: Partial<DashboardFilters>): void {
  filters = { ...filters, ...partial };
  scheduleReload();
}

export function scheduleReload(delayMs = 200): void {
  if (reloadTimer != null) window.clearTimeout(reloadTimer);
  reloadTimer = window.setTimeout(() => {
    reloadTimer = null;
    onChange?.();
  }, delayMs);
}

export function subscribeDashboardReload(fn: () => void): void {
  onChange = fn;
}

export function readFiltersFromDom(): DashboardFilters {
  const range = (document.getElementById('obs-range') as HTMLSelectElement | null)?.value as
    | DashboardRange
    | undefined;
  const surface = (document.getElementById('obs-surface') as HTMLSelectElement | null)?.value;
  const topic = (document.getElementById('obs-topic') as HTMLInputElement | null)?.value.trim();
  const handle = (document.getElementById('obs-handle') as HTMLInputElement | null)?.value
    .trim()
    .replace(/^@/, '');
  const provenanceCategory = (document.getElementById('obs-provenance') as HTMLSelectElement | null)
    ?.value;
  const minSlop = parseInt(
    (document.getElementById('obs-min-slop') as HTMLInputElement | null)?.value ?? '',
    10,
  );
  const minSpam = parseInt(
    (document.getElementById('obs-min-spam') as HTMLInputElement | null)?.value ?? '',
    10,
  );
  const minToxicity = parseInt(
    (document.getElementById('obs-min-tox') as HTMLInputElement | null)?.value ?? '',
    10,
  );
  const interactionOnly = (document.getElementById('obs-interaction-only') as HTMLInputElement | null)
    ?.checked;
  const nonTrustedOnly = (document.getElementById('obs-non-trusted') as HTMLInputElement | null)
    ?.checked;
  const accountFilter = (document.getElementById('obs-account-filter') as HTMLSelectElement | null)
    ?.value as AccountIntelFilter | undefined;
  const trendsGranularity = (document.getElementById('obs-trends-granularity') as HTMLSelectElement | null)
    ?.value as TrendsGranularity | undefined;

  return {
    range: range ?? filters.range,
    surface: surface && surface !== '' ? surface : undefined,
    topic: topic || undefined,
    handle: handle || undefined,
    provenanceCategory: provenanceCategory && provenanceCategory !== '' ? provenanceCategory : undefined,
    minSlop: Number.isFinite(minSlop) ? minSlop : undefined,
    minSpam: Number.isFinite(minSpam) ? minSpam : undefined,
    minToxicity: Number.isFinite(minToxicity) ? minToxicity : undefined,
    interactionOnly: interactionOnly || undefined,
    nonTrustedOnly: nonTrustedOnly || undefined,
    accountFilter: accountFilter && accountFilter !== 'all' ? accountFilter : undefined,
    trendsGranularity: trendsGranularity ?? filters.trendsGranularity,
  };
}

export function syncFiltersFromDom(): void {
  filters = readFiltersFromDom();
}
