// pages/DeviceDetail.tsx
// Single-device view: its own usage trend, lifetime stats, and anomaly
// history — devices were previously just cards in a list with no way
// to drill into one individually.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { deviceService, predictionService, telemetryService } from '../services/api';
import { PowerLineChart } from '../components/charts/PowerLineChart';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_COLORS } from '../utils/categoryColors';
import type { Device, TelemetryRecord, Prediction } from '../types/index';

function resolveDeviceId(ref: string | Device | undefined): string | undefined {
  if (!ref) return undefined;
  return typeof ref === 'string' ? ref : ref._id;
}

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [device, setDevice] = useState<Device | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetryRecord[]>([]);
  const [anomalies, setAnomalies] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [devicesRes, telemetryRes, anomaliesRes] = await Promise.all([
        deviceService.getDevices(),
        telemetryService.getTelemetry('raw', id),
        predictionService.getPredictions('anomaly'),
      ]);

      const found = devicesRes.data.find((d) => d._id === id);
      if (!found) {
        setError('Device not found — it may have been deleted.');
        setIsLoading(false);
        return;
      }
      setDevice(found);

      // Backend returns newest-first for the raw feed; the chart reads
      // more naturally left-to-right as oldest-to-newest.
      setTelemetry([...telemetryRes.data].reverse());

      setAnomalies(anomaliesRes.data.filter((a) => resolveDeviceId(a.device) === id));
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load device.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStatus = async () => {
    if (!device) return;
    const nextStatus = device.status === 'active' ? 'inactive' : 'active';
    setIsToggling(true);
    try {
      const res = await deviceService.updateDeviceStatus(device._id, nextStatus);
      setDevice(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update device status.');
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!device) return;
    setIsDeleting(true);
    try {
      await deviceService.deleteDevice(device._id);
      navigate('/devices');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete device.');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading device..." />;
  }

  if (error && !device) {
    return (
      <div>
        <Link to="/devices" className="d-inline-flex align-items-center gap-1 mb-3" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <i className="bi bi-arrow-left" /> Back to devices
        </Link>
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      </div>
    );
  }

  if (!device) return null;

  // Lifetime figure comes from the device record (server-side aggregate
  // over ALL of its telemetry), not from `telemetry` here — that array
  // is capped to the last 100 raw readings for the trend chart, so
  // summing it understates lifetime usage once a device has more history.
  const totalKWh = device.lifetimeKWh ?? 0;
  const avgWatts = telemetry.length > 0 ? telemetry.reduce((sum, t) => sum + t.watts, 0) / telemetry.length : 0;
  const peakWatts = telemetry.reduce((max, t) => Math.max(max, t.watts), 0);

  const chartData = telemetry.map((t) => ({
    label: new Date(t.timestamp).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
    value: t.watts,
  }));

  return (
    <div>
      <Link to="/devices" className="d-inline-flex align-items-center gap-1 mb-3" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <i className="bi bi-arrow-left" /> Back to devices
      </Link>

      {error && (
        <div className="alert alert-danger mb-3">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="chart-card mb-4 d-flex flex-column flex-md-row justify-content-between gap-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-md)',
              backgroundColor: `${CATEGORY_COLORS[device.category]}22`,
            }}
          >
            <i className={`bi ${CATEGORY_ICONS[device.category]}`} style={{ fontSize: '1.5rem', color: CATEGORY_COLORS[device.category] }} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>{device.name}</h5>
              <span className={`device-status ${device.status}`}>
                <span className="device-status-dot" />
                {device.status}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {CATEGORY_LABELS[device.category]}
              {device.location ? ` · ${device.location}` : ''}
              {typeof device.ratedWattage === 'number' ? ` · ${device.ratedWattage.toLocaleString()} W rated` : ''}
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 align-self-start align-self-md-center">
          <button
            type="button"
            className={`btn btn-sm ${device.status === 'active' ? 'btn-outline-primary' : 'btn-primary'}`}
            onClick={handleToggleStatus}
            disabled={isToggling}
          >
            {isToggling ? <span className="spinner-border spinner-border-sm" /> : device.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className="btn btn-sm border-0"
            style={{ color: 'var(--warning)' }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            <i className="bi bi-trash-fill" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <span className="stat-card-label">Lifetime Usage</span>
            <div className="stat-card-value" style={{ fontSize: '1.4rem' }}>{totalKWh.toFixed(2)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>kWh</span></div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <span className="stat-card-label">Average Draw</span>
            <div className="stat-card-value" style={{ fontSize: '1.4rem' }}>{Math.round(avgWatts)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>W</span></div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <span className="stat-card-label">Peak Draw</span>
            <div className="stat-card-value" style={{ fontSize: '1.4rem' }}>{Math.round(peakWatts)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>W</span></div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <span className="stat-card-label">Anomalies</span>
            <div className="stat-card-value" style={{ fontSize: '1.4rem', color: anomalies.length > 0 ? 'var(--warning)' : undefined }}>
              {anomalies.length}
            </div>
          </div>
        </div>
      </div>

      {/* Usage trend */}
      <div className="chart-card mb-4">
        <div className="chart-header">
          <div>
            <div className="chart-title">Usage Trend</div>
            <div className="chart-subtitle">Recent readings for {device.name}</div>
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><i className="bi bi-graph-up" /></div>
            <div className="empty-state-title">No telemetry yet</div>
          </div>
        ) : (
          <PowerLineChart data={chartData} color={CATEGORY_COLORS[device.category]} valueSuffix=" W" height={260} />
        )}
      </div>

      {/* Anomaly history */}
      <div className="chart-card">
        <div className="chart-title mb-3">Anomaly History</div>
        {anomalies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><i className="bi bi-shield-check" /></div>
            <div className="empty-state-title">No anomalies detected for this device</div>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {anomalies.map((a) => (
              <div
                key={a._id}
                className="d-flex justify-content-between align-items-center p-2"
                style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {a.anomalyDetails || 'Anomaly detected'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {new Date(a.targetDate).toLocaleDateString('en-KE', { dateStyle: 'medium' })} · confidence {Math.round(a.confidence * 100)}%
                  </div>
                </div>
                {a.resolved ? (
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)' }}>
                    <i className="bi bi-check-circle-fill me-1" />
                    Resolved
                  </span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>
                    <i className="bi bi-exclamation-circle-fill me-1" />
                    Unresolved
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="modal show d-block" tabIndex={-1} role="dialog" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-dialog modal-dialog-centered" role="document" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title mb-0">Delete {device.name}?</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteConfirm(false)} />
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  This removes the device and its telemetry history. This can't be undone.
                </p>
                <div className="d-flex gap-2 justify-content-end">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ backgroundColor: 'var(--warning)', color: '#fff' }}
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? <span className="spinner-border spinner-border-sm" /> : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
