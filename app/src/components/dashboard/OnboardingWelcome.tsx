// components/dashboard/OnboardingWelcome.tsx
// Shown on the Dashboard when a new account has no devices yet —
// replaces what would otherwise be a wall of empty stat cards and
// charts with a guided first step instead.

import { Link } from 'react-router-dom';

const STEPS = [
  {
    icon: 'bi-plus-circle-fill',
    title: 'Add a device',
    description: 'Tell SEMP what you want to track - a fridge, AC unit, lights, whatever draws power.',
  },
  {
    icon: 'bi-graph-up',
    title: 'Watch usage come in',
    description: 'Readings start appearing on your dashboard automatically, no extra setup needed.',
  },
  {
    icon: 'bi-lightbulb-fill',
    title: 'Get insights',
    description: 'Spot anomalies, forecast your bill, and set a budget once there is data to work with.',
  },
];

export default function OnboardingWelcome() {
  return (
    <div className="chart-card text-center" style={{ padding: '3rem 2rem' }}>
      <div
        className="d-inline-flex align-items-center justify-content-center mb-3"
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: 'rgba(var(--accent-primary-rgb), 0.12)',
        }}
      >
        <i className="bi bi-lightning-charge-fill" style={{ fontSize: '1.75rem', color: 'var(--accent-primary)' }} />
      </div>

      <h4 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Welcome to SEMP</h4>
      <p className="mx-auto mb-4" style={{ maxWidth: 420, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        You don't have any devices yet, add your first one to start seeing your energy usage,
        trends, and forecasts here.
      </p>

      <div className="row g-3 justify-content-center mb-4" style={{ maxWidth: 720, marginInline: 'auto' }}>
        {STEPS.map((step, i) => (
          <div key={step.title} className="col-12 col-md-4">
            <div
              className="h-100 p-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'left',
              }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <span
                  className="d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <i className={`bi ${step.icon}`} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {step.title}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {step.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Link to="/devices" className="btn btn-primary">
        <i className="bi bi-plus-lg me-2" />
        Add your first device
      </Link>
    </div>
  );
}
