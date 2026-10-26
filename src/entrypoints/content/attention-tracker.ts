import { postFingerprint } from '../../lib/db/fingerprint';
import type { PostAttentionDelta } from '../../lib/attention/aggregate';
import type { FeedSurface, MediaType } from '../../lib/feed/surface-detect';
import { detectFeedSurface } from '../../lib/feed/surface-detect';
import { weightedDeltaMs } from '../../lib/attention/weighting';
import { sendMessage } from '../../lib/messaging';
import { extractTweetSlopContent } from '../../lib/slop/extract-tweet-content';
import { extractTweetAuthorHandle, extractTweetStatusId } from '../../lib/x-dom/selectors';
import { safeSend } from './lifecycle';

const TICK_MS = 250;
const FLUSH_MS = 5000;
const PAUSE_THRESHOLD_MS = 1500;

interface PostAttentionState {
  postFingerprint: string;
  handle: string;
  statusId?: string;
  isIntersecting: boolean;
  intersectionRatio: number;
  visibleMs: number;
  focusedVisibleMs: number;
  weightedVisibleMs: number;
  focusedWeightedMs: number;
  maxVisibleRatio: number;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  revisitCount: number;
  pauseCount: number;
  deltaVisibleMs: number;
  deltaFocusedVisibleMs: number;
  deltaWeightedVisibleMs: number;
  deltaFocusedWeightedMs: number;
  deltaMaxVisibleRatio: number;
  deltaRevisitCount: number;
  deltaPauseCount: number;
  pauseArmed: boolean;
  slopScore?: number;
  spamScore?: number;
  toxicityScore?: number;
  topics?: string[];
  surface?: FeedSurface;
  mediaType?: MediaType;
  cardDomain?: string;
  isPromoted?: boolean;
  lastFocusedAt: number;
}

const byElement = new WeakMap<HTMLElement, PostAttentionState>();
const byFingerprint = new Map<string, PostAttentionState>();
const statusIdToPost = new Map<string, { postFingerprint: string; handle: string }>();

let attentionIo: IntersectionObserver | null = null;
let tickTimer: number | null = null;
let flushTimer: number | null = null;
let lastTickAt = 0;
let lastScrollAt = Date.now();
let initialized = false;

function isTabFocusedVisible(): boolean {
  return document.visibilityState === 'visible' && document.hasFocus();
}

function buildState(article: HTMLElement): PostAttentionState | null {
  const handle = extractTweetAuthorHandle(article);
  if (!handle) return null;
  const statusId = extractTweetStatusId(article);
  const { text, media } = extractTweetSlopContent(article);
  const fp = postFingerprint(handle, text, media.imageUrl, statusId);
  if (statusId) statusIdToPost.set(statusId, { postFingerprint: fp, handle });

  let state = byElement.get(article);
  if (state) return state;

  state = {
    postFingerprint: fp,
    handle,
    statusId,
    isIntersecting: false,
    intersectionRatio: 0,
    visibleMs: 0,
    focusedVisibleMs: 0,
    weightedVisibleMs: 0,
    focusedWeightedMs: 0,
    maxVisibleRatio: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    revisitCount: 0,
    pauseCount: 0,
    deltaVisibleMs: 0,
    deltaFocusedVisibleMs: 0,
    deltaWeightedVisibleMs: 0,
    deltaFocusedWeightedMs: 0,
    deltaMaxVisibleRatio: 0,
    deltaRevisitCount: 0,
    deltaPauseCount: 0,
    pauseArmed: false,
    lastFocusedAt: 0,
    surface: detectFeedSurface(),
  };
  byElement.set(article, state);
  byFingerprint.set(fp, state);
  return state;
}

