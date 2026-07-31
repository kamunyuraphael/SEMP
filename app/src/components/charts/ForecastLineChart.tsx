// components/charts/ForecastLineChart.tsx
// Actual usage history (solid line) transitioning into a forecast
// (dashed line) with a shaded confidence band. Used on the Predictions
// page to show daily consumption forecasts in context, rather than an
// unordered bar list.
//
// IMPORTANT — the confidence band is a visual approximation, not a real
// statistical prediction interval: the ML model (forecaster.py) only
// outputs a single confidence score (0-1, from cross-validated R²), not
// actual variance/std around each prediction. Band half-width is
// derived from that score (lower confidence -> wider band), floored so
// it's never zero-width even at very high confidence. Treat it as "how
// much the model is hedging," not a rigorous interval — if you later
// add real prediction intervals to the model, swap the calculation in
// Predictions.tsx that feeds this component, not this component itself.

import { useId, useMemo, useState } from 'react';
import { useChartSize } from './useChartSize';

export type ForecastHistoryPoint = { label: string; value: number };
export type ForecastPoint = { label: string; value: number; lower: number; upper: number };

type ForecastLineChartProps = {
  history: ForecastHistoryPoint[];
  forecast: ForecastPoint[];
  height?: number;
  valueSuffix?: string;
};

const PADDING = { top: 12, right: 16, bottom: 28, left: 44 };
const GRID_LINES = 4;

