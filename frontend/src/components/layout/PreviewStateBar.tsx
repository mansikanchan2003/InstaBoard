import { usePreviewState, type PreviewState } from '@/app/PreviewStateContext';
import { config } from '@/lib/config';
import { cn } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';

const OPTIONS: Array<{ value: PreviewState; label: string }> = [
  { value: 'normal', label: 'Normal Loaded' },
  { value: 'loading', label: 'Skeleton Shimmer' },
  { value: 'empty', label: 'Empty State' },
  { value: 'error', label: 'API Error' },
];

/** The export's "Interactive States" banner, kept as an explicit demo/review control. */
export function PreviewStateBar() {
  const { state, setState } = usePreviewState();
  return (
    <div className="mb-4 bg-surface-card border border-border-strong rounded-lg px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 text-label-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-text-primary flex items-center gap-1">
          <Icon name="toggle_on" className="text-[16px] text-primary-container" />
          Preview states:
        </span>
        <div className="flex items-center gap-1 flex-wrap" role="radiogroup" aria-label="Preview page state">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={state === o.value}
              onClick={() => setState(o.value)}
              className={cn(
                'px-2.5 py-0.5 rounded text-xs border',
                state === o.value ? 'font-semibold bg-surface-container-low text-text-primary border-primary-container' : 'font-medium text-text-secondary hover:bg-surface-canvas border-transparent',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="text-[11px] text-text-secondary flex items-center gap-1">
        <Icon name={config.dataSource === 'api' ? 'dns' : 'science'} className="text-[14px] text-ai-accent" />
        {config.dataSource === 'api'
          ? 'API mode · sample dataset served from PostgreSQL · live Instagram data appears only where labelled “Live · Instagram API”'
          : 'Prototype · demo data (Oct 2024) · no live Instagram connection'}
      </div>
    </div>
  );
}
