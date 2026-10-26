export interface ImageLabelScore {
  label: string;
  score: number;
}

/** Higher score = more likely AI-generated / promotional graphic. */
export function labelsToSlopImageScore(items: ImageLabelScore[]): {
  score: number;
  label: string;
} {
  let aiProb = 0;
  let topLabel = 'unknown';
  let topProb = 0;
  for (const item of items) {
    const key = item.label.toLowerCase();
    if (item.score > topProb) {
      topProb = item.score;
      topLabel = item.label;
    }
    if (
      key.includes('fake') ||
      key.includes('ai') ||
      key.includes('generated') ||
      key.includes('synthetic') ||
      key === 'label_1'
    ) {
      aiProb = Math.max(aiProb, item.score);
    }
    if (key.includes('real') || key.includes('human') || key === 'label_0') {
      aiProb = Math.max(aiProb, 1 - item.score);
    }
  }
  if (aiProb === 0 && topProb > 0) {
    aiProb = /fake|ai|generated/i.test(topLabel) ? topProb : 1 - topProb;
  }
  return { score: Math.round(aiProb * 100), label: topLabel };
}
