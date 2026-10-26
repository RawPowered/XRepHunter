import type { TweetMediaInfo } from '../slop/extract-tweet-content';
import {
  buildDetectorResult,
  buildEvidenceHit,
  clampConfidence,
  type DetectorResult,
} from './evidence';

export interface MediaEvidenceInput {
  text: string;
  media: TweetMediaInfo;
  imageScore?: number;
  imageLabel?: string;
  hasManualAiMark?: boolean;
  repeatedImageFingerprint?: boolean;
  cardTitle?: string;
  altText?: string;
}

const PAYOUT_RE =
  /\b(withdrawal|earnings|payout|profit|made \$|total earned|payment proof)\b/i;
const STOCK_PROMO_RE = /\b(limited offer|shop now|exclusive deal|flash sale)\b/i;

export function buildMediaEvidence(input: MediaEvidenceInput): DetectorResult {
  const evidence = [];
  const counterEvidence = [];
  const text = input.text.trim();
  const hasText = text.length >= 12;
  const imageOnly = !hasText && (input.media.hasPhoto || input.media.hasCard);

  if (input.hasManualAiMark) {
    evidence.push(
      buildEvidenceHit({
        id: 'user_marked_ai',
        label: 'Image manually marked as likely AI',
        weight: 40,
        category: 'ai_image',
        source: 'user_feedback',
        matchedSignal: 'user_marked_ai',
      }),
    );
  }

  if (input.imageScore != null && input.imageScore >= 35) {
    evidence.push(
      buildEvidenceHit({
        id: 'clip_image_score',
        label: 'Image model suggests AI/promo graphic',
        weight: Math.min(35, Math.round(input.imageScore * 0.4)),
        category: 'ai_image',
        source: 'media',
        matchedSignal: 'image_ml',
        detail: input.imageLabel ?? `score ${input.imageScore}`,
      }),
    );
  }

  if (input.repeatedImageFingerprint) {
    evidence.push(
      buildEvidenceHit({
        id: 'repeated_image_fingerprint',
        label: 'Image fingerprint seen before',
        weight: 28,
        category: 'copypasta',
        source: 'repetition',
      }),
    );
  }

  const promoText = STOCK_PROMO_RE.test(text) || /\b(buy now|discount)\b/i.test(text);
  if (promoText && (input.media.hasCard || input.media.hasPhoto) && !input.cardTitle) {
    evidence.push(
      buildEvidenceHit({
        id: 'text_media_mismatch',
        label: 'Promo text with generic media card',
        weight: 22,
        category: 'ai_image',
        source: 'media',
      }),
    );
  }

  const altOrCard = `${input.altText ?? ''} ${input.cardTitle ?? ''} ${input.media.cardTitle ?? ''}`;
  if (PAYOUT_RE.test(altOrCard) || PAYOUT_RE.test(text)) {
    evidence.push(
      buildEvidenceHit({
        id: 'payout_screenshot',
        label: 'Possible payout/earnings screenshot context',
        weight: 25,
        category: 'promo',
        source: 'media',
        matchedSignal: 'payout_screenshot',
      }),
    );
  }

  if (imageOnly && evidence.length === 1 && evidence[0].id === 'clip_image_score') {
    counterEvidence.push(
      buildEvidenceHit({
        id: 'image_only_no_text',
        label: 'Image-only post — text conclusions limited',
        weight: 20,
        category: 'organic',
        source: 'context',
      }),
    );
  }

  let confidence = 0.55;
  if (imageOnly) confidence = Math.min(confidence, 0.65);
  if (input.hasManualAiMark) confidence = 0.85;
  if (input.imageScore != null && promoText) confidence = Math.min(0.9, confidence + 0.15);
  confidence = clampConfidence(confidence * (hasText ? 1 : 0.75));

  const result = buildDetectorResult(
    evidence.length ? 'Media may indicate AI/promo' : 'Media neutral',
    evidence,
    counterEvidence,
    Math.max(text.length, 20),
    confidence,
  );
  result.confidence = confidence;
  return result;
}

export function aiImageLikelihoodFromMedia(result: DetectorResult): number {
  return result.score;
}
