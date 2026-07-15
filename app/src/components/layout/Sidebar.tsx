// components/layout/Sidebar.tsx
// Fixed left navigation sidebar. Highlights the active route, shows
// live badge counts (e.g. unread anomalies), and exposes a collapse
// toggle for smaller viewports.

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { NavItem } from '../../types/index';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  anomalyCount?: number;
  notificationCount?: number;
}

// Primary navigation — matches the Figma reference structure
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill' },
  { label: 'Devices', path: '/devices', icon: 'bi-cpu-fill' },
  { label: 'Telemetry', path: '/telemetry', icon: 'bi-activity' },
  { label: 'Predictions', path: '/predictions', icon: 'bi-graph-up-arrow' },
  { label: 'Anomalies', path: '/anomalies', icon: 'bi-exclamation-triangle-fill' },
  { label: 'Export', path: '/export', icon: 'bi-download' },
];

export default function Sidebar({
  isOpen,
  onClose,
  anomalyCount = 0,
  notificationCount = 0,
}: SidebarProps) {
  const { logout } = useAuth();

  const handleNavClick = () => {
    // Auto-close sidebar on mobile after navigating
    if (window.innerWidth <= 768) {
      onClose();
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand */}
      <NavLink to="/dashboard" className="sidebar-brand">
        <div className="sidebar-brand-icon">
          {/*<i className="bi bi-lightning-charge-fill" />*/}
        </div>
        <span className="sidebar-brand-name">
          SEMP
        </span>
      </NavLink>

      {/* Primary Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const badge = item.path === '/anomalies' ? anomalyCount : undefined;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <i className={`bi ${item.icon} sidebar-nav-icon`} />
              <span>{item.label}</span>
              {!!badge && <span className="sidebar-badge">{badge}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer — Notifications, Profile, Sign out */}
      <div className="sidebar-footer">
        <NavLink
          to="/notifications"
          onClick={handleNavClick}
          className={({ isActive }) =>
            `sidebar-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <i className="bi bi-bell-fill sidebar-nav-icon" />
          <span>Notifications</span>
          {!!notificationCount && (
            <span className="sidebar-badge">{notificationCount}</span>
          )}
        </NavLink>

        <NavLink
          to="/profile"
          onClick={handleNavClick}
          className={({ isActive }) =>
            `sidebar-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <i className="bi bi-person-fill sidebar-nav-icon" />
          <span>Profile</span>
        </NavLink>

        <button
          type="button"
          className="sidebar-nav-item w-100 border-0 bg-transparent text-start"
          onClick={logout}
        >
          <i className="bi bi-box-arrow-right sidebar-nav-icon" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
