// components/charts/PowerLineChart.tsx
// Line / area chart used for live power and consumption trend views
// (Dashboard, Telemetry). Matches the Figma reference's grid lines,
// gradient fill, and hover tooltip, without adding recharts as a
// dependency. Replaces the old SimpleLineChart (SimpleCharts.tsx),
// which had no grid, no ticks, and no interactivity.

import { useId, useMemo, useState } from 'react';
import { useChartSize } from './useChartSize';

export type LineChartPoint = {
  label: string;
  value: number;
};

type PowerLineChartProps = {
  data: LineChartPoint[];
  color?: string;
  fillColor?: string;
  height?: number;
  valueSuffix?: string;
  valueFormatter?: (value: number) => string;
};

const PADDING = { top: 12, right: 16, bottom: 28, left: 44 };
const GRID_LINES = 4;

export function PowerLineChart({
  data,
  color = 'var(--accent-primary)',
  fillColor,
  height = 240,
  valueSuffix = '',
  valueFormatter,
}: PowerLineChartProps) {
  const gradientId = useId();
  const { ref, width } = useChartSize<HTMLDivElement>(560);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const formatValue = valueFormatter ?? ((v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}${valueSuffix}`);

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const { points, maxValue, minValue } = useMemo(() => {
    if (!data.length) return { points: [] as Array<LineChartPoint & { x: number; y: number }>, maxValue: 0, minValue: 0 };

    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const pts = data.map((point, index) => {
      const x = PADDING.left + (data.length === 1 ? 0 : (index / (data.length - 1)) * chartWidth);
      const y = PADDING.top + chartHeight - ((point.value - min) / range) * chartHeight;
      return { ...point, x, y };
    });

    return { points: pts, maxValue: max, minValue: min };
  }, [data, chartWidth, chartHeight]);

  if (!data.length) {
    return <div className="text-muted small">No data available</div>;
  }

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - PADDING.bottom} L ${points[0].x.toFixed(2)} ${height - PADDING.bottom} Z`;

  // Y-axis gridlines/ticks at even intervals between min and max
  const gridTicks = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
    const value = minValue + ((maxValue - minValue) * i) / GRID_LINES;
    const y = PADDING.top + chartHeight - (i / GRID_LINES) * chartHeight;
    return { value, y };
  });

  // Show a readable subset of x-axis labels (first, last, and a few between)
  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const xLabels = points.filter((_, i) => i % labelStep === 0 || i === points.length - 1);

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!svgRect) return;
    const relX = ((e.clientX - svgRect.left) / svgRect.width) * width;
    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHoverIndex(closest);
  };

  return (
    <div ref={ref} style={{ width: '100%', height, position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        role="img"
        aria-label="Line chart"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor || color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={fillColor || color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

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

        {/* X-axis labels */}
        {xLabels.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-muted)"
          >
            {p.label}
          </text>
        ))}

        {/* Area + line */}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover guide line + dot */}
        {hovered && (
          <>
            <line
              x1={hovered.x}
              y1={PADDING.top}
              x2={hovered.x}
              y2={height - PADDING.bottom}
              stroke="var(--text-muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle cx={hovered.x} cy={hovered.y} r={4.5} fill={color} stroke="var(--bg-card)" strokeWidth={2} />
          </>
        )}

        {/* Invisible hover-capture layer */}
        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={chartWidth}
          height={chartHeight}
          fill="transparent"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        />
      </svg>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max((hovered.x / width) * 100, 12), 88) + '%',
            top: Math.max((hovered.y / height) * 100 - 14, 2) + '%',
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
