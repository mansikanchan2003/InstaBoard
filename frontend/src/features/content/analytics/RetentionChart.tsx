import { useId } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WatchAnalytics } from '@/types/content';

/** Viewer retention curve (amber area) vs fintech benchmark (dashed), with the drop zone and hook/final markers. */
export function RetentionChart({ watch, durationSec }: { watch: WatchAnalytics; durationSec: number }) {
  const gradientId = useId().replace(/:/g, '');
  const points = watch.retention;
  const final = points[points.length - 1];
  const hook = watch.hookSecond !== undefined ? points.find((p) => p.second === watch.hookSecond) : undefined;
  const tickStep = durationSec <= 20 ? 2 : durationSec <= 40 ? 4 : 6;
  const ticks = Array.from({ length: Math.floor(durationSec / tickStep) + 1 }, (_, i) => i * tickStep);
  if (ticks[ticks.length - 1] !== durationSec) ticks.push(durationSec);

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 22, right: 16, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5a623" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#f5a623" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
          <XAxis
            dataKey="second"
            type="number"
            domain={[0, durationSec]}
            ticks={ticks}
            tickFormatter={(s: number) => `${s}s`}
            tickLine={false}
            axisLine={{ stroke: '#CBD5E1' }}
            tick={{ fill: '#64748B', fontSize: 10 }}
          />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} width={44} />
          {watch.dropZone && (
            <ReferenceArea
              x1={watch.dropZone.start}
              x2={watch.dropZone.end}
              fill="#ef4444"
              fillOpacity={0.08}
              stroke="#FCA5A5"
              strokeDasharray="2 2"
              label={{ value: watch.dropZone.label, position: 'insideTop', fill: '#B91C1C', fontSize: 9, fontWeight: 700 }}
            />
          )}
          <Tooltip
            cursor={{ stroke: '#CBD5E1', strokeDasharray: '3 3' }}
            contentStyle={{ borderRadius: 6, border: '1px solid #CBD5E1', boxShadow: '0 4px 16px -2px rgba(15,23,42,0.08)', fontSize: 12 }}
            labelFormatter={(s: number) => `At ${s}s`}
            formatter={(value: number, name: string) => [`${value}%`, name === 'retention' ? 'Audience retention' : 'Fintech benchmark']}
          />
          <Line type="monotone" dataKey="benchmark" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} />
          <Area
            type="monotone"
            dataKey="retention"
            stroke="#f5a623"
            strokeWidth={3}
            fill={`url(#${gradientId})`}
            dot={{ r: 3.5, fill: '#fff', stroke: '#f5a623', strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
          />
          {hook && (
            <ReferenceDot
              x={hook.second}
              y={hook.retention}
              r={5}
              fill="#10B981"
              stroke="#fff"
              strokeWidth={2}
              label={{ value: `${hook.retention}% Hook`, position: 'top', fill: '#065F46', fontSize: 10, fontWeight: 700 }}
            />
          )}
          <ReferenceDot
            x={final.second}
            y={final.retention}
            r={5}
            fill="#0284C7"
            stroke="#fff"
            strokeWidth={2}
            label={{ value: `${final.retention}% Final`, position: 'insideTopRight', fill: '#0369A1', fontSize: 10, fontWeight: 700, dy: -18 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
