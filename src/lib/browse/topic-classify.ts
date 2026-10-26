import type { CustomBrowseInterest } from '../types';
import type { TweetMediaInfo } from '../slop/extract-tweet-content';
import {
  BROWSE_TOPIC_IDS,
  OPINION_KEYWORDS,
  TOPIC_LABEL_THRESHOLD,
  TOPIC_TAXONOMY,
  type BrowseTopicId,
} from './topic-taxonomy';

export interface TopicClassifyInput {
  text: string;
  hashtags: string[];
  authorHandle: string;
  cardTitle?: string;
  cardDescription?: string;
  cardDomain?: string;
  media: TweetMediaInfo;
}

export interface BrowseTopicResult {
  primary: BrowseTopicId | string;
  labels: string[];
  scores: Partial<Record<BrowseTopicId, number>>;
  source: 'heuristic' | 'heuristic+clip';
}

const TICKER_RE = /\$[A-Za-z]{1,5}\b/g;

export function extractHashtags(text: string): string[] {
  const tags: string[] = [];
  const re = /#([\w\u0080-\uFFFF]{2,50})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    tags.push(m[1].toLowerCase());
  }
  return tags;
}

export function extractCardDomain(article: Element): string | undefined {
  const link = article.querySelector(
    '[data-testid="card.wrapper"] a[href^="http"]',
  ) as HTMLAnchorElement | null;
  if (!link?.href) return undefined;
  try {
    return new URL(link.href).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
}

function norm(s: string): string {
  return s.toLowerCase();
}

function haystack(input: TopicClassifyInput): string {
  return norm(
    [input.text, input.cardTitle, input.cardDescription].filter(Boolean).join('\n'),
  );
}

function capScore(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function scoreTopic(
  topic: Exclude<BrowseTopicId, 'other' | 'opinion'>,
  input: TopicClassifyInput,
  allHashtags: string[],
): number {
  const tax = TOPIC_TAXONOMY[topic];
  let score = 0;
  const text = haystack(input);
  const handle = input.authorHandle.toLowerCase();

  for (const h of tax.hashtags) {
    if (allHashtags.includes(h.replace(/^#/, ''))) score += 0.35;
  }
  score = Math.min(score, 0.7);

  if (tax.handles.includes(handle)) score += 0.45;

  for (const kw of tax.keywords) {
    if (text.includes(kw)) score += 0.2;
  }

  if (input.cardDomain) {
    for (const d of tax.domains) {
      if (input.cardDomain === d || input.cardDomain.endsWith('.' + d)) score += 0.5;
    }
  }

  if (topic === 'finance' && TICKER_RE.test(input.text)) score += 0.35;

  if (topic === 'news' && input.media.hasCard && !input.media.hasVideo) score += 0.15;
  if (topic === 'sports' && input.media.hasVideo && text.match(/\b(final|score|win|loss)\b/)) {
    score += 0.2;
  }
  if (topic === 'memes' && input.media.hasPhoto && !input.media.hasCard) score += 0.15;

  return capScore(score);
}

function scoreOpinion(input: TopicClassifyInput, newsScore: number): number {
  if (newsScore >= 0.4) return 0;
  const text = haystack(input);
  for (const kw of OPINION_KEYWORDS) {
    if (text.includes(kw)) return 0.45;
  }
  return 0;
}

function scoreCustom(
  input: TopicClassifyInput,
  allHashtags: string[],
  custom: CustomBrowseInterest[],
): { id: string; label: string; score: number }[] {
  const text = haystack(input);
  const handle = input.authorHandle.toLowerCase();
  return custom.map((c) => {
    let score = 0;
    for (const kw of c.keywords ?? []) {
      if (text.includes(kw.toLowerCase())) score += 0.35;
    }
    for (const h of c.hashtags ?? []) {
      if (allHashtags.includes(h.replace(/^#/, '').toLowerCase())) score += 0.4;
    }
    for (const a of c.handles ?? []) {
      if (handle === a.replace(/^@/, '').toLowerCase()) score += 0.45;
    }
    return { id: c.id, label: c.label, score: capScore(score) };
  });
}

function applyOverlapRules(
  scores: Partial<Record<BrowseTopicId, number>>,
): Partial<Record<BrowseTopicId, number>> {
  const s = { ...scores };
  const news = s.news ?? 0;
  const politics = s.politics ?? 0;
  const memes = s.memes ?? 0;

  if (news >= 0.35 && politics >= 0.35) {
    const breaking = news >= politics;
    if (breaking && politics < news + 0.1) s.news = (s.news ?? 0) + 0.15;
  }

  if (memes >= 0.4 && news < 0.5) {
    s.news = Math.max(0, (s.news ?? 0) - 0.2);
  }

  const anime = s.anime ?? 0;
  const ent = s.entertainment ?? 0;
  if (anime >= 0.35 && ent >= 0.35 && anime > ent) {
    s.entertainment = Math.max(0, ent - 0.1);
  }

  const gaming = s.gaming ?? 0;
  const sports = s.sports ?? 0;
  if (gaming >= 0.35 && sports >= 0.35) {
    const textEsports = (s.gaming ?? 0) >= (s.sports ?? 0);
    if (textEsports) s.sports = Math.max(0, sports - 0.15);
  }

  return s;
}

export function classifyBrowseTopics(
  input: TopicClassifyInput,
  customInterests: CustomBrowseInterest[] = [],
): BrowseTopicResult {
  const allHashtags = [...new Set([...input.hashtags, ...extractHashtags(input.text)])];
  const scores: Partial<Record<BrowseTopicId, number>> = {};

  for (const id of BROWSE_TOPIC_IDS) {
    if (id === 'other' || id === 'opinion') continue;
    scores[id] = scoreTopic(id, input, allHashtags);
  }

  scores.opinion = scoreOpinion(input, scores.news ?? 0);
  const adjusted = applyOverlapRules(scores);

  const labels = (Object.entries(adjusted) as [BrowseTopicId, number][])
    .filter(([, v]) => v >= TOPIC_LABEL_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  let primary: BrowseTopicId = labels[0] ?? 'other';
  if (primary === 'other' || !labels.length) {
    const best = (Object.entries(adjusted) as [BrowseTopicId, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0];
    if (best && best[1] >= 0.2) primary = best[0];
  }

  const customHits = scoreCustom(input, allHashtags, customInterests).filter(
    (c) => c.score >= TOPIC_LABEL_THRESHOLD,
  );
  const allLabels = [...labels];
  for (const c of customHits) allLabels.push(`custom:${c.id}`);
  const primaryOut =
    customHits.length && (adjusted[primary] ?? 0) < customHits[0].score
      ? `custom:${customHits[0].id}`
      : primary;

  return {
    primary: allLabels.length ? primaryOut : 'other',
    labels: allLabels.length ? allLabels : ['other'],
    scores: adjusted,
    source: 'heuristic',
  };
}

export function mergeClipTopicScores(
  heuristic: BrowseTopicResult,
  clipTopic: BrowseTopicId,
  clipScore: number,
): BrowseTopicResult {
  const merged = { ...heuristic.scores };
  const clipVal = clipScore * 0.85;
  merged[clipTopic] = Math.max(merged[clipTopic] ?? 0, clipVal);
  const adjusted = applyOverlapRules(merged);
  const labels = (Object.entries(adjusted) as [BrowseTopicId, number][])
    .filter(([, v]) => v >= TOPIC_LABEL_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const primary = labels[0] ?? String(heuristic.primary);
  return {
    primary,
    labels: labels.length ? labels.map(String) : heuristic.labels,
    scores: adjusted,
    source: 'heuristic+clip',
  };
}

export function topHeuristicConfidence(result: BrowseTopicResult): number {
  return Math.max(0, ...Object.values(result.scores));
}
