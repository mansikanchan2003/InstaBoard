import { modeText } from '@/lib/config';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { AiCategory, AiSettings } from '@/types/settings';
import type { SectionProps } from './GeneralTab';
import { FieldError, inputCls, labelCls, SettingsCard, Switch } from './settingsUi';

const categories: Array<{ id: AiCategory; label: string; detail: string }> = [
  { id: 'campaignDiagnostics', label: 'Campaign Performance Diagnostics', detail: 'Identifies top-performing creative assets and flags underperforming CTR outliers.' },
  { id: 'fatigueAlerts', label: 'Content & Reel Fatigue Alerts', detail: 'Detects engagement decay when creative assets cross optimal exposure saturation.' },
  { id: 'sentiment', label: 'Comment Sentiment & Intent Classification', detail: 'Classifies inbound user remarks into Positive, Neutral, Inquiries, or Service Complaints.' },
  { id: 'leadAttribution', label: 'High-Intent Lead Attribution', detail: 'Scores comment queries exhibiting high partner agent onboarding intent.' },
];

export function AiTab({ s, update, errors }: SectionProps) {
  const ai = s.ai;
  return (
    <section className="flex flex-col gap-6">
      <SettingsCard>
        <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-border-strong">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline-sm text-headline-sm text-text-primary font-bold">InstaBoard Synthesis Engine v4.2</h2>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full font-label-code text-label-code border',
                  ai.enabled ? 'bg-ai-subtle text-ai-accent border-ai-border' : 'bg-surface-card-subtle text-text-secondary border-border-strong',
                )}
              >
                {ai.enabled ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-text-secondary mt-1">
              Governs algorithmic narrative generation, comment sentiment extraction, and automated lead score classification.
            </p>
          </div>
          <Switch size="md" tone="ai" label="AI synthesis engine" checked={ai.enabled} onChange={(v) => update((d) => void (d.ai.enabled = v))} />
        </div>

        <div className={cn('transition-opacity', !ai.enabled && 'opacity-60')}>
          <span className="font-label-sm text-label-sm font-bold text-text-primary block mb-3">Enabled AI Synthesis Categories:</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categories.map((c) => (
              <label key={c.id} className="flex items-start gap-3 p-3 rounded border border-border-strong bg-surface-canvas cursor-pointer hover:border-ai-border transition-colors">
                <input
                  type="checkbox"
                  disabled={!ai.enabled}
                  checked={ai.categories[c.id]}
                  onChange={(e) => update((d) => void (d.ai.categories[c.id] = e.target.checked))}
                  className="rounded text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
                />
                <div>
                  <span className="font-label-md text-label-md font-semibold text-text-primary">{c.label}</span>
                  <p className="text-xs text-text-secondary mt-0.5">{c.detail}</p>
                </div>
              </label>
            ))}
          </div>
          <FieldError message={errors['ai.categories']} />

          <div className="pt-4 mt-6 border-t border-border-strong grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div>
              <label htmlFor="ai-confidence" className={labelCls}>
                Minimum Confidence Threshold
              </label>
              <select
                id="ai-confidence"
                disabled={!ai.enabled}
                className={inputCls}
                value={ai.confidenceThreshold}
                onChange={(e) => update((d) => void (d.ai.confidenceThreshold = Number(e.target.value) as AiSettings['confidenceThreshold']))}
              >
                <option value={90}>90% - High Precision (Suppresses false positives)</option>
                <option value={80}>80% - Balanced Guidance</option>
                <option value={70}>70% - Exploratory Insights</option>
              </select>
              <span className="text-xs text-text-tertiary mt-1 block">Suppresses speculative narrative unless algorithmic confidence exceeds benchmark.</span>
            </div>
            <div>
              <label htmlFor="ai-sample" className={labelCls}>
                Minimum Analytical Sample Size
              </label>
              <select
                id="ai-sample"
                disabled={!ai.enabled}
                className={inputCls}
                value={ai.minSampleSize}
                onChange={(e) => update((d) => void (d.ai.minSampleSize = Number(e.target.value) as AiSettings['minSampleSize']))}
              >
                <option value={500}>n ≥ 500 interactions (Enterprise Recommended)</option>
                <option value={250}>n ≥ 250 interactions</option>
                <option value={1000}>n ≥ 1,000 interactions</option>
              </select>
              <span className="text-xs text-text-tertiary mt-1 block">Ensures statistical robustness prior to generating categorical recommendations.</span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded bg-ai-subtle border border-ai-border flex items-start gap-3">
          <Icon name="auto_awesome" className="text-ai-accent text-[22px]" />
          <div>
            <div className="font-label-md text-label-md font-bold text-ai-accent">Mandatory AI Transparency Disclosure</div>
            <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
              AI interpretations and predictions are always explicitly marked with{' '}
              <span className="font-label-code text-label-code bg-white text-indigo-900 px-1 border border-indigo-200">[AI-GENERATED]</span> or{' '}
              <span className="font-label-code text-label-code bg-white text-indigo-900 px-1 border border-indigo-200">[AI-ESTIMATED]</span> tags. InstaBoard algorithms do NOT infer
              real-world identities, biometric identities, or unverifiable metrics.
            </p>
          </div>
        </div>
        <p className="font-body-sm text-body-sm text-text-tertiary mt-3 italic">
          {modeText('In this prototype AI insights are pre-written sample content; these preferences are stored in memory only and no model is invoked. No credentials or API keys are exposed.', 'AI insights are pre-written sample content; these preferences are saved in the InstaBoard database but no model is invoked. No credentials or API keys are exposed.')}
        </p>
      </SettingsCard>
    </section>
  );
}
