export type DetectorId =

  | 'handlePattern'

  | 'accountAge'

  | 'usernameHistory'

  | 'cryptoSpam'

  | 'repostBot'

  | 'romanceBait'

  | 'thirstTrap'

  | 'adSpam'

  | 'aiVoice'

  | 'aiSlop'

  | 'userExamples'

  | 'xVisibility'

  | 'xRepostDedup'

  | 'xAuthorMonoculture'

  | 'xNegativeEngagement'

  | 'xOrganicTrust'

  | 'xStaleBurst'

  | 'contentToxicity'

  | 'communityNotes'

  | 'postSpamSignals';



export interface DetectorHit {

  id: DetectorId;

  label: string;

  risk: number;

  detail?: string;

  xRules?: string[];

  xStage?: string;

  matchStrength?: number;

  weightedContribution?: number;

  effectiveWeight?: number;

}



export interface AccountProfile {

  handle: string;

  displayName?: string;

  bio?: string;

  joinedText?: string;

  joinedAt?: number;

  location?: string;

  usernameChanges?: number;

  connectionSource?: string;

  followersCount?: number;

  followingCount?: number;

  postsSample?: PostSample[];

  source: 'graphql' | 'dom' | 'mixed';

}



export interface PostSample {

  text: string;

  isRepost: boolean;

  isQuote: boolean;

  hasMedia: boolean;

  imageUrl?: string;

  createdAt?: number;

  hasCommunityNote?: boolean;

  spamScore?: number;

  slopScore?: number;

  toxicityScore?: number;

}



export interface ScoreBreakdown {

  overall: number;

  spamRisk: number;

  generalRisk: number;

  xWeightedSpamRisk: number;

}

export type { DetectorResult, EvidenceHit } from './detectors/evidence';
import type { DetectorResult as DetectorResultType } from './detectors/evidence';

export interface ContentQualityProfile {
  spamLikelihood: number;
  promotionalLikelihood: number;
  affiliateOrSponsorLikelihood: number;
  aiTextLikelihood: number;
  aiImageLikelihood: number;
  slopLikelihood: number;
  promotionalSlopLikelihood: number;
  copypastaLikelihood: number;
  organicLikelihood: number;
  automationLikelihood: number;
  confidence: number;
  topEvidence: import('./detectors/evidence').EvidenceHit[];
  topCounterEvidence: import('./detectors/evidence').EvidenceHit[];
  detectorVersion: string;
  explanations: Record<string, string>;
}

export interface SlopAnalysis {
  heuristic: number;
  model?: number;
  modelLabel?: 'ai_generated' | 'human_written' | 'uncertain';
  onnx?: number;
  onnxLabel?: string;
  image?: number;
  imageLabel?: string;
  mediaSignals?: string[];
  combined: number;
  samplesScored?: number;
  signals?: string[];
  quality?: ContentQualityProfile;
  mediaEvidence?: DetectorResultType;
}

export type DetectorCorrectionKind =
  | 'not_spam'
  | 'not_ai'
  | 'organic'
  | 'sponsored'
  | 'not_sponsored'
  | 'copypasta'
  | 'not_copypasta';

export interface PostQualitySnapshot {
  postFingerprint: string;
  handle: string;
  quality: ContentQualityProfile;
  capturedAt: number;
}

export interface ToxicityAnalysis {
  combined: number;
  labelScores?: Record<string, number>;
  topLabels?: Array<{ label: string; score: number }>;
  source?: 'model' | 'heuristic';
}

export interface ReputationResult {

  handle: string;

  score: number;

  band: 'trusted' | 'caution' | 'high_risk';

  hits: DetectorHit[];

  scannedAt: number;

  profile?: AccountProfile;

  breakdown: ScoreBreakdown;

  isTrusted: boolean;

  trustedNote?: string;

  slop?: SlopAnalysis;

  toxicity?: ToxicityAnalysis;

}



export interface TrustedUser {

  handle: string;

  note?: string;

  addedAt: number;

}



export interface SpamExample {

  id: string;

  handle: string;

  displayName?: string;

  bio?: string;

  keywords: string[];

  handlePattern?: string;

  categories: DetectorId[];

  postSnippets: string[];

  repostRatio?: number;

  joinedText?: string;

  createdAt: number;

  note?: string;

}



