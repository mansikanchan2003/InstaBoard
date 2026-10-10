import { useId, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SegmentedControl } from '@/components/ui/Controls';
import { Notice } from '@/components/ui/Misc';
import { formatCompact, formatNumber } from '@/lib/format';
import type { AudiencePageData } from './model';

type Period = '7' | '30' | '90';
const periodOptions: Array<{ value: Period; label: string }> = [
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
];

/** Follower trajectory with 7/30-day views (subset of the 30-day demo series); 90 days isn't in the demo data. */
export function AudienceGrowthSection({ data, compare }: { data: AudiencePageData; compare: boolean }) {
  const [period, setPeriod] = useState<Period>('30');
  const gradientId = useId().replace(/:/g, '');
  const { intel, summary } = data;
  const full = intel.followerGrowth;
  const series = period === '7' ? full.slice(-7) : full;
  const startBefore = period === '7' ? full[full.length - 8].current : summary.followers - summary.netNewFollowers;
  const net = series[series.length - 1].current - startBefore;
  const perDay = net / series.length;
  const peak = series.find((p) => p.date === intel.growthPeak.date);
  const grossPerDay = Math.round(intel.kpis.newFollowersGross / full.length);

  return (
    <section className="bg-surface-card border border-border-strong rounded-lg p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-border-strong gap-3 mb-4">
        <div>
          <h3 className="font-headline-md text-headline-md text-text-primary font-bold">Audience Growth &amp; Follower Pacing</h3>
          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">Total follower trajectory against daily acquisition velocity</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedControl ariaLabel="Growth period" options={periodOptions} value={period} onChange={setPeriod} size="xs" />
          <div className="flex items-center gap-3 sm:border-l border-border-strong sm:pl-4">
            <div>
              <span className="text-[10px] text-text-secondary uppercase font-semibold">Total Followers</span>
              <div className="font-headline-sm text-headline-sm text-text-primary font-bold tnum">{formatCompact(summary.followers)}</div>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary uppercase font-semibold">{period === '7' ? 'Net (7 days)' : 'New Followers'}</span>
              <div className="font-headline-sm text-headline-sm text-primary font-bold tnum">
                +{formatNumber(period === '7' ? net : intel.kpis.newFollowersGross)}
              </div>
            </div>
          </div>
        </div>
      </div>
      {period === '90' && (
        <Notice tone="demo" className="mb-3" title="90-day history isn't in the demo dataset">
          Only October 2024 (30 days) of follower history is available, so the 30-day trajectory is shown below.
        </Notice>
      )}
      <div className="relative w-full h-56 bg-surface-canvas/50 border border-border-subtle rounded-md p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5a623" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: '#E2E8F0' }} tick={{ fill: '#64748B', fontSize: 10 }} interval={period === '7' ? 0 : 4} dy={6} />
            <YAxis
              domain={[(min: number) => Math.floor((min - 400) / 1000) * 1000, (max: number) => Math.ceil((max + 200) / 1000) * 1000]}
              tickFormatter={(v: number) => formatCompact(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94A3B8', fontSize: 10 }}
              width={44}
            />
            <Tooltip
              contentStyle={{ borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12 }}
              formatter={(v: number, name: string) => [formatNumber(v), name === 'current' ? 'October 2024' : 'September 2024 baseline']}
            />
            {compare && <Line type="monotone" dataKey="previous" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />}
            <Area type="monotone" dataKey="current" stroke="#f5a623" strokeWidth={3} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
            {peak && (
              <ReferenceDot
                x={peak.date}
                y={peak.current}
                r={5}
                fill="#f5a623"
                stroke="#fff"
                strokeWidth={2}
                label={{ value: intel.growthPeak.label, position: 'top', fill: '#855300', fontSize: 10, fontWeight: 700 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary mt-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-primary-container rounded" />
            <span className="text-text-primary font-medium">October 2024 (Actual Trajectory)</span>
          </span>
          {compare && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0 border-t border-dashed border-slate-400" />
              <span>September 2024 Baseline</span>
            </span>
          )}
        </div>
        <span className="text-status-active font-semibold">
          Net velocity +{perDay.toFixed(0)} followers/day · gross +{grossPerDay}/day
        </span>
      </div>
    </section>
  );
}
