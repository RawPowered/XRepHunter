import type { BrowseTopicId } from './topic-taxonomy';
import { classifyBrowseTopicImage } from './topic-image-bridge';

export async function classifyBrowseTopicImageRemote(
  imageUrl: string,
): Promise<{ topic: BrowseTopicId; score: number } | null> {
  const res = await classifyBrowseTopicImage(imageUrl);
  if (!res.success || !res.result) return null;
  return { topic: res.result.topic, score: res.result.score };
}
