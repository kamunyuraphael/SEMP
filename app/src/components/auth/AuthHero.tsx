// components/auth/AuthHero.tsx
// Left-side hero panel for the split-screen auth layout (Login/Register).
// Borrows the *composition* of a stock "Welcome" sign-in template — a
// hero panel next to the form, with a tagline and soft decorative
// shapes — but reskinned entirely in SEMP's own palette instead of the
// template's purple/gradient look, and with an energy-themed visual
// (a soft line-chart squiggle) instead of generic abstract shapes.

type AuthHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export function AuthHero({ eyebrow, title, subtitle }: AuthHeroProps) {
  return (
    <div className="auth-hero">
      {/* Decorative background — a line-art house with an energy pulse
          running through it, plus a few "sensor" nodes along the
          roofline. Still flat vector/line-art (no photography, no
          gradients) to match the rest of the app's data-viz visual
          language, but more literally "SEMP" than plain abstract shapes. */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Soft atmosphere */}
        <circle cx="520" cy="120" r="180" fill="rgba(255,255,255,0.05)" />
        <circle cx="60" cy="640" r="110" fill="rgba(255,255,255,0.04)" />

        {/* House outline */}
        <g fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {/* Roof */}
          <path d="M 330 470 L 475 360 L 620 470" />
          {/* Walls */}
          <path d="M 360 470 L 360 660 L 590 660 L 590 470" />
          {/* Door */}
          <path d="M 445 660 L 445 555 L 505 555 L 505 660" />
          {/* Window */}
          <rect x="405" y="500" width="50" height="50" rx="2" />
          <path d="M 405 525 L 455 525 M 430 500 L 430 550" />
          {/* Chimney */}
          <path d="M 540 420 L 540 380 L 570 380 L 570 445" />
        </g>

        {/* Energy pulse — runs through the house like a live power trace */}
        <path
          d="M -20 560 L 250 560 L 300 500 L 340 610 L 380 470 L 430 560 L 660 560"
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M -20 560 L 250 560 L 300 500 L 340 610 L 380 470 L 430 560 L 660 560"
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1 13"
        />

        {/* Sensor nodes */}
        <circle cx="475" cy="360" r="5" fill="rgba(255,255,255,0.55)" />
        <circle cx="340" cy="610" r="4" fill="rgba(255,255,255,0.55)" />
        <circle cx="590" cy="470" r="4" fill="rgba(255,255,255,0.4)" />
      </svg>

      <div className="auth-hero-content">
        <span className="auth-hero-eyebrow">
          {eyebrow}
        </span>
        <h1 className="auth-hero-title">{title}</h1>
        <p className="auth-hero-subtitle">{subtitle}</p>

        <div className="auth-hero-stat-row">
          <div>
            <div className="auth-hero-stat-value">6</div>
            <div className="auth-hero-stat-label">Categories tracked</div>
          </div>
          <div>
            <div className="auth-hero-stat-value">24/7</div>
            <div className="auth-hero-stat-label">Live monitoring</div>
          </div>
          <div>
            <div className="auth-hero-stat-value">EAT</div>
            <div className="auth-hero-stat-label">Nairobi</div>
          </div>
        </div>
      </div>
    </div>
  );
}
