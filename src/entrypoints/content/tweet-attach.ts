import { syncAiImageBadges } from '../../components/ai-image-badge';
import {
  isImageMarkedLocally,
  primeMarkedImagesCache,
  syncImageMarkControls,
} from '../../components/ai-image-mark';
import {
  createTweetStatsBadges,
  updateTweetStatsBadges,
} from '../../components/tweet-stats-badges';
import {
  classifyBrowseTopics,
  extractCardDomain,
  extractHashtags,
  mergeClipTopicScores,
  topHeuristicConfidence,
} from '../../lib/browse/topic-classify';
import { TOPIC_CLIP_CONFIDENCE_THRESHOLD } from '../../lib/browse/topic-taxonomy';
import { classifyBrowseTopicImageRemote } from '../../lib/browse/topic-model-client';
import {
  computeBrowseFlagsForReport,
  shouldReportCorpusUpdate,
  type CorpusScoreSnapshot,
} from '../../lib/browse/signal-report';
import { postFingerprint } from '../../lib/db/fingerprint';
import { detectFeedSurface, inferMediaType } from '../../lib/feed/surface-detect';
import {
  analyzeContentQuality,
  legacySlopScore,
  legacySpamScore,
  qualityToSlopSignals,
} from '../../lib/detectors/content-quality';
import { sendMessage } from '../../lib/messaging';
import { authorSpamRisk } from '../../lib/scoring/normalize-result';
import { fetchScore } from './score-cache';
import { enrichPostAttention } from './attention-tracker';
import { getContentSettings } from './settings-cache';
import { mergeManualAiSlopScores } from '../../lib/slop/manual-ai-merge';
import { classifySlopMediaRemote } from '../../lib/slop/model-client';
import {
  extractTweetMedia,
  extractTweetSlopContent,
} from '../../lib/slop/extract-tweet-content';
import { queryTweetPreviewImages } from '../../lib/slop/tweet-preview-images';
import { classifyToxicityRemote } from '../../lib/toxicity/model-client';
import type {
  ContentQualityProfile,
  ExtensionSettings,
  ReputationResult,
  SlopAnalysis,
  ToxicityAnalysis,
} from '../../lib/types';
import { applyPromotedAdTreatment } from '../../lib/x-dom/promoted-ad-style';
import { isPromotedAdTweet } from '../../lib/x-dom/promoted-tweet';
import { articleHasCommunityNote } from '../../lib/x-dom/community-note';
import {
  extractTweetAuthorHandle,
  extractTweetStatusId,
  findProfileHandleFromUrl,
  findTweetActionBar,
  insertIntoTweetActionBar,
  insertTweetStatsFallback,
  queryTweetArticles,
  SELECTORS,
} from '../../lib/x-dom/selectors';
import { cs } from './state';

async function ensureMarkedImagesLoaded(handle: string): Promise<void> {
  const h = handle.toLowerCase();
  if (cs.markedHandlesLoaded.has(h)) return;
  try {
    const fps = await sendMessage<string[]>({ type: 'GET_MARKED_AI_IMAGES', handle: h });
    primeMarkedImagesCache(h, fps ?? []);
  } catch {
    primeMarkedImagesCache(h, []);
  }
  cs.markedHandlesLoaded.add(h);
}

export function scheduleAttachTweet(
  article: HTMLElement,
  handle: string,
  existing?: ReputationResult,
): void {
  const prev = cs.attachDebounceTimers.get(article);
  if (prev) window.clearTimeout(prev);
  cs.attachDebounceTimers.set(
    article,
    window.setTimeout(() => {
      cs.attachDebounceTimers.delete(article);
      void attachTweetStatsBar(article, handle, existing);
    }, 100),
  );
}

export function reattachTweetsForHandle(handle: string, result: ReputationResult): void {
  const h = handle.toLowerCase();
  document.querySelectorAll<HTMLElement>(`${SELECTORS.tweet}[data-xrh-author="${h}"]`).forEach((el) => {
    scheduleAttachTweet(el, h, result);
  });
  queryTweetArticles().forEach((el) => {
    if (el.dataset.xrhAuthor === h || extractTweetAuthorHandle(el) === h) {
      el.dataset.xrhAuthor = h;
      scheduleAttachTweet(el, h, result);
    }
  });
}

function clearLegacyTweetBadges(el: HTMLElement): void {
  el.querySelector('.xrh-badge-host')?.remove();
  el.querySelector('.xrh-slop-chip')?.remove();
}

