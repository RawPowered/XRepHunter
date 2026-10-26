/** Fast fallback when ONNX toxicity model is unavailable. Demeaning talk, not swearing alone. */

const HATE_PATTERNS = [
  /\b(kill\s+(all|yourself|them)|death\s+to)\b/i,
  /\b(racial\s+slur|hate\s+crime)\b/i,
  /\b(sub\s*human|vermin|deport\s+all)\b/i,
  /\b(go\s+back\s+to\s+your)\b/i,
  /\b(you\s+people|those\s+people)\b/i,
  /\b(retard|faggot|tranny)\b/i,
  /\b(n[i1]gg|k[i1]ke|sp[i1]c|ch[i1]nk)\b/i,
];

const DEMEANING_PATTERNS = [
  /\b(you(?:'re| are)|u\s*r)[\s\w]{0,24}\b(stupid|dumb|idiot|moron|pathetic|worthless|disgusting|trash|garbage|loser|ugly|fat)\b/i,
  /\b(you\s+suck|nobody\s+likes\s+you|everyone\s+hates\s+you)\b/i,
  /\b(shut\s+up|stfu|gtfo)\b/i,
  /\b(hate\s+you|despise\s+you)\b/i,
  /\b(kill\s+yourself|kys)\b/i,
  /\b(worthless\s+(?:piece|human)|piece\s+of\s+(?:shit|trash))\b/i,
  /\b(go\s+die|hope\s+you\s+die)\b/i,
];

const MILD_PROFANITY =
  /\b(ass|damn|hell|shit|fuck(?:ing)?|bitch|bastard|crap)\b/i;

export function isProfanityOnly(text: string): boolean {
  const t = text.trim();
  if (!MILD_PROFANITY.test(t)) return false;
  for (const re of [...HATE_PATTERNS, ...DEMEANING_PATTERNS]) {
    if (re.test(t)) return false;
  }
  return true;
}

export function scoreTextToxicityHeuristic(text: string): { score: number; signals: string[] } {
  const trimmed = text.trim();
  if (trimmed.length < 8) return { score: 0, signals: [] };
  if (isProfanityOnly(trimmed)) return { score: 0, signals: [] };

  const signals: string[] = [];
  let hits = 0;
  for (const re of HATE_PATTERNS) {
    if (re.test(trimmed)) {
      hits += 2;
      signals.push('hate');
      break;
    }
  }
  for (const re of DEMEANING_PATTERNS) {
    if (re.test(trimmed)) {
      hits++;
      signals.push('demeaning');
      break;
    }
  }
  const score = Math.min(100, hits * 35 + (trimmed.length > 200 && hits ? 5 : 0));
  return { score, signals };
}
