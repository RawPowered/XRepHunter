import { dbQuery } from '../../db/bridge';
import { clampDayLimit, resolveDayLimit, type AccountIntelFilter, type DashboardFilters } from './filters';
import type { AccountRow } from '../../db/repositories/accounts';

export interface AccountIntelRow {
  handle: string;
  postsSeen: number;
  focusedMs: number;
  actions: number;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  isTrusted: boolean;
  reputationScore: number | null;
  band: string | null;
  avgSlop: number | null;
  avgSpam: number | null;
  avgToxicity: number | null;
  noteRate: number | null;
  sponsoredExposure: number;
  aiRatePct: number;
  recycledRatePct: number;
  accountKind: string | null;
}

export interface AccountIntelligenceResponse {
  accounts: AccountIntelRow[];
  total: number;
}

async function loadReachAggregates(filters: DashboardFilters) {
  const dayLimit = clampDayLimit(resolveDayLimit(filters.range));
  const sql =
    dayLimit <= 0
      ? `SELECT handle,
                SUM(posts_exposed) AS posts_exposed,
                SUM(focused_weighted_ms) AS focused_weighted_ms,
                SUM(actions) AS actions,
                SUM(sponsored_exposure) AS sponsored_exposure,
                SUM(ai_assisted_exposure) AS ai_assisted_exposure,
                SUM(copypasta_exposure) AS copypasta_exposure,
                MAX(account_kind) AS account_kind
         FROM account_reach_daily
         GROUP BY handle`
      : `SELECT handle,
                SUM(posts_exposed) AS posts_exposed,
                SUM(focused_weighted_ms) AS focused_weighted_ms,
                SUM(actions) AS actions,
                SUM(sponsored_exposure) AS sponsored_exposure,
                SUM(ai_assisted_exposure) AS ai_assisted_exposure,
                SUM(copypasta_exposure) AS copypasta_exposure,
                MAX(account_kind) AS account_kind
         FROM account_reach_daily
         WHERE day_key IN (
           SELECT DISTINCT day_key FROM account_reach_daily ORDER BY day_key DESC LIMIT ?
         )
         GROUP BY handle`;
  const params = dayLimit <= 0 ? [] : [dayLimit];
  const { rows } = await dbQuery(sql, params);
  return rows;
}

async function loadAttentionByHandle(filters: DashboardFilters) {
  const dayLimit = clampDayLimit(resolveDayLimit(filters.range));
  const sql =
    dayLimit <= 0
      ? `SELECT handle, MIN(first_seen_at) AS first_seen, MAX(last_seen_at) AS last_seen,
                AVG(slop_score) AS avg_slop, AVG(spam_score) AS avg_spam, AVG(toxicity_score) AS avg_tox,
                COUNT(*) AS posts_seen,
                SUM(focused_weighted_ms) AS focused_ms,
                SUM(likes + reposts + replies + quotes) AS actions
         FROM post_attention_daily
         WHERE handle != ''
         GROUP BY handle`
      : `SELECT handle, MIN(first_seen_at) AS first_seen, MAX(last_seen_at) AS last_seen,
                AVG(slop_score) AS avg_slop, AVG(spam_score) AS avg_spam, AVG(toxicity_score) AS avg_tox,
                COUNT(*) AS posts_seen,
                SUM(focused_weighted_ms) AS focused_ms,
                SUM(likes + reposts + replies + quotes) AS actions
         FROM post_attention_daily
         WHERE day_key IN (
           SELECT DISTINCT day_key FROM post_attention_daily ORDER BY day_key DESC LIMIT ?
         ) AND handle != ''
         GROUP BY handle`;
  const params = dayLimit <= 0 ? [] : [dayLimit];
  const { rows } = await dbQuery(sql, params);
  return rows;
}

async function loadAccountRows(handles: string[]): Promise<Map<string, AccountRow>> {
  if (!handles.length) return new Map();
  const placeholders = handles.map(() => '?').join(',');
  const { rows } = await dbQuery(
    `SELECT * FROM accounts WHERE handle IN (${placeholders})`,
    handles.map((h) => h.toLowerCase()),
  );
  const map = new Map<string, AccountRow>();
  for (const r of rows) {
    map.set(String(r.handle).toLowerCase(), {
      handle: String(r.handle),
      display_name: r.display_name != null ? String(r.display_name) : null,
      current_score: Number(r.current_score),
      band: String(r.band),
      spam_risk: Number(r.spam_risk),
      general_risk: Number(r.general_risk),
      note_rate: Number(r.note_rate),
      avg_post_spam: Number(r.avg_post_spam),
      max_post_spam: Number(r.max_post_spam),
      avg_post_slop: Number(r.avg_post_slop),
      max_post_slop: Number(r.max_post_slop),
      avg_post_toxicity: Number(r.avg_post_toxicity),
      max_post_toxicity: Number(r.max_post_toxicity),
      posts_analyzed: Number(r.posts_analyzed),
      posts_with_note: Number(r.posts_with_note),
      last_scanned_at: Number(r.last_scanned_at),
    });
  }
  return map;
}

