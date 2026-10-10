import type { InsightDetail, Insight, InsightsOverview, RecommendedAction } from '@/types/insights';
import { audienceSummary } from './audience';
import { campaigns } from './campaigns';
import { commentSummary } from './comments';
import { contentItems } from './content';
import { leadPipelineSummary } from './leads';
import { media } from './media';
import { accountOverview } from './overview';
import { contentAnalytics } from './contentAnalytics';
import { HINDI_REELS_INSIGHT_TITLE } from './insightTitles';

/**
 * DEMO DATA — AI Insights (overview + detail). Numbers that overlap canonical data are derived from
 * the canonical modules (account overview, campaigns, content, audience, leads, comments) so the
 * screens always agree. Model outputs (confidence, projections, CPL, retention curve, profile
 * visits) are insight-specific sample values.
 */

const fmtK = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M` : n >= 10_000 ? `${Math.round(n / 1_000)}K` : n.toLocaleString('en-US'));
const num = (n: number) => n.toLocaleString('en-US');
const pctDelta = (a: number, b: number) => `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`;

const content = (id: string) => contentItems.find((c) => c.id === id)!;
const campaign = (id: string) => campaigns.find((c) => c.id === id)!;
const state = (label: string) => audienceSummary.topStates.find((s) => s.label === label)!;
const intent = (key: string) => commentSummary.intents.find((i) => i.intent === key)!;

const reel = content('sbi-csp-mitra-reel');
const carousel = content('digital-banking-rural-india');
const october = campaign('sbi-csp-october');
const rural = campaign('rural-banking-access');
const literacy = campaign('financial-literacy-week');
const story = content('csp-day-in-the-life-story');
const up = state('Uttar Pradesh');
const bihar = state('Bihar');
const cohort = audienceSummary.age.find((a) => a.label === '25–34')!;
const eligibility = intent('eligibility');
const application = intent('application');
const complaints = intent('complaint');

const totalReach = accountOverview.reach.value;
const nonFollowerReach = Math.round((totalReach * audienceSummary.nonFollowerReachPct) / 100 / 1_000) * 1_000;
const highIntentLeads = eligibility.potentialLeads + application.potentialLeads;
const eligibilityShare = Math.round((eligibility.potentialLeads / highIntentLeads) * 100);
const benchmarkEng = accountOverview.engagementRate.value;
const leadTarget = accountOverview.leads.target;
const totalLeads = accountOverview.leads.value;

// Insight-specific model inputs (not canonical metrics).
// Profile visits come from the per-content analytics shown on Reel Analytics, so both screens agree.
const reelProfileVisits = contentAnalytics[reel.id]?.discovery?.profileVisits ?? 0;
const carouselProfileVisits = contentAnalytics[carousel.id]?.discovery?.profileVisits ?? 0;
const reelConv = (reel.metrics.leads / reelProfileVisits) * 100;
const carouselConv = (carousel.metrics.leads / carouselProfileVisits) * 100;
const reelWatchSec = Math.round((reel.durationSec ?? 18) * ((reel.metrics.retention ?? 0) / 100) * 10) / 10;

const GENERATED = 'Oct 31, 2024 10:14 AM IST';
const audit: InsightDetail['audit'] = {
  operator: 'Priya Sharma (Growth Lead)',
  trigger: 'Demo dataset snapshot (no Graph API sync)',
  modelVersion: 'Eko-Intelligence-v4.2.1',
  lastCheck: 'Oct 31, 2024 10:14 AM IST (demo)',
};

export const insightsOverview: InsightsOverview = {
  engineVersion: 'SYNTHESIS ENGINE v4.2',
  generatedAt: GENERATED,
  periodLabel: 'OCT 01 - OCT 31, 2024',
  executive: {
    overall: `October campaign efficiency gained [[pos:+${accountOverview.views.delta}% total video views (${fmtK(accountOverview.views.value)})]] and generated [[b:${totalLeads} attributed leads]]. Lead acquisition cost decreased to [[b:₹42/lead]] led by short-form Hindi Reels across Tier-2 banking segments.`,
    positive: `[[b:${reel.title}]] achieved [[pos:${reel.metrics.retention}% completion rate]] with ${audienceSummary.nonFollowerReachPct}% non-follower discovery driving [[b:${reel.metrics.leads} attributed leads]] — ${Math.round((reel.metrics.leads / (october.metrics?.leads ?? 1)) * 100)}% of the ${october.name}'s ${october.metrics?.leads}.`,
    concern: `[[b:${rural.name}]] campaign engagement dropped to [[neg:${rural.metrics?.engagementRate}%]] with comment sentiment drifting [[neg:18% neutral-to-negative]] due to kiosk eligibility ambiguity in promotional assets.`,
    recommendation:
      'Add explicit age (21+) and shop footprint prerequisites directly into the 3-second hook of upcoming CSP recruitment Reels to reduce redundant comment inquiries by ~44%.',
  },
  kpis: {
    synthesizedCampaigns: campaigns.filter((c) => c.metrics !== null).length,
    peakCampaignLabel: `${fmtK(october.metrics?.views ?? 0)} peak views on SBI CSP Oct`,
    baselineLiftLabel: `+${accountOverview.views.delta}% MoM`,
    leadSignals: leadPipelineSummary.aiFilteredPotential,
    leadSignalsDeltaLabel: '+34.2% surge this month',
    avgCplLabel: '₹42 avg CPL',
    modelConfidence: 94.6,
    modelBasisLabel: `${num(commentSummary.totalComments)} comments & ${fmtK(totalReach)} reach`,
    attributionDriftLabel: '< 1.2% dev',
    resolutionPaceLabel: '82% on schedule',
  },
  disclaimer:
    'This insight is an analytical recommendation synthesized from campaign telemetry (demo data in this prototype) and natural language models. AI does not autonomously modify active Instagram campaigns or ad spend. All deployment actions require human operator confirmation.',
};

