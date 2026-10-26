import { initDb } from '../../lib/db/bridge';
import { migrateScoresFromStorageIfNeeded } from '../../lib/db/migrate-storage';
import { exportDatabaseFile, importDatabaseFile } from '../../lib/db/export-import';
import { getAccountRollups, queryLeaderboard } from '../../lib/db/repositories/accounts';
import {
  getBrowseStatsRange,
  getBrowseStatsToday,
  recordBrowsePostDaily,
} from '../../lib/db/repositories/browse-stats';
import {
  getBrowseTopicsRange,
  getBrowseTopicsToday,
  recordBrowseTopicsDaily,
} from '../../lib/db/repositories/browse-topics';
import {
  getUserActionsRange,
  getUserActionsToday,
  recordUserActionDaily,
} from '../../lib/db/repositories/user-actions';
import { classifyBrowseTopicImage } from '../../lib/browse/topic-image-bridge';
import { buildCombinedMetricsResponse } from '../../lib/browse/combined-metrics';
import {
  DEFAULT_MANUAL_AI_SLOP_SCORE,
  markImageAsAi,
  unmarkImageAsAi,
  listMarkedImageFingerprints,
} from '../../lib/db/repositories/manual-ai-images';
import {
  listDetectorCorrections,
  removeDetectorCorrection,
  setDetectorCorrection,
} from '../../lib/db/repositories/detector-corrections';
import {
  accountNeedsFullScan,
  upsertObservedPostSignals,
  upsertObservedPostSlop,
} from '../../lib/db/repositories/posts';
import { scoreTextToxicityHeuristic } from '../../lib/detectors/toxicity-heuristic';
import { onMessage } from '../../lib/messaging';
import { normalizeReputationResult } from '../../lib/scoring/normalize-result';
import { classifySlopMedia } from '../../lib/slop/classify';
import { listOllamaModels } from '../../lib/ollama/api';
import type { TweetMediaInfo } from '../../lib/slop/extract-tweet-content';
import {
  checkSlopImageOffscreenStatus,
  classifySlopImage,
  handleSlopImageOffscreenBroadcast,
  initSlopImageModel,
} from '../../lib/slop/image-bridge';
import {
  checkSlopOnnxOffscreenStatus,
  handleSlopOnnxOffscreenBroadcast,
  initSlopOnnxModel,
} from '../../lib/slop/onnx-bridge';
import {
  checkOffscreenStatus,
  classifySlopText,
  handleOffscreenBroadcast,
  initSlopModel,
} from '../../lib/slop/model-bridge';
import { labelsToToxicityAnalysis } from '../../lib/toxicity/aggregate';
import { classifyToxicityWithFallback } from '../../lib/toxicity/classify';
import {
  checkToxicityOffscreenStatus,
  handleToxicityOffscreenBroadcast,
  initToxicityModel,
} from '../../lib/toxicity/model-bridge';
import {
  addSpamExample,
  addTrustedUser,
  deleteSpamExample,
  exportBundle,
  getAccountInsights,
  getCachedScore,
  getCachedScoresBatch,
  getPrimaryAccount,
  getQueue,
  getSettings,
  getSpamExamples,
  getStats,
  getTrustedUsers,
  importBundle,
  listAnalyticsHistory,
  removeTrustedUser,
  saveAnalyticsSnapshot,
  saveSettings,
  setPrimaryAccount,
  touchPrimaryScanned,
  updateQueueStatus,
} from '../../lib/storage';
import type { AnalyticsImportResult, MessageType, SpamExample } from '../../lib/types';
import { HANDLE_RE, normalizeHandle } from '../../lib/types';
import { parseAnalyticsCsv } from '../../lib/x-api/analytics-csv-import';
import type { BrowseStatsSnapshot } from '../../lib/browse/stats';
import {
  getSessionBrowse,
  recordSessionBrowse,
  resetSessionBrowse,
} from './browse-session';
import {
  getSessionUserActions,
  recordSessionUserAction,
  resetSessionUserActions,
  shouldRecordUserAction,
} from './engagement-session';
import {
  getSessionAttention,
  getSessionAttentionRows,
  recordSessionAttention,
  recordSessionPostAction,
  resetSessionAttention,
} from './attention-session';
import {
  recordPostActionDaily,
  recordPostAttentionBatch,
} from '../../lib/db/repositories/post-attention';
import { buildFeedIntelligenceResponse } from '../../lib/feed/intelligence-response';
import {
  buildDashboardResponse,
  exportDashboardData,
} from '../../lib/feed/dashboard/response';
import { appendFeedEvent, appendFeedEventBatch } from '../../lib/db/repositories/feed-events';
import { analyzePostProvenance } from '../../lib/provenance/analyze-post';
import {
  bumpAccountReachAction,
  bumpAccountReachFocus,
  loadCopypastaCorpus,
  recordProvenanceAssessment,
} from '../../lib/db/repositories/provenance';
import {
  getSessionBrowseTopics,
  recordSessionBrowseTopics,
  resetSessionBrowseTopics,
} from './interest-session';
import { enqueueScan, profileCache, scanHandle } from './scan-pipeline';
import { enqueueTimelineAuthors } from './timeline-queue';

