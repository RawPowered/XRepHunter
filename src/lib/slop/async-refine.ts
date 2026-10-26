import { buildSlopTextForModel } from '../detectors/ai-slop';
import { isExtensionContextAlive, isExtensionContextInvalidated } from '../messaging';
import type { AccountProfile, ExtensionSettings, ReputationResult } from '../types';
import type { TweetMediaInfo } from './extract-tweet-content';
import { classifySlopMedia } from './classify';
import { applySlopToResult } from './refine-reputation';
import { mergeAuthorManualAiSlop } from './manual-ai-merge';
import { initSlopModel } from './model-bridge';
import { initSlopOnnxModel } from './onnx-bridge';
import { initSlopImageModel } from './image-bridge';

function profileMediaFromPosts(profile: AccountProfile): TweetMediaInfo {
  const posts = profile.postsSample ?? [];
  const withImg = posts.find((p) => p.imageUrl);
  const anyMedia = posts.some((p) => p.hasMedia);
  return {
    hasPhoto: anyMedia,
    hasCard: false,
    hasVideo: false,
    imageUrl: withImg?.imageUrl,
    altTexts: [],
  };
}

export async function refineReputationWithSlopModels(
  result: ReputationResult,
  profile: AccountProfile,
  settings: ExtensionSettings,
): Promise<ReputationResult | null> {
  const text = buildSlopTextForModel(profile);
  if (text.length < 12) return null;

  let slop = await classifySlopMedia(text, profileMediaFromPosts(profile), settings);
  slop = await mergeAuthorManualAiSlop(slop, profile.handle);
  if (slop.combined < 1 && !slop.signals?.length) return null;

  return applySlopToResult(result, slop, profile, settings, {
    postSampleCount: profile.postsSample?.length ?? 0,
  });
}

export async function maybePrefetchSlopModels(settings: ExtensionSettings): Promise<void> {
  if (!isExtensionContextAlive()) return;
  try {
    if (settings.aiSlopModelAutoLoad && settings.aiSlopModelEnabled) {
      await initSlopModel();
    }
    if (settings.slopOnnxAutoLoad && settings.slopOnnxEnabled !== false) {
      await initSlopOnnxModel();
    }
    if (settings.slopImageModelAutoLoad && settings.slopImageModelEnabled !== false) {
      await initSlopImageModel();
    }
  } catch (err) {
    if (isExtensionContextInvalidated(err)) return;
    throw err;
  }
}
