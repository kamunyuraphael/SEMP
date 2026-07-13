// pages/Dashboard.tsx
// Primary landing page after login. Stats row matches the Figma
// reference exactly (Current Draw / Today's Usage / Month to Date /
// Active Devices, each with a real trend subtext) — populated from
// live computed data rather than the Figma mock's static placeholder
// numbers. Also shows a live mains power chart, category breakdown,
// and a compact anomalies summary.

import { useState, useEffect, useCallback } from 'react';
import {
  deviceService,
  telemetryService,
  predictionService,
} from '../services/api';
import { PowerLineChart } from '../components/charts/PowerLineChart';
import { CategoryPie } from '../components/charts/CategoryPie';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { extractSeverity, timeAgo } from '../utils/anomaly';
import { CATEGORY_COLORS } from '../utils/categoryColors';
import type {
  Device,
  TelemetryRecord,
  CategoryBreakdown,
  TelemetrySummary,
  Prediction,
} from '../types/index';

const KSH_RATE_PER_KWH = 21.0;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yesterdayISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoDate(d);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Same elapsed-days window, one month back — clamped to that month's length. */
function lastMonthEquivalentRange(today: Date): { from: string; to: string } {
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const daysInLastMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const dayOfMonth = Math.min(today.getDate(), daysInLastMonth);
  const lastMonthEquivalentEnd = new Date(today.getFullYear(), today.getMonth() - 1, dayOfMonth);
  return { from: isoDate(lastMonthStart), to: isoDate(lastMonthEquivalentEnd) };
}