export function ForecastLineChart({ history, forecast, height = 280, valueSuffix = ' kWh' }: ForecastLineChartProps) {
  const gradientId = useId();
  const { ref, width } = useChartSize<HTMLDivElement>(560);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const {
    historyPts,
    forecastPts,
    allPts,
  } = useMemo(() => {
    if (history.length === 0 && forecast.length === 0) {
      return { historyPts: [], forecastPts: [], allPts: [] };
    }

    // Prepend the last actual point to the forecast series so the
    // dashed line visually continues from exactly where the solid
    // line ends, instead of leaving a gap. Its band is zero-width —
    // uncertainty tapers in from "now" rather than starting abruptly.
    const lastHistory = history[history.length - 1];
    const bridgedForecast: ForecastPoint[] = lastHistory
      ? [{ label: lastHistory.label, value: lastHistory.value, lower: lastHistory.value, upper: lastHistory.value }, ...forecast]
      : forecast;

    const combinedForScale = [
      ...history.map((p) => p.value),
      ...forecast.map((p) => p.value),
      ...forecast.map((p) => p.lower),
      ...forecast.map((p) => p.upper),
    ];
    const max = Math.max(...combinedForScale, 1);
    const min = Math.min(...combinedForScale, 0);
    const range = max - min || 1;

    const totalPoints = history.length + forecast.length;
    const xFor = (index: number) =>
      PADDING.left + (totalPoints <= 1 ? 0 : (index / (totalPoints - 1)) * chartWidth);
    const yFor = (value: number) => PADDING.top + chartHeight - ((value - min) / range) * chartHeight;

    const hPts = history.map((p, i) => ({ ...p, x: xFor(i), y: yFor(p.value) }));
    const fPts = bridgedForecast.map((p, i) => ({
      ...p,
      x: xFor(history.length - 1 + i),
      y: yFor(p.value),
      yLower: yFor(p.lower),
      yUpper: yFor(p.upper),
    }));

    return {
      historyPts: hPts,
      forecastPts: fPts,
      allPts: [...hPts, ...fPts.slice(lastHistory ? 1 : 0)],
      maxValue: max,
      minValue: min,
    };
  }, [history, forecast, chartWidth, chartHeight]);

  if (allPts.length === 0) {
    return <div className="text-muted small">No data available</div>;
  }

  const formatValue = (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })}${valueSuffix}`;

  const historyPath = historyPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const forecastPath = forecastPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const bandPath =
    forecastPts.length > 1
      ? `${forecastPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.yUpper.toFixed(2)}`).join(' ')} ` +
        `${[...forecastPts].reverse().map((p) => `L ${p.x.toFixed(2)} ${p.yLower.toFixed(2)}`).join(' ')} Z`
      : '';

  const values = allPts.map((p) => p.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const gridTicks = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
    const value = minValue + ((maxValue - minValue) * i) / GRID_LINES;
    const y = PADDING.top + chartHeight - (i / GRID_LINES) * chartHeight;
    return { value, y };
  });

  const labelStep = Math.max(1, Math.ceil(allPts.length / 7));
  const xLabels = allPts.filter((_, i) => i % labelStep === 0 || i === allPts.length - 1);

  const hovered = hoverIndex !== null ? allPts[hoverIndex] : null;
  const hoveredIsForecast = hovered ? historyPts.length === 0 || hoverIndex! >= historyPts.length : false;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svgRect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!svgRect) return;
    const relX = ((e.clientX - svgRect.left) / svgRect.width) * width;
    let closest = 0;
    let closestDist = Infinity;
    allPts.forEach((p, i) => {
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
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="Actual vs predicted consumption chart">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {gridTicks.map((tick, i) => (
          <g key={i}>
            <line x1={PADDING.left} y1={tick.y} x2={width - PADDING.right} y2={tick.y} stroke="var(--bg-border)" strokeDasharray="3 3" strokeWidth={1} />
            <text x={PADDING.left - 8} y={tick.y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--text-muted)">
              {formatValue(tick.value)}
            </text>
          </g>
        ))}

        {xLabels.map((p, i) => (
          <text key={i} x={p.x} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
            {p.label}
          </text>
        ))}

        {/* Confidence band — forecast region only */}
        {bandPath && <path d={bandPath} fill="var(--accent-amber)" fillOpacity={0.12} stroke="none" />}

        {/* Actual usage — solid line + soft fill under it */}
        {historyPts.length > 0 && (
          <>
            <path
              d={`${historyPath} L ${historyPts[historyPts.length - 1].x.toFixed(2)} ${height - PADDING.bottom} L ${historyPts[0].x.toFixed(2)} ${height - PADDING.bottom} Z`}
              fill={`url(#${gradientId})`}
            />
            <path d={historyPath} fill="none" stroke="var(--accent-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* Predicted usage — dashed line */}
        {forecastPts.length > 1 && (
          <path d={forecastPath} fill="none" stroke="var(--accent-amber)" strokeWidth={2.5} strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Point markers */}
        {historyPts.map((p, i) => (
          <circle key={`h-${i}`} cx={p.x} cy={p.y} r={3} fill="var(--accent-primary)" />
        ))}
        {forecastPts.slice(1).map((p, i) => (
          <circle key={`f-${i}`} cx={p.x} cy={p.y} r={3} fill="var(--accent-amber)" />
        ))}

        {hovered && (
          <>
            <line x1={hovered.x} y1={PADDING.top} x2={hovered.x} y2={height - PADDING.bottom} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hovered.x} cy={hovered.y} r={4.5} fill={hoveredIsForecast ? 'var(--accent-amber)' : 'var(--accent-primary)'} stroke="var(--bg-card)" strokeWidth={2} />
          </>
        )}

        <rect x={PADDING.left} y={PADDING.top} width={chartWidth} height={chartHeight} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIndex(null)} />
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
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
            {hovered.label} · {hoveredIsForecast ? 'Predicted' : 'Actual'}
          </div>
          <strong>{formatValue(hovered.value)}</strong>
        </div>
      )}

      <div className="d-flex gap-3 mt-1" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 2, backgroundColor: 'var(--accent-primary)', marginRight: 4, verticalAlign: 'middle' }} />Actual</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 2, backgroundColor: 'var(--accent-amber)', marginRight: 4, verticalAlign: 'middle', borderTop: '2px dashed var(--accent-amber)' }} />Predicted</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 8, backgroundColor: 'var(--accent-amber)', opacity: 0.25, marginRight: 4, verticalAlign: 'middle' }} />Confidence band</span>
      </div>
    </div>
  );
}