export const insights: Insight[] = [
  {
    id: 'ins-hindi-reels-vs-carousels',
    category: 'content',
    priority: 'high',
    confidence: 96,
    title: HINDI_REELS_INSIGHT_TITLE,
    observed: `${reel.title} generated [[b:${reel.metrics.leads} leads]] (${reel.metrics.retention}% completion, ${fmtK(reel.metrics.views)} views, ${reel.durationSec}s) vs the ${carousel.title} carousel (${carousel.metrics.leads} leads, ${carousel.metrics.engagementRate}% eng, ${fmtK(carousel.metrics.views)} views).`,
    interpretation: 'Audience in UP & Bihar demonstrates higher conversion propensity on visual demonstration of ATM/micro-ATM hardware rather than infographic slides.',
    impact: { text: 'Expected Impact: +25% projected lead volume if 2 additional short-form CSP testimonial Reels are deployed.', icon: 'trending_up', tone: 'positive', predictive: true },
    primaryLink: { label: 'Open Reel Analytics', to: `/content/${reel.id}` },
    generatedAt: GENERATED,
    status: 'new',
    completedStepIds: [],
    detail: {
      telemetry: {
        title: '1. Observed Performance Telemetry (Demo Data)',
        subtitle: 'Direct empirical metrics recorded across campaign assets in the active date range.',
        primaryLabel: 'Reel #01 (Hindi Short-Form)',
        primaryIcon: 'movie',
        comparisonLabel: 'Carousel #04 (Digital Banking)',
        comparisonIcon: 'view_carousel',
        rows: [
          { label: 'Creative Asset', primary: `Hindi Short-Form Reel (${reel.title})`, comparison: `Infographic Carousel (${carousel.title})`, delta: '—', deltaTone: 'neutral' },
          { label: 'Asset Duration', primary: `${reel.durationSec} seconds`, comparison: `N/A (${carousel.slides} Slides)`, delta: '—', deltaTone: 'neutral' },
          { label: 'Total Views / Impressions', primary: num(reel.metrics.views), comparison: num(carousel.metrics.views), delta: `${pctDelta(reel.metrics.views, carousel.metrics.views)} delta` },
          {
            label: 'Total Reach & Distribution',
            primary: fmtK(reel.metrics.reach),
            primaryNote: `(${audienceSummary.nonFollowerReachPct}% non-follower)`,
            comparison: fmtK(carousel.metrics.reach),
            comparisonNote: '(41% non-follower)',
            delta: pctDelta(reel.metrics.reach, carousel.metrics.reach),
          },
          { label: 'Avg Watch Time / Retention', primary: `${reelWatchSec}s`, primaryNote: `(${reel.metrics.retention}% completion)`, comparison: '3.1s slide-through', delta: pctDelta(reelWatchSec, 3.1) },
          { label: 'Direct Leads Generated', primary: `${reel.metrics.leads} attributed leads`, comparison: `${carousel.metrics.leads} leads`, delta: `${(reel.metrics.leads / carousel.metrics.leads).toFixed(1)}x leads`, emphasis: true },
          {
            label: 'Lead Conversion (leads ÷ profile visits)',
            primary: `${reelConv.toFixed(2)}%`,
            primaryNote: `(${reel.metrics.leads} / ${num(reelProfileVisits)})`,
            comparison: `${carouselConv.toFixed(2)}%`,
            comparisonNote: `(${carousel.metrics.leads} / ${num(carouselProfileVisits)})`,
            delta: `${(reelConv / carouselConv).toFixed(1)}x conversion`,
            emphasis: true,
          },
          { label: 'Cost Per Attributed Lead (CPL)', primary: '₹42 / lead', comparison: '₹168 / lead', delta: '-75% efficiency' },
        ],
        retention: {
          title: 'Frame-by-Frame Hook Retention Analysis (First 4 Seconds)',
          headline: '82% Viewport Retention at 0:04',
          segments: [
            { width: 82, tone: 'active', title: '0:00 to 0:04 Hook: 82% retention' },
            { width: 11, tone: 'primary', title: '0:05 to 0:12 Demo: 58% retention' },
            { width: 7, tone: 'muted', title: 'Drop-off: 7%' },
          ],
          notes: [
            { range: '0:00 - 0:04', text: 'Physical biometric scanner close-up hooks audience; 82% maintain view.' },
            { range: '0:05 - 0:12', text: 'Micro-ATM cash dispensing demonstration maintains 58% retention.' },
            { range: `0:13 - 0:${reel.durationSec}`, text: 'Direct Hindi audio call-to-action triggers bio link tapping & comments.' },
          ],
        },
      },
      reasoning: {
        factors: [
          {
            title: 'Hypothesis & Finding',
            icon: 'domain_verification',
            tone: 'amber',
            text: 'Viewers in tier-2/3 regions (Uttar Pradesh, Bihar, Haryana) display strong commercial intent when presented with [[b:tangible hardware]] (micro-ATM, Aadhaar biometric scanner) and real CSP operator testimonials rather than abstract digital illustrations.',
          },
          {
            title: 'Language & Audio Factor',
            icon: 'record_voice_over',
            tone: 'blue',
            text: `Use of native Hindi vernacular voiceover ([[b:"Apne gaon mein bank kholein"]]) in Reel #01 drove ${num(reel.metrics.comments)} comments, of which [[pos:58% were classified as Application or Eligibility intent]] by semantic models.`,
          },
          {
            title: 'Algorithm Multiplier',
            icon: 'trending_up',
            tone: 'emerald',
            text: `The Reels recommendation surface propelled ${audienceSummary.nonFollowerReachPct}% non-follower discovery due to high initial replay and bookmark rate ([[b:${fmtK(reel.metrics.saves)} saves]]), signaling high personal utility value.`,
          },
        ],
        confidenceNote: `96% confidence score assigned due to high statistical significance (sample base: n=${num(reel.metrics.views)} views, ${num(reel.metrics.comments)} intent comments, ${reel.metrics.leads} attributed lead records, p < 0.001).`,
        errorMargin: 'ERR: ±1.4%',
      },
      steps: [
        {
          id: 'step-1',
          title: 'Produce 2 additional 18-25 second Reels featuring authentic CSP operators in rural Bihar and Eastern UP demonstrating cash withdrawal.',
          tag: '[AI-PREDICTIVE ESTIMATE: +30-40 leads/week]',
          tagTone: 'ai',
          description: 'Leverage vernacular audio scripting templates available in Creative Studio. Spotlight local storefronts with SBI CSP branding.',
        },
        {
          id: 'step-2',
          title: 'Incorporate explicit eligibility prerequisites (age 21+, matriculate pass, shop space) in the opening 3 seconds to pre-qualify commenters.',
          tag: 'Expected Lead Quality Gain: +22%',
          tagTone: 'positive',
          description: 'Reduces unqualified inquiry load on the inbound WhatsApp and tele-calling verification teams.',
        },
        {
          id: 'step-3',
          title: 'Shift ₹25,000 promotional budget from low-performing carousel posts to boost the top-performing Reel.',
          tag: 'Budget Optimization: 4x ROAS Delta',
          tagTone: 'primary',
          description: 'Re-allocate Meta Ads Manager budget to a custom lookalike audience modeled after Hindi video viewers (manual step — not executed by InstaBoard).',
        },
      ],
      quickLinks: [
        { label: 'Go to Content Library', to: '/content' },
        { label: 'View Reel Analytics', to: `/content/${reel.id}` },
        { label: 'Open Campaign Detail', to: `/campaigns/${october.id}`, primary: true },
      ],
      artifacts: {
        campaignId: october.id,
        primaryContentId: reel.id,
        primaryMediaUrl: media.closeUpPhotographyIndianVillage.url,
        primaryMediaAlt: media.closeUpPhotographyIndianVillage.alt,
        comparisonContentId: carousel.id,
        funnelCampaignId: october.id,
      },
      evidenceCommentIds: ['cmt-91823', 'cmt-91807', 'cmt-91715'],
      audit,
    },
  },
  {
    id: 'ins-eligibility-response-delay',
    category: 'comments',
    priority: 'high',
    confidence: 92,
    title: `Eligibility Inquiries Constitute ${eligibilityShare}% of High-Intent Leads But Suffer 4.2h Delay`,
    observed: `[[b:${num(eligibility.comments)} comments]] classified under Eligibility Question intent; [[b:${commentSummary.needsResponse} comments]] currently awaiting response in Comments Intelligence.`,
    interpretation: 'Prospective banking correspondents ask repeatedly about minimum educational qualifications (10th/12th pass) and deposit security before submitting form applications.',
    impact: { text: 'Expected Impact: Immediate 18% qualification bump if SLA reduced under 45 minutes via suggested quick replies (human-approved).', icon: 'speed', tone: 'positive' },
    primaryLink: { label: 'Open Comments Intelligence', to: '/comments' },
    generatedAt: GENERATED,
    status: 'new',
    completedStepIds: [],
    detail: {
      telemetry: {
        title: '1. Observed Comment Telemetry (Demo Data)',
        subtitle: 'Eligibility-intent comments compared with all other classified intents, Oct 1–31.',
        primaryLabel: 'Eligibility Questions',
        primaryIcon: 'help',
        comparisonLabel: 'All Other Intents',
        comparisonIcon: 'forum',
        rows: [
          { label: 'Comments', primary: num(eligibility.comments), comparison: num(commentSummary.totalComments - eligibility.comments), delta: `${((eligibility.comments / commentSummary.totalComments) * 100).toFixed(1)}% share`, deltaTone: 'neutral' },
          {
            label: 'AI-Estimated Potential Leads',
            primary: num(eligibility.potentialLeads),
            comparison: num(commentSummary.potentialLeads - eligibility.potentialLeads),
            delta: `${eligibilityShare}% of high-intent`,
            emphasis: true,
          },
          {
            label: 'Lead Yield (leads ÷ comments)',
            primary: `${Math.round((eligibility.potentialLeads / eligibility.comments) * 100)}%`,
            comparison: `${(((commentSummary.potentialLeads - eligibility.potentialLeads) / (commentSummary.totalComments - eligibility.comments)) * 100).toFixed(1)}%`,
            delta: `${(eligibility.potentialLeads / eligibility.comments / ((commentSummary.potentialLeads - eligibility.potentialLeads) / (commentSummary.totalComments - eligibility.comments))).toFixed(1)}x yield`,
          },
          { label: 'Avg First Response Time', primary: '4.2h', comparison: '2.1h', delta: '+100% slower', deltaTone: 'negative' },
        ],
      },
      reasoning: {
        factors: [
          { title: 'Hypothesis & Finding', icon: 'domain_verification', tone: 'amber', text: 'Eligibility questions are asked [[b:before]] the application form — a slow answer loses the prospect at the highest-intent moment.' },
          { title: 'Recurring Questions', icon: 'quiz', tone: 'blue', text: 'Top repeated asks: minimum age (21+), [[b:10th pass]] qualification, rented shop acceptance and security deposit.' },
          { title: 'Response Pattern', icon: 'schedule', tone: 'emerald', text: 'Comments answered within 45 minutes show a [[pos:18% higher qualification rate]] in the sample.' },
        ],
        confidenceNote: `92% confidence (sample base: ${num(eligibility.comments)} eligibility comments, ${commentSummary.needsResponse} awaiting response).`,
        errorMargin: 'ERR: ±2.1%',
      },
      steps: [
        { id: 'step-1', title: 'Create saved reply templates for age, qualification and shop-space questions.', tag: 'Expected SLA: -78%', tagTone: 'positive', description: 'Templates are suggested in the comment drawer; staff copy and post them manually in Instagram.' },
        { id: 'step-2', title: 'Triage the eligibility queue daily using the "Awaiting Staff Response" preset.', tag: '[AI-PREDICTIVE: +18% qualification]', tagTone: 'ai', description: 'Prioritise Tier 1 commenters who disclose shop space or an existing business.' },
        { id: 'step-3', title: 'Add eligibility criteria to the caption and first frame of recruitment Reels.', tag: 'Fewer repeat questions', tagTone: 'primary', description: 'Reduces redundant inquiries so staff can focus on applicants.' },
      ],
      quickLinks: [{ label: 'Open Comments Intelligence', to: '/comments', primary: true }, { label: 'View Leads Pipeline', to: '/leads' }],
      artifacts: { campaignId: october.id, primaryContentId: reel.id },
      evidenceCommentIds: ['cmt-91807', 'cmt-91590', 'cmt-91493'],
      audit,
    },
  },
  {
    id: 'ins-non-follower-discovery-up-bihar',
    category: 'audience',
    priority: 'medium',
    confidence: 89,
    title: `Non-Follower Discovery Spikes in Tier-2/3 Uttar Pradesh & Bihar (${audienceSummary.nonFollowerReachPct}% Reach)`,
    observed: `Non-follower reach reached [[b:${fmtK(nonFollowerReach)} (${audienceSummary.nonFollowerReachPct}% of ${fmtK(totalReach)} total reach)]]. UP represents ${up.share}% (${fmtK(up.reach)} reach, ${up.leads} leads); Bihar ${bihar.share}% (${fmtK(bihar.reach)} reach, ${bihar.leads} leads).`,
    interpretation: 'Instagram Explore and Reels recommendation surfaces are favoring local dialect Hindi banking tutorials outside the current follower base.',
    impact: { text: 'Expected Impact: Follower base growth of +12K net new micro-entrepreneurs if localized regional CTA tags are maintained.', icon: 'groups', tone: 'positive' },
    primaryLink: { label: 'Open Audience Intelligence', to: '/audience' },
    generatedAt: GENERATED,
    status: 'new',
    completedStepIds: [],
    detail: {
      telemetry: {
        title: '1. Observed Audience Telemetry (Demo Data)',
        subtitle: 'Reach and lead contribution by state for the reporting window.',
        primaryLabel: 'Uttar Pradesh',
        primaryIcon: 'location_on',
        comparisonLabel: 'Bihar',
        comparisonIcon: 'location_on',
        rows: [
          { label: 'Share of Reach', primary: `${up.share}%`, comparison: `${bihar.share}%`, delta: `${(up.share / bihar.share).toFixed(1)}x` },
          { label: 'Reach', primary: fmtK(up.reach), comparison: fmtK(bihar.reach), delta: pctDelta(up.reach, bihar.reach) },
          { label: 'Engaged Accounts', primary: fmtK(up.engaged), comparison: fmtK(bihar.engaged), delta: pctDelta(up.engaged, bihar.engaged) },
          { label: 'Leads', primary: `${up.leads}`, comparison: `${bihar.leads}`, delta: `${(up.leads / bihar.leads).toFixed(1)}x leads`, emphasis: true },
        ],
      },
      steps: [
        { id: 'step-1', title: 'Keep district-level location tags (Gorakhpur, Varanasi, Muzaffarpur) on recruitment Reels.', tag: '+12K followers projected', tagTone: 'positive', description: 'Regional tags correlate with Explore distribution in the sample.' },
        { id: 'step-2', title: 'Test a Bhojpuri/Maithili voiceover variant for Bihar audiences.', tag: '[AI-PREDICTIVE ESTIMATE]', tagTone: 'ai', description: 'Bihar reach is growing but leads per reach trail UP.' },
      ],
      quickLinks: [{ label: 'Open Audience Intelligence', to: '/audience', primary: true }],
      audit,
    },
  },
  {
    id: 'ins-rural-banking-underperforming',
    category: 'campaign',
    priority: 'medium',
    confidence: 88,
    title: `${rural.name} Campaign Underperforming Benchmark (${pctDelta(rural.metrics?.engagementRate ?? 0, benchmarkEng)} Eng Pacing)`,
    observed: `${fmtK(rural.metrics?.views ?? 0)} views, ${fmtK(rural.metrics?.reach ?? 0)} reach, [[b:${rural.metrics?.engagementRate}% engagement rate]] (vs ${benchmarkEng}% account benchmark). Generated only ${rural.metrics?.leads} leads at ₹112/lead.`,
    interpretation: 'Broad awareness creative lacks strong commercial call-to-action compared to targeted recruitment campaigns; copy relies on abstract benefit statements.',
    impact: { text: 'Recommendation: Pause flight schedule or replace creative with micro-ATM earnings breakdown.', icon: 'sync_problem', tone: 'warning' },
    primaryLink: { label: 'View Campaign Detail', to: `/campaigns/${rural.id}` },
    generatedAt: GENERATED,
    status: 'new',
    completedStepIds: [],
    detail: {
      telemetry: {
        title: '1. Observed Campaign Telemetry (Demo Data)',
        subtitle: `${rural.name} compared with the best-performing campaign (${october.name}).`,
        primaryLabel: rural.name,
        primaryIcon: 'campaign',
        comparisonLabel: october.name,
        comparisonIcon: 'campaign',
        rows: [
          { label: 'Views', primary: num(rural.metrics?.views ?? 0), comparison: num(october.metrics?.views ?? 0), delta: pctDelta(rural.metrics?.views ?? 0, october.metrics?.views ?? 1), deltaTone: 'negative' },
          { label: 'Reach', primary: num(rural.metrics?.reach ?? 0), comparison: num(october.metrics?.reach ?? 0), delta: pctDelta(rural.metrics?.reach ?? 0, october.metrics?.reach ?? 1), deltaTone: 'negative' },
          {
            label: 'Engagement Rate',
            primary: `${rural.metrics?.engagementRate}%`,
            primaryNote: `(benchmark ${benchmarkEng}%)`,
            comparison: `${october.metrics?.engagementRate}%`,
            delta: `${pctDelta(rural.metrics?.engagementRate ?? 0, benchmarkEng)} vs benchmark`,
            deltaTone: 'negative',
            emphasis: true,
          },
          { label: 'Leads', primary: `${rural.metrics?.leads}`, comparison: `${october.metrics?.leads}`, delta: pctDelta(rural.metrics?.leads ?? 0, october.metrics?.leads ?? 1), deltaTone: 'negative' },
          { label: 'Lead Conversion Rate', primary: `${rural.metrics?.conversionRate}%`, comparison: `${october.metrics?.conversionRate}%`, delta: pctDelta(rural.metrics?.conversionRate ?? 0, october.metrics?.conversionRate ?? 1), deltaTone: 'negative' },
        ],
      },
      steps: [
        { id: 'step-1', title: "Refresh 'Rural Banking Access' creative copy with a micro-ATM earnings breakdown.", tag: '+1.4% Eng Lift [ESTIMATED]', tagTone: 'positive', description: 'Pivot from generic brand awareness to merchant commission calculators.' },
        { id: 'step-2', title: 'Keep the campaign paused until the new creative is approved.', tag: 'Human decision', tagTone: 'primary', description: 'InstaBoard does not pause or resume Instagram campaigns automatically.' },
      ],
      quickLinks: [
        { label: 'View Campaign Detail', to: `/campaigns/${rural.id}`, primary: true },
        { label: 'View Content', to: '/content/banking-services-near-you' },
      ],
      artifacts: { campaignId: rural.id, primaryContentId: 'banking-services-near-you' },
      audit,
    },
  },
  {
    id: 'ins-lead-target-25-34',
    category: 'leads',
    priority: 'high',
    confidence: 90,
    title: `${cohort.label} Cohort Drives Operator Leads as October Beats ${leadTarget}-Lead Target by ${(((totalLeads - leadTarget) / leadTarget) * 100).toFixed(1)}%`,
    observed: `[[b:${totalLeads} qualified leads]] vs ${leadTarget} target (+${accountOverview.leads.delta}% vs Sep). ${cohort.label} year-olds are ${cohort.share}% of the audience (${fmtK(cohort.audience)}); ${leadPipelineSummary.convertedOperators} leads converted to operators (${leadPipelineSummary.closeRate}% close rate).`,
    interpretation: 'Lead quality concentrates in 25–34 year-old shop owners in UP East who already run a retail counter.',
    impact: { text: 'Expected Impact: +60 leads/month if 25–34 lookalike targeting is applied to the November Festival Drive.', icon: 'trending_up', tone: 'positive', predictive: true },
    primaryLink: { label: 'Open Leads Pipeline', to: '/leads' },
    generatedAt: GENERATED,
    status: 'new',
    completedStepIds: [],
  },
  {
    id: 'ins-deposit-friction-negative',
    category: 'comments',
    priority: 'medium',
    confidence: 86,
    title: `Negative Sentiment Clusters Around Security Deposit & Kiosk Rental (${num(complaints.comments)} Complaints)`,
    observed: `[[b:${num(commentSummary.sentiment.negative)} negative comments]] (${((commentSummary.sentiment.negative / commentSummary.totalComments) * 100).toFixed(1)}%), of which ${num(complaints.comments)} are complaints or technical support issues.`,
    interpretation: 'Deposit questions often reference third parties asking for money — a brand-safety and impersonation risk, not only a support issue.',
    impact: { text: 'Expected Impact: -30% negative comments if an official "no deposit to individuals" notice is pinned.', icon: 'shield', tone: 'positive' },
    primaryLink: { label: 'Open Comments Intelligence', to: '/comments' },
    generatedAt: GENERATED,
    status: 'new',
    completedStepIds: [],
    detail: { evidenceCommentIds: ['cmt-91640', 'cmt-91622'], audit },
  },
  {
    id: 'ins-financial-literacy-efficiency',
    category: 'campaign',
    priority: 'low',
    confidence: 81,
    title: `${literacy.name} Delivered the Highest Engagement Rate (${literacy.metrics?.engagementRate}%) on the Smallest Budget`,
    observed: `${fmtK(literacy.metrics?.views ?? 0)} views and ${literacy.metrics?.leads} leads on a ₹${num(literacy.budgetInr ?? 0)} budget — engagement ${literacy.metrics?.engagementRate}% vs ${benchmarkEng}% account benchmark.`,
    interpretation: 'Educational carousels earn saves and shares but convert fewer leads; they work best as top-of-funnel support for recruitment Reels.',
    impact: { text: 'Expected Impact: +8% engagement if one literacy post per week is retained alongside recruitment content.', icon: 'school', tone: 'positive' },
    primaryLink: { label: 'View Campaign Detail', to: `/campaigns/${literacy.id}` },
    generatedAt: GENERATED,
    status: 'new',
    completedStepIds: [],
  },
  {
    id: 'ins-stories-low-lead-yield',
    category: 'content',
    priority: 'low',
    confidence: 77,
    title: 'Stories Contribute Under 1% of Leads — Repurpose Into Reels',
    observed: `${story.title}: ${fmtK(story.metrics.views)} views, ${story.metrics.leads} attributed leads, ${story.metrics.engagementRate}% engagement.`,
    interpretation: 'Ephemeral Stories reach existing followers but lack a persistent comment thread for lead capture.',
    impact: { text: 'Expected Impact: +10–15 leads if the day-in-the-life footage is recut as a 20s Reel.', icon: 'movie', tone: 'positive' },
    primaryLink: { label: 'Open Content Analytics', to: `/content/${story.id}` },
    generatedAt: GENERATED,
    status: 'new',
    completedStepIds: [],
  },
];

