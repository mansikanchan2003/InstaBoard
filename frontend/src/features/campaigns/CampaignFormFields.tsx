import { useId } from 'react';
import { Field, Select, TextInput } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { InstagramAccount } from '@/types/domain';
import { AGE_GROUP_OPTIONS, OBJECTIVES, parseHashtags, REGION_OPTIONS, type CampaignFormErrors, type CampaignFormValues } from './campaignUtils';

interface FieldsProps {
  values: CampaignFormValues;
  errors: CampaignFormErrors;
  onChange: (patch: Partial<CampaignFormValues>) => void;
}

/** Wizard step 1 / edit form: name, objective, lead goal, dates, budget. */
export function BasicsFields({ values, errors, onChange, autoFocus }: FieldsProps & { autoFocus?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-4">
      <Field label="Campaign Title" required htmlFor={`${id}-name`} error={errors.name}>
        <TextInput
          id={`${id}-name`}
          value={values.name}
          invalid={!!errors.name}
          data-autofocus={autoFocus || undefined}
          placeholder="e.g. Bihar CSP Onboarding Blitz - Nov 2024"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Objective" htmlFor={`${id}-objective`}>
          <Select id={`${id}-objective`} value={values.objective} onChange={(e) => onChange({ objective: e.target.value as CampaignFormValues['objective'] })} className="w-full">
            {OBJECTIVES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target Lead Goal" htmlFor={`${id}-goal`} error={errors.leadGoal} hint="Optional">
          <TextInput id={`${id}-goal`} inputMode="numeric" value={values.leadGoal} invalid={!!errors.leadGoal} placeholder="300" onChange={(e) => onChange({ leadGoal: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Start Date" htmlFor={`${id}-start`} error={errors.startDate}>
          <TextInput id={`${id}-start`} type="date" value={values.startDate} invalid={!!errors.startDate} onChange={(e) => onChange({ startDate: e.target.value })} />
        </Field>
        <Field label="End Date" htmlFor={`${id}-end`} error={errors.endDate}>
          <TextInput id={`${id}-end`} type="date" value={values.endDate} min={values.startDate || undefined} invalid={!!errors.endDate} onChange={(e) => onChange({ endDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Budget (₹)" htmlFor={`${id}-budget`} error={errors.budget} hint="Optional — used for planning only; no ad spend is configured on Instagram.">
        <TextInput id={`${id}-budget`} inputMode="numeric" value={values.budget} invalid={!!errors.budget} placeholder="250000" onChange={(e) => onChange({ budget: e.target.value })} />
      </Field>
    </div>
  );
}

/** Wizard step 2 / edit form: Instagram account (connected only) + tracking hashtags. */
export function AccountFields({ values, errors, onChange, accounts }: FieldsProps & { accounts: InstagramAccount[] }) {
  const id = useId();
  const tags = parseHashtags(values.hashtags);
  return (
    <div className="space-y-4">
      <Field label="Instagram Account" required htmlFor={`${id}-acc`} error={errors.accountId} hint="Only connected accounts can be used for new campaigns.">
        <Select id={`${id}-acc`} value={values.accountId} onChange={(e) => onChange({ accountId: e.target.value })} className={cn('w-full', errors.accountId && 'border-error')}>
          <option value="">Select an account…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} disabled={a.status !== 'connected'}>
              {a.displayName} (@{a.handle}){a.status !== 'connected' ? ' — not connected' : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tracking Hashtags" htmlFor={`${id}-tags`} hint="Separate with spaces or commas, e.g. #SBICSP #EkoIndia">
        <TextInput id={`${id}-tags`} value={values.hashtags} placeholder="#SBICSP #EkoIndia" onChange={(e) => onChange({ hashtags: e.target.value })} />
      </Field>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Parsed hashtags">
          {tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded bg-surface-card-subtle border border-border-strong text-[11px] font-semibold text-text-secondary">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Wizard step 3 / edit form: target states + primary age demographic. */
export function AudienceFields({ values, onChange }: Omit<FieldsProps, 'errors'>) {
  const id = useId();
  const toggle = (region: string) =>
    onChange({ targetRegions: values.targetRegions.includes(region) ? values.targetRegions.filter((r) => r !== region) : [...values.targetRegions, region] });
  return (
    <div className="space-y-4">
      <div>
        <span className="text-label-sm text-text-primary font-semibold block mb-1.5" id={`${id}-regions`}>
          Target States
        </span>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-regions`}>
          {REGION_OPTIONS.map((r) => {
            const on = values.targetRegions.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(r)}
                className={cn(
                  'px-2.5 py-1 rounded text-[12px] flex items-center gap-1 transition-colors',
                  on ? 'bg-amber-100 text-on-primary-container font-semibold' : 'bg-surface-canvas border border-border-strong text-text-secondary hover:text-text-primary',
                )}
              >
                {r}
                <Icon name={on ? 'close' : 'add'} className="text-[14px]" />
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-text-tertiary mt-1.5">{values.targetRegions.length === 0 ? 'No states selected — campaign will target all regions.' : `${values.targetRegions.length} selected`}</p>
      </div>
      <Field label="Primary Age Demographic" htmlFor={`${id}-age`}>
        <Select id={`${id}-age`} value={values.primaryAgeGroup} onChange={(e) => onChange({ primaryAgeGroup: e.target.value })} className="w-full">
          <option value="">Not specified</option>
          {AGE_GROUP_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
