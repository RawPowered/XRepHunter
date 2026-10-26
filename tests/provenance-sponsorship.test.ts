import { describe, expect, it } from 'vitest';
import { detectSponsorshipEvidence } from '../src/lib/provenance/sponsorship';

describe('provenance sponsorship', () => {
  it('detects disclosure hashtags', () => {
    const { score, evidence } = detectSponsorshipEvidence('Loving this product #ad thanks!', false);
    expect(score).toBeGreaterThan(0);
    expect(evidence.some((e) => e.id === 'disclosure_ad_hashtag')).toBe(true);
  });

  it('includes dom promoted evidence', () => {
    const { evidence } = detectSponsorshipEvidence('hello', true);
    expect(evidence.some((e) => e.id === 'dom_promoted')).toBe(true);
  });
});
