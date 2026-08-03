// pages/Landing.tsx
// Public marketing page shown to unauthenticated visitors who land on
// the bare domain — previously "/" redirected straight to the login
// screen with no context on what SEMP actually does. Extends the same
// visual language as AuthHero (house + energy-pulse illustration,
// forest-green identity) rather than introducing a separate look.

import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardPreview } from '../components/landing/DashboardPreview';

const FEATURES = [
  {
    icon: 'bi-graph-up',
    title: 'Track usage in real time',
    description: 'See live power draw and daily/weekly/monthly trends across every device you register.',
  },
  {
    icon: 'bi-pie-chart-fill',
    title: 'Understand where it goes',
    description: 'A category breakdown shows exactly which appliances are driving your bill.',
  },
  {
    icon: 'bi-exclamation-triangle-fill',
    title: 'Catch anomalies early',
    description: "Get alerted when a device's usage looks unusual, with a one-click way to turn it off.",
  },
  {
    icon: 'bi-cash-stack',
    title: 'Forecast your bill',
    description: 'Tariff-aware predictions and a monthly budget so surprises stop being surprises.',
  },
];

export default function Landing() {
  const { user, isLoading } = useAuth();

  // Skip the marketing page entirely for anyone already signed in.
  if (!isLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      {/* Nav */}
      <div className="d-flex align-items-center justify-content-between px-4 py-3" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="d-flex align-items-center gap-2">
          <span className="fw-bold" style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>SEMP</span>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Link to="/login" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textDecoration: 'none' }}>
            Sign in
          </Link>
          <Link to="/register" className="btn btn-sm btn-outline-primary">Get started</Link>
        </div>
      </div>

      {/* Hero */}
      <div
        className="position-relative overflow-hidden"
        style={{ backgroundColor: 'var(--accent-secondary)', color: '#ffffff', marginTop: '1rem' }}
      >
        <svg
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 1200 500"
          preserveAspectRatio="xMidYMid slice"
        >
          <circle cx="1050" cy="80" r="220" fill="rgba(255,255,255,0.05)" />
          <circle cx="120" cy="420" r="160" fill="rgba(255,255,255,0.04)" />
        </svg>

        <div
          className="position-relative px-4 py-5 d-flex flex-column flex-lg-row align-items-lg-center gap-4"
          style={{ maxWidth: 1100, margin: '0 auto' }}
        >
          <div style={{ maxWidth: 560, flex: 1 }}>
            <h1 className="fw-bold mb-3" style={{ fontSize: '2.75rem', lineHeight: 1.1 }}>
              Know where your power goes.
            </h1>
            <p className="mb-4" style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.85)' }}>
              SEMP monitors your home's energy usage device by device, flags unusual consumption before it
              costs you, and forecasts your next bill so you're never guessing.
            </p>
            <div className="d-flex gap-3">
              <Link to="/register" className="btn btn-lg" style={{ backgroundColor: '#ffffff', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                Create free account
              </Link>
              <Link to="/login" className="btn btn-lg btn-outline-light">
                Sign in
              </Link>
            </div>
          </div>
          <div className="d-flex justify-content-center justify-content-lg-end" style={{ flex: 1, minWidth: 0 }}>
            <DashboardPreview />
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-4 py-5" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 className="text-center mb-2" style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700 }}>
          Everything you need to cut your energy bill
        </h2>
        <p className="text-center mb-5" style={{ color: 'var(--text-muted)' }}>
          Built for households that want real visibility, not just a monthly total.
        </p>

        <div className="row g-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="col-12 col-sm-6 col-lg-3">
              <div className="chart-card h-100">
                <div
                  className="d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(var(--accent-primary-rgb), 0.12)',
                  }}
                >
                  <i className={`bi ${f.icon}`} style={{ color: 'var(--accent-primary)', fontSize: '1.2rem' }} />
                </div>
                <div className="fw-semibold mb-2" style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  {f.title}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {f.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA band */}
      <div className="px-4 py-5 text-center" style={{ borderTop: '1px solid var(--bg-border)' }}>
        <h3 className="mb-3" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
          Ready to see where your power goes?
        </h3>
        <Link to="/register" className="btn btn-outline-primary btn-lg">
          Start monitoring your energy today
        </Link>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 text-center" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        SEMP - Smart Energy Monitoring and Prediction
      </div>
    </div>
  );
}
