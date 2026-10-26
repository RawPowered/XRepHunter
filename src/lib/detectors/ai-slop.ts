import type { AccountProfile, SlopAnalysis } from '../types';
import {
  buildDetectorResult,
  buildEvidenceHit,
  clampScore,
  DETECTOR_VERSION,
  resultToSignalIds,
  scoreFromEvidence,
  type DetectorResult,
} from './evidence';

const MIN_SAMPLE_LEN = 20;
export const MIN_TWEET_LEN = 12;

/** Stock AI / LLM phrasing (not bullet layout). */
const AI_PHRASES = [
  /\bas an ai\b/i,
  /\bi(?:'m| am) (?:an? )?(?:ai|language model|chatbot|assistant)\b/i,
  /\bdelve\b/i,
  /\btapestry\b/i,
  /\bit'?s worth noting\b/i,
  /\bit is worth noting\b/i,
  /\bin today'?s (?:fast[- ]paced|digital|modern|ever[- ]changing)\b/i,
  /\brobust\b/i,
  /\bseamless\b/i,
  /\bfurthermore\b/i,
  /\bmoreover\b/i,
  /\bin conclusion\b/i,
  /\bto summarize\b/i,
  /\blandscape of\b/i,
  /\bgame[- ]changer\b/i,
  /\bat the end of the day\b/i,
  /\bleverage\b/i,
  /\butilize\b/i,
  /\bholistic\b/i,
  /\bparadigm\b/i,
  /\bnuanced\b/i,
  /\bcomprehensive\b/i,
  /\bunderscores?\b/i,
  /\bnavigate\b/i,
  /\brealm\b/i,
  /\btestament\b/i,
  /\bmyriad\b/i,
  /\bplethora\b/i,
  /\bembark\b/i,
  /\bever[- ]evolving\b/i,
  /\bremains to be seen\b/i,
  /\bwithout further ado\b/i,
  /\bi(?:'d| would) be happy to\b/i,
  /\bcertainly[!,.]?\s/i,
  /\bgreat question\b/i,
  /\bthat said\b/i,
  /\bit'?s important to (?:note|remember)\b/i,
  /\bin summary\b/i,
  /\bkey takeaway\b/i,
  /\brest assured\b/i,
  /\blook no further\b/i,
  /\bunlock the (?:power|potential)\b/i,
  /\belevate your\b/i,
  /\bdeep dive\b/i,
  /\bdouble[- ]down\b/i,
];

const CORPORATE_RE =
  /\b(firstly|secondly|thirdly|in summary|key takeaways?|moving forward|going forward|at its core)\b/i;

/** Rhetorical "listicle hook" lines (No hype / Just X) — not generic bullet lists. */
const AI_RHETORIC_LINE_RE = /^(?:[-•*]\s*)?(No|Not|Just|Only|Always|Never)\s+\S+/gim;

const PROMO_PATTERNS = [
  /\bupload\b.+\bto\b/i,
  /\binstantly\s*:/i,
  /\bbefore you sign\b/i,
  /\bcheck it first\b/i,
  /\bin\s+\d+\s+seconds?\b/i,
  /\bAI\s+[\w\s]{0,20}(review|contract|generated)\b/i,
  /\bdetect\s+(risky|hidden)\b/i,
  /\bspot\s+hidden\b/i,
  /\bunderstand\s+legal\b/i,
  /\bhidden\s+(clauses?|red flags?)\b/i,
  /\bexactly how\b/i,
  /\bmost people\b.+\bwithout\b/i,
];

export interface SlopHeuristicDetail {
  score: number;
  signals: string[];
}

function percentile75(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.75);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function splitSentences(text: string): string[] {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 8);
}

function countAiRhetoricLines(text: string): number {
  const matches = text.match(AI_RHETORIC_LINE_RE);
  return matches?.length ?? 0;
}

function countLongDashes(text: string): number {
  let n = 0;
  n += (text.match(/—/g) ?? []).length;
  n += (text.match(/–/g) ?? []).length;
  n += (text.match(/(?<!\w)--(?!\w)/g) ?? []).length;
  const spaced = text.match(/(?<![-\d])\s-\s(?![-\d])/g);
  n += spaced?.length ?? 0;
  return n;
}

/** "No hype / Just do X" stacks — cliché AI rhetoric, not bullet formatting. */
function scoreAiRhetoric(text: string, signals: string[]): number {
  const count = countAiRhetoricLines(text);
  if (count >= 4) {
    signals.push(`ai_rhetoric×${count}`);
    return 88;
  }
  if (count >= 3) {
    signals.push(`ai_rhetoric×${count}`);
    return 72;
  }
  if (count >= 2) {
    signals.push(`ai_rhetoric×${count}`);
    return 48;
  }
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const shortParallel = lines.filter(
    (l) => l.length < 40 && /^(No|Not|Just|Only)\s/i.test(l.replace(/^[-•*]\s*/, '')),
  ).length;
  if (shortParallel >= 3) {
    signals.push(`ai_rhetoric×${shortParallel}`);
    return 68;
  }
  return 0;
}

function scorePromo(text: string, signals: string[]): number {
  let hits = 0;
  for (const re of PROMO_PATTERNS) {
    if (re.test(text)) hits++;
  }
  if (hits >= 3) {
    signals.push(`promo×${hits}`);
    return 88;
  }
  if (hits >= 2) {
    signals.push(`promo×${hits}`);
    return 68;
  }
  if (hits === 1) {
    signals.push('promo×1');
    return 45;
  }
  return 0;
}

/** Low burstiness: similar sentence lengths (uniform, predictable cadence). */
function scoreBurstiness(text: string, signals: string[]): number {
  const sentences = splitSentences(text);
  if (sentences.length < 3) return 0;

  const lengths = sentences.map((s) => s.length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, l) => a + (l - mean) ** 2, 0) / lengths.length;
  const std = Math.sqrt(variance);
  const cv = mean > 0 ? std / mean : 1;

  if (cv < 0.18 && mean > 35) {
    signals.push('low_burstiness');
    return 78;
  }
  if (cv < 0.28 && mean > 30) {
    signals.push('uniform_sentences');
    return 52;
  }
  return 0;
}

