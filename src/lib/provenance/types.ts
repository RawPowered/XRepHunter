export type ProvenanceEvidenceSource = 'dom' | 'heuristic' | 'corpus';

export interface ProvenanceEvidence {
  id: string;
  label: string;
  confidence: number;
  detail?: string;
  source: ProvenanceEvidenceSource;
}

export type LikelihoodCategory =
  | 'likely_organic'
  | 'likely_sponsored'
  | 'likely_influencer_ad'
  | 'likely_recycled'
  | 'likely_ai_assisted'
  | 'uncertain';

export type AccountKind = 'creator' | 'promoter' | 'recycler' | 'mixed' | 'unknown';

export interface ProvenanceAssessment {
  postFingerprint: string;
  handle: string;
  statusId?: string;
  textFingerprint: string;
  likelihoodCategory: LikelihoodCategory;
  sponsorshipScore: number;
  influencerAdScore: number;
  copypastaScore: number;
  aiAssistedScore: number;
  evidence: ProvenanceEvidence[];
}

export interface ProvenanceAnalyzeInput {
  postFingerprint: string;
  handle: string;
  statusId?: string;
  text: string;
  isPromotedAd: boolean;
  slopScore?: number;
  spamScore?: number;
  hasAiImageMark?: boolean;
  cardDomain?: string;
}
