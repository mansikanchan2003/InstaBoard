import { DemoBadge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Dropdown, MenuItem } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';

/** Section 1 of the export: page title, AI triage badge and action cluster. */
export function CommentsHeader({
  selectedCount,
  onBulkStatus,
  onExport,
  onStartTriage,
}: {
  selectedCount: number;
  onBulkStatus: (status: 'reviewed' | 'archived') => void;
  onExport: () => void;
  onStartTriage: () => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-border-strong gap-4">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-headline-md md:text-headline-lg font-headline-lg text-text-primary tracking-tight">Comments Intelligence</h1>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-code font-label-code bg-ai-subtle border border-ai-border text-ai-accent">
            <Icon name="auto_awesome" className="text-[13px]" />• AI TRIAGE ACTIVE
          </span>
          <DemoBadge label="Demo feed" />
        </div>
        <p className="text-body-md font-body-md text-text-secondary mt-0.5">
          Understand audience sentiment, intent and lead opportunities across your Instagram campaigns.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Dropdown
          label="Batch triage and export"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="h-9 px-3.5 rounded bg-surface-card border border-border-strong hover:bg-surface-canvas text-text-primary text-label-md font-label-md font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Icon name="rule" />
              <span>Batch Triage &amp; Export</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-3 py-1.5 text-label-code font-label-code text-text-tertiary uppercase">
                {selectedCount > 0 ? `${selectedCount} selected` : 'Select rows in the table first'}
              </div>
              {selectedCount > 0 && (
                <>
                  <MenuItem icon="done_all" onClick={() => (close(), onBulkStatus('reviewed'))}>
                    Mark selected as reviewed
                  </MenuItem>
                  <MenuItem icon="archive" onClick={() => (close(), onBulkStatus('archived'))}>
                    Archive selected
                  </MenuItem>
                </>
              )}
              <MenuItem icon="play_arrow" onClick={() => (close(), onStartTriage())}>
                Start fast triage mode
              </MenuItem>
              <MenuItem icon="file_download" onClick={() => (close(), onExport())}>
                Export filtered sample (CSV)
              </MenuItem>
            </>
          )}
        </Dropdown>
        <LinkButton to="/leads" variant="primary" size="md" iconRight="arrow_forward" className="h-9 rounded">
          View Leads
        </LinkButton>
      </div>
    </div>
  );
}
