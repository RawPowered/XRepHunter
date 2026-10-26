import type { SlopAnalysis } from '../types';
import type { SlopModelStatus } from './model-bridge';

export async function getSlopModelStatus(): Promise<SlopModelStatus> {
  return browser.runtime.sendMessage({ type: 'GET_SLOP_MODEL_STATUS' });
}

export async function initSlopModel(): Promise<SlopModelStatus> {
  return browser.runtime.sendMessage({ type: 'INIT_SLOP_MODEL' });
}

export async function classifySlopText(
  text: string,
): Promise<{ success: boolean; result?: { label: string }; error?: string }> {
  return browser.runtime.sendMessage({ type: 'CLASSIFY_SLOP_TEXT', text });
}

export async function classifySlopMediaRemote(
  text: string,
  imageUrl?: string,
): Promise<SlopAnalysis> {
  return browser.runtime.sendMessage({
    type: 'CLASSIFY_SLOP_MEDIA',
    text,
    imageUrl,
  });
}
