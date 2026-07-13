// pages/Anomalies.tsx
// Displays anomaly predictions from the Python IsolationForest pipeline
// and real-time anomaly alerts from Socket.io side by side.
// Severity badges (low/medium/high) and anomalyDetails strings come
// directly from the AnomalyDetector.to_prediction_payloads() output.

import { useState, useEffect, useCallback } from 'react';
import { predictionService } from '../services/api';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Prediction, Device, AlertEventPayload } from '../types/index';
import { extractSeverity } from '../utils/anomaly';

type SeverityFilter = 'all' | 'high' | 'medium' | 'low';

export default function Anomalies() {
  const { liveAlerts, dismissAlert } = useSocket();

  const [anomalies, setAnomalies] = useState<Prediction[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [isResolvingAll, setIsResolvingAll] = useState(false);

  const fetchAnomalies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await predictionService.getPredictions('anomaly');
      setAnomalies(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load anomalies.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    // Optimistic update
    setAnomalies((prev) => prev.map((a) => (a._id === id ? { ...a, resolved: true } : a)));
    try {
      await predictionService.resolveAnomaly(id);
    } catch (err: any) {
      setAnomalies((prev) => prev.map((a) => (a._id === id ? { ...a, resolved: false } : a)));
      setError(err?.response?.data?.error || 'Failed to resolve anomaly.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleResolveAll = async () => {
    setIsResolvingAll(true);
    const previous = anomalies;
    setAnomalies((prev) => prev.map((a) => ({ ...a, resolved: true })));
    try {
      await predictionService.resolveAllAnomalies();
    } catch (err: any) {
      setAnomalies(previous);
      setError(err?.response?.data?.error || 'Failed to resolve anomalies.');
    } finally {
      setIsResolvingAll(false);
    }
  };

  const deviceName = (device?: string | Device): string => {
    if (!device) return 'Whole-home';
    return typeof device === 'string' ? device.slice(-6) : device.name;
  };

  const filteredAnomalies = anomalies.filter((a) => {
    if (severityFilter === 'all') return true;
    return extractSeverity(a.anomalyDetails) === severityFilter;
  });

  const highCount = anomalies.filter((a) => extractSeverity(a.anomalyDetails) === 'high').length;
  const mediumCount = anomalies.filter((a) => extractSeverity(a.anomalyDetails) === 'medium').length;
  const lowCount = anomalies.filter((a) => extractSeverity(a.anomalyDetails) === 'low').length;
  const unresolvedCount = anomalies.filter((a) => !a.resolved).length;

  const liveAnomalyAlerts = liveAlerts.filter((a) => a.type === 'anomaly');

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
            Anomalies
          </h5>
          <p className="mb-0" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {unresolvedCount} unresolved · {anomalies.length} total
          </p>
        </div>
        {unresolvedCount > 0 && (
          <button
            type="button"
            className="btn btn-sm d-flex align-items-center gap-2"
            style={{ color: 'var(--accent-primary)', background: 'transparent', border: 'none' }}
            onClick={handleResolveAll}
            disabled={isResolvingAll}
          >
            {isResolvingAll ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <i className="bi bi-check2-all" />
            )}
            Resolve all
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      )}

      {/* ── Live Alert Banner ─────────────────────────────────── */}
      {liveAnomalyAlerts.length > 0 && (
        <div className="chart-card mb-4" style={{ border: '1px solid var(--warning)' }}>
          <div className="chart-header mb-3">
            <div className="d-flex align-items-center gap-2">
              <span className="live-dot" style={{ backgroundColor: '#862D03' }} />
              <div className="chart-title" style={{ color: 'var(--warning)' }}>
                {liveAnomalyAlerts.length} Live Anomaly Alert{liveAnomalyAlerts.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="d-flex flex-column gap-2">
            {liveAnomalyAlerts.map((alert: AlertEventPayload, i) => (
              <div
                key={i}
                className="d-flex justify-content-between align-items-start p-3 rounded"
                style={{ backgroundColor: 'rgba(134,45,3,0.1)', border: '1px solid rgba(134,45,3,0.2)' }}
              >
                <div className="d-flex gap-3">
                  <i
                    className="bi bi-exclamation-triangle-fill mt-1"
                    style={{ color: 'var(--warning)', fontSize: '1rem' }}
                  />
                  <div>
                    <div className="fw-medium" style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {alert.message}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(alert.timestamp).toLocaleTimeString('en-KE')}
                      {alert.device && ` · ${alert.device}`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm border-0 bg-transparent"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => dismissAlert(i)}
                  aria-label="Dismiss"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner fullPage label="Loading anomalies..." />
      ) : (
        <>
          {/* ── Severity Summary Cards ────────────────────────── */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-sm-4">
              <div
                className="stat-card"
                style={{ cursor: 'pointer', outline: severityFilter === 'high' ? '2px solid var(--warning)' : 'none' }}
                onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
              >
                <div className="stat-card-top">
                  <span className="stat-card-label">High Severity</span>
                  <div className="stat-card-icon rust">
                    <i className="bi bi-exclamation-triangle-fill" />
                  </div>
                </div>
                <div className="stat-card-value" style={{ color: '#862D03' }}>{highCount}</div>
              </div>
            </div>

            <div className="col-12 col-sm-4">
              <div
                className="stat-card"
                style={{ cursor: 'pointer', outline: severityFilter === 'medium' ? '2px solid var(--accent-primary)' : 'none' }}
                onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
              >
                <div className="stat-card-top">
                  <span className="stat-card-label">Medium Severity</span>
                  <div className="stat-card-icon orange">
                    <i className="bi bi-exclamation-circle-fill" />
                  </div>
                </div>
                <div className="stat-card-value" style={{ color: '#C15A02' }}>{mediumCount}</div>
              </div>
            </div>

            <div className="col-12 col-sm-4">
              <div
                className="stat-card"
                style={{ cursor: 'pointer', outline: severityFilter === 'low' ? '2px solid var(--accent-amber)' : 'none' }}
                onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
              >
                <div className="stat-card-top">
                  <span className="stat-card-label">Low Severity</span>
                  <div className="stat-card-icon amber">
                    <i className="bi bi-info-circle-fill" />
                  </div>
                </div>
                <div className="stat-card-value" style={{ color: '#E8A221' }}>{lowCount}</div>
              </div>
            </div>
          </div>

          {/* ── Anomalies List ────────────────────────────────── */}
          <div className="chart-card">
            <div className="chart-header mb-3">
              <div className="chart-title">
                {severityFilter === 'all' ? 'All Anomalies' : `${severityFilter.charAt(0).toUpperCase() + severityFilter.slice(1)} Severity`}
              </div>
              {severityFilter !== 'all' && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setSeverityFilter('all')}
                >
                  Clear filter
                </button>
              )}
            </div>

            {filteredAnomalies.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="bi bi-shield-check" />
                </div>
                <div className="empty-state-title">
                  {severityFilter === 'all'
                    ? 'No anomalies detected'
                    : `No ${severityFilter} severity anomalies`}
                </div>
                <p>
                  {severityFilter === 'all'
                    ? 'The ML pipeline will flag unusual consumption patterns here automatically.'
                    : 'Try a different severity filter.'}
                </p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                {filteredAnomalies.map((anomaly) => {
                  const severity = extractSeverity(anomaly.anomalyDetails);
                  const isResolved = !!anomaly.resolved;
                  return (
                    <div
                      key={anomaly._id}
                      className="p-3 rounded d-flex gap-3"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: isResolved ? '1px solid var(--bg-border)' : '1px solid var(--accent-amber)',
                        opacity: isResolved ? 0.55 : 1,
                        cursor: isResolved ? 'default' : 'pointer',
                        transition: 'opacity 0.15s ease, border-color 0.15s ease',
                      }}
                      onClick={() => !isResolved && resolvingId !== anomaly._id && handleResolve(anomaly._id)}
                    >
                      <div
                        className="d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 8,
                          backgroundColor:
                            severity === 'high'
                              ? 'rgba(134,45,3,0.15)'
                              : severity === 'medium'
                              ? 'rgba(193,90,2,0.15)'
                              : 'rgba(232,162,33,0.15)',
                        }}
                      >
                        <i
                          className="bi bi-exclamation-triangle-fill"
                          style={{
                            color:
                              severity === 'high'
                                ? '#862D03'
                                : severity === 'medium'
                                ? '#C15A02'
                                : '#E8A221',
                          }}
                        />
                      </div>

                      <div className="flex-grow-1 min-width-0">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                          <span className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fw-medium" style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                              {deviceName(anomaly.device)}
                            </span>
                            <span className={`severity-badge severity-${severity}`}>
                              {severity}
                            </span>
                            {!isResolved && (
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--accent-primary)',
                                  display: 'inline-block',
                                }}
                              />
                            )}
                          </span>
                          <div className="d-flex align-items-center gap-2 flex-shrink-0">
                            {resolvingId === anomaly._id ? (
                              <span className="spinner-border spinner-border-sm" style={{ color: 'var(--accent-primary)' }} />
                            ) : isResolved ? (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <i className="bi bi-check-circle-fill me-1" />
                                Resolved
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Click to resolve
                              </span>
                            )}
                          </div>
                        </div>

                        {anomaly.anomalyDetails && (
                          <p
                            className="mb-1"
                            style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}
                          >
                            {anomaly.anomalyDetails}
                          </p>
                        )}

                        <div
                          className="d-flex gap-3"
                          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                        >
                          <span>
                            <i className="bi bi-calendar3 me-1" />
                            {new Date(anomaly.targetDate).toLocaleDateString('en-KE', {
                              dateStyle: 'medium',
                            })}
                          </span>
                          <span>
                            <i className="bi bi-lightning-charge-fill me-1" />
                            {(anomaly.predictedValue * 1000).toFixed(0)}W avg
                          </span>
                          <span>
                            <i className="bi bi-shield-check me-1" />
                            {Math.round(anomaly.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}