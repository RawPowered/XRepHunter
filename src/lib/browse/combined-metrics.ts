import type { BrowseDayRow, BrowseStatsSnapshot } from './stats';
import type { UserActionsDayRow, UserActionsSnapshot } from '../db/repositories/user-actions';

export interface CombinedMetricsDay {
  dayKey: string;
  browse: BrowseStatsSnapshot;
  actions: UserActionsSnapshot;
  supportRate: number | null;
  replyRate: number | null;
  slopExposure: number | null;
  junkExposure: number | null;
  participationIndex: number | null;
}

export interface CombinedMetricsResponse {
  session: CombinedMetricsDay;
  today: CombinedMetricsDay;
  history: CombinedMetricsDay[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function deriveCombined(
  browse: BrowseStatsSnapshot,
  actions: UserActionsSnapshot,
  dayKey = '',
): CombinedMetricsDay {
  const posts = browse.postsSeen;
  const support = actions.likes + actions.reposts;
  const supportRate = posts > 0 ? round1((support / posts) * 100) : null;
  const replyRate = posts > 0 ? round1((actions.replies / posts) * 100) : null;
  const slopExposure = posts > 0 ? round1((browse.slopFlagged / posts) * 100) : null;
  const junkExposure =
    posts > 0 ? round1(((browse.spamFlagged + browse.adsSeen) / posts) * 100) : null;
  const participationIndex =
    supportRate != null && replyRate != null ? round1(supportRate * 0.6 + replyRate * 0.4) : null;
  return {
    dayKey,
    browse,
    actions,
    supportRate,
    replyRate,
    slopExposure,
    junkExposure,
    participationIndex,
  };
}

const emptyBrowse = (): BrowseStatsSnapshot => ({
  postsSeen: 0,
  spamFlagged: 0,
  slopFlagged: 0,
  slopSum: 0,
  slopCount: 0,
  avgSlop: null,
  adsSeen: 0,
  toxicityFlagged: 0,
  toxicitySum: 0,
  toxicityCount: 0,
  avgToxicity: null,
});

export function joinCombinedHistory(
  browseDays: BrowseDayRow[],
  actionDays: UserActionsDayRow[],
): CombinedMetricsDay[] {
  const actionByDay = new Map(actionDays.map((d) => [d.dayKey, d]));
  const browseByDay = new Map(browseDays.map((d) => [d.dayKey, d]));
  const keys = new Set([...browseByDay.keys(), ...actionByDay.keys()]);
  return [...keys]
    .sort()
    .map((dayKey) => {
      const bRow = browseByDay.get(dayKey);
      const browse: BrowseStatsSnapshot = bRow
        ? (({ dayKey: _dk, ...rest }) => rest)(bRow)
        : emptyBrowse();
      const aRow = actionByDay.get(dayKey);
      const actions: UserActionsSnapshot = aRow
        ? { likes: aRow.likes, reposts: aRow.reposts, replies: aRow.replies, quotes: aRow.quotes }
        : { likes: 0, reposts: 0, replies: 0, quotes: 0 };
      return deriveCombined(browse, actions, dayKey);
    });
}

export function buildCombinedMetricsResponse(
  sessionBrowse: BrowseStatsSnapshot,
  sessionActions: UserActionsSnapshot,
  todayBrowse: BrowseStatsSnapshot,
  todayActions: UserActionsSnapshot,
  browseDays: BrowseDayRow[],
  actionDays: UserActionsDayRow[],
): CombinedMetricsResponse {
  return {
    session: deriveCombined(sessionBrowse, sessionActions, 'session'),
    today: deriveCombined(todayBrowse, todayActions, 'today'),
    history: joinCombinedHistory(browseDays, actionDays),
  };
}
