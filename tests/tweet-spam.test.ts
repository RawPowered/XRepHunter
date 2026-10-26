import { describe, expect, it } from 'vitest';
import { detectTweetSpam, getSpamDimensions, scoreTweetSpamHeuristic } from '../src/lib/detectors/tweet-spam';

describe('scoreTweetSpamHeuristic', () => {
  it('scores low on normal reply', () => {
    const r = scoreTweetSpamHeuristic('Thanks for sharing this, really helpful perspective.');
    expect(r.score).toBeLessThan(30);
    expect(r.signals).toHaveLength(0);
  });

  it('scores high on crypto promo', () => {
    const r = scoreTweetSpamHeuristic(
      'Free $BTC airdrop — claim your NFT now at https://scam.example wallet connect web3',
    );
    expect(r.score).toBeGreaterThanOrEqual(45);
    expect(r.signals).toContain('crypto');
  });

  it('detects ad and promo patterns', () => {
    const r = scoreTweetSpamHeuristic('Buy now — limited time discount! Link in bio for promo code.');
    expect(r.score).toBeGreaterThanOrEqual(35);
    expect(r.signals).toContain('ad');
  });

  it('returns evidence from detectTweetSpam', () => {
    const r = detectTweetSpam({
      text: 'Join Telegram for free $ETH airdrop — DM me wallet connect',
    });
    expect(r.evidence.length).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThanOrEqual(40);
  });

  it('disclosed sponsorship lowers spam dimension', () => {
    const dims = getSpamDimensions(
      detectTweetSpam({ text: 'Great product review #ad Paid partnership with BrandCo' }),
    );
    expect(dims.affiliateOrSponsorLikelihood).toBeGreaterThanOrEqual(30);
    expect(dims.spamLikelihood).toBeLessThan(50);
  });
});
