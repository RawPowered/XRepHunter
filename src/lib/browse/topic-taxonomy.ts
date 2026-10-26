/** Built-in X browse topic reference (keywords, hashtags, handles, domains). */

export type BrowseTopicId =
  | 'news'
  | 'politics'
  | 'opinion'
  | 'sports'
  | 'entertainment'
  | 'anime'
  | 'tech'
  | 'finance'
  | 'gaming'
  | 'pokemon'
  | 'memes'
  | 'lifestyle'
  | 'other';

export const BROWSE_TOPIC_IDS: BrowseTopicId[] = [
  'news',
  'politics',
  'opinion',
  'sports',
  'entertainment',
  'anime',
  'tech',
  'finance',
  'gaming',
  'pokemon',
  'memes',
  'lifestyle',
  'other',
];

export const TOPIC_LABEL_THRESHOLD = 0.35;
export const TOPIC_CLIP_CONFIDENCE_THRESHOLD = 0.45;

export interface TopicTaxonomyEntry {
  keywords: string[];
  hashtags: string[];
  handles: string[];
  domains: string[];
}

export const TOPIC_TAXONOMY: Record<Exclude<BrowseTopicId, 'other' | 'opinion'>, TopicTaxonomyEntry> = {
  news: {
    keywords: [
      'breaking',
      'live updates',
      'eyewitness',
      'developing',
      'sources say',
      'exclusive',
      'alert',
      'footage',
      'confirmed',
      'reported',
      'according to',
    ],
    hashtags: ['breakingnews', 'news', 'worldnews'],
    handles: ['cnn', 'bbcnews', 'nytimes', 'reuters', 'ap', 'npr', 'wsj', 'bbc', 'foxnews'],
    domains: [
      'cnn.com',
      'bbc.com',
      'bbc.co.uk',
      'nytimes.com',
      'reuters.com',
      'apnews.com',
      'npr.org',
      'wsj.com',
      'theguardian.com',
      'washingtonpost.com',
    ],
  },
  politics: {
    keywords: [
      'election',
      'congress',
      'parliament',
      'senate',
      'ballot',
      'vote',
      'bill',
      'policy',
      'debate',
      'scandal',
      'administration',
      'democrat',
      'republican',
      'maga',
      'gop',
      'brexit',
      'white house',
    ],
    hashtags: ['politics', 'election2026', 'election2024', 'maga', 'democrats', 'gop', 'brexit'],
    handles: ['potus', 'whitehouse', 'gop', 'thedemocrats', 'speakerpelosi'],
    domains: [],
  },
  sports: {
    keywords: [
      'final score',
      'game thread',
      'matchup',
      'highlights',
      'overtime',
      'touchdown',
      'home run',
      'premier league',
      'playoffs',
      'championship',
      'mvp',
    ],
    hashtags: [
      'nfl',
      'nba',
      'mlb',
      'nhl',
      'soccer',
      'ufc',
      'f1',
      'worldcup',
      'sports',
    ],
    handles: ['espn', 'bleacherreport', 'nba', 'nfl', 'wojespn', 'jeffpassan', 'skysports'],
    domains: ['espn.com'],
  },
  entertainment: {
    keywords: [
      'trailer',
      'premiere',
      'red carpet',
      'box office',
      'album drop',
      'world tour',
      'season finale',
      'cast',
      'celebrity',
      'grammy',
      'oscar',
    ],
    hashtags: ['entertainment', 'movies', 'music', 'oscars', 'kpop', 'bts', 'hollywood'],
    handles: ['variety', 'thr', 'billboard', 'entertainmentweekly', 'people'],
    domains: [],
  },
  anime: {
    keywords: [
      'anime',
      'manga',
      'waifu',
      'husbando',
      'crunchyroll',
      'studio ghibli',
      'mappa',
      'one piece',
      'jujutsu kaisen',
      'subbed',
      'dubbed',
      'otaku',
      'cartoon',
      'disney',
    ],
    hashtags: ['anime', 'manga', 'otaku', 'onepiece', 'jujutsukaisen'],
    handles: ['crunchyroll', 'anime'],
    domains: [],
  },
  tech: {
    keywords: [
      'artificial intelligence',
      'machine learning',
      'startup',
      'breakthrough',
      'gadget',
      'firmware',
      'open source',
      'research paper',
      'spacex launch',
    ],
    hashtags: ['tech', 'ai', 'machinelearning', 'web3', 'spacex', 'tesla'],
    handles: ['techcrunch', 'theverge', 'wired', 'karpathy', 'elonmusk'],
    domains: ['techcrunch.com', 'theverge.com', 'wired.com'],
  },
  finance: {
    keywords: [
      'stock market',
      'earnings',
      'bull market',
      'bear market',
      'bitcoin',
      'crypto',
      'investment',
      'fed rate',
      'ipo',
      'startup funding',
    ],
    hashtags: ['finance', 'investing', 'bitcoin', 'stocks', 'fintech', 'crypto'],
    handles: ['cnbc', 'bloomberg', 'wsj', 'morganhousel'],
    domains: ['bloomberg.com', 'cnbc.com', 'marketwatch.com'],
  },
  gaming: {
    keywords: [
      'gameplay',
      'patch notes',
      'esports',
      'fortnite',
      'valorant',
      'twitch stream',
      'playstation',
      'xbox',
      'nintendo',
      'speedrun',
    ],
    hashtags: ['gaming', 'esports', 'twitch', 'fortnite', 'valorant'],
    handles: ['xbox', 'playstation', 'nintendo', 'kotaku', 'ign'],
    domains: [],
  },
  pokemon: {
    keywords: [
      'pokemon',
      'pikachu',
      'charizard',
      'tcg',
      'pokémon',
      'shiny pokemon',
      'pokemon go',
    ],
    hashtags: ['pokemon', 'pokemontcg', 'pokemongo'],
    handles: ['pokemon'],
    domains: [],
  },
  memes: {
    keywords: ['meme', 'lol', 'roast', 'relatable', 'viral', 'funny', 'shitpost'],
    hashtags: ['memes', 'funny', 'viral', 'meme'],
    handles: [],
    domains: [],
  },
  lifestyle: {
    keywords: [
      'workout',
      'recipe',
      'meal prep',
      'wanderlust',
      'ootd',
      'outfit',
      'restaurant',
      'travel guide',
    ],
    hashtags: ['fitness', 'gym', 'food', 'recipe', 'foodporn', 'travel', 'wanderlust', 'fashion', 'ootd'],
    handles: [],
    domains: [],
  },
};

