import { Button } from '@/components/ui/Button';
import type { Campaign } from '@/types/domain';

/** Bulk actions for selected rows (pause / resume in InstaBoard only, CSV export of demo data). */
export function CampaignsBulkBar({
  selected,
  pending,
  onPause,
  onResume,
  onExport,
  onClear,
}: {
  selected: Campaign[];
  pending: boolean;
  onPause: () => void;
  onResume: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  const canPause = selected.some((c) => c.status === 'active');
  const canResume = selected.some((c) => c.status === 'paused');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-50/60 border border-primary-container/40" role="region" aria-label="Bulk actions">
      <span className="text-label-md text-text-primary font-semibold tnum">
        {selected.length} campaign{selected.length === 1 ? '' : 's'} selected
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" icon="pause" onClick={onPause} disabled={!canPause || pending} title={canPause ? undefined : 'No active campaigns selected'}>
          Pause
        </Button>
        <Button size="xs" icon="play_arrow" onClick={onResume} disabled={!canResume || pending} title={canResume ? undefined : 'No paused campaigns selected'}>
          Resume
        </Button>
        <Button size="xs" icon="file_download" onClick={onExport}>
          Export CSV
        </Button>
        <Button size="xs" variant="ghost" icon="close" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
