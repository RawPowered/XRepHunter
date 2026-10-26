import type { AttentionSnapshot } from '../../attention/aggregate';
import type { BrowseStatsSnapshot } from '../../browse/stats';
import { buildAccountIntelligence } from './account-intelligence';
import { buildAttentionBreakdown } from './attention-breakdown';
import { buildCompositionWithBrowseFallback } from './composition';
import { buildCopypastaClusters } from './copypasta-clusters';
import { dashboardToCsv, dashboardToSummaryJson } from './export';
import type { DashboardFilters, DashboardView } from './filters';
import { applyRowFilters } from './filters';
import { buildInteractionBreakdown } from './interaction-breakdown';
import { buildOverviewWithBrowse } from './overview';
import { buildProvenanceBreakdown } from './provenance-breakdown';
import { loadDashboardRows, sessionRowsToDashboardRows } from './row-source';
import { buildTrends } from './trends';

export interface DashboardSessionContext {
  browse?: BrowseStatsSnapshot;
  attention?: AttentionSnapshot;
  attentionRows?: import('../../attention/aggregate').PostAttentionRow[];
}

export async function buildDashboardResponse(
  view: DashboardView,
  filters: DashboardFilters,
  trustedHandles: Set<string>,
  session?: DashboardSessionContext,
): Promise<unknown> {
  let rows =
    filters.range === 'session' && session?.attentionRows
      ? sessionRowsToDashboardRows(session.attentionRows)
      : await loadDashboardRows(filters);

  rows = applyRowFilters(rows, filters, trustedHandles);

  switch (view) {
    case 'overview':
      return buildOverviewWithBrowse(
        rows,
        filters,
        trustedHandles,
        session?.browse,
        session?.attention,
      );
    case 'composition':
      return buildCompositionWithBrowseFallback(rows, filters, trustedHandles);
    case 'attention':
      return buildAttentionBreakdown(rows, filters, trustedHandles);
    case 'interaction':
      return buildInteractionBreakdown(rows, filters, trustedHandles);
    case 'accounts':
      return buildAccountIntelligence(filters, trustedHandles);
    case 'provenance':
      return buildProvenanceBreakdown(rows, filters, trustedHandles);
    case 'copypasta':
      return buildCopypastaClusters(filters);
    case 'trends':
      return buildTrends(rows, filters, trustedHandles);
    default:
      return {};
  }
}

export async function exportDashboardData(
  view: DashboardView,
  filters: DashboardFilters,
  trustedHandles: Set<string>,
  format: 'csv' | 'json',
  session?: DashboardSessionContext,
): Promise<{ content: string; filename: string; mimeType: string }> {
  const data = await buildDashboardResponse(view, filters, trustedHandles, session);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    return {
      content: dashboardToCsv(view, data),
      filename: `xrephunter-${view}-${stamp}.csv`,
      mimeType: 'text/csv',
    };
  }
  return {
    content: dashboardToSummaryJson(view, data),
    filename: `xrephunter-${view}-${stamp}.json`,
    mimeType: 'application/json',
  };
}
