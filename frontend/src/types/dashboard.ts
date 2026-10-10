/** Dashboard-only entities (Eko India Campaign Overview). */

export type ExecutiveBriefTone = 'working' | 'declining' | 'opportunity' | 'action';

/** A run of brief text; `strong` segments render bold (the export highlights the key figure). */
export interface BriefSegment {
  text: string;
  strong?: boolean;
}

export interface ExecutiveBriefItem {
  id: string;
  tone: ExecutiveBriefTone;
  /** Uppercase eyebrow, e.g. "What is working". */
  label: string;
  segments: BriefSegment[];
  /** Optional deep link to the supporting AI insight. */
  insightId?: string;
}

export interface ExecutiveBrief {
  generatedAt: string;
  /** Model confidence label shown with the AI-inferred badge. */
  confidence: 'high' | 'medium' | 'low';
  items: ExecutiveBriefItem[];
}
