// components/alerts/AlertToast.tsx
// Floating top-right toast notifications for real-time Socket.io alerts,
// matching the Figma reference popup. Mounted once at the AppLayout level
// so it appears above every page, not per-route.

import { useEffect, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { deviceService } from '../../services/api';
import type { AlertEventPayload, AlertType } from '../../types/index';

const AUTO_DISMISS_MS = 8000;
const MAX_VISIBLE = 3;

const TYPE_META: Record<AlertType, { icon: string; color: string; bg: string; label: string }> = {
  anomaly: {
    icon: 'bi-exclamation-circle-fill',
    color: 'var(--warning)',
    bg: 'rgba(var(--warning-rgb), 0.15)',
    label: 'Anomaly',
  },
  threshold: {
    icon: 'bi-graph-up-arrow',
    color: 'var(--accent-primary)',
    bg: 'rgba(var(--accent-primary-rgb), 0.15)',
    label: 'Threshold',
  },
  info: {
    icon: 'bi-info-circle-fill',
    color: 'var(--accent-amber)',
    bg: 'rgba(var(--accent-amber-rgb), 0.15)',
    label: 'Info',
  },
};

function ToastItem({
  alert,
  index,
  onDismiss,
}: {
  alert: AlertEventPayload;
  index: number;
  onDismiss: (index: number) => void;
}) {
  const [isToggling, setIsToggling] = useState(false);
  const [turnedOff, setTurnedOff] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(index), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const meta = TYPE_META[alert.type] || TYPE_META.info;

  const handleTurnOff = async () => {
    if (!alert.deviceId) return;
    setIsToggling(true);
    try {
      await deviceService.updateDeviceStatus(alert.deviceId, 'inactive');
      setTurnedOff(true);
    } catch {
      // Non-critical — the toast auto-dismisses either way; the
      // device can still be turned off from Notifications/Devices.
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className="d-flex align-items-start gap-3 p-3 mb-2"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${alert.type === 'anomaly' ? 'var(--warning)' : 'var(--bg-border)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        minWidth: 300,
        maxWidth: 360,
        animation: 'toast-slide-in 0.2s ease-out',
      }}
      role="alert"
    >
      <div
        className="d-flex align-items-center justify-content-center flex-shrink-0"
        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: meta.bg }}
      >
        <i className={`bi ${meta.icon}`} style={{ color: meta.color }} />
      </div>

      <div className="flex-grow-1 min-width-0">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <span className="fw-semibold" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {alert.device ? `${alert.device} — ${meta.label.toLowerCase()}` : meta.label}
          </span>
          <button
            type="button"
            className="btn-close btn-close-white"
            style={{ fontSize: '0.65rem', opacity: 0.6 }}
            onClick={() => onDismiss(index)}
            aria-label="Dismiss"
          />
        </div>
        <p className="mb-0 mt-1" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {alert.message}
        </p>

        {alert.type === 'anomaly' && alert.deviceId && (
          <div className="mt-2">
            {turnedOff ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
                <i className="bi bi-check-circle-fill me-1" />
                Turned off
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  backgroundColor: 'rgba(var(--warning-rgb), 0.12)',
                  color: 'var(--warning)',
                  border: '1px solid rgba(var(--warning-rgb), 0.3)',
                  fontSize: '0.72rem',
                  padding: '2px 10px',
                }}
                onClick={handleTurnOff}
                disabled={isToggling}
              >
                {isToggling ? (
                  <span className="spinner-border spinner-border-sm" style={{ width: 10, height: 10 }} />
                ) : (
                  <>
                    <i className="bi bi-power me-1" />
                    Turn off{alert.device ? ` ${alert.device}` : ' device'}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AlertToast() {
  const { liveAlerts, dismissAlert } = useSocket();

  const visible = liveAlerts.slice(0, MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div
      className="position-fixed"
      style={{ top: 16, right: 16, zIndex: 1080 }}
    >
      {visible.map((alert, i) => (
        <ToastItem key={`${alert.timestamp}-${i}`} alert={alert} index={i} onDismiss={dismissAlert} />
      ))}
    </div>
  );
}
