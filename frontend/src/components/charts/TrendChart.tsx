import { useId } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompact } from '@/lib/format';
import type { TrendPoint } from '@/types/domain';

/**
 * Current vs previous period chart used on Dashboard / Campaign Detail / Content Library:
 * solid amber area for the current period, dashed slate line for the baseline.
 */
export function TrendChart({
  data,
  height = 280,
  valueFormatter = (v: number) => formatCompact(v),
  currentLabel = 'Current period',
  previousLabel = 'Previous period',
  showPrevious = true,
  color = '#F5A623',
  showYAxis = false,
}: {
  data: TrendPoint[];
  height?: number;
  valueFormatter?: (v: number) => string;
  currentLabel?: string;
  previousLabel?: string;
  showPrevious?: boolean;
  color?: string;
  showYAxis?: boolean;
}) {
  const gradientId = useId().replace(/:/g, '');
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: showYAxis ? 0 : 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} interval={4} dy={8} padding={{ left: 14, right: 14 }} />
          <YAxis hide={!showYAxis} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={valueFormatter} width={48} />
          <Tooltip
            cursor={{ stroke: '#CBD5E1', strokeDasharray: '3 3' }}
            contentStyle={{ borderRadius: 6, border: '1px solid #CBD5E1', boxShadow: '0 4px 16px -2px rgba(15,23,42,0.08)', fontSize: 12 }}
            labelStyle={{ color: '#0F172A', fontWeight: 600 }}
            formatter={(value: number, name: string) => [valueFormatter(value), name === 'current' ? currentLabel : previousLabel]}
          />
          {showPrevious && <Line type="monotone" dataKey="previous" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={{ r: 3 }} />}
          <Area type="monotone" dataKey="current" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-[12px] text-text-primary font-medium">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-2">
          <span className="w-4 h-0 border-t-2" style={{ borderColor: i.color, borderStyle: i.dashed ? 'dashed' : 'solid' }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
