import { ensureOffscreenDocument, markOffscreenClosed } from '../offscreen/lifecycle';
import type { BrowseTopicId } from './topic-taxonomy';

async function sendToOffscreen<T>(message: Record<string, unknown>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      await ensureOffscreenDocument('Run ONNX slop and image classifiers');
      return (await chrome.runtime.sendMessage(message)) as T;
    } catch (err) {
      markOffscreenClosed();
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error('Offscreen unreachable');
}

export async function classifyBrowseTopicImage(imageUrl: string): Promise<{
  success: boolean;
  result?: { topic: BrowseTopicId; score: number; label: string };
  error?: string;
}> {
  try {
    const status = await sendToOffscreen<{ isLoaded?: boolean }>({ type: 'CHECK_SLOP_IMAGE_STATUS' });
    if (!status?.isLoaded) {
      await sendToOffscreen({ type: 'LOAD_SLOP_IMAGE_MODEL' });
    }
    return await sendToOffscreen({
      type: 'CLASSIFY_BROWSE_TOPIC_IMAGE',
      imageUrl,
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
