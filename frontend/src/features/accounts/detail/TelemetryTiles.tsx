import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/format';
import type { TelemetryTile, TileTone } from '@/types/accounts';

const badgeCls: Record<TileTone, string> = {
  active: 'bg-status-active-subtle text-[#065F46] border-[#A7F3D0]',
  ai: 'bg-ai-subtle text-ai-accent border-ai-border',
  info: 'bg-status-completed-subtle text-status-completed border-[#BAE6FD]',
  warning: 'bg-status-paused-subtle text-[#92400E] border-[#FDE68A]',
  neutral: 'bg-surface-card-subtle text-text-secondary border-border-strong',
  error: 'bg-error-container/60 text-on-error-container border-error/20',
};

const dotCls: Partial<Record<TileTone, string>> = { active: 'bg-status-active', warning: 'bg-status-paused', error: 'bg-error' };

const footCls = { active: 'text-status-active', neutral: 'text-text-primary', error: 'text-error', warning: 'text-[#92400E]' } as const;

/** Four telemetry health cards (Media / Audience / Comments & NLP / API quota). */
export function TelemetryTiles({ tiles }: { tiles: TelemetryTile[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <div key={t.key} className="bg-surface-card border border-border-strong rounded-lg p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-2">
            <span className="font-label-md text-label-md font-semibold text-text-secondary">{t.label}</span>
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold border whitespace-nowrap', badgeCls[t.badge.tone])}>
              {t.badge.icon ? <Icon name={t.badge.icon} className="text-[12px]" /> : dotCls[t.badge.tone] && <span className={cn('w-1.5 h-1.5 rounded-full', dotCls[t.badge.tone])} />}
              {t.badge.label}
            </span>
          </div>
          <div className="my-3">
            <div className="font-metric-stat-lg text-metric-stat-lg text-text-primary tnum">{t.value}</div>
            <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">{t.caption}</p>
          </div>
          {t.progress !== undefined ? (
            <div
              className="w-full bg-surface-canvas rounded-full h-1.5 overflow-hidden border border-border-strong"
              role="progressbar"
              aria-valuenow={t.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t.label}
            >
              <div className="bg-primary-container h-full rounded-full" style={{ width: `${t.progress}%` }} />
            </div>
          ) : (
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-2 text-[11px] text-text-tertiary">
              <span>{t.footLabel}</span>
              <span className={cn('font-semibold tnum text-right', footCls[t.footTone ?? 'neutral'])}>{t.footValue}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
