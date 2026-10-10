import type { ID, TrendPoint } from './domain';

/** Campaign Detail → Performance Analytics metric switch. */
export type CampaignProgressMetric = 'views' | 'reach' | 'engagement' | 'leads';

/** Cumulative (views / reach / leads) or running-average (engagement) progression, current vs baseline period. */
export type CampaignProgression = Record<CampaignProgressMetric, TrendPoint[]>;

export type AiAnalysisKind = 'working' | 'attention' | 'opportunity' | 'recommendation';

export interface AiAnalysisItem {
  kind: AiAnalysisKind;
  text: string;
}

/** Visual tone of an AI intent label on a comment. */
export type CommentIntentTone = 'emerald' | 'amber' | 'neutral';

export interface CampaignCommentItem {
  id: ID;
  handle: string;
  ago: string;
  /** Short reference to the creative, e.g. "Reel #1". */
  contentRef: string;
  contentId: ID | null;
  text: string;
  aiInferred: boolean;
  intentLabel: string;
  intentTone: CommentIntentTone;
  /** Footer note, e.g. "Lead Potential: High". */
  note: string;
  noteTone: 'primary' | 'secondary' | 'tertiary';
  /** Which follow-up action the design shows for this comment. */
  action: 'reply' | 'archive';
}

export interface CampaignCommentSnapshot {
  /** Sentiment split in percent (sums to 100). */
  sentiment: { positive: number; neutral: number; negative: number };
  items: CampaignCommentItem[];
}

/** Rich, campaign-specific detail data that only exists for some campaigns in the demo dataset. */
export interface CampaignDetailExtras {
  campaignId: ID;
  progression?: CampaignProgression;
  analysis?: AiAnalysisItem[];
  comments?: CampaignCommentSnapshot;
  /** Campaigns list → quick-view drawer AI recommendation. */
  quickViewRecommendation?: string;
}