function scoreRepetitiveOpeners(sentences: string[], signals: string[]): number {
  if (sentences.length < 3) return 0;
  const starters = sentences.map((s) => s.split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const w of starters) counts.set(w, (counts.get(w) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  if (max >= 3) {
    signals.push(`repeated_opener×${max}`);
    return 55;
  }
  return 0;
}

function scoreDashes(text: string, wordCount: number, phraseHits: number, signals: string[]): number {
  const dashCount = countLongDashes(text);
  if (dashCount === 0) return 0;
  signals.push(`em_dash×${dashCount}`);
  const per100 = (dashCount / Math.max(wordCount, 1)) * 100;
  if (phraseHits >= 1 && (dashCount >= 2 || per100 > 5)) return 55;
  if (dashCount >= 4 || per100 > 10) return 65;
  if (dashCount >= 2) return 35;
  return 18;
}

function qualifiesForScoring(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length >= MIN_SAMPLE_LEN) return true;
  if (trimmed.length >= MIN_TWEET_LEN && countAiRhetoricLines(trimmed) >= 3) return true;
  if (trimmed.length >= MIN_TWEET_LEN) {
    for (const re of PROMO_PATTERNS) {
      if (re.test(trimmed)) return true;
    }
    for (const re of AI_PHRASES) {
      if (re.test(trimmed)) return true;
    }
  }
  return false;
}

/** Legacy blended slop score (preserves badge thresholds). */
function computeLegacySlopBlend(text: string): SlopHeuristicDetail {
  const trimmed = text.trim();
  const signals: string[] = [];

  if (!qualifiesForScoring(trimmed)) {
    return { score: 0, signals };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);

  let phraseHits = 0;
  for (const re of AI_PHRASES) {
    const m = trimmed.match(new RegExp(re.source, 'gi'));
    if (m) phraseHits += m.length;
  }
  if (phraseHits > 0) signals.push(`phrases×${phraseHits}`);
  const phraseDensity = Math.min(1, phraseHits / Math.max(wordCount * 0.06, 1));
  const phraseScore = phraseDensity * 100;

  const rhetoricScore = scoreAiRhetoric(trimmed, signals);
  const promoScore = scorePromo(trimmed, signals);
  const dashScore = scoreDashes(trimmed, wordCount, phraseHits, signals);
  const burstScore = scoreBurstiness(trimmed, signals);
  const sentences = splitSentences(trimmed);
  const openerScore = scoreRepetitiveOpeners(sentences, signals);

  let corporateScore = 0;
  if (CORPORATE_RE.test(trimmed)) {
    corporateScore = 55;
    signals.push('corporate_speak');
  }

  const combined = Math.max(
    phraseScore * 0.38 +
      rhetoricScore * 0.14 +
      promoScore * 0.22 +
      burstScore * 0.12 +
      openerScore * 0.08 +
      dashScore * 0.04 +
      corporateScore * 0.02,
    promoScore,
    rhetoricScore >= 72 ? rhetoricScore * 0.85 : 0,
  );

  return { score: clamp(combined), signals: [...new Set(signals)] };
}

/** Score a single text block 0–100 with matched signal labels. */
export function scoreTextHeuristicDetailed(text: string): SlopHeuristicDetail {
  return computeLegacySlopBlend(text);
}

/** Score a single text block 0–100 (higher = more AI-like). */
export function scoreTextHeuristic(text: string): number {
  return scoreTextHeuristicDetailed(text).score;
}

export function hasStrongSlopSignal(signals: string[]): boolean {
  for (const s of signals) {
    if (s === 'promo_media' || s === 'low_burstiness') return true;
    if (s.startsWith('ai_rhetoric×')) {
      const n = parseInt(s.replace('ai_rhetoric×', ''), 10);
      if (n >= 3) return true;
    }
    if (s.startsWith('listicle×')) {
      const n = parseInt(s.replace('listicle×', ''), 10);
      if (n >= 3) return true;
    }
    if (s.startsWith('em_dash×')) {
      const n = parseInt(s.replace('em_dash×', ''), 10);
      if (n >= 3) return true;
    }
    if (s.startsWith('promo×')) {
      const n = parseInt(s.replace('promo×', ''), 10);
      if (n >= 2) return true;
    }
    if (s.startsWith('phrases×')) {
      const n = parseInt(s.replace('phrases×', ''), 10);
      if (n >= 2) return true;
    }
  }
  return false;
}

function mergeSignals(samples: SlopHeuristicDetail[]): string[] {
  const counts = new Map<string, number>();
  for (const s of samples) {
    for (const sig of s.signals) {
      const base = sig.replace(/×\d+$/, '');
      const m = sig.match(/×(\d+)$/);
      const n = m ? parseInt(m[1], 10) : 1;
      counts.set(base, Math.max(counts.get(base) ?? 0, n));
    }
  }
  return [...counts.entries()].map(([k, v]) => `${k}×${v}`).slice(0, 8);
}

export function scoreProfileHeuristic(profile: AccountProfile): SlopAnalysis {
  const samples: string[] = [];
  if (profile.bio?.trim() && qualifiesForScoring(profile.bio)) {
    samples.push(profile.bio);
  }
  for (const p of profile.postsSample ?? []) {
    if (p.isRepost && p.text.length < 60) continue;
    if (qualifiesForScoring(p.text)) samples.push(p.text);
  }

  if (!samples.length) {
    return { heuristic: 0, combined: 0, samplesScored: 0, signals: [] };
  }

  const details = samples.map((t) => scoreTextHeuristicDetailed(t));
  const scores = details.map((d) => d.score);
  const heuristic = percentile75(scores);
  return {
    heuristic,
    combined: heuristic,
    samplesScored: scores.length,
    signals: mergeSignals(details),
  };
}

export function mergeSlopScores(
  base: SlopAnalysis,
  modelScore?: number,
  modelLabel?: SlopAnalysis['modelLabel'],
): SlopAnalysis {
  const combined =
    modelScore != null ? Math.max(base.combined, modelScore) : base.combined;
  return {
    ...base,
    model: modelScore ?? base.model,
    modelLabel: modelLabel ?? base.modelLabel,
    combined,
  };
}

/** Merge heuristic + local model + Ollama + image + media signals into one SlopAnalysis. */
export function mergeSlopAnalysisParts(parts: {
  heuristic: number;
  signals?: string[];
  onnx?: number;
  onnxLabel?: string;
  model?: number;
  modelLabel?: SlopAnalysis['modelLabel'];
  ollama?: number;
  ollamaLabel?: SlopAnalysis['ollamaLabel'];
  ollamaModel?: string;
  image?: number;
  imageLabel?: string;
  mediaSignals?: string[];
}): SlopAnalysis {
  const signals = [...new Set([...(parts.signals ?? []), ...(parts.mediaSignals ?? [])])];
  const combined = Math.max(
    parts.heuristic,
    parts.onnx ?? 0,
    parts.model ?? 0,
    parts.ollama ?? 0,
    parts.image ?? 0,
  );
  return {
    heuristic: parts.heuristic,
    combined,
    onnx: parts.onnx,
    onnxLabel: parts.onnxLabel,
    model: parts.model,
    modelLabel: parts.modelLabel,
    ollama: parts.ollama,
    ollamaLabel: parts.ollamaLabel,
    ollamaModel: parts.ollamaModel,
    image: parts.image,
    imageLabel: parts.imageLabel,
    mediaSignals: parts.mediaSignals,
    signals,
  };
}

export function slopToRisk(combined: number): number {
  return Math.min(0.9, (combined / 100) * 0.9);
}

export function formatSlopDetail(slop: SlopAnalysis): string {
  const sig = slop.signals?.length ? ` (${slop.signals.join(', ')})` : '';
  const parts = [`Slop score: ${slop.combined}`];
  if (slop.onnx != null) parts.push(`ONNX ${slop.onnx}`);
  if (slop.model != null) parts.push(`Wllama ${slop.model}`);
  if (slop.ollama != null) parts.push(`Ollama ${slop.ollama} (${slop.ollamaModel ?? 'local model'})`);
  if (slop.image != null) parts.push(`image ${slop.image}`);
  return `${parts.join(' · ')}${sig}`;
}

export function shouldFlagSlop(slop: SlopAnalysis): boolean {
  if (slop.combined >= 40) return true;
  return hasStrongSlopSignal(slop.signals ?? []);
}

export function buildSlopTextForModel(profile: AccountProfile, maxLen = 2000): string {
  const parts: string[] = [];
  if (profile.bio?.trim()) parts.push(profile.bio.trim());
  const posts = [...(profile.postsSample ?? [])]
    .filter((p) => qualifiesForScoring(p.text))
    .sort((a, b) => b.text.length - a.text.length)
    .slice(0, 3);
  for (const p of posts) parts.push(p.text.trim());
  return parts.join('\n\n').slice(0, maxLen);
}

export function labelToModelScore(label: string): {
  score?: number;
  modelLabel?: SlopAnalysis['modelLabel'];
} {
  const n = label.toLowerCase();
  if (n === 'ai_generated' || n.startsWith('ai')) {
    return { score: 90, modelLabel: 'ai_generated' };
  }
  if (n === 'human_written' || n.startsWith('human')) {
    return { score: 10, modelLabel: 'human_written' };
  }
  return { modelLabel: 'uncertain' };
}

const NAMED_ENTITY_RE = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/;
const TIMELY_RE = /\b(today|yesterday|this week|breaking|just announced|hours ago)\b/i;
const TYPO_FRAGMENT_RE = /\b(lol|idk|tbh|gonna|kinda|sorta)\b|\.{3}|[!?]{2,}/i;
const REPORTING_RE = /\b(broke the story|exclusive|sources say|interviewed|on the record)\b/i;

function collectAiTextEvidence(text: string): { evidence: ReturnType<typeof buildEvidenceHit>[]; counter: ReturnType<typeof buildEvidenceHit>[] } {
  const evidence = [];
  const counter = [];
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);

  let phraseHits = 0;
  for (const re of AI_PHRASES) {
    const m = trimmed.match(new RegExp(re.source, 'gi'));
    if (m) phraseHits += m.length;
  }
  if (phraseHits > 0) {
    evidence.push(
      buildEvidenceHit({
        id: 'ai_phrases',
        label: 'Stock AI / LLM phrasing',
        weight: Math.min(40, phraseHits * 12),
        category: 'ai_text',
        source: 'text',
        matchedSignal: `phrases×${phraseHits}`,
      }),
    );
  }

  if (CORPORATE_RE.test(trimmed)) {
    evidence.push(
      buildEvidenceHit({
        id: 'corporate_speak',
        label: 'Corporate / essay structure',
        weight: 30,
        category: 'ai_text',
        source: 'text',
        matchedSignal: 'corporate_speak',
      }),
    );
  }

  if (/\b(in conclusion|to summarize|key takeaway|firstly|secondly)\b/i.test(trimmed)) {
    evidence.push(
      buildEvidenceHit({
        id: 'essay_style',
        label: 'Summary / essay-style phrasing',
        weight: 25,
        category: 'ai_text',
        source: 'text',
      }),
    );
  }

  const dashCount = countLongDashes(trimmed);
  if (dashCount >= 2 && phraseHits >= 1) {
    evidence.push(
      buildEvidenceHit({
        id: 'polished_low_info',
        label: 'Polished punctuation with low specificity',
        weight: 20,
        category: 'ai_text',
        source: 'text',
        matchedSignal: `em_dash×${dashCount}`,
      }),
    );
  }

  if (NAMED_ENTITY_RE.test(trimmed)) {
    counter.push(
      buildEvidenceHit({
        id: 'named_details',
        label: 'Concrete named details',
        weight: 22,
        category: 'organic',
        source: 'text',
      }),
    );
  }
  if (TIMELY_RE.test(trimmed)) {
    counter.push(
      buildEvidenceHit({
        id: 'timely_context',
        label: 'Timely / news context',
        weight: 18,
        category: 'organic',
        source: 'text',
      }),
    );
  }
  if (TYPO_FRAGMENT_RE.test(trimmed)) {
    counter.push(
      buildEvidenceHit({
        id: 'natural_fragment',
        label: 'Natural informal phrasing',
        weight: 15,
        category: 'organic',
        source: 'text',
      }),
    );
  }
  if (REPORTING_RE.test(trimmed)) {
    counter.push(
      buildEvidenceHit({
        id: 'original_reporting',
        label: 'Original reporting cues',
        weight: 25,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  if (wordCount > 30 && phraseHits === 0) {
    counter.push(
      buildEvidenceHit({
        id: 'domain_coherence',
        label: 'Domain vocabulary without AI clichés',
        weight: 12,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  return { evidence, counter };
}

function collectSlopEvidence(text: string): { evidence: ReturnType<typeof buildEvidenceHit>[]; counter: ReturnType<typeof buildEvidenceHit>[] } {
  const evidence = [];
  const counter = [];
  const signals: string[] = [];
  const rhetoricScore = scoreAiRhetoric(text, signals);
  if (rhetoricScore >= 40) {
    evidence.push(
      buildEvidenceHit({
        id: 'ai_rhetoric',
        label: 'No X / Just Y rhetorical stack',
        weight: rhetoricScore * 0.45,
        category: 'slop',
        source: 'text',
        matchedSignal: signals.find((s) => s.startsWith('ai_rhetoric')) ?? 'ai_rhetoric',
      }),
    );
  }

  const burstSignals: string[] = [];
  const burstScore = scoreBurstiness(text, burstSignals);
  if (burstScore >= 50) {
    evidence.push(
      buildEvidenceHit({
        id: 'low_burstiness',
        label: 'Unnatural uniform cadence',
        weight: burstScore * 0.4,
        category: 'slop',
        source: 'text',
        matchedSignal: burstSignals[0] ?? 'low_burstiness',
      }),
    );
  }

  const sentences = splitSentences(text);
  const openerSignals: string[] = [];
  const openerScore = scoreRepetitiveOpeners(sentences, openerSignals);
  if (openerScore >= 40) {
    evidence.push(
      buildEvidenceHit({
        id: 'repeated_hooks',
        label: 'Repetitive rhetorical hooks',
        weight: openerScore * 0.45,
        category: 'slop',
        source: 'text',
      }),
    );
  }

  if (/\b(grind|hustle|mindset|level up|unlock|manifest|journey)\b/i.test(text)) {
    evidence.push(
      buildEvidenceHit({
        id: 'motivational_cliche',
        label: 'Generic motivational phrasing',
        weight: 22,
        category: 'slop',
        source: 'text',
      }),
    );
  }

  if (text.length > 80 && !NAMED_ENTITY_RE.test(text) && !TIMELY_RE.test(text)) {
    evidence.push(
      buildEvidenceHit({
        id: 'low_specificity',
        label: 'Low specificity (no names/dates)',
        weight: 18,
        category: 'slop',
        source: 'text',
      }),
    );
  }

  if (NAMED_ENTITY_RE.test(text) || TIMELY_RE.test(text)) {
    counter.push(
      buildEvidenceHit({
        id: 'concrete_context',
        label: 'Concrete context reduces slop likelihood',
        weight: 20,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  return { evidence, counter };
}

function collectPromotionalSlopEvidence(text: string): { evidence: ReturnType<typeof buildEvidenceHit>[]; counter: ReturnType<typeof buildEvidenceHit>[] } {
  const evidence = [];
  const counter = [];
  const promoSignals: string[] = [];
  const promoScore = scorePromo(text, promoSignals);
  if (promoScore >= 40) {
    evidence.push(
      buildEvidenceHit({
        id: 'promo_slop',
        label: 'Promotional template patterns',
        weight: promoScore * 0.5,
        category: 'promo',
        source: 'text',
        matchedSignal: promoSignals[0],
      }),
    );
  }

  if (/\b(unlock your|elevate your|game[- ]changer|deep dive)\b/i.test(text) && promoScore >= 30) {
    evidence.push(
      buildEvidenceHit({
        id: 'ai_promo_blend',
        label: 'AI cliché + promo blend',
        weight: 28,
        category: 'promo',
        source: 'text',
      }),
    );
  }

  if (promoScore === 0 && !/\b(buy now|use code)\b/i.test(text)) {
    counter.push(
      buildEvidenceHit({
        id: 'no_promo_template',
        label: 'No promotional template detected',
        weight: 12,
        category: 'organic',
        source: 'text',
      }),
    );
  }

  return { evidence, counter };
}

export interface TextSlopAnalysis {
  aiText: DetectorResult;
  slop: DetectorResult;
  promotionalSlop: DetectorResult;
}

export function analyzeTextSlop(text: string, opts?: { isReply?: boolean }): TextSlopAnalysis {
  const trimmed = text.trim();
  if (!qualifiesForScoring(trimmed)) {
    const empty = {
      score: 0,
      confidence: 0.25,
      label: 'Insufficient text',
      evidence: [] as DetectorResult['evidence'],
      counterEvidence: [] as DetectorResult['counterEvidence'],
      detectorVersion: DETECTOR_VERSION,
      explanationSummary: 'Too short for AI/slop assessment.',
    };
    return { aiText: { ...empty }, slop: { ...empty }, promotionalSlop: { ...empty } };
  }

  const aiCollected = collectAiTextEvidence(trimmed);
  if (opts?.isReply && trimmed.length < 80) {
    aiCollected.counter.push(
      buildEvidenceHit({
        id: 'reply_context',
        label: 'Short reply context',
        weight: 18,
        category: 'organic',
        source: 'context',
      }),
    );
  }
  const slopCollected = collectSlopEvidence(trimmed);
  const promoCollected = collectPromotionalSlopEvidence(trimmed);

  const aiText = buildDetectorResult(
    'Likely machine-written text',
    aiCollected.evidence,
    aiCollected.counter,
    trimmed.length,
    0.6,
  );
  aiText.score = scoreFromEvidence(aiCollected.evidence, aiCollected.counter);

  const slop = buildDetectorResult(
    'Likely engagement slop',
    slopCollected.evidence,
    slopCollected.counter,
    trimmed.length,
    0.6,
  );
  slop.score = scoreFromEvidence(slopCollected.evidence, slopCollected.counter);

  const promotionalSlop = buildDetectorResult(
    'Likely promotional slop',
    promoCollected.evidence,
    promoCollected.counter,
    trimmed.length,
    0.55,
  );
  promotionalSlop.score = scoreFromEvidence(promoCollected.evidence, promoCollected.counter);

  return { aiText, slop, promotionalSlop };
}

export function legacySlopFromAnalysis(text: string, analysis: TextSlopAnalysis): SlopHeuristicDetail {
  const blend = computeLegacySlopBlend(text);
  const dimMax = clampScore(
    Math.max(analysis.slop.score, analysis.aiText.score, analysis.promotionalSlop.score),
  );
  const signals = [
    ...blend.signals,
    ...resultToSignalIds(analysis.aiText),
    ...resultToSignalIds(analysis.slop),
    ...resultToSignalIds(analysis.promotionalSlop),
  ];
  return { score: Math.max(blend.score, dimMax), signals: [...new Set(signals)] };
}
