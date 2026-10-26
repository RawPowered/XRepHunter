import type {
  ExtensionSettings,
  PrimaryAccount,
  ReputationResult,
  SlopAnalysis,
  ToxicityAnalysis,
} from '../../lib/types';
import type { CorpusScoreSnapshot } from '../../lib/browse/signal-report';

export const GRAPHQL_EVENT = 'xrephunter-graphql';

/** Mutable content-script session state (single object avoids ESM import reassignment issues). */
export const cs = {
  pendingHandles: new Set<string>(),
  pendingHandleTimers: new Map<string, number>(),
  PENDING_HANDLE_TIMEOUT_MS: 30_000,
  scannedThisPage: new Set<string>(),
  browseReported: new Set<string>(),
  provenanceReported: new Set<string>(),
  browseTopicsInflight: 0,
  MAX_BROWSE_TOPICS_CLIP_INFLIGHT: 2,
  corpusReported: new Map<string, CorpusScoreSnapshot>(),
  MAX_DISCOVER_HANDLES: 80,
  debounceTimer: null as number | null,
  tweetIo: null as IntersectionObserver | null,
  primaryAccount: undefined as PrimaryAccount | undefined,
  analyticsDomTimer: null as number | null,
  toxicityTextCache: new Map<string, ToxicityAnalysis>(),
  toxicityInflight: 0,
  MAX_TOXICITY_INFLIGHT: 2,
  slopMediaCache: new Map<string, SlopAnalysis>(),
  slopFetchPending: new Set<string>(),
  slopInflight: 0,
  MAX_SLOP_INFLIGHT: 4,
  lazySlopWired: new WeakSet<HTMLElement>(),
  attachDebounceTimers: new WeakMap<HTMLElement, number>(),
  tweetWire: new WeakMap<HTMLElement, { handle: string; slopKey: string; gen: number }>(),
  markedHandlesLoaded: new Set<string>(),
  profileRescanTimer: null as number | null,
  lastProfileRescanAt: 0,
  lastProfileVisibleTweets: 0,
  cachedSettings: null as ExtensionSettings | null,
  scoreCache: new Map<string, ReputationResult>(),
  scanRaf: null as number | null,
};

export function getPrimaryAccount(): PrimaryAccount | undefined {
  return cs.primaryAccount;
}

export function setPrimaryAccount(v: PrimaryAccount | undefined): void {
  cs.primaryAccount = v;
}
