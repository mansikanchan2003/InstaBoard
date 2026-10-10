import { useEffect, useRef, useState } from 'react';
import { DemoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { ErrorState, QueryState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useQuery';
import { cn } from '@/lib/format';
import { accountDetailService } from '@/services/accountDetails';
import { META_DOCS_URL } from '../AccountsOverview';
import { connectSteps, initialConnectState, type ConnectFormState, type ConnectStep } from './connectState';
import { StepAuthorization, StepRequirements } from './ConnectStepsEarly';
import { ConnectDone, isSelectableCandidate, StepConfirm, StepScopes } from './ConnectStepsLate';

function Stepper({ current, done }: { current: ConnectStep; done: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  // The modal body is the scroll container: return to the top whenever the step changes.
  useEffect(() => {
    if (ref.current?.parentElement) ref.current.parentElement.scrollTop = 0;
  }, [current, done]);
  return (
    <ol ref={ref} className="sticky -top-4 z-10 -mx-5 -mt-4 mb-5 px-5 md:px-8 py-3 bg-surface-canvas border-b border-border-strong flex items-center justify-between gap-2" aria-label="Progress">
      {connectSteps.map(({ step, label }, i) => {
        const complete = done || step < current;
        const active = !done && step === current;
        return (
          <li key={step} className={cn('flex items-center', i < connectSteps.length - 1 && 'flex-1')} aria-current={active ? 'step' : undefined}>
            <div className={cn('flex items-center gap-2.5', !complete && !active && 'opacity-60')}>
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                  complete && 'bg-status-active text-white shadow-sm',
                  active && 'bg-primary-container text-text-primary ring-2 ring-primary-container/40 ring-offset-2',
                  !complete && !active && 'bg-surface-container border border-border-strong text-text-secondary',
                )}
              >
                {complete ? <Icon name="check" className="text-base font-bold" /> : step}
              </div>
              <div className={cn(active ? 'block' : 'hidden lg:block')}>
                <p className={cn('text-label-sm font-label-sm leading-tight whitespace-nowrap', active || complete ? 'font-bold text-text-primary' : 'font-medium text-text-secondary')}>
                  Step {step}: {label}
                </p>
                <p className={cn('text-label-code font-label-code', complete ? 'text-status-active' : active ? 'text-primary font-bold uppercase tracking-wider' : 'text-text-tertiary')}>
                  {complete ? 'Completed' : active ? 'Active Flow' : 'Upcoming'}
                </p>
              </div>
            </div>
            {i < connectSteps.length - 1 && <div className={cn('flex-1 h-0.5 mx-3 min-w-[12px]', complete ? 'bg-status-active' : 'bg-border-strong')} />}
          </li>
        );
      })}
    </ol>
  );
}

const nextLabel: Record<ConnectStep, string> = {
  1: 'Continue to Meta Authorization',
  2: 'Review Scopes & Continue',
  3: 'Continue to Confirmation',
  4: 'Finish Demo Walkthrough',
};

/**
 * Multi-step "Connect Instagram Professional Account" flow. Meta OAuth is NOT performed:
 * the authorization step explains that and offers a clearly-labelled demo walkthrough instead.
 */
export function ConnectFlowModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const reference = useQuery('accounts:connect-reference', accountDetailService.connectReference);
  const [step, setStep] = useState<ConnectStep>(1);
  const [done, setDone] = useState(false);
  const [state, setState] = useState<ConnectFormState>(initialConnectState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const patch = (p: Partial<ConnectFormState>) => {
    setState((s) => ({ ...s, ...p }));
    setErrors({});
  };

  const ref = reference.data;
  const candidate = ref?.candidates.find((c) => c.id === state.candidateId);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!ref) return e;
    if (step === 1) {
      if (!state.accountType) e.accountType = 'Select whether this is a Business or Creator account.';
      if (state.prerequisites.length < ref.prerequisites.length) e.prerequisites = 'Confirm all three prerequisites to continue.';
    }
    if (step === 2 && !state.demoMode) {
      e.auth = state.authAttempted
        ? 'Meta authorization isn’t available here — choose “Continue with demo account” to explore the remaining steps.'
        : 'Start Meta Business Login first (B).';
    }
    if (step === 3) {
      if (!state.candidateId) e.candidate = 'Select a sample account to continue.';
      else if (!isSelectableCandidate(candidate)) e.candidate = 'This sample account can’t be connected — pick an eligible account.';
      if (!state.scopesAcknowledged) e.ack = 'Please acknowledge the requested scopes.';
    }
    return e;
  };

  const next = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < 4) {
      setStep((s) => (s + 1) as ConnectStep);
      return;
    }
    setDone(true);
    toast({ tone: 'demo', title: 'Demo walkthrough complete', description: 'No Instagram account was connected — Meta authorization isn’t available in this prototype.' });
  };

  const restart = () => {
    setState(initialConnectState);
    setErrors({});
    setStep(1);
    setDone(false);
  };

  const footer = (
    <>
      <p className="text-label-sm font-label-sm text-text-secondary mr-auto max-w-md hidden sm:block">
        {done ? 'Prototype only — no tokens were created.' : 'You can revoke access or disconnect an account at any time from InstaBoard or Meta Business Integrations.'}
      </p>
      {done ? (
        <>
          <Button size="md" icon="restart_alt" onClick={restart}>
            Restart walkthrough
          </Button>
          <a href={META_DOCS_URL} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex items-center gap-1 h-9 px-3 text-label-md font-semibold text-ai-accent hover:underline">
            Meta API Docs <Icon name="arrow_outward" className="text-[14px]" />
          </a>
          <Button size="md" variant="primary" icon="arrow_back" onClick={onClose}>
            Back to Instagram Accounts
          </Button>
        </>
      ) : (
        <>
          <Button size="md" onClick={step === 1 ? onClose : () => (setErrors({}), setStep((s) => (s - 1) as ConnectStep))}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button size="md" variant="primary" iconRight="arrow_forward" onClick={next} disabled={!ref}>
            {nextLabel[step]}
          </Button>
        </>
      )}
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      className="max-w-4xl"
      icon="photo_camera"
      title={
        <span className="flex items-center gap-2 flex-wrap">
          Connect Instagram Professional Account
          <span className="text-label-code font-label-code uppercase tracking-wider px-2 py-0.5 rounded-full bg-ai-subtle border border-ai-border text-ai-accent">Meta Graph API v19.0</span>
          <DemoBadge label="Prototype" />
        </span>
      }
      subtitle="Authorize Meta Graph API access to synchronize campaign telemetry, audience demographics, and comments."
      footer={footer}
    >
      <Stepper current={step} done={done} />
      <QueryState
        query={reference}
        loading={
          <div className="space-y-4" role="status" aria-label="Loading">
            <Skeleton className="h-14" />
            <Skeleton className="h-32" />
            <Skeleton className="h-40" />
          </div>
        }
        error={(err, retry) => <ErrorState title="Unable to load connect requirements" error={err} onRetry={retry} />}
        empty={<ErrorState title="Connect requirements unavailable" />}
      >
        {(data) =>
          done ? (
            <ConnectDone state={state} candidate={candidate} />
          ) : step === 1 ? (
            <StepRequirements state={state} patch={patch} prerequisites={data.prerequisites} errors={errors} />
          ) : step === 2 ? (
            <StepAuthorization state={state} patch={patch} prerequisites={data.prerequisites} scopes={data.scopes} error={errors.auth} />
          ) : step === 3 ? (
            <StepScopes state={state} patch={patch} candidates={data.candidates} scopes={data.scopes} errors={errors} />
          ) : (
            <StepConfirm state={state} patch={patch} candidate={candidate} scopes={data.scopes} />
          )
        }
      </QueryState>
    </Modal>
  );
}