function ensureAttentionObserver(): IntersectionObserver {
  if (attentionIo) return attentionIo;
  attentionIo = new IntersectionObserver(
    (entries) => {
      const now = Date.now();
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const state = byElement.get(el);
        if (!state) continue;
        const wasIntersecting = state.isIntersecting;
        state.isIntersecting = entry.isIntersecting && entry.intersectionRatio > 0;
        state.intersectionRatio = entry.intersectionRatio;
        if (entry.intersectionRatio > state.maxVisibleRatio) {
          state.maxVisibleRatio = entry.intersectionRatio;
        }
        if (entry.intersectionRatio > state.deltaMaxVisibleRatio) {
          state.deltaMaxVisibleRatio = entry.intersectionRatio;
        }
        if (state.isIntersecting) {
          if (state.firstSeenAt == null) {
            state.firstSeenAt = now;
            state.lastSeenAt = now;
          } else if (!wasIntersecting) {
            state.revisitCount++;
            state.deltaRevisitCount++;
            state.pauseArmed = false;
          }
        }
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  return attentionIo;
}

function tickAttention(): void {
  const now = Date.now();
  const deltaMs = lastTickAt ? now - lastTickAt : 0;
  lastTickAt = now;
  if (deltaMs <= 0) return;

  const focused = isTabFocusedVisible();
  const scrollIdle = now - lastScrollAt >= PAUSE_THRESHOLD_MS;

  for (const state of byFingerprint.values()) {
    if (!state.isIntersecting || state.intersectionRatio <= 0) {
      state.pauseArmed = false;
      continue;
    }

    const ratio = state.intersectionRatio;
    const weighted = weightedDeltaMs(deltaMs, ratio, undefined, focused);

    state.visibleMs += deltaMs;
    state.deltaVisibleMs += deltaMs;
    state.weightedVisibleMs += weighted.weightedVisibleMs;
    state.deltaWeightedVisibleMs += weighted.weightedVisibleMs;
    state.lastSeenAt = now;

    if (focused) {
      state.focusedVisibleMs += deltaMs;
      state.deltaFocusedVisibleMs += deltaMs;
      state.focusedWeightedMs += weighted.focusedWeightedMs;
      state.deltaFocusedWeightedMs += weighted.focusedWeightedMs;
      state.lastFocusedAt = now;

      if (scrollIdle && !state.pauseArmed) {
        state.pauseCount++;
        state.deltaPauseCount++;
        state.pauseArmed = true;
      } else if (!scrollIdle) {
        state.pauseArmed = false;
      }
    }
  }
}

function collectFlushRecords(): PostAttentionDelta[] {
  const records: PostAttentionDelta[] = [];
  for (const state of byFingerprint.values()) {
    const hasDelta =
      state.deltaVisibleMs > 0 ||
      state.deltaFocusedVisibleMs > 0 ||
      state.deltaWeightedVisibleMs > 0 ||
      state.deltaFocusedWeightedMs > 0 ||
      state.deltaRevisitCount > 0 ||
      state.deltaPauseCount > 0 ||
      state.deltaMaxVisibleRatio > 0;
    if (!hasDelta) continue;

    records.push({
      postFingerprint: state.postFingerprint,
      handle: state.handle,
      statusId: state.statusId,
      visibleMs: state.deltaVisibleMs,
      focusedVisibleMs: state.deltaFocusedVisibleMs,
      weightedVisibleMs: state.deltaWeightedVisibleMs,
      focusedWeightedMs: state.deltaFocusedWeightedMs,
      maxVisibleRatio: state.deltaMaxVisibleRatio,
      firstSeenAt: state.firstSeenAt ?? undefined,
      lastSeenAt: state.lastSeenAt ?? undefined,
      revisitCount: state.deltaRevisitCount,
      pauseCount: state.deltaPauseCount,
      slopScore: state.slopScore,
      spamScore: state.spamScore,
      toxicityScore: state.toxicityScore,
      topics: state.topics,
      surface: state.surface,
      mediaType: state.mediaType,
      cardDomain: state.cardDomain,
      isPromoted: state.isPromoted,
    });

    state.deltaVisibleMs = 0;
    state.deltaFocusedVisibleMs = 0;
    state.deltaWeightedVisibleMs = 0;
    state.deltaFocusedWeightedMs = 0;
    state.deltaMaxVisibleRatio = 0;
    state.deltaRevisitCount = 0;
    state.deltaPauseCount = 0;
  }
  return records;
}

function flushAttention(force = false): void {
  const records = collectFlushRecords();
  if (!records.length && !force) return;
  if (!records.length) return;
  safeSend(sendMessage({ type: 'RECORD_POST_ATTENTION', records }));
}

function onScrollActivity(): void {
  lastScrollAt = Date.now();
  for (const state of byFingerprint.values()) {
    if (state.isIntersecting) state.pauseArmed = false;
  }
}

function startTimers(): void {
  if (tickTimer != null) return;
  lastTickAt = Date.now();
  tickTimer = window.setInterval(tickAttention, TICK_MS);
  flushTimer = window.setInterval(() => flushAttention(), FLUSH_MS);
}

function stopTimers(): void {
  if (tickTimer != null) {
    window.clearInterval(tickTimer);
    tickTimer = null;
  }
  if (flushTimer != null) {
    window.clearInterval(flushTimer);
    flushTimer = null;
  }
}

export function initAttentionTracker(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('scroll', onScrollActivity, { passive: true, capture: true });
  window.addEventListener('wheel', onScrollActivity, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAttention();
  });
  window.addEventListener('pagehide', () => flushAttention());
  window.addEventListener('blur', () => flushAttention());
  window.addEventListener('focus', () => {
    lastScrollAt = Date.now();
  });

  startTimers();
}

export function observePostAttention(article: HTMLElement): void {
  initAttentionTracker();
  const state = buildState(article);
  if (!state) return;
  ensureAttentionObserver().observe(article);
}

export function enrichPostAttention(
  postFp: string,
  ctx: {
    slopScore?: number;
    spamScore?: number;
    toxicityScore?: number;
    topics?: string[];
    surface?: FeedSurface;
    mediaType?: MediaType;
    cardDomain?: string;
    isPromoted?: boolean;
  },
): void {
  const state = byFingerprint.get(postFp);
  if (!state) return;
  if (ctx.slopScore != null) state.slopScore = ctx.slopScore;
  if (ctx.spamScore != null) state.spamScore = ctx.spamScore;
  if (ctx.toxicityScore != null) state.toxicityScore = ctx.toxicityScore;
  if (ctx.topics?.length) state.topics = ctx.topics;
  if (ctx.surface) state.surface = ctx.surface;
  if (ctx.mediaType) state.mediaType = ctx.mediaType;
  if (ctx.cardDomain) state.cardDomain = ctx.cardDomain;
  if (ctx.isPromoted != null) state.isPromoted = ctx.isPromoted;
}

export function resolvePostFromArticle(
  article: HTMLElement,
): { postFingerprint: string; handle: string; statusId?: string } | null {
  const state = byElement.get(article) ?? buildState(article);
  if (!state) return null;
  return {
    postFingerprint: state.postFingerprint,
    handle: state.handle,
    statusId: state.statusId,
  };
}

export function resolvePostFromStatusId(
  statusId: string,
): { postFingerprint: string; handle: string; statusId: string } | null {
  const post = statusIdToPost.get(statusId);
  if (!post) return null;
  return { ...post, statusId };
}

export function getLastFocusedPost(): {
  postFingerprint: string;
  handle: string;
  statusId?: string;
} | null {
  let best: PostAttentionState | null = null;
  for (const state of byFingerprint.values()) {
    if (state.lastFocusedAt <= 0) continue;
    if (!best || state.lastFocusedAt > best.lastFocusedAt) best = state;
  }
  if (!best) return null;
  const cutoff = Date.now() - 8000;
  if (best.lastFocusedAt < cutoff) return null;
  return {
    postFingerprint: best.postFingerprint,
    handle: best.handle,
    statusId: best.statusId,
  };
}

export function destroyAttentionTracker(): void {
  stopTimers();
  flushAttention();
  attentionIo?.disconnect();
  attentionIo = null;
  byFingerprint.clear();
  statusIdToPost.clear();
  initialized = false;
}