export default function Dashboard() {
  const { liveAlerts } = useSocket();

  const [devices, setDevices] = useState<Device[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryRecord[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [yesterdayBreakdown, setYesterdayBreakdown] = useState<CategoryBreakdown[]>([]);
  const [monthToDate, setMonthToDate] = useState<TelemetrySummary | null>(null);
  const [lastMonthEquivalent, setLastMonthEquivalent] = useState<TelemetrySummary | null>(null);
  const [anomalies, setAnomalies] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const today = new Date();
      const lastMonthRange = lastMonthEquivalentRange(today);

      const [
        devicesRes,
        telemetryRes,
        breakdownRes,
        yesterdayRes,
        monthRes,
        lastMonthRes,
        anomaliesRes,
      ] = await Promise.all([
        deviceService.getDevices(),
        telemetryService.getTelemetry('raw'),
        telemetryService.getCategoryBreakdown(), // defaults to today
        telemetryService.getCategoryBreakdown(yesterdayISODate()),
        telemetryService.getSummary(isoDate(startOfMonth(today)), isoDate(today)),
        telemetryService.getSummary(lastMonthRange.from, lastMonthRange.to),
        predictionService.getPredictions('anomaly'),
      ]);

      setDevices(devicesRes.data);
      setTelemetry(telemetryRes.data);
      setBreakdown(breakdownRes.data);
      setYesterdayBreakdown(yesterdayRes.data);
      setMonthToDate(monthRes.data);
      setLastMonthEquivalent(lastMonthRes.data);
      setAnomalies(anomaliesRes.data);
      setError(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.error || 'Failed to load dashboard data.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30_000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const deviceName = (device?: string | Device): string => {
    if (!device) return 'Whole-home';
    return typeof device === 'string' ? device.slice(-6) : device.name;
  };

  const activeDevices = devices.filter((d) => d.status === 'active').length;
  const totalDevices = devices.length;

  // ── Current Draw: latest reading per device, summed, vs ~1h ago ────
  const latestByDevice = new Map<string, TelemetryRecord>();
  for (const t of telemetry) {
    const key = typeof t.device === 'string' ? t.device : t.device._id;
    if (!latestByDevice.has(key)) latestByDevice.set(key, t); // API returns newest-first
  }
  const currentDrawWatts = [...latestByDevice.values()].reduce((sum, t) => sum + t.watts, 0);

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let wattsOneHourAgo = 0;
  let hourAgoMatches = 0;
  for (const [deviceId] of latestByDevice) {
    const deviceReadings = telemetry.filter(
      (t) => (typeof t.device === 'string' ? t.device : t.device._id) === deviceId
    );
    // Closest reading to exactly 1h before this device's latest timestamp
    let closest: TelemetryRecord | null = null;
    let closestDiff = Infinity;
    for (const t of deviceReadings) {
      const diff = Math.abs(new Date(t.timestamp).getTime() - oneHourAgo);
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = t;
      }
    }
    // Only count it if within 20 minutes of the 1h-ago target
    if (closest && closestDiff <= 20 * 60 * 1000) {
      wattsOneHourAgo += closest.watts;
      hourAgoMatches++;
    }
  }
  const currentDrawTrendPct =
    hourAgoMatches > 0 && wattsOneHourAgo > 0
      ? ((currentDrawWatts - wattsOneHourAgo) / wattsOneHourAgo) * 100
      : null;

  // ── Today's Usage vs yesterday ──────────────────────────────────────
  const todayKWh = breakdown.reduce((sum, b) => sum + b.totalKWh, 0);
  const yesterdayKWh = yesterdayBreakdown.reduce((sum, b) => sum + b.totalKWh, 0);
  const kWhTrendPct = yesterdayKWh > 0 ? ((todayKWh - yesterdayKWh) / yesterdayKWh) * 100 : null;

  // ── Month to Date vs same elapsed period last month ─────────────────
  const monthToDateCost = (monthToDate?.totalKWh || 0) * KSH_RATE_PER_KWH;
  const lastMonthEquivalentCost = (lastMonthEquivalent?.totalKWh || 0) * KSH_RATE_PER_KWH;
  const monthTrendPct =
    lastMonthEquivalentCost > 0
      ? ((monthToDateCost - lastMonthEquivalentCost) / lastMonthEquivalentCost) * 100
      : null;

  // ── Anomalies ────────────────────────────────────────────────────────
  const liveAnomalyAlerts = liveAlerts.filter((a) => a.type === 'anomaly');
  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);
  // Live socket alerts always count as unresolved (they haven't been
  // persisted/acted on yet) — combine with the real resolved-count from
  // persisted predictions rather than the previous length-based guess.
  const unresolvedCount = liveAnomalyAlerts.length + unresolvedAnomalies.length;

  const recentAnomalies = [
    ...liveAnomalyAlerts.map((a) => ({
      key: `live-${a.timestamp}-${a.device ?? ''}`,
      severity: extractSeverity(a.anomalyDetails),
      deviceLabel: a.device || 'Whole-home',
      timestamp: a.timestamp,
    })),
    ...unresolvedAnomalies.map((p) => ({
      key: p._id,
      severity: extractSeverity(p.anomalyDetails),
      deviceLabel: deviceName(p.device),
      timestamp: p.timestamp,
    })),
  ].slice(0, 4);

  const chartData = [...telemetry]
    .slice(0, 30)
    .reverse()
    .map((t) => ({
      time: new Date(t.timestamp).toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      watts: t.watts,
    }));

  const pieData = breakdown.map((b) => ({
    name: b.category,
    value: b.totalKWh,
    fill: CATEGORY_COLORS[b.category] || '#C15A02',
  }));

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading dashboard..." />;
  }

  const renderTrend = (pct: number | null, positiveIsGood: boolean, fallback: string) => {
    if (pct === null) return <span className="stat-card-sub">{fallback}</span>;
    const isGood = positiveIsGood ? pct >= 0 : pct <= 0;
    return (
      <span className={`stat-card-trend ${isGood ? 'up' : 'down'}`}>
        {pct > 0 ? '+' : ''}
        {pct.toFixed(1)}%
      </span>
    );
  };

  return (
    <div>
      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-card-label">Current Draw</span>
              <div className="stat-card-icon amber">
                <i className="bi bi-lightning-fill" />
              </div>
            </div>
            <div className="stat-card-value">
              {currentDrawWatts.toLocaleString()}
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}> W</span>
            </div>
            <div className="stat-card-sub">
              {renderTrend(currentDrawTrendPct, false, 'No data for last hour yet')}
              {currentDrawTrendPct !== null && (
                <span style={{ color: 'var(--text-muted)' }}> vs last hour</span>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-card-label">Today's Usage</span>
              <div className="stat-card-icon orange">
                <i className="bi bi-activity" />
              </div>
            </div>
            <div className="stat-card-value">
              {todayKWh.toFixed(1)}
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}> kWh</span>
            </div>
            <div className="stat-card-sub">
              {renderTrend(kWhTrendPct, false, 'No data for yesterday yet')}
              {kWhTrendPct !== null && (
                <span style={{ color: 'var(--text-muted)' }}> vs yesterday</span>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-card-label">Month to Date</span>
              <div className="stat-card-icon orange">
                <i className="bi bi-cash-stack" />
              </div>
            </div>
            <div className="stat-card-value">KSh {monthToDateCost.toFixed(0)}</div>
            <div className="stat-card-sub">
              {renderTrend(monthTrendPct, false, 'No data for last month yet')}
              {monthTrendPct !== null && (
                <span style={{ color: 'var(--text-muted)' }}> vs last month</span>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-card-label">Active Devices</span>
              <div className="stat-card-icon rust">
                <i className="bi bi-cpu-fill" />
              </div>
            </div>
            <div className="stat-card-value">
              {activeDevices}
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                {' '}/ {totalDevices}
              </span>
            </div>
            <div className="stat-card-sub">
              {totalDevices - activeDevices} offline
            </div>
          </div>
        </div>
      </div>

      <div className="chart-card mb-4">
        <div className="chart-header">
          <div>
            <div className="chart-title">Live Power Consumption</div>
            <div className="chart-subtitle">Whole-home mains, last 30 readings</div>
          </div>
          <div className="live-indicator">
            <span className="live-dot" />
            LIVE
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="bi bi-graph-up" />
            </div>
            <div className="empty-state-title">No telemetry data yet</div>
            <p>Once your devices start reporting, live data will appear here.</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <PowerLineChart
              data={chartData.map((point) => ({
                label: point.time,
                value: Number(point.watts),
              }))}
              height={280}
              color="var(--accent-primary)"
              valueSuffix=" W"
            />
          </div>
        )}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="chart-card h-100">
            <div className="chart-header">
              <div>
                <div className="chart-title">Consumption by Category</div>
                <div className="chart-subtitle">Today's breakdown</div>
              </div>
            </div>

            {pieData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-pie-chart" />
                </div>
                <div className="empty-state-title">No category data yet</div>
              </div>
            ) : (
              <div className="d-flex flex-column flex-lg-row align-items-center justify-content-between gap-3">
                <CategoryPie
                  data={pieData.map((entry) => ({
                    label: entry.name,
                    value: Number(entry.value),
                    color: entry.fill,
                  }))}
                  size={180}
                  valueSuffix=" kWh"
                />
                <div className="w-100">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="d-flex justify-content-between align-items-center py-1">
                      <span className="d-flex align-items-center gap-2 text-capitalize">
                        <span style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', backgroundColor: entry.fill }} />
                        {entry.name}
                      </span>
                      <strong>{Number(entry.value).toFixed(2)} kWh</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="chart-card h-100" style={unresolvedCount > 0 ? { border: '1px solid var(--warning)' } : undefined}>
            <div className="chart-header">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill" style={{ color: 'var(--accent-amber)' }} />
                <div className="chart-title mb-0">Active Anomalies</div>
              </div>
              {unresolvedCount > 0 && (
                <span className="severity-badge severity-medium">
                  {unresolvedCount} unresolved
                </span>
              )}
            </div>

            {recentAnomalies.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-shield-check" />
                </div>
                <div className="empty-state-title">No anomalies detected</div>
                <p>Unusual consumption patterns will show up here automatically.</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {recentAnomalies.map((a) => (
                  <div
                    key={a.key}
                    className="d-flex justify-content-between align-items-center py-2"
                    style={{ borderBottom: '1px solid var(--bg-border)' }}
                  >
                    <div className="d-flex align-items-center gap-2 min-width-0">
                      <span className={`severity-badge severity-${a.severity}`}>
                        {a.severity}
                      </span>
                      <span className="fw-medium text-truncate" style={{ color: 'var(--text-primary)', maxWidth: 180 }}>
                        {a.deviceLabel}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {timeAgo(a.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
