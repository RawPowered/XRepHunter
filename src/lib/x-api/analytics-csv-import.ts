import type { AccountAnalyticsSnapshot, TweetAnalytics } from '../types';
import { normalizeHandle } from '../types';

export interface CsvImportOutcome {
  ok: boolean;
  snapshot?: AccountAnalyticsSnapshot;
  warnings: string[];
  error?: string;
}

type RowField =
  | 'tweetId'
  | 'textPreview'
  | 'impressions'
  | 'engagements'
  | 'likes'
  | 'reposts'
  | 'replies'
  | 'profileVisits'
  | 'mentions'
  | 'newFollowers'
  | 'linkClicks'
  | 'periodLabel'
  | 'createdAt'
  | 'handle';

const HEADER_ALIASES: Record<string, RowField> = {
  impressions: 'impressions',
  impression: 'impressions',
  impressioncount: 'impressions',
  views: 'impressions',
  viewcount: 'impressions',
  engagements: 'engagements',
  engagement: 'engagements',
  engagementcount: 'engagements',
  totalengagements: 'engagements',
  profilevisits: 'profileVisits',
  profilevisit: 'profileVisits',
  profilevisitcount: 'profileVisits',
  mentions: 'mentions',
  mention: 'mentions',
  mentioncount: 'mentions',
  newfollowers: 'newFollowers',
  followersgained: 'newFollowers',
  followerstotal: 'newFollowers',
  tweetid: 'tweetId',
  postid: 'tweetId',
  statusid: 'tweetId',
  id: 'tweetId',
  posttext: 'textPreview',
  tweettext: 'textPreview',
  text: 'textPreview',
  content: 'textPreview',
  likes: 'likes',
  like: 'likes',
  likecount: 'likes',
  favorites: 'likes',
  favoritecount: 'likes',
  reposts: 'reposts',
  repost: 'reposts',
  repostcount: 'reposts',
  retweets: 'reposts',
  retweetcount: 'reposts',
  replies: 'replies',
  reply: 'replies',
  replycount: 'replies',
  linkclicks: 'linkClicks',
  urllinkclicks: 'linkClicks',
  urlclicks: 'linkClicks',
  period: 'periodLabel',
  daterange: 'periodLabel',
  reportingperiod: 'periodLabel',
  date: 'createdAt',
  createdat: 'createdAt',
  postdate: 'createdAt',
  tweetcreatedat: 'createdAt',
  username: 'handle',
  screenname: 'handle',
  handle: 'handle',
};

function normHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field.trim());
      field = '';
      i++;
      continue;
    }
    if (c === '\r' && s[i + 1] === '\n') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      i += 2;
      continue;
    }
    if (c === '\n' || c === '\r') {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function parseNum(raw: string | undefined): number | undefined {
  if (raw == null || raw === '') return undefined;
  const cleaned = raw.replace(/,/g, '').replace(/%/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? undefined : t;
}

function mapHeaders(headers: string[]): (RowField | null)[] {
  const mapped: (RowField | null)[] = [];
  const unknown: string[] = [];
  for (const h of headers) {
    const key = normHeader(h);
    const field = HEADER_ALIASES[key];
    if (field) mapped.push(field);
    else {
      mapped.push(null);
      if (key) unknown.push(h);
    }
  }
  return mapped;
}

function finalizeTweet(t: TweetAnalytics): void {
  if (t.engagements == null) {
    const sum = (t.likes ?? 0) + (t.reposts ?? 0) + (t.replies ?? 0);
    if (sum > 0) t.engagements = sum;
  }
  const imp = t.impressions;
  const eng = t.engagements;
  if (imp && imp > 0 && eng != null && eng > 0) {
    t.engagementRate = (eng / imp) * 100;
  }
}

export function parseAnalyticsCsv(csv: string, handle: string): CsvImportOutcome {
  const warnings: string[] = [];
  const h = normalizeHandle(handle);
  if (!h) {
    return { ok: false, warnings, error: 'Handle is required for CSV import.' };
  }

  const rows = parseCsvRows(csv);
  if (rows.length < 2) {
    return { ok: false, warnings, error: 'CSV must have a header row and at least one data row.' };
  }

  const headers = rows[0];
  const colMap = mapHeaders(headers);
  const unknownCols = headers.filter((_, i) => colMap[i] == null && normHeader(headers[i]));
  if (unknownCols.length) {
    warnings.push(`Unmapped columns ignored: ${unknownCols.slice(0, 8).join(', ')}${unknownCols.length > 8 ? '…' : ''}.`);
  }

  const account: Partial<AccountAnalyticsSnapshot> = { handle: h };
  const tweetMap = new Map<string, TweetAnalytics>();
  let skipped = 0;
  let fileHandle: string | undefined;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowData: Partial<Record<RowField, string>> = {};
    for (let c = 0; c < colMap.length; c++) {
      const field = colMap[c];
      if (!field || cells[c] === undefined) continue;
      rowData[field] = cells[c];
    }

    const tweetId = rowData.tweetId?.trim();
    const textPreview = rowData.textPreview?.trim();
    const hasTweet =
      (tweetId && tweetId.length > 0) ||
      (textPreview && textPreview.length > 10);
    const hasMetric = ['impressions', 'engagements', 'likes', 'reposts', 'replies'].some(
      (k) => rowData[k as RowField] != null && rowData[k as RowField] !== '',
    );

    if (!hasTweet && !hasMetric) {
      skipped++;
      continue;
    }

    if (rowData.handle) fileHandle = normalizeHandle(rowData.handle);

    if (hasTweet) {
      const id = tweetId || `row-${r}`;
      const tweet = tweetMap.get(id) ?? {
        tweetId: id,
        capturedAt: Date.now(),
      };
      if (textPreview) tweet.textPreview = textPreview.slice(0, 120);
      if (rowData.createdAt) tweet.createdAt = parseDate(rowData.createdAt);
      for (const key of [
        'impressions',
        'engagements',
        'likes',
        'reposts',
        'replies',
        'linkClicks',
      ] as const) {
        const n = parseNum(rowData[key]);
        if (n != null) tweet[key] = n;
      }
      finalizeTweet(tweet);
      tweetMap.set(id, tweet);
    } else {
      for (const key of [
        'impressions',
        'engagements',
        'profileVisits',
        'mentions',
        'newFollowers',
      ] as const) {
        const n = parseNum(rowData[key]);
        if (n != null) account[key] = Math.max((account[key] as number | undefined) ?? 0, n);
      }
      if (rowData.periodLabel) account.periodLabel = rowData.periodLabel;
    }
  }

  if (skipped > 0) warnings.push(`Skipped ${skipped} empty or unrecognizable row(s).`);

  const tweets = [...tweetMap.values()].sort(
    (a, b) => (b.impressions ?? 0) - (a.impressions ?? 0),
  );

  if (!account.impressions && tweets.length) {
    account.impressions = tweets.reduce((s, t) => s + (t.impressions ?? 0), 0);
  }
  if (!account.engagements && tweets.length) {
    account.engagements = tweets.reduce((s, t) => s + (t.engagements ?? 0), 0);
  }

  const hasAccount =
    account.impressions != null ||
    account.engagements != null ||
    account.profileVisits != null;
  if (!hasAccount && !tweets.length) {
    return {
      ok: false,
      warnings,
      error: 'No recognizable metrics found. Check column headers (Impressions, Engagements, Tweet ID, etc.).',
    };
  }

  if (fileHandle && fileHandle !== h) {
    warnings.push(`CSV username @${fileHandle} differs from primary @${h}; data saved under @${h}.`);
  }

  const snapshot: AccountAnalyticsSnapshot = {
    handle: h,
    periodLabel: account.periodLabel,
    impressions: account.impressions,
    engagements: account.engagements,
    profileVisits: account.profileVisits,
    mentions: account.mentions,
    newFollowers: account.newFollowers,
    tweets: tweets.length ? tweets : undefined,
    capturedAt: Date.now(),
    source: 'import',
  };

  if (tweets.length) {
    warnings.push(`Imported ${tweets.length} post row(s).`);
  }

  return { ok: true, snapshot, warnings };
}
