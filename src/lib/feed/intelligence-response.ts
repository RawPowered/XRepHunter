import {
  rankAuthorsByFocusedMs,
  rankTopicsByFocusedMs,
} from '../attention/aggregate';
import {
  getAttentionLeaders,
  getAttentionMetricsResponse,
  getAttentionRowsForRange,
} from '../db/repositories/post-attention';
import { rollupFeedEventsByHandle } from '../db/repositories/feed-events';
import {
  getAccountReachLeaders,
  getAiOrganicSplit,
  getCopypastaLeaders,
  getProvenanceSummary,
  getSponsoredExposure,
  recomputeAccountKinds,
} from '../db/repositories/provenance';
import type { AttentionSnapshot, PostAttentionRow } from '../attention/aggregate';
import { computeInteractionMismatch } from './interaction-mismatch';

export type FeedIntelligenceSection =
  | 'attention'
  | 'provenance'
  | 'accounts_reach'
  | 'sponsored'
  | 'ai_organic'
  | 'copypasta'
  | 'mismatch';

export async function buildFeedIntelligenceResponse(
  section: FeedIntelligenceSection,
  days: number,
  attentionSession?: { snapshot: AttentionSnapshot; rows: PostAttentionRow[] },
): Promise<unknown> {
  switch (section) {
    case 'attention': {
      const metrics = await getAttentionMetricsResponse(days);
      const sessionRows = attentionSession?.rows ?? [];
      return {
        session: attentionSession?.snapshot ?? metrics.today,
        today: metrics.today,
        range: metrics.range,
        topAuthors: metrics.topAuthors,
        topTopics: metrics.topTopics,
        sessionTopAuthors: rankAuthorsByFocusedMs(sessionRows, 10),
        sessionTopTopics: rankTopicsByFocusedMs(sessionRows, 10),
      };
    }
    case 'provenance': {
      await recomputeAccountKinds(days);
      return getProvenanceSummary(days);
    }
    case 'accounts_reach': {
      await recomputeAccountKinds(days);
      const [reach, feedRollup] = await Promise.all([
        getAccountReachLeaders(days, 25),
        rollupFeedEventsByHandle(days, 25),
      ]);
      return { reach, feedRollup };
    }
    case 'sponsored':
      return getSponsoredExposure(days);
    case 'ai_organic':
      return getAiOrganicSplit(days);
    case 'copypasta':
      return { leaders: await getCopypastaLeaders(days) };
    case 'mismatch': {
      const rows = await getAttentionRowsForRange(days);
      return computeInteractionMismatch(rows);
    }
    default:
      return {};
  }
}
