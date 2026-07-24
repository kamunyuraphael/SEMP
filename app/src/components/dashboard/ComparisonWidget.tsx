// components/dashboard/ComparisonWidget.tsx
// Dashboard widget: "this week/month so far" vs the same elapsed span of
// the previous period, total kWh and a per-category % change breakdown.
// Self-contained — fetches its own data via telemetryService.getComparison
// so it can be dropped into any page without threading extra state through
// the parent's fetch function.

import { useState, useEffect, useCallback } from 'react';
import { telemetryService } from '../../services/api';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../utils/categoryColors';
import type { ComparisonPeriod, ComparisonResponse } from '../../types/index';

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="stat-card-sub">No prior data</span>;
  }
  // For energy usage, "up" (using more) is the unwelcome direction —
  // opposite of how "up" reads for something like savings.
  const isGood = pct <= 0;
  return (
    <span className={`stat-card-trend ${isGood ? 'up' : 'down'}`}>
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}%
    </span>
  );
}

export default function ComparisonWidget() {
  const [period, setPeriod] = useState<ComparisonPeriod>('week');
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async (p: ComparisonPeriod) => {
    setIsLoading(true);
    try {
      const res = await telemetryService.getComparison(p);
      setComparison(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load comparison data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComparison(period);
  }, [period, fetchComparison]);

  return (
    <div className="chart-card h-100">
      <div className="chart-header">
        <div>
          <div className="chart-title">How You're Trending</div>
          <div className="chart-subtitle">
            This {period} so far vs. the same span of the previous {period}
          </div>
        </div>
        <div className="btn-group btn-group-sm" role="group" aria-label="Comparison period">
          <button
            type="button"
            className={`btn ${period === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setPeriod('week')}
          >
            Week
          </button>
          <button
            type="button"
            className={`btn ${period === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setPeriod('month')}
          >
            Month
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-3">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-muted small py-4 text-center">Loading comparison…</div>
      ) : !comparison || comparison.categories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="bi bi-bar-chart-line" />
          </div>
          <div className="empty-state-title">Not enough data yet</div>
          <p>Once telemetry has built up across two {period}s, your trend will show here.</p>
        </div>
      ) : (
        <>
          <div className="d-flex align-items-baseline justify-content-between mb-3 pb-3" style={{ borderBottom: '1px solid var(--bg-border)' }}>
            <div>
              <div className="stat-card-value" style={{ fontSize: '1.6rem' }}>
                {comparison.totalKWh.current.toFixed(1)} kWh
              </div>
              <div className="stat-card-sub">
                vs {comparison.totalKWh.previous.toFixed(1)} kWh last {period}
              </div>
            </div>
            <TrendBadge pct={comparison.totalKWh.changePercent} />
          </div>

          <div className="d-flex flex-column gap-2">
            {comparison.categories.map((cat) => (
              <div key={cat.category} className="d-flex align-items-center gap-2">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: CATEGORY_COLORS[cat.category] || '#C15A02',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1 }}>
                  {CATEGORY_LABELS[cat.category] || cat.category}
                </span>
                <span className="text-muted small">{cat.currentKWh.toFixed(1)} kWh</span>
                <TrendBadge pct={cat.changePercent} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
