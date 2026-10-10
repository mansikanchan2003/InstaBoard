import { Icon } from '@/components/ui/Icon';
import { formatDelta } from '@/lib/format';
import type { ReportContext } from '@/types/reports';

/** "AI Report Synthesis Ready" banner — the observation is derived from the canonical account overview. */
export function ReportsAiBanner({ ctx, onDraft }: { ctx: ReportContext; onDraft: () => void }) {
  const watchDelta = ctx.overview.watchTimeHours.delta ?? 0;
  return (
    <section className="bg-ai-subtle border border-ai-border rounded p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-white border border-ai-border text-ai-accent shadow-xs">
          <Icon name="auto_awesome" className="text-[24px]" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-headline-sm text-headline-sm font-bold text-text-primary">AI Report Synthesis Ready</span>
            <span className="font-label-code text-label-code px-2 py-0.5 rounded bg-white text-ai-accent border border-ai-border font-bold">AI-INFERRED</span>
          </div>
          <p className="font-body-md text-body-md text-text-secondary mt-0.5">
            InstaBoard AI observed a {formatDelta(watchDelta)} rise in Reel watch time versus September. Generate an executive brief summarizing Hindi-language campaign conversions.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDraft}
        className="whitespace-nowrap px-3.5 py-1.5 rounded bg-white hover:bg-surface-canvas border border-ai-border text-text-primary font-label-md text-label-md font-bold shadow-xs"
      >
        Draft AI Brief
      </button>
    </section>
  );
}
