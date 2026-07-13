// components/charts/StackedBarChart.tsx
// Stacked bar chart for "Daily kWh by Category" on the Telemetry page,
// matching the Figma reference's recharts <BarChart stackId="a">
// behaviour. Dependency-free (no recharts), built on the same
// conventions as the other hand-rolled charts (useChartSize, CSS
// variable theming, hover tooltip).

import { useMemo, useState } from 'react';
import { useChartSize } from './useChartSize';

export type StackSeries = { key: string; label: string; color: string };
export type StackedBarPoint = { label: string; values: Record<string, number> };

type StackedBarChartProps = {
  data: StackedBarPoint[];
  series: StackSeries[];
  height?: number;
  valueSuffix?: string;
};

const PADDING = { top: 12, right: 16, bottom: 36, left: 44 };
const GRID_LINES = 4;

export function StackedBarChart({ data, series, height = 260, valueSuffix = '' }: StackedBarChartProps) {
  const { ref, width } = useChartSize<HTMLDivElement>(640);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const totals = useMemo(
    () => data.map((d) => series.reduce((sum, s) => sum + (d.values[s.key] || 0), 0)),
    [data, series]
  );
  const maxTotal = Math.max(...totals, 1);

  if (!data.length) {
    return <div className="text-muted small">No data available</div>;
  }

  const gridTicks = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
    const value = (maxTotal * i) / GRID_LINES;
    const y = PADDING.top + chartHeight - (i / GRID_LINES) * chartHeight;
    return { value, y };
  });

  const slotWidth = chartWidth / data.length;
  const barWidth = Math.max(Math.min(slotWidth - 14, 56), 6);

  const bars = data.map((point, index) => {
    const x = PADDING.left + index * slotWidth + (slotWidth - barWidth) / 2;
    let cursor = PADDING.top + chartHeight;
    const segments = series.map((s) => {
      const value = point.values[s.key] || 0;
      const segHeight = (value / maxTotal) * chartHeight;
      const y = cursor - segHeight;
      cursor = y;
      return { key: s.key, color: s.color, value, y, height: segHeight };
    });
    return { label: point.label, x, segments, centerX: x + barWidth / 2, total: totals[index] };
  });

  const maxLabelChars = Math.max(4, Math.floor(slotWidth / 7));
  const truncate = (label: string) =>
    label.length > maxLabelChars ? `${label.slice(0, maxLabelChars - 1)}…` : label;

  const hovered = hoverIndex !== null ? bars[hoverIndex] : null;

  return (
    <div ref={ref} style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Stacked bar chart">
        {gridTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              y1={tick.y}
              x2={width - PADDING.right}
              y2={tick.y}
              stroke="var(--bg-border)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <text x={PADDING.left - 8} y={tick.y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--text-muted)">
              {tick.value.toFixed(1)}
            </text>
          </g>
        ))}

        {bars.map((bar, index) => (
          <g
            key={`${bar.label}-${index}`}
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
          >
            <rect x={PADDING.left + index * slotWidth} y={PADDING.top} width={slotWidth} height={chartHeight} fill="transparent" />
            {bar.segments.map((seg) =>
              seg.height > 0 ? (
                <rect
                  key={seg.key}
                  x={bar.x}
                  y={seg.y}
                  width={barWidth}
                  height={Math.max(seg.height, 0.5)}
                  fill={seg.color}
                  opacity={hoverIndex === null || hoverIndex === index ? 1 : 0.45}
                  style={{ transition: 'opacity 0.15s ease' }}
                />
              ) : null
            )}
            <text x={bar.centerX} y={height - 12} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
              {truncate(bar.label)}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="d-flex flex-wrap gap-3 justify-content-center mt-2">
        {series.map((s) => (
          <div key={s.key} className="d-flex align-items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', backgroundColor: s.color }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max((hovered.centerX / width) * 100, 14), 86) + '%',
            top: 8,
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            padding: '8px 10px',
            fontSize: '0.75rem',
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: 4 }}>{hovered.label}</div>
          {hovered.segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div key={s.key} className="d-flex justify-content-between gap-3">
                <span className="d-flex align-items-center gap-1">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', backgroundColor: s.color }} />
                  {series.find((x) => x.key === s.key)?.label}
                </span>
                <strong>{s.value.toFixed(2)}{valueSuffix}</strong>
              </div>
            ))}
          <div className="d-flex justify-content-between gap-3 mt-1 pt-1" style={{ borderTop: '1px solid var(--bg-border)' }}>
            <span>Total</span>
            <strong>{hovered.total.toFixed(2)}{valueSuffix}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
