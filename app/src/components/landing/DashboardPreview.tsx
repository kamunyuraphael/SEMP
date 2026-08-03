// components/landing/DashboardPreview.tsx
// Static "product screenshot" mockup for the landing hero — replaces the
// abstract house illustration with an actual (illustrative, non-live)
// glimpse of the dashboard: stat tiles, a usage trend, and an anomaly
// alert with its one-click action. Numbers are hardcoded for display
// only, not fetched from the API.

const BAR_HEIGHTS = [30, 45, 38, 62, 50, 70, 58, 40, 66, 52, 74, 60];

export function DashboardPreview() {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        padding: '1.25rem',
        width: '100%',
        maxWidth: 420,
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-3">
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Dashboard
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            color: 'var(--accent-primary)',
            backgroundColor: 'rgba(var(--accent-primary-rgb), 0.12)',
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          Today
        </span>
      </div>

      <div className="d-flex gap-2 mb-3">
        {[
          { label: 'USAGE TODAY', value: '12.4', unit: 'kWh' },
          { label: 'PEAK DRAW', value: '1136', unit: 'W' },
          { label: 'ALERTS', value: '1', unit: '' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-main)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.6rem 0.5rem',
            }}
          >
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {s.value}
              {s.unit && <span style={{ fontSize: '0.65rem', fontWeight: 600, marginLeft: 2 }}>{s.unit}</span>}
            </div>
            <div style={{ fontSize: '0.55rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          backgroundColor: 'var(--bg-main)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.6rem 0.6rem 0.4rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
          Usage trend
        </div>
        <svg viewBox="0 0 240 48" width="100%" height="48" aria-hidden="true">
          {BAR_HEIGHTS.map((h, i) => (
            <rect
              key={i}
              x={i * 20 + 2}
              y={48 - h * 0.6}
              width={12}
              height={h * 0.6}
              rx={2}
              fill="var(--accent-primary)"
              opacity={i === BAR_HEIGHTS.length - 3 ? 1 : 0.35}
            />
          ))}
        </svg>
      </div>

      <div
        className="d-flex align-items-center gap-2"
        style={{
          backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
          border: '1px solid rgba(var(--warning-rgb), 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.5rem 0.6rem',
        }}
      >
        <i className="bi bi-exclamation-triangle-fill" style={{ color: 'var(--warning)', fontSize: '0.85rem' }} />
        <div style={{ flex: 1, fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          Home Office Desktop — unusual draw
        </div>
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            color: 'var(--warning)',
            border: '1px solid var(--warning)',
            borderRadius: 999,
            padding: '2px 8px',
          }}
        >
          Turn off
        </span>
      </div>
    </div>
  );
}
