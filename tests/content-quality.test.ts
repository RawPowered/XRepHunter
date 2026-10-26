import { describe, expect, it } from 'vitest';
import { analyzeContentQuality } from '../src/lib/detectors/content-quality';
import { allDetectorFixtures } from './fixtures/detectors';

describe('analyzeContentQuality fixtures', () => {
  for (const { name, cases } of allDetectorFixtures) {
    describe(name, () => {
      for (const c of cases) {
        it(c.id, () => {
          const q = analyzeContentQuality({ text: c.text, handle: 'fixtureuser' });
          const e = c.expect;
          if (e.minSpam != null) expect(q.spamLikelihood).toBeGreaterThanOrEqual(e.minSpam);
          if (e.minPromo != null) {
            expect(q.promotionalLikelihood).toBeGreaterThanOrEqual(e.minPromo);
          }
          if (e.maxSpam != null) expect(q.spamLikelihood).toBeLessThanOrEqual(e.maxSpam);
          if (e.minOrganic != null) expect(q.organicLikelihood).toBeGreaterThanOrEqual(e.minOrganic);
          if (e.minSlop != null) expect(q.slopLikelihood).toBeGreaterThanOrEqual(e.minSlop);
          if (e.minAiText != null) expect(q.aiTextLikelihood).toBeGreaterThanOrEqual(e.minAiText);
          if (e.maxAiText != null) expect(q.aiTextLikelihood).toBeLessThanOrEqual(e.maxAiText);
          if (e.minAffiliate != null) {
            expect(q.affiliateOrSponsorLikelihood).toBeGreaterThanOrEqual(e.minAffiliate);
          }
          if (e.maxConfidence != null) expect(q.confidence).toBeLessThanOrEqual(e.maxConfidence);
          if (e.minConfidence != null) expect(q.confidence).toBeGreaterThanOrEqual(e.minConfidence);
        });
      }
    });
  }
});

describe('counter-evidence reduces overconfidence', () => {
  it('personal experience lowers spam vs promo-only baseline', () => {
    const promo = analyzeContentQuality({
      text: 'Buy now limited time discount promo code link in bio',
      handle: 'u',
    });
    const personal = analyzeContentQuality({
      text: 'I tried this coffee shop on Monday — best latte I have had in years, no promo just sharing',
      handle: 'u',
    });
    expect(
      Math.max(personal.spamLikelihood, personal.promotionalLikelihood),
    ).toBeLessThan(Math.max(promo.spamLikelihood, promo.promotionalLikelihood, 20));
  });
});

describe('user corrections', () => {
  it('not_spam reduces spam likelihood', () => {
    const base = analyzeContentQuality({
      text: 'Free $BTC airdrop claim wallet web3 token',
      handle: 'u',
    });
    const corrected = analyzeContentQuality({
      text: 'Free $BTC airdrop claim wallet web3 token',
      handle: 'u',
      corrections: ['not_spam'],
    });
    expect(corrected.spamLikelihood).toBeLessThan(base.spamLikelihood);
  });
});