export async function broadcastAnalyticsCaptured(handle: string): Promise<void> {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (
        tab.id &&
        (tab.url?.includes('dashboard.html') || tab.url?.includes('chrome-extension://'))
      ) {
        browser.tabs
          .sendMessage(tab.id, { type: 'ANALYTICS_CAPTURED', handle })
          .catch(() => {});
      }
    }
    await browser.runtime.sendMessage({ type: 'ANALYTICS_CAPTURED', handle }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function registerMessageRouter(): void {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.url?.includes('offscreen.html')) {
      const m = message as { type: string; progress?: number; error?: string };
      handleOffscreenBroadcast(m);
      handleToxicityOffscreenBroadcast(m);
      handleSlopOnnxOffscreenBroadcast(m);
      handleSlopImageOffscreenBroadcast(m);
    }
  });

  onMessage(async (msg: MessageType) => {
    switch (msg.type) {
      case 'GET_SETTINGS':
        return getSettings();
      case 'SAVE_SETTINGS':
        return saveSettings(msg.settings);
      case 'GRAPHQL_PROFILE': {
        profileCache.set(msg.handle.toLowerCase(), {
          ...profileCache.get(msg.handle.toLowerCase()),
          ...msg.profile,
        });
        enqueueScan(msg.handle);
        return { ok: true };
      }
      case 'GRAPHQL_TIMELINE_AUTHORS': {
        enqueueTimelineAuthors(msg.handles);
        return { ok: true };
      }
      case 'ENSURE_ACCOUNT_SCANNED': {
        await initDb();
        if (await accountNeedsFullScan(msg.handle)) enqueueScan(msg.handle);
        return { ok: true };
      }
      case 'SCAN_HANDLE':
        return scanHandle(msg.handle, msg.profile);
      case 'GET_SCORE': {
        const settings = await getSettings();
        const cached = await getCachedScore(msg.handle, settings.scoreCacheTtlMs);
        if (cached) return normalizeReputationResult(cached);
        return scanHandle(msg.handle);
      }
      case 'BATCH_GET_SCORES': {
        const settings = await getSettings();
        const handles = [...new Set(msg.handles.map((h) => h.toLowerCase()))].slice(0, 48);
        const out = await getCachedScoresBatch(handles, settings.scoreCacheTtlMs);
        for (const h of handles) {
          if (!out[h]) enqueueScan(h);
        }
        return out;
      }
      case 'REPORT_POST_SIGNALS': {
        await initDb();
        const result = await upsertObservedPostSignals({
          handle: msg.handle,
          source: msg.source,
          text: msg.text,
          imageUrl: msg.imageUrl,
          statusId: msg.statusId,
          slopScore: msg.slopScore,
          spamScore: msg.spamScore,
          toxicityScore: msg.toxicityScore,
          hasCommunityNote: msg.hasCommunityNote,
          qualityJson: msg.qualityJson,
        });
        const needsScan = await accountNeedsFullScan(msg.handle);
        if (result.inserted || result.scoresImproved || needsScan) enqueueScan(msg.handle);
        return { ok: true, ...result };
      }
      case 'GET_LEADERBOARD':
        await initDb();
        return queryLeaderboard(msg.kind, msg.limit ?? 50, msg.minPosts ?? 0);
      case 'GET_ACCOUNT_ROLLUPS':
        await initDb();
        return getAccountRollups(msg.handle);
      case 'EXPORT_DB': {
        await initDb();
        const { bytes, filename } = await exportDatabaseFile();
        return { bytes: Array.from(bytes), filename };
      }
      case 'IMPORT_DB': {
        await importDatabaseFile(new Uint8Array(msg.bytes), msg.mode);
        await migrateScoresFromStorageIfNeeded();
        return { ok: true };
      }
      case 'MARK_IMAGE_AS_AI': {
        await initDb();
        const settings = await getSettings();
        const slopScore = settings.manualAiImageSlopScore ?? DEFAULT_MANUAL_AI_SLOP_SCORE;
        await markImageAsAi(msg.handle, msg.imageUrl, slopScore);
        await upsertObservedPostSlop({
          handle: msg.handle,
          source: 'timeline',
          text: msg.text ?? '',
          imageUrl: msg.imageUrl,
          slopScore,
        });
        enqueueScan(msg.handle);
        return { ok: true, slopScore };
      }
      case 'UNMARK_IMAGE_AS_AI': {
        await initDb();
        await unmarkImageAsAi(msg.handle, msg.imageUrl);
        enqueueScan(msg.handle);
        return { ok: true };
      }
      case 'GET_MARKED_AI_IMAGES':
        await initDb();
        return listMarkedImageFingerprints(msg.handle);
      case 'SET_DETECTOR_CORRECTION': {
        await initDb();
        await setDetectorCorrection(msg.postFingerprint, msg.handle, msg.correction);
        return { ok: true };
      }
      case 'REMOVE_DETECTOR_CORRECTION': {
        await initDb();
        await removeDetectorCorrection(msg.postFingerprint, msg.correction);
        return { ok: true };
      }
      case 'GET_DETECTOR_CORRECTIONS':
        await initDb();
        return listDetectorCorrections(msg.postFingerprint);
      case 'RECORD_BROWSE_POST': {
        await initDb();
        const opts = {
          flaggedSpam: msg.flaggedSpam,
          flaggedSlop: msg.flaggedSlop,
          slopScore: msg.slopScore,
          flaggedAd: msg.flaggedAd,
          flaggedToxicity: msg.flaggedToxicity,
          toxicityScore: msg.toxicityScore,
        };
        recordSessionBrowse(msg.postFingerprint, opts);
        await recordBrowsePostDaily(msg.postFingerprint, opts);
        await appendFeedEvent({
          eventKind: 'post_exposure',
          postFingerprint: msg.postFingerprint,
          payload: {
            flaggedSpam: msg.flaggedSpam,
            flaggedSlop: msg.flaggedSlop,
            flaggedAd: msg.flaggedAd,
            flaggedToxicity: msg.flaggedToxicity,
            slopScore: msg.slopScore,
            spamScore: msg.spamScore,
            toxicityScore: msg.toxicityScore,
          },
        });
        const today = await getBrowseStatsToday();
        return { session: getSessionBrowse(), today } satisfies {
          session: BrowseStatsSnapshot;
          today: BrowseStatsSnapshot;
        };
      }
      case 'GET_BROWSE_STATS': {
        await initDb();
        return { session: getSessionBrowse(), today: await getBrowseStatsToday() };
      }
      case 'GET_BROWSE_STATS_RANGE': {
        await initDb();
        const days = msg.days ?? 30;
        return getBrowseStatsRange(days);
      }
      case 'RECORD_USER_ACTION': {
        const deduped = !shouldRecordUserAction(msg.kind);
        await initDb();
        if (!deduped) {
          recordSessionUserAction(msg.kind);
          await recordUserActionDaily(msg.kind);
          if (msg.postFingerprint) {
            recordSessionPostAction(
              msg.postFingerprint,
              msg.handle ?? '',
              msg.statusId,
              msg.kind,
            );
            await recordPostActionDaily(
              msg.postFingerprint,
              msg.handle ?? '',
              msg.statusId,
              msg.kind,
            );
          }
          if (msg.handle) await bumpAccountReachAction(msg.handle);
        }
        await appendFeedEvent({
          eventKind: msg.kind,
          postFingerprint: msg.postFingerprint,
          handle: msg.handle,
          statusId: msg.statusId,
          payload: {
            attributionSource: msg.attributionSource,
            deduped,
          },
        });
        return deduped
          ? { ok: true, deduped: true }
          : {
              session: getSessionUserActions(),
              today: await getUserActionsToday(),
            };
      }
      case 'GET_USER_ACTIONS': {
        await initDb();
        return { session: getSessionUserActions(), today: await getUserActionsToday() };
      }
      case 'GET_USER_ACTIONS_RANGE': {
        await initDb();
        return getUserActionsRange(msg.days ?? 30);
      }
      case 'GET_COMBINED_METRICS': {
        await initDb();
        const days = msg.days ?? 30;
        return buildCombinedMetricsResponse(
          getSessionBrowse(),
          getSessionUserActions(),
          await getBrowseStatsToday(),
          await getUserActionsToday(),
          await getBrowseStatsRange(days),
          await getUserActionsRange(days),
        );
      }
      case 'RECORD_BROWSE_TOPICS': {
        await initDb();
        recordSessionBrowseTopics(msg.postFingerprint, msg.labels);
        await recordBrowseTopicsDaily(msg.postFingerprint, msg.labels);
        return {
          session: getSessionBrowseTopics(),
          today: await getBrowseTopicsToday(),
        };
      }
      case 'GET_BROWSE_TOPICS': {
        await initDb();
        return {
          session: getSessionBrowseTopics(),
          today: await getBrowseTopicsToday(),
        };
      }
      case 'GET_BROWSE_TOPICS_RANGE': {
        await initDb();
        return getBrowseTopicsRange(msg.days ?? 30);
      }
      case 'CLASSIFY_BROWSE_TOPIC_IMAGE':
        return classifyBrowseTopicImage(msg.imageUrl);
      case 'RECORD_POST_ATTENTION': {
        await initDb();
        recordSessionAttention(msg.records);
        await recordPostAttentionBatch(msg.records);
        await appendFeedEventBatch(
          msg.records.map((r) => ({
            eventKind: 'attention_flush' as const,
            postFingerprint: r.postFingerprint,
            handle: r.handle,
            statusId: r.statusId,
            payload: {
              visibleMs: r.visibleMs,
              focusedVisibleMs: r.focusedVisibleMs,
              weightedVisibleMs: r.weightedVisibleMs,
              focusedWeightedMs: r.focusedWeightedMs,
              maxVisibleRatio: r.maxVisibleRatio,
              revisitCount: r.revisitCount,
              pauseCount: r.pauseCount,
            },
          })),
        );
        for (const r of msg.records) {
          const fw = r.focusedWeightedMs ?? r.focusedVisibleMs;
          if (fw > 0 && r.handle) {
            await bumpAccountReachFocus(r.handle, fw, true);
          }
        }
        return { ok: true };
      }
      case 'GET_ATTENTION_METRICS': {
        await initDb();
        const days = msg.days ?? 30;
        return buildFeedIntelligenceResponse('attention', days, {
          snapshot: getSessionAttention(),
          rows: getSessionAttentionRows(),
        });
      }
      case 'RECORD_PROVENANCE': {
        await initDb();
        const corpus = await loadCopypastaCorpus();
        const assessment = analyzePostProvenance(
          {
            postFingerprint: msg.postFingerprint,
            handle: msg.handle,
            statusId: msg.statusId,
            text: msg.text,
            isPromotedAd: msg.isPromotedAd,
            slopScore: msg.slopScore,
            spamScore: msg.spamScore,
            hasAiImageMark: msg.hasAiImageMark,
            cardDomain: msg.cardDomain,
          },
          corpus,
        );
        await recordProvenanceAssessment(assessment);
        return { ok: true, likelihoodCategory: assessment.likelihoodCategory };
      }
      case 'GET_FEED_INTELLIGENCE': {
        await initDb();
        const days = msg.days ?? 30;
        return buildFeedIntelligenceResponse(msg.section, days, {
          snapshot: getSessionAttention(),
          rows: getSessionAttentionRows(),
        });
      }
      case 'GET_DASHBOARD_DATA': {
        await initDb();
        const settings = await getSettings();
        const trusted = new Set(
          (settings.trustedUsers ?? []).map((t) => t.handle.toLowerCase()),
        );
        return buildDashboardResponse(msg.view, msg.filters, trusted, {
          browse: getSessionBrowse(),
          attention: getSessionAttention(),
          attentionRows: getSessionAttentionRows(),
        });
      }
      case 'EXPORT_DASHBOARD_DATA': {
        await initDb();
        const settings = await getSettings();
        const trusted = new Set(
          (settings.trustedUsers ?? []).map((t) => t.handle.toLowerCase()),
        );
        return exportDashboardData(msg.view, msg.filters, trusted, msg.format, {
          browse: getSessionBrowse(),
          attention: getSessionAttention(),
          attentionRows: getSessionAttentionRows(),
        });
      }
      case 'RESET_BROWSE_SESSION':
        resetSessionBrowse();
        resetSessionUserActions();
        resetSessionBrowseTopics();
        resetSessionAttention();
        return { ok: true };
      case 'ADD_SPAM_EXAMPLE': {
        const ex: SpamExample = {
          ...msg.example,
          id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
        };
        await addSpamExample(ex);
        return ex;
      }
      case 'GET_SPAM_EXAMPLES':
        return getSpamExamples();
      case 'DELETE_SPAM_EXAMPLE':
        await deleteSpamExample(msg.id);
        return { ok: true };
      case 'IMPORT_DATA':
        await importBundle(msg.data);
        return { ok: true };
      case 'EXPORT_DATA':
        return exportBundle();
      case 'GET_QUEUE':
        return getQueue();
      case 'UPDATE_QUEUE':
        await updateQueueStatus(msg.id, msg.status);
        return { ok: true };
      case 'GET_STATS':
        return getStats();
      case 'ADD_TRUSTED':
        return addTrustedUser(msg.handle, msg.note);
      case 'REMOVE_TRUSTED':
        await removeTrustedUser(msg.handle);
        return { ok: true };
      case 'GET_TRUSTED':
        return getTrustedUsers();
      case 'GET_SLOP_MODEL_STATUS':
        return checkOffscreenStatus();
      case 'INIT_SLOP_MODEL':
        return initSlopModel();
      case 'CLASSIFY_SLOP_TEXT': {
        const settings = await getSettings();
        if (!settings.aiSlopModelEnabled) {
          return { success: false, error: 'AI slop model is disabled in settings' };
        }
        return classifySlopText(msg.text);
      }
      case 'OLLAMA_LIST_MODELS':
        return listOllamaModels();
      case 'GET_SLOP_ONNX_MODEL_STATUS':
        return checkSlopOnnxOffscreenStatus();
      case 'INIT_SLOP_ONNX_MODEL':
        return initSlopOnnxModel();
      case 'GET_SLOP_IMAGE_MODEL_STATUS':
        return checkSlopImageOffscreenStatus();
      case 'INIT_SLOP_IMAGE_MODEL':
        return initSlopImageModel();
      case 'CLASSIFY_SLOP_IMAGE':
        return classifySlopImage(msg.imageUrl);
      case 'CLASSIFY_SLOP_MEDIA': {
        const settings = await getSettings();
        const media: TweetMediaInfo = {
          hasPhoto: Boolean(msg.imageUrl),
          hasCard: false,
          hasVideo: false,
          imageUrl: msg.imageUrl,
          altTexts: [],
        };
        return classifySlopMedia(msg.text, media, settings);
      }
      case 'GET_TOXICITY_MODEL_STATUS':
        return checkToxicityOffscreenStatus();
      case 'INIT_TOXICITY_MODEL':
        return initToxicityModel();
      case 'CLASSIFY_TOXICITY': {
        const settings = await getSettings();
        if (settings.toxicityModelEnabled === false) {
          const { score } = scoreTextToxicityHeuristic(msg.text);
          return labelsToToxicityAnalysis(
            score > 0 ? [{ label: 'toxic', score: score / 100 }] : [],
          );
        }
        return classifyToxicityWithFallback(msg.text, settings);
      }
      case 'GET_PRIMARY_ACCOUNT':
        return getPrimaryAccount();
      case 'SET_PRIMARY_ACCOUNT': {
        const h = normalizeHandle(msg.handle);
        if (!HANDLE_RE.test(h)) {
          return { ok: false, error: 'Invalid handle (1–15 letters, numbers, underscore)' };
        }
        const account = await setPrimaryAccount(h, msg.displayLabel);
        enqueueScan(h);
        return { ok: true, account };
      }
      case 'SCAN_PRIMARY_ACCOUNT': {
        const primary = await getPrimaryAccount();
        if (!primary) return { ok: false, error: 'No primary account saved' };
        const result = await scanHandle(primary.handle);
        await touchPrimaryScanned(primary.handle);
        return { ok: true, result };
      }
      case 'GET_ACCOUNT_INSIGHTS':
        return getAccountInsights();
      case 'GET_ANALYTICS_HISTORY': {
        const primary = await getPrimaryAccount();
        const h = msg.handle ? normalizeHandle(msg.handle) : primary?.handle;
        if (!h) return [];
        return listAnalyticsHistory(h);
      }
      case 'IMPORT_ANALYTICS_CSV': {
        const primary = await getPrimaryAccount();
        const h = msg.handle ? normalizeHandle(msg.handle) : primary?.handle;
        if (!h) {
          return {
            ok: false,
            warnings: [],
            error: 'Save your primary @handle on My account before importing CSV.',
          } satisfies AnalyticsImportResult;
        }
        const parsed = parseAnalyticsCsv(msg.csv, h);
        if (!parsed.ok || !parsed.snapshot) {
          return {
            ok: false,
            warnings: parsed.warnings,
            error: parsed.error ?? 'Import failed.',
          } satisfies AnalyticsImportResult;
        }
        const saved = await saveAnalyticsSnapshot(parsed.snapshot);
        await broadcastAnalyticsCaptured(saved.handle);
        return {
          ok: true,
          snapshot: saved,
          warnings: parsed.warnings,
        } satisfies AnalyticsImportResult;
      }
      case 'ANALYTICS_PAYLOAD': {
        const primary = await getPrimaryAccount();
        const snap = msg.snapshot;
        if (primary && normalizeHandle(snap.handle) !== primary.handle) {
          snap.handle = primary.handle;
        }
        const saved = await saveAnalyticsSnapshot(snap);
        await broadcastAnalyticsCaptured(saved.handle);
        return { ok: true, snapshot: saved };
      }
      default:
        return undefined;
    }
  });
}
