import { extractStatusId } from '../lib/feed/graphql-status-id';

export default defineUnlistedScript({
  matches: ['*://x.com/*', '*://twitter.com/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const EVENT = 'xrephunter-graphql';
    const USER_ACTION_EVENT = 'xrephunter-user-action';

    function emit(url: string, body: unknown) {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { url, body } }));
    }

    function bodyStr(body: unknown): string {
      if (!body) return '';
      if (typeof body === 'string') return body;
      try {
        if (body instanceof URLSearchParams) return body.toString();
        if (body instanceof Blob) return '';
        if (body instanceof ArrayBuffer) return new TextDecoder().decode(body);
        if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body);
      } catch {
        /* ignore */
      }
      return '';
    }

    function classifyUserAction(
      url: string,
      method: string,
      body: unknown,
    ): 'like' | 'repost' | 'reply' | 'quote' | null {
      const m = (method || 'GET').toUpperCase();
      if (m !== 'POST' && m !== 'PUT') return null;
      const u = url.toLowerCase();
      const b = bodyStr(body).toLowerCase();
      const hay = `${u} ${b}`;
      if (hay.includes('unfavoritetweet') || hay.includes('destroyfavorite')) return null;
      if (hay.includes('unretweet') || hay.includes('destroyretweet')) return null;
      if (hay.includes('favoritetweet') || hay.includes('createfavorite')) return 'like';
      if (hay.includes('createretweet') || hay.includes('retweetcreate')) return 'repost';
      if (
        hay.includes('createtweet') &&
        (b.includes('in_reply_to') || b.includes('"reply"') || b.includes('reply_to'))
      ) {
        return 'reply';
      }
      if (
        hay.includes('createtweet') &&
        (b.includes('quoted_tweet') || b.includes('quote_tweet') || b.includes('"quote"'))
      ) {
        return 'quote';
      }
      return null;
    }

    function emitUserAction(url: string, method: string, body: unknown) {
      if (!url.includes('graphql') && !url.includes('/i/api/')) return;
      const kind = classifyUserAction(url, method, body);
      if (kind) {
        const statusId = extractStatusId(body, url);
        window.dispatchEvent(
          new CustomEvent(USER_ACTION_EVENT, { detail: { kind, statusId } }),
        );
      }
    }

    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      try {
        const req = args[0];
        const init = args[1] ?? {};
        let url = '';
        let method = 'GET';
        let body: unknown;
        if (typeof req === 'string') {
          url = req;
          method = init.method ?? 'GET';
          body = init.body;
        } else if (req instanceof Request) {
          url = req.url;
          method = init.method ?? req.method;
          body = init.body ?? null;
        }
        emitUserAction(url, method, body);
      } catch {
        /* ignore */
      }
      const res = await origFetch(...args);
      try {
        const req = args[0];
        const url = typeof req === 'string' ? req : req instanceof Request ? req.url : '';
        if (url.includes('graphql') || url.includes('/i/api/')) {
          const clone = res.clone();
          clone
            .json()
            .then((b) => emit(url, b))
            .catch(() => {});
        }
      } catch {
        /* ignore */
      }
      return res;
    };

    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function (method: string, url: string | URL, ...rest: unknown[]) {
      const self = this as XMLHttpRequest & { _xrhUrl?: string; _xrhMethod?: string };
      self._xrhUrl = String(url);
      self._xrhMethod = method;
      return open.apply(this, [method, url, ...rest] as Parameters<typeof open>);
    };

    XHR.send = function (...args: unknown[]) {
      try {
        const self = this as XMLHttpRequest & { _xrhUrl?: string; _xrhMethod?: string };
        emitUserAction(self._xrhUrl ?? '', self._xrhMethod ?? 'GET', args[0]);
      } catch {
        /* ignore */
      }
      this.addEventListener('load', function () {
        try {
          const url = (this as XMLHttpRequest & { _xrhUrl?: string })._xrhUrl ?? '';
          if (url.includes('graphql') || url.includes('/i/api/')) {
            const body = JSON.parse(this.responseText);
            emit(url, body);
          }
        } catch {
          /* ignore */
        }
      });
      return send.apply(this, args as Parameters<typeof send>);
    };
  },
});
