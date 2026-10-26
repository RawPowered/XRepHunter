const NOTE_RE =
  /community\s*note|readers?\s+added\s+context|context\s+from\s+readers|note\s+from\s+readers/i;

export function articleHasCommunityNote(article: Element): boolean {
  if (article.querySelector('[data-testid*="community"]')) return true;
  if (article.querySelector('[aria-label*="Community Note" i]')) return true;
  const snippets = article.querySelectorAll('[data-testid="socialContext"], [role="note"]');
  for (const el of snippets) {
    if (NOTE_RE.test(el.textContent ?? '')) return true;
  }
  const sample = (article.textContent ?? '').slice(0, 1200);
  return NOTE_RE.test(sample);
}