function applyAccountFilter(
  rows: AccountIntelRow[],
  filter: AccountIntelFilter | undefined,
): AccountIntelRow[] {
  if (!filter || filter === 'all') return rows;
  switch (filter) {
    case 'non_trusted':
      return rows.filter((r) => !r.isTrusted);
    case 'high_dwell':
      return rows.filter((r) => r.focusedMs >= 30000);
    case 'high_interaction':
      return rows.filter((r) => r.actions >= 3);
    case 'high_slop':
      return rows.filter((r) => (r.avgSlop ?? 0) >= 55);
    case 'high_toxicity':
      return rows.filter((r) => (r.avgToxicity ?? 0) >= 45);
    case 'suspected_promo':
      return rows.filter((r) => r.sponsoredExposure >= 2);
    case 'automation_like':
      return rows.filter(
        (r) => r.accountKind === 'recycler' || (r.avgSpam ?? 0) >= 50,
      );
    default:
      return rows;
  }
}

export async function buildAccountIntelligence(
  filters: DashboardFilters,
  trustedHandles: Set<string>,
): Promise<AccountIntelligenceResponse> {
  const [reachRows, attnRows] = await Promise.all([
    loadReachAggregates(filters),
    loadAttentionByHandle(filters),
  ]);

  const byHandle = new Map<string, AccountIntelRow>();

  for (const r of attnRows) {
    const handle = String(r.handle).toLowerCase();
    const postsSeen = Number(r.posts_seen) || 0;
    byHandle.set(handle, {
      handle,
      postsSeen,
      focusedMs: Number(r.focused_ms) || 0,
      actions: Number(r.actions) || 0,
      firstSeenAt: r.first_seen != null ? Number(r.first_seen) : null,
      lastSeenAt: r.last_seen != null ? Number(r.last_seen) : null,
      isTrusted: trustedHandles.has(handle),
      reputationScore: null,
      band: null,
      avgSlop: r.avg_slop != null ? Math.round(Number(r.avg_slop)) : null,
      avgSpam: r.avg_spam != null ? Math.round(Number(r.avg_spam)) : null,
      avgToxicity: r.avg_tox != null ? Math.round(Number(r.avg_tox)) : null,
      noteRate: null,
      sponsoredExposure: 0,
      aiRatePct: 0,
      recycledRatePct: 0,
      accountKind: null,
    });
  }

  for (const r of reachRows) {
    const handle = String(r.handle).toLowerCase();
    const postsExposed = Number(r.posts_exposed) || 0;
    const existing = byHandle.get(handle);
    const aiExp = Number(r.ai_assisted_exposure) || 0;
    const copyExp = Number(r.copypasta_exposure) || 0;
  const sponsored = Number(r.sponsored_exposure) || 0;
    if (existing) {
      existing.postsSeen = Math.max(existing.postsSeen, postsExposed);
      existing.sponsoredExposure = sponsored;
      existing.aiRatePct = postsExposed > 0 ? Math.round((aiExp / postsExposed) * 1000) / 10 : 0;
      existing.recycledRatePct =
        postsExposed > 0 ? Math.round((copyExp / postsExposed) * 1000) / 10 : 0;
      existing.accountKind = r.account_kind != null ? String(r.account_kind) : null;
    } else {
      byHandle.set(handle, {
        handle,
        postsSeen: postsExposed,
        focusedMs: Number(r.focused_weighted_ms) || 0,
        actions: Number(r.actions) || 0,
        firstSeenAt: null,
        lastSeenAt: null,
        isTrusted: trustedHandles.has(handle),
        reputationScore: null,
        band: null,
        avgSlop: null,
        avgSpam: null,
        avgToxicity: null,
        noteRate: null,
        sponsoredExposure: sponsored,
        aiRatePct: postsExposed > 0 ? Math.round((aiExp / postsExposed) * 1000) / 10 : 0,
        recycledRatePct:
          postsExposed > 0 ? Math.round((copyExp / postsExposed) * 1000) / 10 : 0,
        accountKind: r.account_kind != null ? String(r.account_kind) : null,
      });
    }
  }

  const accountMap = await loadAccountRows([...byHandle.keys()]);
  for (const [handle, row] of byHandle) {
    const acct = accountMap.get(handle);
    if (acct) {
      row.reputationScore = acct.current_score;
      row.band = acct.band;
      row.noteRate = acct.note_rate;
      if (row.avgSlop == null) row.avgSlop = Math.round(acct.avg_post_slop);
      if (row.avgSpam == null) row.avgSpam = Math.round(acct.avg_post_spam);
      if (row.avgToxicity == null) row.avgToxicity = Math.round(acct.avg_post_toxicity);
    }
  }

  let accounts = [...byHandle.values()].sort((a, b) => b.focusedMs - a.focusedMs);
  if (filters.handle) {
    accounts = accounts.filter((a) => a.handle === filters.handle!.toLowerCase());
  }
  if (filters.nonTrustedOnly) {
    accounts = accounts.filter((a) => !a.isTrusted);
  }
  accounts = applyAccountFilter(accounts, filters.accountFilter);

  return { accounts, total: accounts.length };
}
