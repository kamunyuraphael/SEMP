// pages/auth/Login.tsx
// Sign-in page. Matches the Figma reference layout — centred card,
// email/password fields, link to Register. Redirects to the page
// the user originally tried to visit (via ProtectedRoute state)
// or /dashboard by default.

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect back to the originally requested page after login,
  // falling back to the dashboard.
  const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Invalid email or password. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          {/* <div className="sidebar-brand-icon">
            <i className="bi bi-lightning-charge-fill" />
          </div>*/}
          <span className="sidebar-brand-name">
            SEMP
          </span>
        </div>

        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Monitor your energy, reduce your footprint.</p>

        {error && (
          <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '0.85rem' }}>
            <i className="bi bi-exclamation-circle-fill me-2" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="position-relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control pe-5"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="btn btn-link position-absolute top-50 end-0 translate-middle-y pe-3"
                style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="text-center mt-4 mb-0" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
  }
