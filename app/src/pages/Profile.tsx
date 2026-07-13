// pages/Profile.tsx
// Displays the authenticated user's account details.
// Pulls from AuthContext so no additional API call is needed
// for the initial render — calls refreshProfile() on mount
// to ensure the data is fresh.

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function Profile() {
  const { user, isLoading, refreshProfile, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [showPasswords, setShowPasswords] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword) {
      setPasswordError('Fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err?.response?.data?.error || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  if (isLoading || !user) {
    return <LoadingSpinner fullPage label="Loading profile..." />;
  }

  const initials = user.username
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      <div className="mb-4">
        <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
          Profile
        </h5>
        <p className="mb-0" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Your account details
        </p>
      </div>

      <div className="row g-4">
        {/* ── Account Card ───────────────────────────────────── */}
        <div className="col-12 col-lg-6">
          <div className="chart-card">
            <div className="d-flex align-items-center gap-4 mb-4">
              {/* Avatar */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-amber))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div>
                <div
                  className="fw-bold"
                  style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}
                >
                  {user.username}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {user.email}
                </div>
                <span
                  className="badge mt-1"
                  style={{
                    backgroundColor: 'rgba(193,90,2,0.15)',
                    color: 'var(--accent-primary)',
                    textTransform: 'capitalize',
                  }}
                >
                  {user.role}
                </span>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--bg-border)',
                paddingTop: '1rem',
              }}
            >
              {[
                { label: 'Username', value: user.username, icon: 'bi-person-fill' },
                { label: 'Email', value: user.email, icon: 'bi-envelope-fill' },
                { label: 'Role', value: user.role, icon: 'bi-shield-fill' },
                { label: 'Devices', value: `${user.devices.length} registered`, icon: 'bi-cpu-fill' },
                { label: 'Member since', value: memberSince, icon: 'bi-calendar3' },
              ].map((row) => (
                <div
                  key={row.label}
                  className="d-flex justify-content-between align-items-center py-2"
                  style={{ borderBottom: '1px solid var(--bg-border)' }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <i
                      className={`bi ${row.icon}`}
                      style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', width: 16 }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {row.label}
                    </span>
                  </div>
                  <span
                    className="fw-medium text-capitalize"
                    style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Preferences & Actions ───────────────────────────── */}
        <div className="col-12 col-lg-6">
          <div className="chart-card mb-4">
            <div className="chart-title mb-3">Preferences</div>

            {/* Theme toggle */}
            <div
              className="d-flex justify-content-between align-items-center py-3"
              style={{ borderBottom: '1px solid var(--bg-border)' }}
            >
              <div className="d-flex align-items-center gap-3">
                <div className="stat-card-icon amber" style={{ width: 36, height: 36 }}>
                  <i className={`bi ${isDark ? 'bi-moon-fill' : 'bi-sun-fill'}`} />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Appearance
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isDark ? 'Dark mode active' : 'Light mode active'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={toggleTheme}
              >
                Switch to {isDark ? 'light' : 'dark'}
              </button>
            </div>

            {/* Timezone info */}
            <div
              className="d-flex justify-content-between align-items-center py-3"
            >
              <div className="d-flex align-items-center gap-3">
                <div className="stat-card-icon orange" style={{ width: 36, height: 36 }}>
                  <i className="bi bi-globe2" />
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Timezone
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Africa/Nairobi (EAT, UTC+3)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="chart-card mb-4">
            <div className="chart-title mb-3">Change Password</div>

            {passwordSuccess && (
              <div className="alert alert-success py-2 mb-3">
                <i className="bi bi-check-circle-fill me-2" />
                {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div className="alert alert-danger py-2 mb-3">
                <i className="bi bi-exclamation-circle-fill me-2" />
                {passwordError}
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Current password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                className="form-control"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">New password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Confirm new password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-sm border-0 bg-transparent mb-3 p-0 d-flex align-items-center gap-2"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setShowPasswords((v) => !v)}
            >
              <i className={`bi ${showPasswords ? 'bi-eye-slash' : 'bi-eye'}`} />
              {showPasswords ? 'Hide' : 'Show'} passwords
            </button>

            <button
              type="button"
              className="btn btn-primary w-100"
              onClick={handleChangePassword}
              disabled={isSavingPassword}
            >
              {isSavingPassword ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                'Update Password'
              )}
            </button>
          </div>

          {/* Danger Zone */}
          <div
            className="chart-card"
            style={{ border: '1px solid rgba(134,45,3,0.3)' }}
          >
            <div
              className="chart-title mb-3"
              style={{ color: 'var(--warning)' }}
            >
              <i className="bi bi-exclamation-triangle-fill me-2" />
              Account Actions
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Signing out will end your current session. Your data will remain
              intact and accessible on your next login.
            </p>

            <button
              type="button"
              className="btn w-100"
              style={{
                backgroundColor: 'rgba(134,45,3,0.1)',
                color: 'var(--warning)',
                border: '1px solid rgba(134,45,3,0.3)',
              }}
              onClick={logout}
            >
              <i className="bi bi-box-arrow-right me-2" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}