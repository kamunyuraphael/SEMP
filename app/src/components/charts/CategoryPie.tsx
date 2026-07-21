// components/charts/CategoryPie.tsx
// Donut chart used for the category consumption breakdown (Dashboard).
// Matches the Figma reference's hover tooltip on each segment. Replaces
// the old SimpleDonutChart (SimpleCharts.tsx), which rendered a static
// CSS conic-gradient with no per-segment interactivity.

import { useMemo, useState } from 'react';

export type PieChartPoint = {
  label: string;
  value: number;
  color?: string;
};

type CategoryPieProps = {
  data: PieChartPoint[];
  size?: number;
  valueSuffix?: string;
  centerLabel?: string;
};

const DEFAULT_COLOR = 'var(--accent-primary)';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function donutArcPath(cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number) {
  const isFullCircle = endAngle - startAngle >= 359.99;
  const adjustedEnd = isFullCircle ? startAngle + 359.99 : endAngle;

  const outerStart = polarToCartesian(cx, cy, outerR, adjustedEnd);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, adjustedEnd);
  const largeArcFlag = adjustedEnd - startAngle <= 180 ? 0 : 1;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

export function CategoryPie({ data, size = 180, valueSuffix = ' kWh', centerLabel }: CategoryPieProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  if (!data.length || total <= 0) {
    return <div className="text-muted small">No data available</div>;
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.62;
  const hoverOuterR = outerR + 4;

  let cursor = 0;
  const segments = data.map((point) => {
    const fraction = point.value / total;
    const startAngle = cursor * 360;
    const endAngle = (cursor + fraction) * 360;
    cursor += fraction;
    return { ...point, startAngle, endAngle, fraction };
  });

  const hovered = hoverIndex !== null ? segments[hoverIndex] : null;

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label="Donut chart">
        {segments.map((seg, index) => (
          <path
            key={`${seg.label}-${index}`}
            d={donutArcPath(cx, cy, innerR, hoverIndex === index ? hoverOuterR : outerR, seg.startAngle, seg.endAngle)}
            fill={seg.color || DEFAULT_COLOR}
            opacity={hoverIndex === null || hoverIndex === index ? 1 : 0.45}
            style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
          />
        ))}
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: `${size * 0.155}px`,
          borderRadius: '50%',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          fontWeight: 600,
          textAlign: 'center',
          padding: 4,
          pointerEvents: 'none',
        }}
      >
        {hovered ? `${Math.round(hovered.fraction * 100)}%` : centerLabel ?? `${total.toFixed(2)}${valueSuffix}`}
      </div>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -8,
            transform: 'translate(-50%, 100%)',
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
          <strong>{hovered.value.toFixed(2)}{valueSuffix}</strong>
        </div>
      )}
    </div>
  );
}
