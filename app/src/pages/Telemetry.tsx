// pages/Telemetry.tsx
// Historical consumption timeline. Lets the user filter by interval
// (raw/daily/weekly/monthly) and view both a chart and a sortable
// table of underlying readings.

import { useState, useEffect, useCallback } from 'react';
import { telemetryService } from '../services/api';
import { PowerLineChart } from '../components/charts/PowerLineChart';
import { StackedBarChart, type StackSeries } from '../components/charts/StackedBarChart';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../utils/categoryColors';
import type { TelemetryRecord, TelemetryInterval, Device, DailyCategoryBreakdown, DeviceCategory } from '../types/index';

const INTERVAL_OPTIONS: { value: TelemetryInterval; label: string }[] = [
  { value: 'raw', label: 'Raw' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

type DailyRange = '24h' | '7d' | '30d';

const RANGE_OPTIONS: { value: DailyRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const CATEGORY_SERIES: StackSeries[] = (Object.keys(CATEGORY_LABELS) as DeviceCategory[]).map((cat) => ({
  key: cat,
  label: CATEGORY_LABELS[cat],
  color: CATEGORY_COLORS[cat],
}));

function formatPeriodLabel(period: string, range: DailyRange): string {
  const date = range === '24h' ? new Date(period + ':00') : new Date(period);
  if (range === '24h') {
    return date.toLocaleTimeString('en-KE', { hour: '2-digit' });
  }
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' });
}

export default function Telemetry() {
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const [interval, setInterval] = useState<TelemetryInterval>('raw');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dailyRange, setDailyRange] = useState<DailyRange>('7d');
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyCategoryBreakdown[]>([]);
  const [isDailyLoading, setIsDailyLoading] = useState(true);

  const fetchTelemetry = useCallback(async (selectedInterval: TelemetryInterval) => {
    setIsLoading(true);
    try {
      const res = await telemetryService.getTelemetry(selectedInterval);
      setRecords(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load telemetry data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDailyBreakdown = useCallback(async (range: DailyRange) => {
    setIsDailyLoading(true);
    try {
      const to = new Date();
      const from = new Date(to);
      const groupBy = range === '24h' ? 'hour' : 'day';
      if (range === '24h') from.setHours(from.getHours() - 24);
      else if (range === '7d') from.setDate(from.getDate() - 7);
      else from.setDate(from.getDate() - 30);

      const res = await telemetryService.getCategoryBreakdownRange(
        from.toISOString(),
        to.toISOString(),
        groupBy
      );
      setDailyBreakdown(res.data);
    } catch {
      setDailyBreakdown([]);
    } finally {
      setIsDailyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry(interval);
  }, [interval, fetchTelemetry]);

  useEffect(() => {
    fetchDailyBreakdown(dailyRange);
  }, [dailyRange, fetchDailyBreakdown]);

  const deviceName = (device: string | Device): string =>
    typeof device === 'string' ? device.slice(-6) : device.name;

  const chartData = [...records]
    .slice(0, 50)
    .reverse()
    .map((r) => ({
      time: new Date(r.timestamp).toLocaleString('en-KE', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      kWh: r.kWh,
      watts: r.watts,
    }));

  const totalKWh = records.reduce((sum, r) => sum + r.kWh, 0);
  const avgWatts =
    records.length > 0
      ? records.reduce((sum, r) => sum + r.watts, 0) / records.length
      : 0;
  const peakWatts = records.length > 0 ? Math.max(...records.map((r) => r.watts)) : 0;

  // Pivot the flat {period, category, totalKWh} list into one stacked
  // bar per period, each holding a value per category key.
  const dailyChartData = Object.values(
    dailyBreakdown.reduce<Record<string, { label: string; values: Record<string, number> }>>((acc, row) => {
      if (!acc[row.period]) {
        acc[row.period] = { label: formatPeriodLabel(row.period, dailyRange), values: {} };
      }
      acc[row.period].values[row.category] = row.totalKWh;
      return acc;
    }, {})
  );

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
            Telemetry History
          </h5>
          <p className="mb-0" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {records.length} reading{records.length !== 1 ? 's' : ''} loaded
          </p>
        </div>

        <div className="btn-group" role="group" aria-label="Interval selector">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="btn"
              style={{
                backgroundColor:
                  interval === opt.value ? 'var(--accent-primary)' : 'var(--bg-surface)',
                color: interval === opt.value ? '#ffffff' : 'var(--text-primary)',
                border: '1px solid var(--bg-border)',
              }}
              onClick={() => setInterval(opt.value)}
            >
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
        <LoadingSpinner fullPage label="Loading telemetry..." />
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-4">
              <div className="stat-card">
                <div className="stat-card-top">
                  <span className="stat-card-label">Total kWh</span>
                  <div className="stat-card-icon amber">
                    <i className="bi bi-lightning-charge-fill" />
                  </div>
                </div>
                <div className="stat-card-value">{totalKWh.toFixed(2)}</div>
              </div>
            </div>
            <div className="col-12 col-sm-4">
              <div className="stat-card">
                <div className="stat-card-top">
                  <span className="stat-card-label">Average Power</span>
                  <div className="stat-card-icon orange">
                    <i className="bi bi-activity" />
                  </div>
                </div>
                <div className="stat-card-value">{avgWatts.toFixed(0)}W</div>
              </div>
            </div>
            <div className="col-12 col-sm-4">
              <div className="stat-card">
                <div className="stat-card-top">
                  <span className="stat-card-label">Peak Power</span>
                  <div className="stat-card-icon rust">
                    <i className="bi bi-graph-up-arrow" />
                  </div>
                </div>
                <div className="stat-card-value">{peakWatts.toFixed(0)}W</div>
              </div>
            </div>
          </div>

          <div className="chart-card mb-4">
            <div className="chart-header">
              <div>
                <div className="chart-title">Daily kWh by Category</div>
                <div className="chart-subtitle">Consumption breakdown over time</div>
              </div>
              <div className="btn-group" role="group" aria-label="Range selector">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="btn btn-sm"
                    style={{
                      backgroundColor:
                        dailyRange === opt.value ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: dailyRange === opt.value ? '#ffffff' : 'var(--text-primary)',
                      border: '1px solid var(--bg-border)',
                    }}
                    onClick={() => setDailyRange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {isDailyLoading ? (
              <div className="text-center py-4">
                <span className="spinner-border spinner-border-sm" style={{ color: 'var(--accent-primary)' }} />
              </div>
            ) : dailyChartData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-bar-chart" />
                </div>
                <div className="empty-state-title">No data for this range</div>
                <p>Try a wider range, or check back once devices report more data.</p>
              </div>
            ) : (
              <StackedBarChart data={dailyChartData} series={CATEGORY_SERIES} height={260} valueSuffix=" kWh" />
            )}
          </div>

          <div className="chart-card mb-4">
            <div className="chart-header">
              <div>
                <div className="chart-title">Consumption Trend</div>
                <div className="chart-subtitle">
                  {INTERVAL_OPTIONS.find((o) => o.value === interval)?.label} view, last 50 readings
                </div>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-graph-up" />
                </div>
                <div className="empty-state-title">No data for this interval</div>
                <p>Try selecting a different interval or check back once devices report data.</p>
              </div>
            ) : (
              <div style={{ width: '100%', height: 300 }}>
                <PowerLineChart
                  data={chartData.map((point) => ({
                    label: point.time,
                    value: Number(point.kWh),
                  }))}
                  height={300}
                  color="var(--accent-primary)"
                  valueSuffix=" kWh"
                />
              </div>
            )}
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div className="chart-title">Reading Log</div>
            </div>

            {records.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-table" />
                </div>
                <div className="empty-state-title">No readings recorded</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Device</th>
                      <th>Watts</th>
                      <th>kWh</th>
                      <th>Interval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 100).map((record) => (
                      <tr key={record._id}>
                        <td>
                          {new Date(record.timestamp).toLocaleString('en-KE', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td>{deviceName(record.device)}</td>
                        <td>{record.watts.toFixed(1)}W</td>
                        <td>{record.kWh.toFixed(4)}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor: 'var(--bg-surface)',
                              color: 'var(--accent-primary)',
                              border: '1px solid var(--bg-border)',
                            }}
                          >
                            {record.interval}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 100 && (
                  <p
                    className="text-center mt-3 mb-0"
                    style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                  >
                    Showing first 100 of {records.length} readings. Use Export for full data.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}