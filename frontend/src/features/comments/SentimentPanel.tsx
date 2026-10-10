import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { cn, formatNumber } from '@/lib/format';
import type { CommentSummary, SentimentTrendPoint } from '@/types/comments';
import { pct } from './commentMeta';

type Mode = 'volume' | 'share' | 'score';
type Range = '7d' | '30d';

const modeLabels: Record<Mode, string> = { volume: 'Volume', share: 'Share %', score: 'Score' };

/** Section 3 (left) of the export: sentiment spectrum + 30-day trajectory. */
export function SentimentPanel({ summary, trend, onDeepDive }: { summary: CommentSummary; trend: SentimentTrendPoint[] | undefined; onDeepDive: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('volume');
  const [range, setRange] = useState<Range>('30d');
  const { sentiment, totalComments: total } = summary;

  const data = useMemo(() => {
    const rows = (trend ?? []).slice(range === '7d' ? -7 : 0);
    if (mode !== 'share') return rows;
    return rows.map((r) => {
      const t = r.positive + r.neutral + r.negative || 1;
      const round = (v: number) => Math.round((v / t) * 1000) / 10;
      return { ...r, positive: round(r.positive), neutral: round(r.neutral), negative: round(r.negative) };
    });
  }, [trend, mode, range]);

  const fmt = (v: number) => (mode === 'volume' ? formatNumber(v) : mode === 'share' ? `${v}%` : `${v}/100`);
  const peak = useMemo(() => (trend ?? []).reduce<SentimentTrendPoint | undefined>((best, p) => (!best || p.positive > best.positive ? p : best), undefined), [trend]);

  const legend = [
    { key: 'positive', label: 'POSITIVE', value: sentiment.positive, box: 'bg-status-active-subtle', text: 'text-status-active', dot: 'bg-status-active' },
    { key: 'neutral', label: 'NEUTRAL', value: sentiment.neutral, box: 'bg-status-draft-subtle', text: 'text-text-secondary', dot: 'bg-status-draft' },
    { key: 'negative', label: 'NEGATIVE', value: sentiment.negative, box: 'bg-error-container/20', text: 'text-error', dot: 'bg-error' },
  ];

  return (
    <div className="lg:col-span-5 bg-surface-card border border-border-strong rounded p-4 flex flex-col justify-between min-w-0">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="text-headline-sm font-headline-sm text-text-primary">Sentiment Breakdown &amp; Trajectory</h2>
            <p className="text-body-sm font-body-sm text-text-secondary">Aggregated tonal analysis via NLP classifier</p>
          </div>
          <div role="tablist" aria-label="Chart measure" className="flex bg-surface-canvas p-0.5 rounded border border-border-strong text-label-code font-label-code">
            {(Object.keys(modeLabels) as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn('px-2 py-1 rounded', mode === m ? 'bg-surface-card text-text-primary font-bold shadow-xs' : 'text-text-secondary hover:text-text-primary font-semibold')}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="h-4 w-full rounded-full flex overflow-hidden mb-3" role="img" aria-label={`Positive ${pct(sentiment.positive, total)}, neutral ${pct(sentiment.neutral, total)}, negative ${pct(sentiment.negative, total)}`}>
          <div className="bg-status-active" style={{ width: pct(sentiment.positive, total) }} title={`Positive: ${pct(sentiment.positive, total)}`} />
          <div className="bg-status-draft" style={{ width: pct(sentiment.neutral, total) }} title={`Neutral: ${pct(sentiment.neutral, total)}`} />
          <div className="bg-error" style={{ width: pct(sentiment.negative, total) }} title={`Negative: ${pct(sentiment.negative, total)}`} />
        </div>
        <div className="grid grid-cols-3 gap-2 pb-4 border-b border-border-strong text-center">
          {legend.map((l) => (
            <div key={l.key} className={cn('p-2 rounded', l.box)}>
              <div className={cn('flex items-center justify-center gap-1.5 text-label-code font-label-code', l.text)}>
                <span className={cn('w-2 h-2 rounded-full', l.dot)} />
                <span>{l.label}</span>
              </div>
              <div className="text-headline-sm md:text-metric-stat-sm font-metric-stat-sm text-text-primary tnum font-bold mt-0.5">{formatNumber(l.value)}</div>
              <span className="text-label-sm font-label-sm text-text-secondary">{pct(l.value, total)} share</span>
            </div>
          ))}
        </div>
        <div className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-label-sm font-label-sm text-text-secondary font-medium">
              Trajectory ({range === '7d' ? 'Oct 25 - Oct 31' : 'Oct 1 - Oct 31'}, 2024)
            </span>
            <div className="flex gap-2 text-label-code font-label-code">
              {(['7d', '30d'] as Range[]).map((r) => (
                <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={range === r ? 'text-text-primary font-bold underline' : 'text-text-secondary hover:text-text-primary'}>
                  {r.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                onClick={() => toast({ tone: 'demo', title: '90-day history not in demo data', description: 'Only the Oct 1–31, 2024 reporting window is available in this prototype.' })}
                className="text-text-secondary hover:text-text-primary"
              >
                90D
              </button>
            </div>
          </div>
          {trend ? (
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sentiment-positive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} interval={range === '7d' ? 0 : 9} dy={4} />
                  <YAxis hide domain={mode === 'score' ? ['dataMin - 5', 'dataMax + 5'] : [0, 'auto']} />
                  <Tooltip
                    contentStyle={{ borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
                    labelStyle={{ color: '#0F172A', fontWeight: 600 }}
                    formatter={(value: number, name: string) => [fmt(value), name === 'score' ? 'Avg score' : name[0].toUpperCase() + name.slice(1)]}
                  />
                  {mode === 'score' ? (
                    <Area type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2.5} fill="url(#sentiment-positive)" dot={false} />
                  ) : (
                    <>
                      <Area type="monotone" dataKey="positive" stroke="#10B981" strokeWidth={2.5} fill="url(#sentiment-positive)" dot={false} />
                      <Line type="monotone" dataKey="neutral" stroke="#64748B" strokeWidth={1.8} strokeDasharray="4 2" dot={false} />
                      <Line type="monotone" dataKey="negative" stroke="#EF4444" strokeWidth={1.5} dot={false} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Skeleton className="h-36" />
          )}
        </div>
      </div>
      <div className="pt-3 border-t border-border-strong mt-3 flex items-center justify-between gap-2 text-label-sm font-label-sm text-text-secondary">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-status-active shrink-0" />
          {summary.peakNote}
          {peak && <span className="sr-only">Highest positive volume on {peak.date}.</span>}
        </span>
        <button type="button" onClick={onDeepDive} className="text-primary font-semibold hover:underline whitespace-nowrap">
          Deep Dive →
        </button>
      </div>
    </div>
  );
}