export const OPINION_KEYWORDS = [
  'unpopular opinion',
  'hot take',
  'i think',
  'imo',
  'in my opinion',
  'thread rant',
  'hear me out',
];

export const CLIP_LABEL_TO_TOPIC: Record<string, BrowseTopicId> = {
  'breaking news or newspaper headline': 'news',
  'political rally or government press event': 'politics',
  'sports action photo or stadium': 'sports',
  'celebrity or entertainment red carpet': 'entertainment',
  'anime or manga illustration': 'anime',
  'video game screenshot or esports': 'gaming',
  'pokemon or trading card': 'pokemon',
  'tech product or infographic': 'tech',
  'stock chart or financial graph': 'finance',
  'internet meme or funny image': 'memes',
  'casual lifestyle photo food fitness travel': 'lifestyle',
};

export const TOPIC_CLIP_LABELS = Object.keys(CLIP_LABEL_TO_TOPIC);

export const TOPIC_DISPLAY_LABELS: Record<BrowseTopicId, string> = {
  news: 'News',
  politics: 'Politics',
  opinion: 'Opinion',
  sports: 'Sports',
  entertainment: 'Entertainment',
  anime: 'Anime',
  tech: 'Tech',
  finance: 'Finance',
  gaming: 'Gaming',
  pokemon: 'Pokémon',
  memes: 'Memes',
  lifestyle: 'Lifestyle',
  other: 'Other',
};

export const TOPIC_GROUPS: { title: string; topics: BrowseTopicId[] }[] = [
  { title: 'News & civics', topics: ['news', 'politics', 'opinion'] },
  { title: 'Culture', topics: ['entertainment', 'anime', 'memes'] },
  { title: 'Markets & tech', topics: ['finance', 'tech'] },
  { title: 'Play', topics: ['sports', 'gaming', 'pokemon'] },
  { title: 'Life', topics: ['lifestyle'] },
];
