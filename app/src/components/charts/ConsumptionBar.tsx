// components/charts/ConsumptionBar.tsx
// Bar chart used for consumption/forecast comparisons (Predictions page).
// Matches the Figma reference's grid lines and hover tooltip, without
// adding recharts as a dependency. Replaces the old SimpleBarChart
// (SimpleCharts.tsx), which had no grid, no y-axis, and no interactivity.

import { useMemo, useState } from 'react';
import { useChartSize } from './useChartSize';

export type BarChartPoint = {
  label: string;
  value: number;
  color?: string;
};

type ConsumptionBarProps = {
  data: BarChartPoint[];
  height?: number;
  color?: string;
  valueSuffix?: string;
  valueFormatter?: (value: number) => string;
};

const PADDING = { top: 12, right: 16, bottom: 36, left: 44 };
const GRID_LINES = 4;

export function ConsumptionBar({
  data,
  height = 260,
  color = 'var(--accent-primary)',
  valueSuffix = '',
  valueFormatter,
}: ConsumptionBarProps) {
  const { ref, width } = useChartSize<HTMLDivElement>(560);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const formatValue = valueFormatter ?? ((v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${valueSuffix}`);

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  if (!data.length) {
    return <div className="text-muted small">No data available</div>;
  }

  const gridTicks = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
    const value = (maxValue * i) / GRID_LINES;
    const y = PADDING.top + chartHeight - (i / GRID_LINES) * chartHeight;
    return { value, y };
  });

  const slotWidth = chartWidth / data.length;
  const barWidth = Math.max(Math.min(slotWidth - 12, 48), 4);

  const bars = data.map((point, index) => {
    const barHeight = (point.value / maxValue) * chartHeight;
    const x = PADDING.left + index * slotWidth + (slotWidth - barWidth) / 2;
    const y = PADDING.top + chartHeight - barHeight;
    return { ...point, x, y, barHeight, centerX: x + barWidth / 2 };
  });

  // Truncate long labels so they don't overlap each other
  const maxLabelChars = Math.max(4, Math.floor((slotWidth / 6)));
  const truncate = (label: string) =>
    label.length > maxLabelChars ? `${label.slice(0, maxLabelChars - 1)}…` : label;

  const hovered = hoverIndex !== null ? bars[hoverIndex] : null;

  return (
    <div ref={ref} style={{ width: '100%', height, position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="Bar chart">
        {/* Gridlines + y-axis labels */}
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
            <text
              x={PADDING.left - 8}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              fill="var(--text-muted)"
            >
              {formatValue(tick.value)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {bars.map((bar, index) => (
          <g
            key={`${bar.label}-${index}`}
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
          >
            {/* Wider invisible hit-area for easier hovering */}
            <rect x={PADDING.left + index * slotWidth} y={PADDING.top} width={slotWidth} height={chartHeight} fill="transparent" />
            <rect
              x={bar.x}
              y={bar.y}
              width={barWidth}
              height={Math.max(bar.barHeight, 1)}
              rx={4}
              fill={bar.color || color}
              opacity={hoverIndex === null || hoverIndex === index ? 1 : 0.55}
              style={{ transition: 'opacity 0.15s ease' }}
            />
            <text x={bar.centerX} y={height - 12} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
              {truncate(bar.label)}
            </text>
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max((hovered.centerX / width) * 100, 12), 88) + '%',
            top: Math.max((hovered.y / height) * 100 - 6, 2) + '%',
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            padding: '4px 8px',
            fontSize: '0.75rem',
            color: 'var(--text-primary)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{hovered.label}</div>
          <strong>{formatValue(hovered.value)}</strong>
        </div>
      )}
    </div>
  );
}
