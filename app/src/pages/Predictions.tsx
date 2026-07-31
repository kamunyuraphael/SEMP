// pages/Predictions.tsx
// Displays ML-generated consumption forecasts, bill estimates,
// and per-appliance kWh predictions from the Python analytics pipeline.
// Filters by prediction type (bill / consumption / anomaly).

import { useState, useEffect, useCallback } from 'react';
import { predictionService, telemetryService } from '../services/api';
import { ConsumptionBar } from '../components/charts/ConsumptionBar';
import { ForecastLineChart } from '../components/charts/ForecastLineChart';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Prediction, PredictionType, Device } from '../types/index';
import { estimateEnergyChargeKES } from '../utils/tariff';

const TYPE_OPTIONS: { value: PredictionType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'bi-grid-fill' },
  { value: 'consumption', label: 'Consumption', icon: 'bi-lightning-charge-fill' },
  { value: 'bill', label: 'Bill', icon: 'bi-cash-stack' },
  { value: 'anomaly', label: 'Anomaly', icon: 'bi-exclamation-triangle-fill' },
];

const CONFIDENCE_COLOR = (confidence: number): string => {
  if (confidence >= 0.8) return 'var(--accent-primary)';
  if (confidence >= 0.6) return 'var(--accent-amber)';
  return 'var(--warning)';
};

