import {
  actionTotal,
  applyRowFilters,
  focusedMs,
  pct,
  rollupByKey,
  type DashboardFilters,
  type DashboardRow,
} from './filters';
import {
  maxEvidenceConfidence,
  PROVENANCE_CATEGORY_LABELS,
  topEvidenceSignals,
  type ProvenanceDisplayCategory,
} from './provenance-display';

export interface ProvenanceCategoryBlock {
  category: ProvenanceDisplayCategory;
  label: string;
  postsSeen: number;
  focusedMs: number;
  actions: number;
  topAuthors: Array<{ key: string; postsSeen: number }>;
  topTopics: Array<{ key: string; postsSeen: number }>;
  topDomains: Array<{ key: string; postsSeen: number }>;
  trendByDay: Array<{ dayKey: string; count: number }>;
  topEvidence: Array<{ id: string; label: string; count: number; maxConfidence: number }>;
  examples: Array<{
    postFingerprint: string;
    handle: string;
    statusId?: string;
    confidence: number;
    signals: string[];
  }>;
}

export interface ProvenanceBreakdownResponse {
  categories: ProvenanceCategoryBlock[];
  totalPosts: number;
}

const ALL_CATEGORIES: ProvenanceDisplayCategory[] = [
  'organic_likely',
  'official_ad',
  'disclosed_sponsor',
  'suspected_influencer_ad',
  'affiliate_promo',
  'monetization_likely',
  'ai_likely',
  'recycled_likely',
  'automation_likely',
  'unknown',
];

export function buildProvenanceBreakdown(
  rows: DashboardRow[],
  filters: DashboardFilters,
  trustedHandles: Set<string>,
): ProvenanceBreakdownResponse {
  const filtered = applyRowFilters(rows, filters, trustedHandles);

  const categories: ProvenanceCategoryBlock[] = ALL_CATEGORIES.map((category) => {
    const catRows = filtered.filter((r) => r.displayCategory === category);
    const evidenceCounts = new Map<string, { label: string; count: number; maxConfidence: number }>();

    for (const r of catRows) {
      for (const e of r.evidence ?? []) {
        const cur = evidenceCounts.get(e.id) ?? { label: e.label, count: 0, maxConfidence: 0 };
        cur.count++;
        cur.maxConfidence = Math.max(cur.maxConfidence, e.confidence);
        evidenceCounts.set(e.id, cur);
      }
    }

    const trendByDay = new Map<string, number>();
    for (const r of catRows) {
      trendByDay.set(r.dayKey, (trendByDay.get(r.dayKey) ?? 0) + 1);
    }

    const examples = catRows
      .slice(0, 5)
      .map((r) => ({
        postFingerprint: r.postFingerprint,
        handle: r.handle,
        statusId: r.statusId,
        confidence: maxEvidenceConfidence(r.evidence ?? []),
        signals: topEvidenceSignals(r.evidence ?? [], 3).map((e) => e.label),
      }));

    return {
      category,
      label: PROVENANCE_CATEGORY_LABELS[category],
      postsSeen: catRows.length,
      focusedMs: catRows.reduce((s, r) => s + focusedMs(r), 0),
      actions: catRows.reduce((s, r) => s + actionTotal(r), 0),
      topAuthors: rollupByKey(catRows, (r) => (r.handle ? r.handle.toLowerCase() : null))
        .slice(0, 5)
        .map((d) => ({ key: d.key, postsSeen: d.postsSeen })),
      topTopics: rollupByKey(catRows, (r) => r.topics ?? [])
        .slice(0, 5)
        .map((d) => ({ key: d.key, postsSeen: d.postsSeen })),
      topDomains: rollupByKey(catRows, (r) => (r.cardDomain ? r.cardDomain.toLowerCase() : null))
        .slice(0, 5)
        .map((d) => ({ key: d.key, postsSeen: d.postsSeen })),
      trendByDay: [...trendByDay.entries()]
        .map(([dayKey, count]) => ({ dayKey, count }))
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
      topEvidence: [...evidenceCounts.entries()]
        .map(([id, v]) => ({ id, label: v.label, count: v.count, maxConfidence: v.maxConfidence }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      examples,
    };
  }).filter((c) => c.postsSeen > 0 || filters.provenanceCategory === c.category);

  return { categories, totalPosts: filtered.length };
}
