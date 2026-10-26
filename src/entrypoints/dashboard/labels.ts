import type { DetectorId } from '../../lib/types';

export const DETECTOR_LABELS: Record<DetectorId, string> = {
  handlePattern: 'Handle pattern',
  accountAge: 'Account age',
  usernameHistory: 'Username history',
  cryptoSpam: 'Crypto spam',
  repostBot: 'Repost bot',
  romanceBait: 'Romance bait',
  thirstTrap: 'Thirst trap',
  adSpam: 'Ad spam',
  aiVoice: 'AI voice (legacy)',
  aiSlop: 'AI slop',
  contentToxicity: 'Content toxicity (ML)',
  communityNotes: 'Community Notes on posts',
  postSpamSignals: 'Per-post spam / slop signals',
  userExamples: 'Spam examples match',
  xVisibility: 'X VF: visibility / spam',
  xRepostDedup: 'X: repost deduplication',
  xAuthorMonoculture: 'X: author diversity',
  xNegativeEngagement: 'X: block/mute/report signals',
  xOrganicTrust: 'X: organic trust ratio',
  xStaleBurst: 'X: new-account burst',
};

export const STAGE_LABELS: Record<string, string> = {
  pre_scoring_filter: 'Pre-scoring filters',
  post_selection_filter: 'Post-selection (VF)',
  scoring_negative: 'Negative engagement (Phoenix)',
  scoring_positive: 'Positive engagement (Phoenix)',
  diversity: 'Author diversity',
  grox: 'Grox content understanding',
};