export interface BlockSuggestion {

  id: string;

  handle: string;

  score: number;

  hits: DetectorHit[];

  status: 'pending' | 'dismissed' | 'blocked' | 'muted' | 'whitelisted';

  createdAt: number;

}

export interface PrimaryAccount {
  handle: string;
  displayLabel?: string;
  addedAt: number;
  lastScannedAt?: number;
}

export interface TweetAnalytics {
  tweetId: string;
  textPreview?: string;
  createdAt?: number;
  impressions?: number;
  engagements?: number;
  engagementRate?: number;
  likes?: number;
  reposts?: number;
  replies?: number;
  profileVisits?: number;
  linkClicks?: number;
  capturedAt: number;
}

export interface AccountAnalyticsSnapshot {
  handle: string;
  periodLabel?: string;
  impressions?: number;
  engagements?: number;
  profileVisits?: number;
  mentions?: number;
  newFollowers?: number;
  tweets?: TweetAnalytics[];
  capturedAt: number;
  source: 'graphql' | 'dom' | 'import';
}

export interface AnalyticsImportResult {
  ok: boolean;
  snapshot?: AccountAnalyticsSnapshot;
  warnings: string[];
  error?: string;
}

export interface AnalyticsHistoryEntry {
  handle: string;
  capturedAt: number;
  source: AccountAnalyticsSnapshot['source'];
  periodLabel?: string;
  impressions?: number;
  engagements?: number;
  tweetCount: number;
}

export interface AccountInsights {
  handle: string;
  generatedAt: number;
  reputation?: ReputationResult;
  analytics?: AccountAnalyticsSnapshot;
  summary: string[];
  algorithmNotes: string[];
  risks: string[];
  opportunities: string[];
}

export interface CustomBrowseInterest {
  id: string;
  label: string;
  keywords: string[];
  hashtags?: string[];
  handles?: string[];
}

export interface ExtensionSettings {

  enabled: boolean;

  xAlgorithmAlignment: boolean;

  spamBucketWeight: number;

  learningMode: boolean;

  autoBlockAgreed: boolean;

  autoSuggestEnabled: boolean;

  autoSuggestThreshold: number;

  sensitivity: number;

  scoreCacheTtlMs: number;

  aiSlopModelEnabled: boolean;

  aiSlopModelAutoLoad: boolean;

  slopDisplayThreshold: number;

  slopPerTweetEnabled: boolean;

  slopOnnxEnabled: boolean;

  slopOnnxAutoLoad: boolean;

  slopImageModelEnabled: boolean;

  slopImageModelAutoLoad: boolean;

  toxicityModelEnabled: boolean;

  toxicityModelAutoLoad: boolean;

  toxicityDisplayThreshold: number;

  spamDisplayThreshold: number;

  aiImageBadgeEnabled: boolean;

  aiImageBadgeThreshold: number;

  /** Show “Mark as AI” on tweet photos; feeds author slop / reputation. */
  manualAiImageMarkEnabled: boolean;

  /** Slop score applied when you mark a photo as AI (0–100). */
  manualAiImageSlopScore: number;

  /** Hide preview media and blacken text on posts with X "Ad" label. */
  promotedAdDimEnabled: boolean;

  /** Classify timeline posts into browse interest topics. */
  browseTopicsEnabled?: boolean;

  /** Refine weak topic matches with CLIP (uses slop image model). */
  browseTopicClipEnabled?: boolean;

  customBrowseInterests?: CustomBrowseInterest[];

  /** Hard cap on reputation score (default 95 — difficult to reach 100). */
  reputationScoreCap: number;

  /** Minimum combined risk floor so empty scans rarely score near 100. */
  reputationBaselineRisk: number;

  detectors: Record<DetectorId, { enabled: boolean; weight: number }>;

  /** @deprecated migrated to trustedUsers */

  whitelist?: string[];

  trustedUsers: TrustedUser[];

  primaryAccount?: PrimaryAccount;

}