export const recommendedActions: RecommendedAction[] = [
  {
    id: 'act-hindi-testimonial-reels',
    priority: 'high',
    title: 'Deploy 2 Additional Short-Form Hindi CSP Testimonial Reels',
    rationale: 'Focus on micro-ATM hardware workflow & daily commission proofs.',
    metric: `${reel.metrics.leads} leads from Reel #01`,
    metricNote: `${(reelConv / carouselConv).toFixed(1)}x carousel lead conversion`,
    impact: '+25% Lead Vol',
    target: { label: 'Content Intelligence', to: '/content' },
    insightId: 'ins-hindi-reels-vs-carousels',
    status: 'pending_review',
  },
  {
    id: 'act-eligibility-quick-replies',
    priority: 'high',
    title: 'Configure AI Quick-Reply Templates for Eligibility Comments',
    rationale: 'Pre-answer age (21+), 10th pass, and retail kiosk requirements.',
    metric: `${commentSummary.needsResponse} pending queries`,
    metricNote: '4.2h current avg SLA',
    metricNoteTone: 'negative',
    impact: '-78% SLA Drop',
    target: { label: 'Comments Intelligence', to: '/comments' },
    insightId: 'ins-eligibility-response-delay',
    status: 'pending_review',
  },
  {
    id: 'act-rural-creative-refresh',
    priority: 'medium',
    title: "Refresh 'Rural Banking Access' Creative Copy & CTA Hook",
    rationale: 'Pivot from generic brand awareness to merchant commission calculators.',
    metric: `${rural.metrics?.engagementRate}% engagement`,
    metricNote: `${pctDelta(rural.metrics?.engagementRate ?? 0, benchmarkEng)} vs ${benchmarkEng}% norm`,
    impact: '+1.4% Eng Lift',
    target: { label: 'Campaigns', to: `/campaigns/${rural.id}` },
    insightId: 'ins-rural-banking-underperforming',
    status: 'reviewed',
  },
];
