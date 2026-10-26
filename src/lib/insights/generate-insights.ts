import { profileHealthTips } from '../scoring/reputation';
import type {
  AccountAnalyticsSnapshot,
  AccountInsights,
  ReputationResult,
} from '../types';

function engagementRate(snapshot: AccountAnalyticsSnapshot): number | undefined {
  if (snapshot.impressions && snapshot.impressions > 0 && snapshot.engagements != null) {
    return (snapshot.engagements / snapshot.impressions) * 100;
  }
  const tweets = snapshot.tweets ?? [];
  if (!tweets.length) return undefined;
  const withRate = tweets.filter((t) => t.engagementRate != null);
  if (withRate.length) {
    return withRate.reduce((a, t) => a + (t.engagementRate ?? 0), 0) / withRate.length;
  }
  return undefined;
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function periodLabelShort(s?: string, capturedAt?: number): string {
  if (s) return s;
  if (capturedAt) return new Date(capturedAt).toLocaleDateString();
  return 'prior period';
}

export function generateAccountInsights(
  handle: string,
  reputation?: ReputationResult | null,
  analytics?: AccountAnalyticsSnapshot,
  previousSnapshot?: AccountAnalyticsSnapshot,
): AccountInsights {
  const summary: string[] = [];
  const algorithmNotes: string[] = [];
  const risks: string[] = [];
  const opportunities: string[] = [];

  if (reputation) {
    summary.push(`Reputation score: ${reputation.score}/100 (${reputation.band.replace('_', ' ')}).`);
    if (reputation.slop) {
      summary.push(
        `AI slop score: ${reputation.slop.combined} (heuristic ${reputation.slop.heuristic}${reputation.slop.model != null ? `, model ${reputation.slop.model}` : ''}).`,
      );
    }
    for (const tip of profileHealthTips(reputation)) {
      summary.push(tip);
    }
    for (const h of reputation.hits.slice(0, 5)) {
      if (h.xRules?.length) {
        algorithmNotes.push(`${h.label} — maps to X rules: ${h.xRules.join(', ')}.`);
      }
    }
    if (reputation.hits.some((h) => h.id === 'repostBot' || h.id === 'xRepostDedup')) {
      risks.push('Repost-heavy feed — RepostDeduplicationFilter and author diversity penalties likely.');
    }
    if (reputation.hits.some((h) => h.id === 'aiSlop' || h.id === 'aiVoice')) {
      risks.push('AI slop patterns detected — may align with VFFilter / Grox spam-style downranking.');
    }
    if (reputation.hits.some((h) => h.id === 'xOrganicTrust')) {
      opportunities.push('Organic trust signals present — favorable for P(follow_author) style scoring.');
    }
    if (reputation.score >= 70 && reputation.hits.length <= 2) {
      opportunities.push('Low risk profile — content patterns align with positive For You signals.');
    }
  }

  if (analytics && previousSnapshot) {
    const curLabel = periodLabelShort(analytics.periodLabel, analytics.capturedAt);
    const prevLabel = periodLabelShort(
      previousSnapshot.periodLabel,
      previousSnapshot.capturedAt,
    );
    if (
      analytics.impressions != null &&
      previousSnapshot.impressions != null &&
      analytics.impressions !== previousSnapshot.impressions
    ) {
      summary.push(
        `Impressions ${pctChange(analytics.impressions, previousSnapshot.impressions)} vs ${prevLabel} (${curLabel}).`,
      );
    }
    if (
      analytics.engagements != null &&
      previousSnapshot.engagements != null &&
      analytics.engagements !== previousSnapshot.engagements
    ) {
      summary.push(
        `Engagements ${pctChange(analytics.engagements, previousSnapshot.engagements)} vs prior snapshot.`,
      );
    }
    const curRate = engagementRate(analytics);
    const prevRate = engagementRate(previousSnapshot);
    if (curRate != null && prevRate != null && Math.abs(curRate - prevRate) > 0.1) {
      summary.push(
        `Engagement rate ${curRate.toFixed(2)}% (${curRate >= prevRate ? 'up' : 'down'} from ${prevRate.toFixed(2)}%).`,
      );
    }
    if (analytics.source === 'import' && previousSnapshot.source !== 'import') {
      algorithmNotes.push(
        `Latest data from CSV import merged with prior ${previousSnapshot.source} capture.`,
      );
    } else if (analytics.source !== 'import' && previousSnapshot.source === 'import') {
      algorithmNotes.push('Live X capture updated metrics since last CSV import.');
    }
  }

  if (analytics) {
    const rate = engagementRate(analytics);
    if (analytics.impressions != null) {
      summary.push(
        `Reach: ${analytics.impressions.toLocaleString()} impressions${analytics.periodLabel ? ` (${analytics.periodLabel})` : ''}.`,
      );
    }
    if (analytics.engagements != null) {
      summary.push(`Engagements: ${analytics.engagements.toLocaleString()}.`);
    }
    if (rate != null) {
      summary.push(`Engagement rate: ${rate.toFixed(2)}%.`);
      if (analytics.impressions && analytics.impressions > 1000 && rate < 1) {
        risks.push(
          'High impressions with low engagement — audience sees posts but rarely interacts (weak P(favorite/reply), possible P(not_interested)).',
        );
        algorithmNotes.push('Phoenix negative engagement: low interaction despite distribution.');
      } else if (rate >= 3) {
        opportunities.push(
          'Strong engagement rate — aligns with positive Phoenix signals (P(favorite), P(reply)).',
        );
      }
    }
    if (analytics.profileVisits != null && analytics.profileVisits > 50) {
      summary.push(`Profile visits: ${analytics.profileVisits.toLocaleString()}.`);
      if (analytics.newFollowers != null && analytics.newFollowers < 5) {
        risks.push('Profile visits without follower growth — curiosity without follows; review bio and CTAs.');
      }
    }
    if (analytics.newFollowers != null && analytics.newFollowers > 0) {
      opportunities.push(`+${analytics.newFollowers} new followers in period — organic growth signal.`);
    }
    const tweets = analytics.tweets ?? [];
    const topTweets = [...tweets].sort(
      (a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0),
    );
    if (topTweets.length) {
      const best = topTweets[0];
      if (best?.engagementRate != null && best.engagementRate >= 3) {
        opportunities.push(
          `Top post engagement ~${best.engagementRate.toFixed(1)}% — replicate formats that earn replies and favorites.`,
        );
      }
    }
    const totalImp = analytics.impressions ?? tweets.reduce((s, t) => s + (t.impressions ?? 0), 0);
    if (totalImp > 0 && tweets.length >= 2) {
      const maxTweetImp = Math.max(...tweets.map((t) => t.impressions ?? 0));
      if (maxTweetImp / totalImp > 0.5) {
        risks.push(
          'More than half of impressions come from a single post — author diversity / feed variety may suffer if all content looks the same.',
        );
      }
    }
    if (reputation?.slop && reputation.slop.combined >= 55 && (analytics.impressions ?? 0) > 500) {
      risks.push(
        'AI slop score is elevated while posts still get reach — distribution may not match long-term VF/Grox trust.',
      );
    }
    if (reputation?.slop && tweets.length >= 2) {
      const sorted = [...tweets].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0));
      const top = sorted[0];
      const second = sorted[1];
      if (
        top.impressions &&
        second.impressions &&
        top.impressions > second.impressions * 2 &&
        reputation.slop.combined < 45
      ) {
        opportunities.push(
          'Top-performing post has strong reach — profile slop is low; lean into this content style.',
        );
      }
    }
  }

  if (!analytics) {
    summary.push(
      'No analytics yet — import a CSV from X or visit Account analytics while logged in.',
    );
  }

  if (!summary.length) {
    summary.push('Save your handle and refresh reputation, then import or sync analytics.');
  }

  algorithmNotes.push(
    'Insights infer behavior from open x-algorithm rules and your captured metrics — not official X guidance.',
  );

  return {
    handle: handle.toLowerCase(),
    generatedAt: Date.now(),
    reputation: reputation ?? undefined,
    analytics,
    summary,
    algorithmNotes,
    risks,
    opportunities,
  };
}
