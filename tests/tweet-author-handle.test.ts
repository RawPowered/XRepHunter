import { describe, expect, it } from 'vitest';
import {
  extractTweetAuthorHandle,
  extractTweetStatusId,
} from '../src/lib/x-dom/selectors';

function mockArticle(opts: {
  userNameHref?: string;
  statusHrefs?: string[];
  firstHref?: string;
}): HTMLElement {
  const statusLinks = (opts.statusHrefs ?? []).map((href) => ({
    getAttribute: (n: string) => (n === 'href' ? href : null),
  }));
  const userNameLink = opts.userNameHref
    ? { getAttribute: (n: string) => (n === 'href' ? opts.userNameHref! : null) }
    : null;
  const firstLink = opts.firstHref
    ? { getAttribute: (n: string) => (n === 'href' ? opts.firstHref! : null) }
    : null;

  return {
    querySelector: (sel: string) => {
      if (sel.includes('User-Name')) {
        return userNameLink ? { querySelector: () => userNameLink } : null;
      }
      if (sel.startsWith('a[href^="/"]')) return firstLink;
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel.includes('/status/')) return statusLinks;
      return [];
    },
  } as unknown as HTMLElement;
}

describe('extractTweetAuthorHandle', () => {
  it('prefers User-Name link', () => {
    const el = mockArticle({
      userNameHref: '/authoruser',
      firstHref: '/mentioneduser',
      statusHrefs: ['/authoruser/status/1'],
    });
    expect(extractTweetAuthorHandle(el)).toBe('authoruser');
  });

  it('uses status URL when User-Name missing', () => {
    const el = mockArticle({ statusHrefs: ['/poster/status/999'] });
    expect(extractTweetAuthorHandle(el)).toBe('poster');
    expect(extractTweetStatusId(el)).toBe('999');
  });

  it('falls back to first profile link', () => {
    const el = mockArticle({ firstHref: '/fallback' });
    expect(extractTweetAuthorHandle(el)).toBe('fallback');
  });
});
