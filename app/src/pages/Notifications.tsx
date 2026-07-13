// pages/Notifications.tsx
// Persistent alert history pulled from /api/alerts.
// Shows all alert types (anomaly, threshold, info) with read/unread state.

import { useState, useEffect, useCallback } from 'react';
import { alertService } from '../services/api';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Alert, AlertType } from '../types/index';

type AlertFilter = AlertType | 'all' | 'unread';

const FILTER_OPTIONS: { value: AlertFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'anomaly', label: 'Anomaly' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'info', label: 'Info' },
];

const ALERT_ICON: Record<AlertType, string> = {
  anomaly: 'bi-exclamation-triangle-fill',
  threshold: 'bi-speedometer2',
  info: 'bi-info-circle-fill',
};

const ALERT_COLOR: Record<AlertType, string> = {
  anomaly: '#862D03',
  threshold: '#C15A02',
  info: '#E8A221',
};

export default function Notifications() {
  const { liveAlerts } = useSocket();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await alertService.getAlerts();
      setAlerts(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, read: true } : a)));
    try {
      await alertService.markAsRead(id);
    } catch (err: any) {
      setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, read: false } : a)));
      setError(err?.response?.data?.error || 'Failed to mark as read.');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    const previous = alerts;
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    try {
      await alertService.markAllAsRead();
    } catch (err: any) {
      setAlerts(previous);
      setError(err?.response?.data?.error || 'Failed to mark all as read.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const filtered = alerts.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !a.read;
    return a.type === filter;
  });

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
            Notifications
          </h5>
          <p className="mb-0" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>

        <div className="d-flex align-items-center gap-3 flex-wrap">
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-sm d-flex align-items-center gap-2"
              style={{ color: 'var(--accent-primary)', background: 'transparent', border: 'none' }}
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
            >
              {isMarkingAll ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-check2-all" />
              )}
              Mark all read
            </button>
          )}

          <div className="btn-group flex-wrap" role="group">
            {FILTER_OPTIONS.map((opt) => (
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
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      )}

      {/* ── Live alerts from Socket.io ───────────────────────── */}
      {liveAlerts.length > 0 && (
        <div className="chart-card mb-4" style={{ border: '1px solid var(--accent-amber)' }}>
          <div className="chart-title mb-3 d-flex align-items-center gap-2">
            <span className="live-dot" />
            <span style={{ color: 'var(--accent-amber)' }}>
              {liveAlerts.length} new real-time alert{liveAlerts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="d-flex flex-column gap-2">
            {liveAlerts.slice(0, 5).map((alert, i) => (
              <div
                key={i}
                className="p-2 rounded d-flex align-items-start gap-3"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              >
                <i
                  className={`bi ${ALERT_ICON[alert.type]} mt-1`}
                  style={{ color: ALERT_COLOR[alert.type], fontSize: '0.9rem' }}
                />
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {alert.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(alert.timestamp).toLocaleTimeString('en-KE')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner fullPage label="Loading notifications..." />
      ) : (
        <div className="chart-card">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <i className="bi bi-bell-slash" />
              </div>
              <div className="empty-state-title">No notifications</div>
              <p>
                {filter === 'unread'
                  ? 'You have no unread notifications.'
                  : 'No notifications match this filter.'}
              </p>
            </div>
          ) : (
            <div className="d-flex flex-column">
              {filtered.map((alert, i) => (
                <div
                  key={alert._id}
                  className="d-flex align-items-start gap-3 py-3"
                  style={{
                    borderBottom:
                      i < filtered.length - 1
                        ? '1px solid var(--bg-border)'
                        : 'none',
                    opacity: alert.read ? 0.65 : 1,
                    cursor: alert.read ? 'default' : 'pointer',
                  }}
                  onClick={() => !alert.read && markingId !== alert._id && handleMarkRead(alert._id)}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      backgroundColor:
                        alert.type === 'anomaly'
                          ? 'rgba(134,45,3,0.15)'
                          : alert.type === 'threshold'
                          ? 'rgba(193,90,2,0.15)'
                          : 'rgba(232,162,33,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <i
                      className={`bi ${ALERT_ICON[alert.type]}`}
                      style={{ color: ALERT_COLOR[alert.type], fontSize: '0.9rem' }}
                    />
                  </div>

                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <span
                        className="fw-medium"
                        style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}
                      >
                        {alert.message}
                      </span>
                      {markingId === alert._id ? (
                        <span className="spinner-border spinner-border-sm flex-shrink-0" style={{ color: 'var(--accent-primary)', width: 12, height: 12 }} />
                      ) : !alert.read && (
                        <span
                          className="flex-shrink-0"
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-amber)',
                            marginTop: 6,
                          }}
                        />
                      )}
                    </div>
                    <div
                      className="d-flex gap-3 mt-1"
                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                    >
                      <span>
                        <i className="bi bi-clock me-1" />
                        {new Date(alert.timestamp).toLocaleString('en-KE', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      <span className="text-capitalize">{alert.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}