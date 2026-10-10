import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { Notice } from '@/components/ui/Misc';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useMutation } from '@/hooks/useMutation';
import { useQuery } from '@/hooks/useQuery';
import { cn, formatNumber } from '@/lib/format';
import { accountService } from '@/services/accounts';
import { campaignService, type NewCampaignInput } from '@/services/campaigns';
import { AccountFields, AudienceFields, BasicsFields } from './CampaignFormFields';
import {
  campaignDurationLabel,
  emptyCampaignForm,
  optionalNumber,
  parseHashtags,
  validateCampaignForm,
  type CampaignFormErrors,
  type CampaignFormValues,
} from './campaignUtils';

const STEPS = [
  { tab: '1. Basics', title: 'Campaign Basics' },
  { tab: '2. Account', title: 'Account & Tracking' },
  { tab: '3. Audience', title: 'Audience Targeting' },
  { tab: '4. Review', title: 'Review & Save' },
];

const STEP1_FIELDS: Array<keyof CampaignFormValues> = ['name', 'startDate', 'endDate', 'budget', 'leadGoal'];

/** Global "New Campaign" wizard (sidebar / dashboard / campaigns page). State resets every time it closes. */
export function CreateCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <CampaignWizard onClose={onClose} /> : null;
}

function CampaignWizard({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const accountsQ = useQuery('accounts:list', accountService.list);
  const accounts = accountsQ.data ?? [];
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<CampaignFormValues>(() => emptyCampaignForm());
  const [errors, setErrors] = useState<CampaignFormErrors>({});

  // Default to the first connected account once accounts load.
  useEffect(() => {
    if (values.accountId || accounts.length === 0) return;
    const first = accounts.find((a) => a.status === 'connected');
    if (first) setValues((v) => ({ ...v, accountId: first.id }));
  }, [accounts, values.accountId]);

  const create = useMutation((input: NewCampaignInput) => campaignService.create(input), { invalidate: ['campaigns'] });

  const onChange = (patch: Partial<CampaignFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch) as Array<keyof CampaignFormValues>) delete next[k];
      return next;
    });
  };

  const validateStep = (s: number) => {
    const all = validateCampaignForm(values, { requireAccount: s >= 2 });
    const relevant: CampaignFormErrors = {};
    if (s === 1) STEP1_FIELDS.forEach((k) => all[k] && (relevant[k] = all[k]));
    if (s === 2 && all.accountId) relevant.accountId = all.accountId;
    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  };

  const next = () => validateStep(step) && setStep((s) => Math.min(STEPS.length, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const save = async (status: NewCampaignInput['status']) => {
    const errs = validateCampaignForm(values, { requireDates: status === 'scheduled', requireAccount: true });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setStep(errs.accountId && !STEP1_FIELDS.some((k) => errs[k]) ? 2 : 1);
      return;
    }
    const created = await create.mutate({
      name: values.name.trim(),
      objective: values.objective,
      startDate: values.startDate,
      endDate: values.endDate,
      accountId: values.accountId,
      targetRegions: values.targetRegions,
      hashtags: parseHashtags(values.hashtags),
      budgetInr: optionalNumber(values.budget),
      leadGoal: optionalNumber(values.leadGoal),
      primaryAgeGroup: values.primaryAgeGroup || undefined,
      status,
    });
    if (!created) {
      toast({ tone: 'error', title: 'Could not save the campaign', description: 'Please try again.' });
      return;
    }
    toast({
      tone: 'demo',
      title: status === 'draft' ? `Draft "${created.name}" saved` : `"${created.name}" scheduled`,
      description: 'Saved in InstaBoard only — nothing was created or published on Instagram.',
    });
    onClose();
    navigate(`/campaigns/${created.id}`);
  };

  const account = accounts.find((a) => a.id === values.accountId);
  const tags = parseHashtags(values.hashtags);

  const footer = (
    <div className="w-full flex items-center justify-between gap-2 flex-wrap">
      <Button size="sm" onClick={back} disabled={step === 1 || create.isPending}>
        Back
      </Button>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onClose} disabled={create.isPending}>
          Cancel
        </Button>
        {step < STEPS.length ? (
          <Button size="sm" variant="primary" onClick={next}>
            Next Step →
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => save('draft')} loading={create.isPending} icon="draft">
              Save as Draft
            </Button>
            <Button size="sm" variant="primary" onClick={() => save('scheduled')} loading={create.isPending} icon="event">
              Schedule Campaign
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} size="lg" title="Create New Instagram Campaign" subtitle={`Step ${step} of ${STEPS.length}: ${STEPS[step - 1].title}`} footer={footer}>
      <ol className="grid grid-cols-4 border-b border-border-strong text-center text-[11px] font-semibold -mx-5 -mt-4 mb-5" aria-label="Wizard progress">
        {STEPS.map((s, i) => {
          const n = i + 1;
          return (
            <li
              key={s.tab}
              aria-current={n === step ? 'step' : undefined}
              className={cn(
                'py-2',
                n < step && 'bg-emerald-50 text-status-active font-bold border-b-2 border-emerald-500',
                n === step && 'bg-amber-50 text-text-primary font-bold border-b-2 border-primary-container',
                n > step && 'text-text-tertiary',
              )}
            >
              {s.tab}
            </li>
          );
        })}
      </ol>

      {step === 1 && <BasicsFields values={values} errors={errors} onChange={onChange} autoFocus />}

      {step === 2 &&
        (accountsQ.status === 'loading' ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="space-y-4">
            <AccountFields values={values} errors={errors} onChange={onChange} accounts={accounts} />
            <Notice tone="demo" title="Linking content">
              Reels and posts are attributed to this campaign once they use its tracking hashtags. Attaching existing Instagram media needs the Instagram backend, which
              this prototype does not have.
            </Notice>
          </div>
        ))}

      {step === 3 && <AudienceFields values={values} onChange={onChange} />}

      {step === 4 && (
        <div className="space-y-3">
          <dl className="p-3.5 rounded bg-surface-canvas border border-border-strong space-y-2 text-[12px]">
            <ReviewRow label="Campaign">{values.name.trim()}</ReviewRow>
            <ReviewRow label="Objective">{values.objective}</ReviewRow>
            <ReviewRow label="Dates">{values.startDate || values.endDate ? campaignDurationLabel({ startDate: values.startDate || null, endDate: values.endDate || null }) : 'Not set (required to schedule)'}</ReviewRow>
            <ReviewRow label="Account">{account ? `${account.displayName} (@${account.handle})` : '—'}</ReviewRow>
            <ReviewRow label="Target States">{values.targetRegions.length ? values.targetRegions.join(', ') : 'All regions'}</ReviewRow>
            <ReviewRow label="Age Demographic">{values.primaryAgeGroup || 'Not specified'}</ReviewRow>
            <ReviewRow label="Hashtags">{tags.length ? tags.join(' ') : 'None'}</ReviewRow>
            <ReviewRow label="Budget">{values.budget ? `₹${formatNumber(Number(values.budget))}` : 'Not set'}</ReviewRow>
            <ReviewRow label="Target Lead Goal" highlight>
              {values.leadGoal ? `${formatNumber(Number(values.leadGoal))} leads` : 'Not set'}
            </ReviewRow>
          </dl>
          <Notice tone="demo" title="Saved in InstaBoard only">
            Save as Draft or Schedule stores this campaign in the prototype. Nothing is created or published on Instagram and no comment monitoring is started.
          </Notice>
        </div>
      )}
    </Modal>
  );
}

function ReviewRow({ label, children, highlight }: { label: string; children: ReactNode; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-secondary shrink-0">{label}:</dt>
      <dd className={cn('font-bold text-right min-w-0 break-words', highlight ? 'text-primary' : 'text-text-primary')}>{children}</dd>
    </div>
  );
}