export const DEFAULT_SETTINGS: ExtensionSettings = {

  enabled: true,

  xAlgorithmAlignment: true,

  spamBucketWeight: 0.65,

  learningMode: false,

  autoBlockAgreed: false,

  autoSuggestEnabled: false,

  autoSuggestThreshold: 25,

  sensitivity: 0.5,

  scoreCacheTtlMs: 24 * 60 * 60 * 1000,

  aiSlopModelEnabled: false,

  aiSlopModelAutoLoad: false,

  slopDisplayThreshold: 55,

  slopPerTweetEnabled: true,

  slopOnnxEnabled: true,

  slopOnnxAutoLoad: false,

  slopImageModelEnabled: true,

  slopImageModelAutoLoad: false,

  toxicityModelEnabled: true,

  toxicityModelAutoLoad: false,

  toxicityDisplayThreshold: 45,

  spamDisplayThreshold: 40,

  aiImageBadgeEnabled: true,

  aiImageBadgeThreshold: 35,

  manualAiImageMarkEnabled: true,

  manualAiImageSlopScore: 82,

  promotedAdDimEnabled: true,

  browseTopicsEnabled: true,

  browseTopicClipEnabled: true,

  customBrowseInterests: [],

  reputationScoreCap: 95,

  reputationBaselineRisk: 0.06,

  detectors: {

    handlePattern: { enabled: true, weight: 1.2 },

    accountAge: { enabled: true, weight: 1.0 },

    usernameHistory: { enabled: true, weight: 0.8 },

    cryptoSpam: { enabled: true, weight: 1.1 },

    repostBot: { enabled: true, weight: 1.0 },

    romanceBait: { enabled: true, weight: 1.0 },

    thirstTrap: { enabled: true, weight: 0.9 },

    adSpam: { enabled: true, weight: 1.0 },

    aiVoice: { enabled: true, weight: 0.7 },

    aiSlop: { enabled: true, weight: 0.85 },

    userExamples: { enabled: true, weight: 1.3 },

    xVisibility: { enabled: true, weight: 1.15 },

    xRepostDedup: { enabled: true, weight: 1.0 },

    xAuthorMonoculture: { enabled: true, weight: 0.95 },

    xNegativeEngagement: { enabled: true, weight: 1.1 },

    xOrganicTrust: { enabled: true, weight: 0.85 },

    xStaleBurst: { enabled: true, weight: 1.0 },

    contentToxicity: { enabled: true, weight: 1.2 },

    communityNotes: { enabled: true, weight: 1.1 },

    postSpamSignals: { enabled: true, weight: 1.0 },

  },

  trustedUsers: [],

};



