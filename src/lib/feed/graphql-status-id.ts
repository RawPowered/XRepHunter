const ID_PATTERNS: Array<{ re: RegExp; priority: number }> = [
  { re: /"tweet_id"\s*:\s*"(\d+)"/, priority: 10 },
  { re: /"tweet_id"\s*:\s*(\d+)/, priority: 10 },
  { re: /"tweetId"\s*:\s*"(\d+)"/, priority: 9 },
  { re: /"tweetId"\s*:\s*(\d+)/, priority: 9 },
  { re: /"sourceTweetId"\s*:\s*"(\d+)"/, priority: 8 },
  { re: /"sourceTweetId"\s*:\s*(\d+)/, priority: 8 },
  { re: /"rest_id"\s*:\s*"(\d+)"/, priority: 5 },
  { re: /"rest_id"\s*:\s*(\d+)/, priority: 5 },
  { re: /"id"\s*:\s*"(\d{15,})"/, priority: 3 },
  { re: /"id"\s*:\s*(\d{15,})/, priority: 3 },
  { re: /\/status\/(\d+)/, priority: 2 },
];

export function extractStatusIdFromBody(body: string, url = ''): string | undefined {
  if (!body && !url) return undefined;
  const hay = `${url} ${body}`;
  let best: { id: string; priority: number } | null = null;
  for (const { re, priority } of ID_PATTERNS) {
    const m = hay.match(re);
    if (!m) continue;
    const id = m[1];
    if (!best || priority > best.priority) best = { id, priority };
  }
  return best?.id;
}

export function bodyToStr(body: unknown): string {
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

export function extractStatusId(body: unknown, url = ''): string | undefined {
  return extractStatusIdFromBody(bodyToStr(body), url);
}
