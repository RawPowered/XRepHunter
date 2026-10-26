export interface OnnxLabelScore {
  label: string;
  score: number;
}

/** Map roberta openai-detector labels to 0–100 slop (higher = more AI-like). */
export function labelsToSlopOnnxScore(items: OnnxLabelScore[]): {
  score: number;
  label: string;
} {
  let fakeProb = 0;
  let topLabel = 'unknown';
  let topProb = 0;
  for (const item of items) {
    const key = item.label.toLowerCase();
    if (item.score > topProb) {
      topProb = item.score;
      topLabel = item.label;
    }
    if (key.includes('fake') || key.includes('generated') || key === 'label_0') {
      fakeProb = Math.max(fakeProb, item.score);
    }
    if (key.includes('real') || key.includes('human') || key === 'label_1') {
      fakeProb = Math.max(fakeProb, 1 - item.score);
    }
  }
  if (fakeProb === 0 && topProb > 0) {
    fakeProb = topLabel.toLowerCase().includes('fake') ? topProb : 1 - topProb;
  }
  return { score: Math.round(fakeProb * 100), label: topLabel };
}
