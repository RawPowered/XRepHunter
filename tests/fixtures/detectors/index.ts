export interface DetectorFixtureCase {
  id: string;
  text: string;
  expect: {
    minSpam?: number;
    maxSpam?: number;
    minOrganic?: number;
    minSlop?: number;
    minAiText?: number;
    maxAiText?: number;
    minAffiliate?: number;
    minPromo?: number;
    maxConfidence?: number;
    minConfidence?: number;
    minCopypasta?: number;
  };
}

export const organicPersonal: DetectorFixtureCase[] = [
  {
    id: 'lived-detail',
    text: 'Took the kids to the park on Saturday — muddy shoes, worth it. My daughter finally learned to ride without training wheels.',
    expect: { minOrganic: 25, maxAiText: 40 },
  },
  {
    id: 'casual-reply',
    text: '@friend yeah the game was wild, we stayed up way too late but totally worth it lol',
    expect: { minOrganic: 20, maxAiText: 35 },
  },
];

export const newsNormal: DetectorFixtureCase[] = [
  {
    id: 'cited-news',
    text: 'According to the AP, the committee voted 12-3 on the measure. Full story via @newsdesk — no paywall on this one.',
    expect: { maxSpam: 35, maxAiText: 45 },
  },
];

export const jokesMemes: DetectorFixtureCase[] = [
  {
    id: 'meme-casual',
    text: 'lol why is the cat always on the keyboard during standup idk man',
    expect: { maxAiText: 40 },
  },
];

export const spamScam: DetectorFixtureCase[] = [
  {
    id: 'crypto-airdrop',
    text: 'Free $BTC airdrop — claim your NFT now at https://scam.example wallet connect web3 token',
    expect: { minSpam: 60, minConfidence: 0.5 },
  },
  {
    id: 'telegram-funnel',
    text: 'Join our Telegram for exclusive signals! DM me before the pump. $ETH $SOL $DOGE',
    expect: { minSpam: 50 },
  },
];

export const affiliatePromo: DetectorFixtureCase[] = [
  {
    id: 'use-code',
    text: 'Use code SAVE20 for 20% off — link in bio. Limited time discount shop now!',
    expect: { minAffiliate: 28, minPromo: 25 },
  },
];

export const sponsorshipDisclosed: DetectorFixtureCase[] = [
  {
    id: 'paid-partnership',
    text: 'Loving this keyboard for coding streams. #ad Paid partnership with KeyCo.',
    expect: { minAffiliate: 30, maxSpam: 40 },
  },
];

export const aiSlop: DetectorFixtureCase[] = [
  {
    id: 'stock-phrases',
    text: "It's worth noting that in today's fast-paced digital landscape, organizations must leverage holistic strategies. Furthermore, seamless integration remains a game-changer. In conclusion, this comprehensive approach underscores the paradigm shift we are navigating.",
    expect: { minSlop: 40, minAiText: 30 },
  },
  {
    id: 'rhetoric-stack',
    text: `No hype.
No fluff.
Just results.
Only what works.`,
    expect: { minSlop: 40 },
  },
];

export const humanLowQuality: DetectorFixtureCase[] = [
  {
    id: 'bad-but-human',
    text: 'this take is so bad lol like genuinely what were they thinking??? anyway im going to bed',
    expect: { maxAiText: 45 },
  },
];

export const shortAmbiguous: DetectorFixtureCase[] = [
  {
    id: 'nice',
    text: 'nice',
    expect: { maxConfidence: 0.4 },
  },
  {
    id: 'lol',
    text: 'lol',
    expect: { maxConfidence: 0.4 },
  },
];

export const copypastaFixtures: DetectorFixtureCase[] = [
  {
    id: 'long-boilerplate',
    text: 'The greatest glory in living lies not in never falling, but in rising every time we fall. Nelson Mandela taught us that resilience defines character more than success ever could.',
    expect: {},
  },
];

export const allDetectorFixtures: { name: string; cases: DetectorFixtureCase[] }[] = [
  { name: 'organic-personal', cases: organicPersonal },
  { name: 'news-normal', cases: newsNormal },
  { name: 'jokes-memes', cases: jokesMemes },
  { name: 'spam-scam', cases: spamScam },
  { name: 'affiliate-promo', cases: affiliatePromo },
  { name: 'sponsorship-disclosed', cases: sponsorshipDisclosed },
  { name: 'ai-slop', cases: aiSlop },
  { name: 'human-low-quality', cases: humanLowQuality },
  { name: 'short-ambiguous', cases: shortAmbiguous },
];
