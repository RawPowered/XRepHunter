import type { DetectorHit, ToxicityAnalysis } from '../types';
import { enrichHitWithXRules } from '../x-algorithm/rules';

export function detectContentToxicity(toxicity: ToxicityAnalysis): DetectorHit | null {
  if (toxicity.combined < 40) return null;
  const top = toxicity.topLabels?.[0];
  const detail = top
    ? `${top.label} ${Math.round(top.score * 100)}% · combined ${toxicity.combined}`
    : `Toxicity score ${toxicity.combined}${toxicity.source ? ` (${toxicity.source})` : ''}`;
  return enrichHitWithXRules({
    id: 'contentToxicity',
    label: 'Hate / toxic content (ML)',
    risk: Math.min(0.95, toxicity.combined / 100),
    detail,
  });
}
