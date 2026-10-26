import type { ToxicityAnalysis } from '../types';
import type { ToxicityModelStatus } from './model-bridge';

export async function getToxicityModelStatus(): Promise<ToxicityModelStatus> {
  return browser.runtime.sendMessage({ type: 'GET_TOXICITY_MODEL_STATUS' });
}

export async function initToxicityModel(): Promise<ToxicityModelStatus> {
  return browser.runtime.sendMessage({ type: 'INIT_TOXICITY_MODEL' });
}

export async function classifyToxicityRemote(text: string): Promise<ToxicityAnalysis | null> {
  return browser.runtime.sendMessage({ type: 'CLASSIFY_TOXICITY', text });
}
