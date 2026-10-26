import { describe, expect, it } from 'vitest';
import { classifyBrowseTopics, extractHashtags } from '../src/lib/browse/topic-classify';
import type { TweetMediaInfo } from '../src/lib/slop/extract-tweet-content';

const emptyMedia: TweetMediaInfo = {
  hasPhoto: false,
  hasCard: false,
  hasVideo: false,
  altTexts: [],
};

describe('topic-classify', () => {
  it('detects news from breaking keywords', () => {
    const r = classifyBrowseTopics({
      text: 'BREAKING: sources say developing story confirmed',
      hashtags: extractHashtags('#BreakingNews'),
      authorHandle: 'randomuser',
      media: emptyMedia,
    });
    expect(r.labels).toContain('news');
  });

  it('detects politics from election hashtag', () => {
    const r = classifyBrowseTopics({
      text: 'Vote tomorrow',
      hashtags: ['politics', 'election2026'],
      authorHandle: 'voter',
      media: emptyMedia,
    });
    expect(r.labels).toContain('politics');
  });

  it('detects sports from espn handle', () => {
    const r = classifyBrowseTopics({
      text: 'What a game',
      hashtags: [],
      authorHandle: 'espn',
      media: { ...emptyMedia, hasVideo: true },
    });
    expect(r.labels).toContain('sports');
  });

  it('detects anime hashtag', () => {
    const r = classifyBrowseTopics({
      text: 'new episode',
      hashtags: ['anime'],
      authorHandle: 'fan',
      media: emptyMedia,
    });
    expect(r.labels).toContain('anime');
  });

  it('detects finance from ticker', () => {
    const r = classifyBrowseTopics({
      text: '$TSLA ripping after earnings',
      hashtags: [],
      authorHandle: 'trader',
      media: emptyMedia,
    });
    expect(r.labels).toContain('finance');
  });

  it('detects pokemon', () => {
    const r = classifyBrowseTopics({
      text: 'pulled a charizard from pokemon tcg',
      hashtags: ['pokemon'],
      authorHandle: 'collector',
      media: emptyMedia,
    });
    expect(r.labels).toContain('pokemon');
  });

  it('suppresses opinion on news domain', () => {
    const r = classifyBrowseTopics({
      text: 'unpopular opinion: I think this is huge',
      hashtags: [],
      authorHandle: 'reader',
      cardDomain: 'reuters.com',
      media: { ...emptyMedia, hasCard: true },
    });
    expect(r.labels).toContain('news');
    expect(r.labels).not.toContain('opinion');
  });

  it('matches custom interest', () => {
    const r = classifyBrowseTopics(
      {
        text: 'my gundam build finally done',
        hashtags: [],
        authorHandle: 'builder',
        media: emptyMedia,
      },
      [{ id: 'mecha', label: 'Mecha', keywords: ['gundam'] }],
    );
    expect(r.labels.some((l) => l.startsWith('custom:'))).toBe(true);
  });
});
