// components/layout/AppLayout.tsx
// Combines Sidebar + Navbar + the routed page content (via Outlet).
// Fetches live counts (unread alerts, anomalies) once at the layout
// level so both Sidebar and Navbar can display badges without each
// making their own redundant API calls.

import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AlertToast from '../alerts/AlertToast';
import { alertService, predictionService } from '../../services/api';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anomalyCount, setAnomalyCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    try {
      const [alertsRes, predictionsRes] = await Promise.all([
        alertService.getAlerts(),
        predictionService.getPredictions('anomaly'),
      ]);

      const unread = alertsRes.data.filter((a) => !a.read).length;
      setUnreadCount(unread);
      setAnomalyCount(predictionsRes.data.length);
    } catch {
      // Silently ignore — badges just won't update this cycle.
      // Individual pages still fetch their own full data and will
      // surface any real errors there.
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    // Refresh badge counts every 60s so they stay reasonably current
    // without hammering the API on every render.
    const interval = setInterval(fetchCounts, 60_000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return (
    <div className="app-shell">
      <AlertToast />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        anomalyCount={anomalyCount}
        notificationCount={unreadCount}
      />

      {/* Mobile backdrop — closes sidebar when tapped outside */}
      {sidebarOpen && (
        <div
          className="d-md-none position-fixed top-0 start-0 w-100 h-100"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="main-content">
        <Navbar
          onMenuClick={() => setSidebarOpen((s) => !s)}
          notificationCount={unreadCount}
        />

        <div className="page-wrapper">
          <Outlet context={{ refreshCounts: fetchCounts }} />
        </div>
      </div>
    </div>
  );
}