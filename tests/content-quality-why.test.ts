import { describe, expect, it } from 'vitest';
import { renderContentQualityWhyHtml } from '../src/components/content-quality-why';
import { applyCorrectionsToProfile } from '../src/lib/detectors/content-quality';
import type { ContentQualityProfile } from '../src/lib/types';

const sampleProfile: ContentQualityProfile = {
  spamLikelihood: 80,
  promotionalLikelihood: 5,
  affiliateOrSponsorLikelihood: 0,
  aiTextLikelihood: 20,
  aiImageLikelihood: 0,
  slopLikelihood: 15,
  promotionalSlopLikelihood: 8,
  copypastaLikelihood: 0,
  organicLikelihood: 40,
  automationLikelihood: 5,
  confidence: 0.72,
  topEvidence: [],
  topCounterEvidence: [],
  detectorVersion: '2026.05.26',
  explanations: {},
};

describe('content quality why UI', () => {
  it('renders Why this score heading and low-confidence warning', () => {
    const html = renderContentQualityWhyHtml({ ...sampleProfile, confidence: 0.2 });
    expect(html).toContain('Why this score?');
    expect(html).toContain('Low confidence');
  });

  it('applyCorrectionsToProfile adds user feedback counter-evidence', () => {
    const corrected = applyCorrectionsToProfile(sampleProfile, ['not_spam']);
    expect(corrected.topCounterEvidence.some((e) => e.id === 'user_not_spam')).toBe(true);
  });
});
