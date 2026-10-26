import type { AccountProfile, DetectorHit, DetectorId, ExtensionSettings, SlopAnalysis, SpamExample } from '../types';
import { matchUserExamples } from '../examples/matcher';
import { enrichHitWithXRules } from '../x-algorithm/rules';
import { runXAlgorithmDetectors } from '../x-algorithm/detectors';
import { formatSlopDetail, shouldFlagSlop, slopToRisk } from './ai-slop';

const CRYPTO_RE =
  /\b(web3|crypto|bitcoin|btc|eth|airdrop|nft|defi|pump\.fun|wallet|token|memecoin|\$[A-Z]{2,8})\b/i;
const ROMANCE_RE =
  /\b(my love|miss you|lonely|single|dm me|text me|onlyfans|spoil me|sugar|babe|darling)\b/i;
const AD_RE =
  /\b(buy now|discount|limited time|shop now|promo code|affiliate|sponsored|link in bio)\b/i;
function hit(id: DetectorId, label: string, risk: number, detail?: string): DetectorHit {
  return enrichHitWithXRules({ id, label, risk, detail });
}

export function detectHandlePattern(profile: AccountProfile): DetectorHit | null {
  const h = profile.handle;
  const digits = h.match(/\d+$/);
  if (digits && digits[0].length >= 6) {
    return hit('handlePattern', 'Numeric-heavy handle', 0.85, `Suffix: ${digits[0].length} digits`);
  }
  if (/^[a-z]+\d{8,}$/i.test(h)) {
    return hit('handlePattern', 'Name + long number handle', 0.9);
  }
  if (profile.displayName && !profile.displayName.toLowerCase().includes(h.replace(/\d+/g, '').slice(0, 4))) {
    const namePart = h.replace(/\d+/g, '');
    if (namePart.length >= 3 && profile.displayName.length > 2) {
      const dn = profile.displayName.toLowerCase();
      if (!dn.includes(namePart.slice(0, 4).toLowerCase()) && /\d{5,}/.test(h)) {
        return hit('handlePattern', 'Display name vs handle mismatch', 0.7);
      }
    }
  }
  return null;
}

export function detectAccountAge(profile: AccountProfile): DetectorHit | null {
  if (!profile.joinedAt) return null;
  const ageDays = (Date.now() - profile.joinedAt) / (1000 * 60 * 60 * 24);
  if (ageDays < 90) return hit('accountAge', 'Very new account (<90 days)', 0.75, `${Math.round(ageDays)}d`);
  if (ageDays < 180) return hit('accountAge', 'Recent account (<6 months)', 0.45);
  return null;
}

export function detectUsernameHistory(profile: AccountProfile): DetectorHit | null {
  if (profile.usernameChanges != null && profile.usernameChanges >= 1) {
    const ageDays = profile.joinedAt ? (Date.now() - profile.joinedAt) / 86400000 : 999;
    if (ageDays < 365) {
      return hit(
        'usernameHistory',
        'Username changed soon after join',
        0.55,
        `${profile.usernameChanges} change(s)`,
      );
    }
  }
  return null;
}

function textBlob(profile: AccountProfile): string {
  const posts = (profile.postsSample ?? []).map((p) => p.text).join('\n');
  return `${profile.bio ?? ''}\n${posts}`.toLowerCase();
}

export function detectCryptoSpam(profile: AccountProfile): DetectorHit | null {
  const t = textBlob(profile);
  const matches = t.match(new RegExp(CRYPTO_RE.source, 'gi'));
  if (matches && matches.length >= 2) {
    return hit('cryptoSpam', 'Crypto/Web3 spam patterns', 0.8, `${matches.length} hits`);
  }
  if (matches?.length === 1 && (profile.postsSample?.filter((p) => p.isRepost).length ?? 0) >= 3) {
    return hit('cryptoSpam', 'Crypto repost behavior', 0.65);
  }
  return null;
}

export function detectRepostBot(profile: AccountProfile): DetectorHit | null {
  const posts = profile.postsSample ?? [];
  if (posts.length < 5) return null;
  const reposts = posts.filter((p) => p.isRepost || p.isQuote).length;
  const ratio = reposts / posts.length;
  if (ratio >= 0.85) return hit('repostBot', 'Mostly reposts/quotes', 0.85, `${Math.round(ratio * 100)}%`);
  if (ratio >= 0.65) return hit('repostBot', 'High repost ratio', 0.55, `${Math.round(ratio * 100)}%`);
  return null;
}

export function detectRomanceBait(profile: AccountProfile): DetectorHit | null {
  if (ROMANCE_RE.test(textBlob(profile))) {
    return hit('romanceBait', 'Romance / emotional bait language', 0.7);
  }
  return null;
}

export function detectThirstTrap(profile: AccountProfile): DetectorHit | null {
  const posts = profile.postsSample ?? [];
  if (posts.length < 3) return null;
  const media = posts.filter((p) => p.hasMedia).length;
  const ratio = media / posts.length;
  const shortText = posts.filter((p) => p.text.length < 40 && p.hasMedia).length;
  if (ratio >= 0.6 && shortText >= 2) {
    return hit('thirstTrap', 'Media-heavy vague posts', 0.6);
  }
  return null;
}

export function detectAdSpam(profile: AccountProfile): DetectorHit | null {
  if (AD_RE.test(textBlob(profile))) {
    return hit('adSpam', 'Advertising / product pitch patterns', 0.65);
  }
  return null;
}

export function detectAiSlop(profile: AccountProfile, slop: SlopAnalysis): DetectorHit | null {
  if (!shouldFlagSlop(slop)) return null;
  return hit(
    'aiSlop',
    'AI slop patterns',
    slopToRisk(slop.combined),
    formatSlopDetail(slop),
  );
}

export function runAllDetectors(
  profile: AccountProfile,
  settings: ExtensionSettings,
  examples: SpamExample[],
  slop?: SlopAnalysis,
): DetectorHit[] {
  const fns: Array<() => DetectorHit | null> = [
    () => detectHandlePattern(profile),
    () => detectAccountAge(profile),
    () => detectUsernameHistory(profile),
    () => detectCryptoSpam(profile),
    () => detectRepostBot(profile),
    () => detectRomanceBait(profile),
    () => detectThirstTrap(profile),
    () => detectAdSpam(profile),
    () => (slop ? detectAiSlop(profile, slop) : null),
    () => matchUserExamples(profile, examples),
  ];

  const hits: DetectorHit[] = [];
  const ids: DetectorId[] = [
    'handlePattern',
    'accountAge',
    'usernameHistory',
    'cryptoSpam',
    'repostBot',
    'romanceBait',
    'thirstTrap',
    'adSpam',
    'aiSlop',
    'userExamples',
  ];

  fns.forEach((fn, i) => {
    const id = ids[i];
    if (!settings.detectors[id]?.enabled) return;
    const h = fn();
    if (h) hits.push(h);
  });

  if (settings.xAlgorithmAlignment !== false) {
    const xIds: DetectorId[] = [
      'xVisibility',
      'xRepostDedup',
      'xAuthorMonoculture',
      'xNegativeEngagement',
      'xOrganicTrust',
      'xStaleBurst',
    ];
    for (const h of runXAlgorithmDetectors(profile)) {
      if (settings.detectors[h.id]?.enabled !== false) hits.push(h);
    }
    // Re-enrich legacy hits with X rule mapping when alignment is on
    for (let i = 0; i < hits.length; i++) {
      if (!xIds.includes(hits[i].id)) {
        hits[i] = enrichHitWithXRules(hits[i]);
      }
    }
  }

  return hits;
}
