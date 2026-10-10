import type { ExecutiveBrief } from '@/types/dashboard';

/**
 * DEMO DATA — AI Executive Brief on the Dashboard (Eko India Campaign Overview export).
 * AI-inferred statements for the Oct 1–31 2024 window; not produced by a live model.
 */
export const executiveBrief: ExecutiveBrief = {
  generatedAt: 'Oct 31, 2024, 10:18 AM IST',
  confidence: 'high',
  items: [
    {
      id: 'brief-working',
      tone: 'working',
      label: 'What is working',
      insightId: 'ins-hindi-reels-vs-carousels',
      segments: [
        { text: 'Reels under 45s featuring real CSP operator testimonial videos in Hindi generated ' },
        { text: '62% of all recruits', strong: true },
        { text: '.' },
      ],
    },
    {
      id: 'brief-declining',
      tone: 'declining',
      label: 'What is declining',
      insightId: 'ins-hindi-reels-vs-carousels',
      segments: [{ text: 'Static carousel posts have dropped by 18% in save rate compared to short-form Reels with direct call-to-actions.' }],
    },
    {
      id: 'brief-opportunity',
      tone: 'opportunity',
      label: 'Biggest Opportunity',
      segments: [
        { text: 'East UP & Bihar show a ' },
        { text: '3.2x higher lead conversion rate', strong: true },
        { text: ' when mentioning SBI CSP eligibility criteria in the first 3 seconds.' },
      ],
    },
    {
      id: 'brief-action',
      tone: 'action',
      label: 'Recommended Action',
      segments: [{ text: 'Auto-dispatch WhatsApp follow-ups to comments tagged "Eligibility Inquiry" within 15 minutes.' }],
    },
  ],
};
