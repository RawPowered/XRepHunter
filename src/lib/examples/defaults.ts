import type { SpamExample } from '../types';

/** Seed examples from known bot patterns (user-provided accounts) */
export const DEFAULT_SPAM_EXAMPLES: SpamExample[] = [
  {
    id: 'seed-jeff',
    handle: 'jeff33112939573',
    displayName: 'Jennifer',
    keywords: ['crypto', 'web3', 'bitcoin', 'repost', 'follow', 'dm'],
    handlePattern: '^[a-zA-Z]+\\d{8,}$',
    categories: ['handlePattern', 'accountAge', 'cryptoSpam', 'repostBot'],
    postSnippets: [],
    repostRatio: 0.9,
    joinedText: 'April 2024',
    createdAt: Date.now(),
    note: 'Numeric handle + recent join + crypto reposts',
  },
  {
    id: 'seed-livyx',
    handle: 'livyxlovely',
    keywords: ['lovely', 'love', 'single', 'dm', 'onlyfans', 'link'],
    handlePattern: 'lovely$',
    categories: ['romanceBait', 'thirstTrap'],
    postSnippets: [],
    createdAt: Date.now(),
    note: 'Romance / thirst-trap pattern handle',
  },
  {
    id: 'seed-silaz',
    handle: 'silazbb',
    keywords: ['crypto', 'airdrop', 'nft', 'follow back', 'repost'],
    handlePattern: 'bb$',
    categories: ['cryptoSpam', 'handlePattern', 'repostBot'],
    postSnippets: [],
    createdAt: Date.now(),
    note: 'Short handle + crypto spam cluster',
  },
];
