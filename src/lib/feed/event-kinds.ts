export const FEED_EVENT_KINDS = [
  'post_exposure',
  'attention_flush',
  'like',
  'repost',
  'reply',
  'quote',
  'negative_action',
] as const;

export type FeedEventKind = (typeof FEED_EVENT_KINDS)[number];

export type AttributionSource = 'statusId' | 'article' | 'lastFocused';

export interface FeedEventInput {
  eventAt?: number;
  eventKind: FeedEventKind;
  postFingerprint?: string;
  handle?: string;
  statusId?: string;
  payload?: Record<string, unknown>;
}