export type MessageType =

  | { type: 'GET_SETTINGS' }

  | { type: 'SAVE_SETTINGS'; settings: Partial<ExtensionSettings> }

  | { type: 'SCAN_HANDLE'; handle: string; profile?: AccountProfile }

  | { type: 'GET_SCORE'; handle: string }

  | { type: 'BATCH_GET_SCORES'; handles: string[] }

  | { type: 'SCORE_RESULT'; result: ReputationResult }

  | { type: 'GRAPHQL_PAYLOAD'; payload: unknown }

  | { type: 'GRAPHQL_PROFILE'; handle: string; profile: Partial<AccountProfile> }

  | { type: 'ADD_SPAM_EXAMPLE'; example: Omit<SpamExample, 'id' | 'createdAt'> }

  | { type: 'GET_SPAM_EXAMPLES' }

  | { type: 'DELETE_SPAM_EXAMPLE'; id: string }

  | { type: 'IMPORT_DATA'; data: ExportBundle }

  | { type: 'EXPORT_DATA' }

  | { type: 'QUEUE_SUGGESTION'; suggestion: BlockSuggestion }

  | { type: 'GET_QUEUE' }

  | { type: 'UPDATE_QUEUE'; id: string; status: BlockSuggestion['status'] }

  | { type: 'MARK_SPAM_FROM_PAGE'; handle: string }

  | { type: 'GET_STATS' }

  | { type: 'ADD_TRUSTED'; handle: string; note?: string }

  | { type: 'REMOVE_TRUSTED'; handle: string }

  | { type: 'GET_TRUSTED' }

  | { type: 'GET_SLOP_MODEL_STATUS' }

  | { type: 'INIT_SLOP_MODEL' }

  | { type: 'CLASSIFY_SLOP_TEXT'; text: string }

  | { type: 'CLASSIFY_SLOP_MEDIA'; text: string; imageUrl?: string }

  | { type: 'GET_SLOP_ONNX_MODEL_STATUS' }

  | { type: 'INIT_SLOP_ONNX_MODEL' }

  | { type: 'CLASSIFY_SLOP_ONNX_TEXT'; text: string }

  | { type: 'GET_SLOP_IMAGE_MODEL_STATUS' }

  | { type: 'INIT_SLOP_IMAGE_MODEL' }

  | { type: 'CLASSIFY_SLOP_IMAGE'; imageUrl: string }

  | { type: 'SLOP_UPDATED'; handle: string; result: ReputationResult }

  | { type: 'GET_TOXICITY_MODEL_STATUS' }

  | { type: 'INIT_TOXICITY_MODEL' }

  | { type: 'CLASSIFY_TOXICITY'; text: string }

  | { type: 'TOXICITY_UPDATED'; handle: string; result: ReputationResult }

  | { type: 'SET_PRIMARY_ACCOUNT'; handle: string; displayLabel?: string }

  | { type: 'GET_PRIMARY_ACCOUNT' }

  | { type: 'SCAN_PRIMARY_ACCOUNT' }

  | { type: 'GET_ACCOUNT_INSIGHTS' }

  | { type: 'ANALYTICS_PAYLOAD'; snapshot: AccountAnalyticsSnapshot }

  | { type: 'IMPORT_ANALYTICS_CSV'; csv: string; handle?: string }

  | { type: 'GET_ANALYTICS_HISTORY'; handle?: string }

  | { type: 'ANALYTICS_CAPTURED'; handle: string }

  | {
      type: 'REPORT_POST_SIGNALS';
      handle: string;
      source: 'timeline' | 'profile';
      text: string;
      imageUrl?: string;
      statusId?: string;
      slopScore?: number;
      spamScore?: number;
      toxicityScore?: number;
      hasCommunityNote?: boolean;
      qualityJson?: string;
    }

  | { type: 'ENSURE_ACCOUNT_SCANNED'; handle: string }

  | { type: 'GRAPHQL_TIMELINE_AUTHORS'; handles: string[] }

  | { type: 'GET_LEADERBOARD'; kind: 'riskiest' | 'safest' | 'most_notes' | 'most_analyzed'; limit?: number; minPosts?: number }

  | { type: 'GET_ACCOUNT_ROLLUPS'; handle: string }

  | { type: 'EXPORT_DB' }

  | { type: 'IMPORT_DB'; bytes: number[]; mode: 'replace' | 'merge' }

  | { type: 'MARK_IMAGE_AS_AI'; handle: string; imageUrl: string; text?: string }

  | { type: 'UNMARK_IMAGE_AS_AI'; handle: string; imageUrl: string }

  | { type: 'GET_MARKED_AI_IMAGES'; handle: string }

  | {
      type: 'SET_DETECTOR_CORRECTION';
      postFingerprint: string;
      handle: string;
      correction: DetectorCorrectionKind;
    }

  | {
      type: 'REMOVE_DETECTOR_CORRECTION';
      postFingerprint: string;
      correction: DetectorCorrectionKind;
    }

  | { type: 'GET_DETECTOR_CORRECTIONS'; postFingerprint: string }

  | {
      type: 'RECORD_BROWSE_POST';
      postFingerprint: string;
      slopScore?: number;
      spamScore?: number;
      authorSpamRisk?: number;
      flaggedSpam: boolean;
      flaggedSlop: boolean;
      flaggedAd?: boolean;
      toxicityScore?: number;
      flaggedToxicity?: boolean;
    }

  | { type: 'GET_BROWSE_STATS' }

  | { type: 'GET_BROWSE_STATS_RANGE'; days?: number }

  | {
      type: 'RECORD_USER_ACTION';
      kind: 'like' | 'repost' | 'reply' | 'quote';
      postFingerprint?: string;
      handle?: string;
      statusId?: string;
      attributionSource?: 'statusId' | 'article' | 'lastFocused';
    }

  | { type: 'GET_USER_ACTIONS' }

  | { type: 'GET_USER_ACTIONS_RANGE'; days?: number }

  | { type: 'GET_COMBINED_METRICS'; days?: number }

  | {
      type: 'RECORD_BROWSE_TOPICS';
      postFingerprint: string;
      primary: string;
      labels: string[];
    }

  | { type: 'GET_BROWSE_TOPICS' }

  | { type: 'GET_BROWSE_TOPICS_RANGE'; days?: number }

  | { type: 'CLASSIFY_BROWSE_TOPIC_IMAGE'; imageUrl: string }

  | {
      type: 'RECORD_POST_ATTENTION';
      records: Array<{
        postFingerprint: string;
        handle: string;
        statusId?: string;
        visibleMs: number;
        focusedVisibleMs: number;
        weightedVisibleMs?: number;
        focusedWeightedMs?: number;
        maxVisibleRatio: number;
        firstSeenAt?: number;
        lastSeenAt?: number;
        revisitCount: number;
        pauseCount: number;
        slopScore?: number;
        spamScore?: number;
        toxicityScore?: number;
        topics?: string[];
        surface?: string;
        mediaType?: string;
        cardDomain?: string;
        isPromoted?: boolean;
      }>;
    }

  | { type: 'GET_ATTENTION_METRICS'; days?: number }

  | {
      type: 'RECORD_PROVENANCE';
      postFingerprint: string;
      handle: string;
      statusId?: string;
      text: string;
      isPromotedAd: boolean;
      slopScore?: number;
      spamScore?: number;
      hasAiImageMark?: boolean;
      cardDomain?: string;
    }

  | {
      type: 'GET_FEED_INTELLIGENCE';
      section:
        | 'attention'
        | 'provenance'
        | 'accounts_reach'
        | 'sponsored'
        | 'ai_organic'
        | 'copypasta'
        | 'mismatch';
      days?: number;
    }

  | {
      type: 'GET_DASHBOARD_DATA';
      view:
        | 'overview'
        | 'composition'
        | 'attention'
        | 'interaction'
        | 'accounts'
        | 'provenance'
        | 'copypasta'
        | 'trends';
      filters: {
        range: 'session' | 'today' | '7d' | '30d' | '90d' | 'all';
        surface?: string;
        topic?: string;
        handle?: string;
        provenanceCategory?: string;
        minSlop?: number;
        minSpam?: number;
        minToxicity?: number;
        interactionOnly?: boolean;
        nonTrustedOnly?: boolean;
        accountFilter?:
          | 'all'
          | 'non_trusted'
          | 'high_dwell'
          | 'high_interaction'
          | 'high_slop'
          | 'high_toxicity'
          | 'suspected_promo'
          | 'automation_like';
        trendsGranularity?: 'daily' | 'weekly' | 'monthly';
      };
    }

  | {
      type: 'EXPORT_DASHBOARD_DATA';
      view:
        | 'overview'
        | 'composition'
        | 'attention'
        | 'interaction'
        | 'accounts'
        | 'provenance'
        | 'copypasta'
        | 'trends';
      filters: {
        range: 'session' | 'today' | '7d' | '30d' | '90d' | 'all';
        surface?: string;
        topic?: string;
        handle?: string;
        provenanceCategory?: string;
        minSlop?: number;
        minSpam?: number;
        minToxicity?: number;
        interactionOnly?: boolean;
        nonTrustedOnly?: boolean;
        accountFilter?:
          | 'all'
          | 'non_trusted'
          | 'high_dwell'
          | 'high_interaction'
          | 'high_slop'
          | 'high_toxicity'
          | 'suspected_promo'
          | 'automation_like';
        trendsGranularity?: 'daily' | 'weekly' | 'monthly';
      };
      format: 'csv' | 'json';
    }

  | { type: 'RESET_BROWSE_SESSION' };



export interface ExportBundle {

  version: 1;

  settings: ExtensionSettings;

  spamExamples: SpamExample[];

  scores: Record<string, ReputationResult>;

  queue: BlockSuggestion[];

  analyticsSnapshots?: Record<string, AccountAnalyticsSnapshot[]>;

}

export const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase();
}



export function isTrustedHandle(handle: string, settings: ExtensionSettings): boolean {

  const h = handle.toLowerCase();

  if (settings.trustedUsers?.some((t) => t.handle.toLowerCase() === h)) return true;

  return (settings.whitelist ?? []).includes(h);

}



export function getTrustedUser(

  handle: string,

  settings: ExtensionSettings,

): TrustedUser | undefined {

  return settings.trustedUsers?.find((t) => t.handle.toLowerCase() === handle.toLowerCase());

}