export default function Predictions() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [filter, setFilter] = useState<PredictionType | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async (type: PredictionType | 'all') => {
    setIsLoading(true);
    try {
      const res = await predictionService.getPredictions(
        type === 'all' ? undefined : type
      );
      setPredictions(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load predictions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions(filter);
  }, [filter, fetchPredictions]);

  // Last 7 days of actual usage, for the actual->predicted line chart.
  // Non-critical: if this fails, the chart just renders forecast-only.
  const [dailyActual, setDailyActual] = useState<{ day: string; label: string; value: number }[]>([]);
  useEffect(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 6);
    telemetryService
      .getCategoryBreakdownRange(from.toISOString(), to.toISOString(), 'day')
      .then((res) => {
        const byDay = new Map<string, number>();
        res.data.forEach((row) => {
          byDay.set(row.period, (byDay.get(row.period) || 0) + row.totalKWh);
        });
        const sortedDays = Array.from(byDay.keys()).sort();
        setDailyActual(
          sortedDays.map((day) => ({
            day,
            label: new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short' }),
            value: byDay.get(day) || 0,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const deviceName = (device?: string | Device): string => {
    if (!device) return '—';
    return typeof device === 'string' ? device.slice(-6) : device.name;
  };

  // Stats derived from all loaded predictions
  const consumptionPredictions = predictions.filter((p) => p.type === 'consumption');
  const billPredictions = predictions.filter((p) => p.type === 'bill');
  const latestBill = billPredictions[0] ?? null;
  const totalForecastKWh = consumptionPredictions.reduce(
    (sum, p) => sum + p.predictedValue,
    0
  );
  const avgConfidence =
    predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
      : 0;

  // Bar chart — top 10 consumption predictions by predicted kWh
  const chartData = [...consumptionPredictions]
    .sort((a, b) => b.predictedValue - a.predictedValue)
    .slice(0, 10)
    .map((p) => ({
      name: deviceName(p.device),
      kWh: p.predictedValue,
      confidence: p.confidence,
    }));

  // Daily forecast total (summed across devices per target day), for
  // the actual->predicted line chart. Band half-width is derived from
  // average confidence for that day — see ForecastLineChart.tsx for why
  // this is an approximation, not a real statistical interval.
  const dailyForecast = (() => {
    const byDay = new Map<string, { total: number; confidenceSum: number; count: number }>();
    consumptionPredictions.forEach((p) => {
      const day = p.targetDate.slice(0, 10);
      const entry = byDay.get(day) || { total: 0, confidenceSum: 0, count: 0 };
      entry.total += p.predictedValue;
      entry.confidenceSum += p.confidence;
      entry.count += 1;
      byDay.set(day, entry);
    });
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, entry]) => {
        const avgConfidence = entry.confidenceSum / entry.count;
        const bandFraction = Math.max(0.05, (1 - avgConfidence) * 0.5);
        return {
          label: new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short' }),
          value: entry.total,
          lower: Math.max(0, entry.total * (1 - bandFraction)),
          upper: entry.total * (1 + bandFraction),
        };
      });
  })();

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
            Predictions
          </h5>
          <p className="mb-0" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            ML-generated forecasts from the analytics pipeline
          </p>
        </div>

        <div className="btn-group" role="group">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="btn"
              style={{
                backgroundColor:
                  filter === opt.value ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: filter === opt.value ? '#ffffff' : 'var(--text-primary)',
                border: '1px solid var(--bg-border)',
                fontSize: '0.85rem',
              }}
              onClick={() => setFilter(opt.value)}
            >
              <i className={`bi ${opt.icon} me-1`} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner fullPage label="Loading predictions..." />
      ) : (
        <>
          {/* ── Summary Cards ────────────────────────────────── */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-4">
              <div className="stat-card">
                <div className="stat-card-top">
                  <span className="stat-card-label">Daily Forecast kWh</span>
                  <div className="stat-card-icon amber">
                    <i className="bi bi-lightning-charge-fill" />
                  </div>
                </div>
                <div className="stat-card-value">{totalForecastKWh.toFixed(2)}</div>
                <div className="stat-card-sub">Total across appliances</div>
              </div>
            </div>

            <div className="col-12 col-sm-4">
              <div className="stat-card">
                <div className="stat-card-top">
                  <span className="stat-card-label">Est. Daily Bill</span>
                  <div className="stat-card-icon orange">
                    <i className="bi bi-cash-stack" />
                  </div>
                </div>
                <div className="stat-card-value">
                  {latestBill
                    ? `KSh ${latestBill.predictedValue.toFixed(2)}`
                    : `KSh ${estimateEnergyChargeKES(totalForecastKWh).toFixed(2)}`}
                </div>
                <div className="stat-card-sub">
                  {latestBill
                    ? `${Math.round(latestBill.confidence * 100)}% confidence`
                    : 'At KSh 21/kWh'}
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-4">
              <div className="stat-card">
                <div className="stat-card-top">
                  <span className="stat-card-label">Avg Confidence</span>
                  <div className="stat-card-icon orange">
                    <i className="bi bi-shield-check" />
                  </div>
                </div>
                <div className="stat-card-value">
                  {Math.round(avgConfidence * 100)}%
                </div>
                <div className="stat-card-sub">Across all predictions</div>
              </div>
            </div>
          </div>

          {/* ── Actual vs Predicted Trend ─────────────────────── */}
          {(dailyActual.length > 0 || dailyForecast.length > 0) && (
            <div className="chart-card mb-4">
              <div className="chart-header">
                <div>
                  <div className="chart-title">Actual vs Predicted Usage</div>
                  <div className="chart-subtitle">
                    Last 7 days of actual usage, forecast ahead with a confidence band
                  </div>
                </div>
              </div>

              <ForecastLineChart
                history={dailyActual.map((d) => ({ label: d.label, value: d.value }))}
                forecast={dailyForecast}
                height={280}
              />

              <p className="mt-2 mb-0" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <i className="bi bi-info-circle me-1" />
                The shaded band is derived from the model's confidence score, not a statistical prediction
                interval — treat it as how much the model is hedging, not an exact range.
              </p>
            </div>
          )}

          {/* ── Consumption Bar Chart ─────────────────────────── */}
          {consumptionPredictions.length > 0 && (
            <div className="chart-card mb-4">
              <div className="chart-header">
                <div>
                  <div className="chart-title">Top Appliance Forecasts</div>
                  <div className="chart-subtitle">
                    Predicted kWh - top 10 by consumption
                  </div>
                </div>
              </div>

              <ConsumptionBar
                data={chartData.map((entry) => ({
                  label: entry.name,
                  value: Number(entry.kWh),
                  color: CONFIDENCE_COLOR(entry.confidence),
                }))}
                height={280}
                valueSuffix=" kWh"
              />

              <p className="mt-2 mb-0" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <i className="bi bi-info-circle me-1" />
                Bar color reflects model confidence -{' '}
                <span style={{ color: 'var(--accent-primary)' }}>●</span> high (≥80%){' '}
                <span style={{ color: 'var(--accent-amber)' }}>●</span> medium (≥60%){' '}
                <span style={{ color: 'var(--warning)' }}>●</span> low
              </p>
            </div>
          )}

          {/* ── Predictions Table ─────────────────────────────── */}
          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">All Predictions</div>
            </div>

            {predictions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-graph-up-arrow" />
                </div>
                <div className="empty-state-title">No predictions yet</div>
                <p>
                  The Python analytics pipeline will generate predictions automatically
                  on its next scheduled run.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Target Date</th>
                      <th>Type</th>
                      <th>Device</th>
                      <th>Value</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.slice(0, 100).map((p) => (
                      <tr key={p._id}>
                        <td>
                          {new Date(p.targetDate).toLocaleDateString('en-KE', {
                            dateStyle: 'medium',
                          })}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor:
                                p.type === 'bill'
                                  ? 'rgba(var(--accent-amber-rgb), 0.15)'
                                  : p.type === 'anomaly'
                                  ? 'rgba(var(--warning-rgb), 0.15)'
                                  : 'rgba(var(--accent-primary-rgb), 0.15)',
                              color:
                                p.type === 'bill'
                                  ? 'var(--accent-amber)'
                                  : p.type === 'anomaly'
                                  ? 'var(--warning)'
                                  : 'var(--accent-primary)',
                            }}
                          >
                            {p.type}
                          </span>
                        </td>
                        <td>{deviceName(p.device)}</td>
                        <td className="fw-medium">
                          {p.type === 'bill'
                            ? `KSh ${p.predictedValue.toFixed(2)}`
                            : `${p.predictedValue.toFixed(4)} kWh`}
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div
                              style={{
                                width: 60,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: 'var(--bg-surface)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${p.confidence * 100}%`,
                                  height: '100%',
                                  backgroundColor: CONFIDENCE_COLOR(p.confidence),
                                  borderRadius: 3,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {Math.round(p.confidence * 100)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}