function wireLazyImageSlop(
  article: HTMLElement,
  text: string,
  onSlop: (slop: SlopAnalysis) => void,
  enrich: (slop: SlopAnalysis | null) => SlopAnalysis | null,
): void {
  if (cs.lazySlopWired.has(article)) return;
  cs.lazySlopWired.add(article);
  queryTweetPreviewImages(article).forEach((img) => {
    const run = () => {
      const media = extractTweetMedia(article);
      if (!media.imageUrl) return;
      const key = `${text.slice(0, 200)}|${media.imageUrl}`;
      void fetchTweetSlop(text, media.imageUrl, key, enrich).then((slop) => {
        if (slop) onSlop(slop);
      });
    };
    if (img.complete && img.naturalWidth > 0) run();
    else img.addEventListener('load', run, { once: true });
  });
}

async function resolveReputation(
  handle: string,
  existing?: ReputationResult,
): Promise<ReputationResult> {
  return fetchScore(handle, existing);
}

export async function attachTweetStatsBar(
  el: HTMLElement,
  handle: string,
  existing?: ReputationResult,
): Promise<void> {
  const settings = await getContentSettings();
  const { text, media } = extractTweetSlopContent(el);
  const slopKey = `${text.slice(0, 200)}|${media.imageUrl ?? ''}`;
  const prevWire = cs.tweetWire.get(el);
  const statsReady = !!el.querySelector('.xrh-tweet-stats');
  const lightRefresh =
    statsReady && prevWire?.handle === handle && prevWire?.slopKey === slopKey && !existing;

  const gen = lightRefresh ? prevWire!.gen : (prevWire?.gen ?? 0) + 1;
  cs.tweetWire.set(el, { handle, slopKey, gen });

  if (!lightRefresh) {
    clearLegacyTweetBadges(el);
    applyPromotedAdTreatment(el, settings.promotedAdDimEnabled !== false);
  }

  const actionTarget = findTweetActionBar(el);
  const statusId = extractTweetStatusId(el);

  await ensureMarkedImagesLoaded(handle);

  const result = await resolveReputation(handle, existing);
  if (cs.tweetWire.get(el)?.gen !== gen) return;

  const spamRisk = authorSpamRisk(result);
  const quality = analyzeContentQuality({
    text,
    handle,
    isReply: Boolean(el.querySelector('[data-testid="inReplyTo"]')),
    media,
    cardTitle: media.cardTitle,
    profile: result.profile,
    imageScore: undefined,
    hasManualAiMark: media.imageUrl ? isImageMarkedLocally(handle, media.imageUrl) : false,
  });
  const heuristicSlop = legacySlopScore(quality);
  const tweetSpamScore = legacySpamScore(quality);
  const signals = qualityToSlopSignals(quality);
  const slopThreshold = settings.slopDisplayThreshold ?? 55;
  const toxicityThreshold = settings.toxicityDisplayThreshold ?? 45;
  const spamThreshold = settings.spamDisplayThreshold ?? 40;
  const aiImageBadgeThreshold = settings.aiImageBadgeThreshold ?? 35;
  const aiImageBadgeEnabled = settings.aiImageBadgeEnabled !== false;
  const toxKey = text.slice(0, 280);

  const postFp = postFingerprint(handle, text, media.imageUrl, statusId);

  const enrichSlopWithQuality = (tweetSlop: SlopAnalysis | null): SlopAnalysis | null => {
    if (!tweetSlop) return null;
    const q = analyzeContentQuality({
      text,
      handle,
      media,
      cardTitle: media.cardTitle,
      profile: result.profile,
      imageScore: tweetSlop.image,
      imageLabel: tweetSlop.imageLabel,
      hasManualAiMark: media.imageUrl ? isImageMarkedLocally(handle, media.imageUrl) : false,
    });
    return {
      ...tweetSlop,
      quality: q,
      signals: qualityToSlopSignals(q),
    };
  };

  const buildOpts = (tweetSlop: SlopAnalysis | null, tweetToxicity: ToxicityAnalysis | null) => ({
    reputation: result,
    tweetSlopScore: tweetSlop?.combined ?? heuristicSlop,
    tweetSignals: tweetSlop?.signals ?? signals,
    contentQuality: tweetSlop?.quality ?? quality,
    postFingerprint: postFp,
    handle,
    slopThreshold,
    slopPerTweetEnabled: settings.slopPerTweetEnabled !== false,
    tweetTextLength: text.length,
    toxicityThreshold,
    tweetToxicity,
    tweetSpamScore,
    authorSpamRisk: spamRisk,
    spamThreshold,
    tweetSlopImage: tweetSlop?.image,
    tweetSlopImageLabel: tweetSlop?.imageLabel,
  });

  const withManualSlop = (tweetSlop: SlopAnalysis | null): SlopAnalysis | null => {
    if (!tweetSlop) return null;
    const url = media.imageUrl;
    const manualScore = settings.manualAiImageSlopScore ?? 82;
    if (url && isImageMarkedLocally(handle, url)) {
      return mergeManualAiSlopScores(tweetSlop, manualScore, manualScore);
    }
    return tweetSlop;
  };

  const postSource =
    findProfileHandleFromUrl() === handle.toLowerCase() ? ('profile' as const) : ('timeline' as const);

  const reportSignals = (
    tweetSlop: SlopAnalysis | null,
    tweetToxicity: ToxicityAnalysis | null,
  ) => {
    const displaySlop = withManualSlop(tweetSlop);
    const q = displaySlop?.quality ?? quality;
    const slopScore = displaySlop?.combined ?? legacySlopScore(q);
    const { flaggedSpam, flaggedSlop } = computeBrowseFlagsForReport(
      slopScore,
      tweetSpamScore,
      spamRisk,
      slopThreshold,
      spamThreshold,
    );
    const toxicityScore = tweetToxicity?.combined;
    const flaggedToxicity = (toxicityScore ?? 0) >= toxicityThreshold;
    const flaggedAd = isPromotedAdTweet(el);
    const snapshot: CorpusScoreSnapshot = {
      slopScore,
      spamScore: tweetSpamScore,
      toxicityScore,
      flaggedSpam,
      flaggedSlop,
    };

    enrichPostAttention(postFp, {
      slopScore,
      spamScore: tweetSpamScore,
      toxicityScore,
      surface: detectFeedSurface(),
      mediaType: inferMediaType(media),
      cardDomain: extractCardDomain(el),
      isPromoted: flaggedAd,
    });

    if (!cs.provenanceReported.has(postFp)) {
      cs.provenanceReported.add(postFp);
      void sendMessage({
        type: 'RECORD_PROVENANCE',
        postFingerprint: postFp,
        handle,
        statusId,
        text,
        isPromotedAd: flaggedAd,
        slopScore,
        spamScore: tweetSpamScore,
        hasAiImageMark: !!(media.imageUrl && isImageMarkedLocally(handle, media.imageUrl)),
        cardDomain: extractCardDomain(el),
      }).catch(() => {});
    }

    if (!cs.browseReported.has(postFp)) {
      cs.browseReported.add(postFp);
      void sendMessage({
        type: 'RECORD_BROWSE_POST',
        postFingerprint: postFp,
        slopScore,
        spamScore: tweetSpamScore,
        authorSpamRisk: spamRisk,
        flaggedSpam,
        flaggedSlop,
        flaggedAd,
        toxicityScore,
        flaggedToxicity,
      }).catch(() => {});

      if (settings.browseTopicsEnabled !== false) {
        const topicInput = {
          text,
          hashtags: extractHashtags(text),
          authorHandle: handle,
          cardTitle: media.cardTitle,
          cardDescription: media.cardDescription,
          cardDomain: extractCardDomain(el),
          media,
        };
        const topics = classifyBrowseTopics(topicInput, settings.customBrowseInterests ?? []);
        const recordTopics = (t: ReturnType<typeof classifyBrowseTopics>) => {
          enrichPostAttention(postFp, { topics: t.labels });
          void sendMessage({
            type: 'RECORD_BROWSE_TOPICS',
            postFingerprint: postFp,
            primary: String(t.primary),
            labels: t.labels,
          }).catch(() => {});
        };
        recordTopics(topics);
        const needsClip =
          settings.browseTopicClipEnabled !== false &&
          settings.slopImageModelEnabled !== false &&
          media.imageUrl &&
          topHeuristicConfidence(topics) < TOPIC_CLIP_CONFIDENCE_THRESHOLD;
        if (needsClip && cs.browseTopicsInflight < cs.MAX_BROWSE_TOPICS_CLIP_INFLIGHT) {
          cs.browseTopicsInflight++;
          void classifyBrowseTopicImageRemote(media.imageUrl!)
            .then((clip) => {
              if (!clip) return;
              const merged = mergeClipTopicScores(topics, clip.topic, clip.score);
              if (
                merged.primary !== topics.primary ||
                merged.labels.join() !== topics.labels.join()
              ) {
                recordTopics(merged);
              }
            })
            .finally(() => {
              cs.browseTopicsInflight--;
            });
        }
      }
    }

    const prevCorpus = cs.corpusReported.get(postFp);
    if (!shouldReportCorpusUpdate(prevCorpus, snapshot)) return;
    cs.corpusReported.set(postFp, snapshot);

    void sendMessage({
      type: 'REPORT_POST_SIGNALS',
      handle,
      source: postSource,
      text,
      imageUrl: media.imageUrl,
      statusId,
      slopScore,
      spamScore: legacySpamScore(q),
      toxicityScore: tweetToxicity?.combined,
      hasCommunityNote: articleHasCommunityNote(el),
      qualityJson: JSON.stringify(q),
    }).catch(() => {});
  };

  const slopPending = cs.slopFetchPending.has(slopKey);

  const render = (tweetToxicity: ToxicityAnalysis | null, tweetSlop: SlopAnalysis | null) => {
    if (cs.tweetWire.get(el)?.gen !== gen) return;
    const displaySlop = withManualSlop(tweetSlop);
    const opts = buildOpts(displaySlop, tweetToxicity);
    syncAiImageBadges(
      el,
      displaySlop,
      { threshold: aiImageBadgeThreshold, enabled: aiImageBadgeEnabled, slopPending },
      (url) => isImageMarkedLocally(handle, url),
    );
    syncImageMarkControls(
      el,
      handle,
      text,
      settings,
      displaySlop,
      { badgeThreshold: aiImageBadgeThreshold, badgeEnabled: aiImageBadgeEnabled },
      (next) => {
        if (next) render(tweetToxicity, next);
        else void fetchTweetSlop(text, media.imageUrl, slopKey, enrichSlopWithQuality).then((s) =>
          render(tweetToxicity, s),
        );
      },
    );
    reportSignals(displaySlop, tweetToxicity);

    if (!lightRefresh) {
      let host = el.querySelector('.xrh-tweet-stats') as HTMLElement | null;
      if (host) updateTweetStatsBadges(host, opts);
      else host = createTweetStatsBadges(opts);
      if (actionTarget) {
        const parent = actionTarget.insertBefore?.parentElement ?? actionTarget.group;
        if (!parent.contains(host)) {
          host.remove();
          insertIntoTweetActionBar(actionTarget, host);
        }
      } else if (!el.contains(host)) {
        host.remove();
        insertTweetStatsFallback(el, host);
      }
    } else {
      const host = el.querySelector('.xrh-tweet-stats') as HTMLElement | null;
      if (host) updateTweetStatsBadges(host, opts);
    }
  };

  const cachedSlop = cs.slopMediaCache.get(slopKey) ?? null;
  const cachedTox = cs.toxicityTextCache.get(toxKey) ?? null;
  render(cachedTox, cachedSlop);

  const slopModelsOn =
    settings.slopOnnxEnabled !== false ||
    settings.aiSlopModelEnabled ||
    settings.slopImageModelEnabled !== false;

  if (
    !lightRefresh &&
    (text.length >= 8 || media.imageUrl) &&
    slopModelsOn &&
    !cachedSlop &&
    !cs.slopFetchPending.has(slopKey)
  ) {
    void fetchTweetSlop(text, media.imageUrl, slopKey, enrichSlopWithQuality).then((slop) => {
      if (slop) render(cachedTox, slop);
    });
  }

  if (!lightRefresh && !media.imageUrl && queryTweetPreviewImages(el).length > 0 && slopModelsOn) {
    wireLazyImageSlop(el, text, (slop) => render(cachedTox, slop), enrichSlopWithQuality);
  }

  if (
    !lightRefresh &&
    text.length >= 8 &&
    settings.toxicityModelEnabled !== false &&
    !cachedTox
  ) {
    void fetchTweetToxicity(text).then((tox) => {
      if (tox) render(tox, cs.slopMediaCache.get(slopKey) ?? cachedSlop);
    });
  }
}

