// components/layout/Navbar.tsx
// Fixed top navbar. Shows the current page title, theme toggle,
// notification bell with live unread count, and a user avatar
// dropdown for quick access to profile/logout.

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';

interface NavbarProps {
  onMenuClick: () => void;
  notificationCount?: number;
}

// Maps route paths to display titles shown in the navbar
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/devices': 'Devices',
  '/telemetry': 'Telemetry',
  '/predictions': 'Predictions',
  '/anomalies': 'Anomalies',
  '/export': 'Export Data',
  '/notifications': 'Notifications',
  '/profile': 'Profile',
};

export default function Navbar({ onMenuClick, notificationCount = 0 }: NavbarProps) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = PAGE_TITLES[location.pathname] || 'SEMP';

  // Close dropdown when clicking outside it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.username
    ? user.username
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  const handleLogout = () => {
    setShowDropdown(false);
    logout();
  };

  return (
    <header className="top-navbar">
      <div className="d-flex align-items-center gap-3">
        {/* Mobile menu toggle — hidden on desktop via CSS */}
        <button
          type="button"
          className="navbar-icon-btn d-md-none"
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <i className="bi bi-list fs-5" />
        </button>

        <span className="navbar-page-title">{pageTitle}</span>

        {/* Socket connection indicator — subtle, only shown when disconnected */}
        {!isConnected && (
          <span
            className="badge rounded-pill"
            style={{
              backgroundColor: 'rgba(134, 45, 3, 0.15)',
              color: 'var(--warning)',
              fontSize: '0.65rem',
              fontWeight: 600,
            }}
            title="Real-time alerts disconnected — reconnecting..."
          >
            <i className="bi bi-wifi-off me-1" />
            Offline
          </span>
        )}
      </div>

      <div className="navbar-actions">
        {/* Theme Toggle */}
        <button
          type="button"
          className="navbar-icon-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-fill'}`} />
        </button>

        {/* Notifications Bell */}
        <button
          type="button"
          className="navbar-icon-btn"
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
        >
          <i className="bi bi-bell-fill" />
          {notificationCount > 0 && <span className="notification-dot" />}
        </button>

        {/* User Avatar + Dropdown */}
        <div className="position-relative" ref={dropdownRef}>
          <button
            type="button"
            className="navbar-avatar"
            onClick={() => setShowDropdown((s) => !s)}
            aria-label="User menu"
          >
            {initials}
          </button>

          {showDropdown && (
            <div
              className="dropdown-menu show position-absolute end-0 mt-2"
              style={{ minWidth: '200px' }}
            >
              <div className="px-3 py-2">
                <div className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                  {user?.username}
                </div>
                <div
                  className="text-truncate"
                  style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                >
                  {user?.email}
                </div>
              </div>
              <hr className="dropdown-divider" style={{ borderColor: 'var(--bg-border)' }} />
              <button
                className="dropdown-item"
                onClick={() => {
                  setShowDropdown(false);
                  navigate('/profile');
                }}
              >
                <i className="bi bi-person-fill me-2" />
                Profile
              </button>
              <button className="dropdown-item text-danger" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right me-2" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
        }