async function fetchTweetSlop(
  text: string,
  imageUrl: string | undefined,
  key: string,
  enrich: (slop: SlopAnalysis | null) => SlopAnalysis | null = (s) => s,
): Promise<SlopAnalysis | null> {
  const cached = cs.slopMediaCache.get(key);
  if (cached) return cached;
  if (cs.slopFetchPending.has(key) || cs.slopInflight >= cs.MAX_SLOP_INFLIGHT) return null;
  cs.slopFetchPending.add(key);
  cs.slopInflight++;
  try {
    const slop = await classifySlopMediaRemote(text, imageUrl);
    const enriched = enrich(slop);
    if (enriched) cs.slopMediaCache.set(key, enriched);
    return enriched;
  } catch {
    return null;
  } finally {
    cs.slopFetchPending.delete(key);
    cs.slopInflight--;
  }
}

async function fetchTweetToxicity(text: string): Promise<ToxicityAnalysis | null> {
  const key = text.slice(0, 280);
  const cached = cs.toxicityTextCache.get(key);
  if (cached) return cached;
  if (cs.toxicityInflight >= cs.MAX_TOXICITY_INFLIGHT) return null;
  cs.toxicityInflight++;
  try {
    const tox = await classifyToxicityRemote(key);
    if (tox) cs.toxicityTextCache.set(key, tox);
    return tox;
  } catch {
    return null;
  } finally {
    cs.toxicityInflight--;
  }
}
